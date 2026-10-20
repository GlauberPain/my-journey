import { BaseScheduleStrategy } from './BaseScheduleStrategy.ts';
import type {
  RawDayPunch,
  EmployeeWorkContract,
  DailyPunchCalculation,
  WorkScheduleMetadata,
  WorkSchedulePeriodSummary,
  WorkScheduleType,
} from '../types.ts';

/**
 * Estratégia para Regime de Trabalho em Tempo Parcial (Art. 58-A da CLT)
 *
 * Duas modalidades legais (Redação dada pela Lei 13.467/2017):
 * 1. PART_TIME_30H: Até 30 horas semanais, VEDADA a prestação de horas extras (Art. 58-A, caput).
 * 2. PART_TIME_26H: Até 26 horas semanais, permitidas até 6 horas suplementares semanais (Art. 58-A, § 3º).
 */
export class PartTimeStrategy extends BaseScheduleStrategy {
  readonly type: WorkScheduleType;
  readonly isMax30HoursNoOvertime: boolean;

  constructor(variant: 'PART_TIME_30H' | 'PART_TIME_26H' = 'PART_TIME_30H') {
    super();
    this.type = variant;
    this.isMax30HoursNoOvertime = variant === 'PART_TIME_30H';
  }

  getEffectiveWeeklyLimit(_targetDate: string, contract?: EmployeeWorkContract): number {
    if (contract?.weeklyContractHours && contract.weeklyContractHours > 0) {
      return contract.weeklyContractHours;
    }
    return this.isMax30HoursNoOvertime ? 30 : 26;
  }

  getMonthlyDivisor(targetDate: string, contract?: EmployeeWorkContract): number {
    if (contract?.customDivisor && contract.customDivisor > 0) {
      return contract.customDivisor;
    }
    const weeklyHours = this.getEffectiveWeeklyLimit(targetDate, contract);
    // Fórmula padrão trabalhista: Carga semanal * 5
    return Math.round(weeklyHours * 5); // 30h -> 150 | 26h -> 130
  }

  getMetadata(targetDate?: string): WorkScheduleMetadata {
    const date = targetDate || new Date().toISOString().slice(0, 10);
    const limit = this.getEffectiveWeeklyLimit(date);
    const divisor = this.getMonthlyDivisor(date);

    return {
      type: this.type,
      title: `Regime de Tempo Parcial (${limit}h)`,
      legalBasis: 'Art. 58-A da CLT (com alterações da Reforma Trabalhista, Lei 13.467/2017).',
      standardDailyHours: limit === 30 ? 6.0 : 5.2,
      standardWeeklyHours: limit,
      monthlyDivisor: divisor,
      overtimeEligible: !this.isMax30HoursNoOvertime,
      nightBonusEligible: true,
      toleranceApplicable: true,
      description: this.isMax30HoursNoOvertime
        ? 'Jornada em tempo parcial de até 30 horas semanais. Por expressa disposição legal (Art. 58-A), é VEDADA a realização de qualquer hora extra.'
        : 'Jornada em tempo parcial de até 26 horas semanais. A CLT permite o acréscimo de até 6 horas extras semanais pagas com adicional de 50%.',
      legalPeculiarities: this.isMax30HoursNoOvertime
        ? [
            'Proibição absoluta de horas extras (Art. 58-A, caput da CLT).',
            'O descumprimento gera risco de descaracterização do regime de tempo parcial.',
            'Divisor mensal proporcional 150.',
          ]
        : [
            'Limite semanal rígido de no máximo 6 horas extras (Art. 58-A, § 3º da CLT).',
            'Extrapolação além de 6h extras desvirtua o contrato de tempo parcial.',
            'Divisor mensal proporcional 130.',
          ],
    };
  }

  calculateDailyPunch(punch: RawDayPunch, contract?: EmployeeWorkContract): DailyPunchCalculation {
    const weeklyLimit = this.getEffectiveWeeklyLimit(punch.date, contract);
    // Para 5 dias na semana: 30h/5 = 6h (360 min) | 26h/5 = 5.2h (312 min)
    const expectedDailyMinutes = weeklyLimit === 30 ? 6 * 60 : Math.round(5.2 * 60);
    const warnings: string[] = [];

    const {
      nightData,
      effectiveWorkedMinutes,
      dailyOvertimeMinutes,
      dailyDeficitMinutes,
      hasInsufficientInterval,
    } = this.computeBasicDay(punch, expectedDailyMinutes, contract);

    // Validação rígida das regras do Art. 58-A da CLT
    if (this.isMax30HoursNoOvertime && dailyOvertimeMinutes > 0) {
      warnings.push(
        `INFRAÇÃO LEGAL (Art. 58-A da CLT): No regime de tempo parcial de 30 horas é PROIBIDA a realização de horas extras. Foram realizadas ${Math.round(dailyOvertimeMinutes / 60 * 10) / 10}h extras.`
      );
    }

    if (!this.isMax30HoursNoOvertime && dailyOvertimeMinutes > 2 * 60) {
      warnings.push(
        `Prestação diária de horas extras superior a 2 horas no regime de 26h (Art. 58-A, § 3º e Art. 59 CLT).`
      );
    }

    const dailyBalanceMinutes = effectiveWorkedMinutes - (punch.dayType === 'off' || punch.dayType === 'dsr' ? 0 : expectedDailyMinutes);

    return {
      date: punch.date,
      scheduleType: this.type,
      grossWorkedMinutes: nightData.grossMinutes,
      breakMinutes: nightData.breakMinutes,
      netClockWorkedMinutes: nightData.netClockMinutes,
      daytimeWorkedMinutes: nightData.daytimeMinutes,
      nighttimeClockMinutes: nightData.nightClockMinutes,
      nighttimeFictitiousMinutes: nightData.nightFictitiousMinutes,
      nighttimeBonusMinutes: nightData.nightBonusMinutes,
      nighttimeExtendedMinutes: nightData.extendedNightMinutes,
      effectiveWorkedMinutes,
      expectedDailyMinutes: punch.dayType === 'work' ? expectedDailyMinutes : 0,
      dailyOvertimeMinutes,
      dailyDeficitMinutes,
      dailyBalanceMinutes,
      isHolidayWork: Boolean(punch.isHoliday && punch.workedOnHoliday),
      hasInsufficientInterval,
      isArt58ToleranceApplied: false,
      legalWarnings: warnings,
    };
  }

  /**
   * Sobrescreve o cálculo de período para auditar a regra semanal do Art. 58-A, § 3º da CLT
   */
  override calculatePeriod(
    punches: RawDayPunch[],
    contract?: EmployeeWorkContract
  ): WorkSchedulePeriodSummary {
    const summary = super.calculatePeriod(punches, contract);

    const totalOvertimeHours = (summary.totalOvertimeMinutesWeekday + summary.totalOvertimeMinutesWeekend) / 60;

    if (this.isMax30HoursNoOvertime && totalOvertimeHours > 0) {
      const msg = `INFRAÇÃO AO ART. 58-A CLT: Regime parcial de 30h veda horas extras, mas houve prestação de ${totalOvertimeHours.toFixed(1)}h no período.`;
      if (!summary.legalInfractions.includes(msg)) {
        summary.legalInfractions.push(msg);
      }
    }

    if (!this.isMax30HoursNoOvertime && totalOvertimeHours > 6) {
      const msg = `EXTRAPOLAÇÃO LEGAL (Art. 58-A, § 3º CLT): O regime de 26h permite no máximo 6h extras semanais. Foram apuradas ${totalOvertimeHours.toFixed(1)}h extras.`;
      if (!summary.legalInfractions.includes(msg)) {
        summary.legalInfractions.push(msg);
      }
    }

    return summary;
  }
}
