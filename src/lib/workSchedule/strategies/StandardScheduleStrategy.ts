import { BaseScheduleStrategy } from './BaseScheduleStrategy.ts';
import type {
  RawDayPunch,
  EmployeeWorkContract,
  DailyPunchCalculation,
  WorkScheduleMetadata,
  WorkScheduleType,
} from '../types.ts';
import { getLegalWeeklyLimit, getSalaryDivisor, getTransitionPhase } from '../../legalTransition.ts';
import { evaluateArt58Tolerance } from '../tolerance.ts';

/**
 * Estratégia para Jornada Padrão Semanal (CLT / CF/88 e PEC 221/2019)
 *
 * Suporta o versionamento por fases:
 * - Legado (44h semanais, divisor 220, 8h/dia padrão ou 8h48 compensado 5x2)
 * - Fase 1 (42h semanais, divisor 210 a partir de 16/12/2026)
 * - Fase 2 (40h semanais, divisor 200 a partir de 16/12/2027)
 */
export class StandardScheduleStrategy extends BaseScheduleStrategy {
  readonly type: WorkScheduleType;

  constructor(variant: 'STANDARD' | 'STANDARD_44H' | 'STANDARD_42H' | 'STANDARD_40H' = 'STANDARD') {
    super();
    this.type = variant;
  }

  getEffectiveWeeklyLimit(targetDate: string, contract?: EmployeeWorkContract): number {
    if (contract?.weeklyContractHours && contract.weeklyContractHours > 0) {
      return contract.weeklyContractHours;
    }

    if (this.type === 'STANDARD_44H') return 44;
    if (this.type === 'STANDARD_42H') return 42;
    if (this.type === 'STANDARD_40H') return 40;

    // Dinâmico com base na data da vigência legal
    return getLegalWeeklyLimit(targetDate);
  }

  getMonthlyDivisor(targetDate: string, contract?: EmployeeWorkContract): number {
    if (contract?.customDivisor && contract.customDivisor > 0) {
      return contract.customDivisor;
    }
    const weeklyHours = this.getEffectiveWeeklyLimit(targetDate, contract);
    return getSalaryDivisor(weeklyHours);
  }

  getMetadata(targetDate?: string): WorkScheduleMetadata {
    const date = targetDate || new Date().toISOString().slice(0, 10);
    const limit = this.getEffectiveWeeklyLimit(date);
    const divisor = this.getMonthlyDivisor(date);
    const phase = getTransitionPhase(date);

    return {
      type: this.type,
      title: `Jornada Padrão Semanal (${limit}h)`,
      legalBasis:
        'Art. 7º, XIII da Constituição Federal, Art. 58 e 59 da CLT e Emenda Constitucional da jornada de trabalho (PEC 221/2019).',
      standardDailyHours: limit === 44 ? 8.8 : limit === 42 ? 8.4 : 8.0,
      standardWeeklyHours: limit,
      monthlyDivisor: divisor,
      overtimeEligible: true,
      nightBonusEligible: true,
      toleranceApplicable: true,
      description:
        `Jornada padrão sob o teto legal de ${limit}h semanais (Fase Vigente: ${phase}, divisor ${divisor}). Horas que ultrapassarem o limite diário ou semanal geram adicional extraordinário de no mínimo 50%.`,
      legalPeculiarities: [
        'Tolerância legal de 5 minutos por marcação e máximo de 10 minutos diários (Art. 58, § 1º da CLT e Súmula 366 TST).',
        'Possibilidade de compensação semanal em regime 5x2 (ex: 8h48min de seg a sex na fase de 44h).',
        'Garantia constitucional estrita da irredutibilidade salarial (Art. 7º, VI da CF/88).',
      ],
    };
  }

  calculateDailyPunch(punch: RawDayPunch, contract?: EmployeeWorkContract): DailyPunchCalculation {
    const weeklyLimit = this.getEffectiveWeeklyLimit(punch.date, contract);
    // Carga diária esperada padrão: 8h para 40h/sem, 8h48 (528 min) para 44h 5x2, 8h24 (504 min) para 42h
    const expectedDailyMinutes = weeklyLimit === 44 ? 528 : weeklyLimit === 42 ? 504 : 480;

    const warnings: string[] = [];
    let isArt58ToleranceApplied = false;

    // Avaliação da tolerância do Art. 58 § 1º da CLT se horários informados
    let punchToUse = punch;
    if (contract?.applyToleranceArt58 !== false && punch.startTime && punch.endTime) {
      // Exemplo contratual esperado de turno padrão
      const toleranceEval = evaluateArt58Tolerance({
        start: { actual: punch.startTime, scheduled: punch.startTime },
        end: { actual: punch.endTime, scheduled: punch.endTime },
      });

      if (toleranceEval.isWithinTolerance && toleranceEval.totalVariationMinutes > 0) {
        isArt58ToleranceApplied = true;
      }
    }

    const {
      nightData,
      effectiveWorkedMinutes,
      dailyOvertimeMinutes,
      dailyDeficitMinutes,
      hasInsufficientInterval,
    } = this.computeBasicDay(punchToUse, expectedDailyMinutes, contract);

    if (hasInsufficientInterval) {
      warnings.push(
        'Intervalo intrajornada inferior a 1 hora em turno superior a 6 horas (Art. 71, § 4º da CLT). Exige indenização com adicional de 50%.'
      );
    }

    // Alerta de excesso diário além do limite legal de 2 horas extras (Art. 59 CLT)
    if (dailyOvertimeMinutes > 2 * 60) {
      warnings.push(
        `Prestação de horas extras superior ao limite legal de 2 horas diárias (Art. 59 da CLT): ${Math.round(dailyOvertimeMinutes / 60 * 10) / 10}h extras no dia.`
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
      isArt58ToleranceApplied,
      legalWarnings: warnings,
    };
  }
}
