import { BaseScheduleStrategy } from './BaseScheduleStrategy.ts';
import type {
	RawDayPunch,
	EmployeeWorkContract,
	DailyPunchCalculation,
	WorkScheduleMetadata,
	WorkScheduleType,
} from '../types.ts';
import { getLegalWeeklyLimit, getSalaryDivisor, getTransitionPhase } from '../../legalTransition.ts';

/**
 * Estratégia para Jornada Noturna Urbana (Art. 73 da CLT e Súmula 60 do TST)
 *
 * Características Jurídicas:
 * - Período noturno urbano: entre 22:00 e 05:00.
 * - Hora ficta noturna reduzida de 52m30s (fator de ampliação de 60/52.5 = 1.142857).
 * - Adicional noturno mínimo legal de 20% sobre a remuneração diurna (Art. 73, caput).
 * - Prorrogação de jornada após 05h00 mantendo os adicionais (Súmula 60, II do TST e Art. 73, § 5º).
 */
export class NightShiftStrategy extends BaseScheduleStrategy {
	readonly type: WorkScheduleType = 'NIGHT_SHIFT';

	getEffectiveWeeklyLimit(targetDate: string, contract?: EmployeeWorkContract): number {
		if (contract?.weeklyContractHours && contract.weeklyContractHours > 0) {
			return contract.weeklyContractHours;
		}
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
			title: 'Jornada Noturna (Art. 73 da CLT)',
			legalBasis: 'Art. 73 da CLT e Súmula 60 do Tribunal Superior do Trabalho (TST).',
			standardDailyHours: limit === 44 ? 8.8 : limit === 42 ? 8.4 : 8.0,
			standardWeeklyHours: limit,
			monthlyDivisor: divisor,
			overtimeEligible: true,
			nightBonusEligible: true,
			toleranceApplicable: true,
			description:
        `Trabalho executado no período noturno urbano (22h às 05h). Cada hora trabalhada equivale legalmente a 52 minutos e 30 segundos (hora ficta), com adicional mínimo de 20% (Fase Vigente: ${phase}, teto ${limit}h, divisor ${divisor}).`,
			legalPeculiarities: [
				'Hora Noturna Reduzida: Fator de 60 / 52.5 = ~1.142857 aplicado sobre os minutos de relógio.',
				'Adicional noturno de no mínimo 20% sobre a hora diurna normal (Art. 73 da CLT).',
				'Prorrogação Noturna (Súmula 60, II TST): Jornada integralmente noturna que avança após as 05h00 mantém o adicional e a hora ficta.',
				'Se houver hora extra no horário noturno, o adicional de hora extra incide sobre o salário-hora acrescido do adicional noturno (Súmula 264 do TST).',
			],
		};
	}

	calculateDailyPunch(punch: RawDayPunch, contract?: EmployeeWorkContract): DailyPunchCalculation {
		const weeklyLimit = this.getEffectiveWeeklyLimit(punch.date, contract);
		const expectedDailyMinutes = weeklyLimit === 44 ? 528 : weeklyLimit === 42 ? 504 : 480;
		const warnings: string[] = [];

		const {
			nightData,
			effectiveWorkedMinutes,
			dailyOvertimeMinutes,
			dailyDeficitMinutes,
			hasInsufficientInterval,
		} = this.computeBasicDay(punch, expectedDailyMinutes, contract);

		if (nightData.nightClockMinutes === 0 && (punch.startTime || punch.endTime)) {
			warnings.push(
				'Aviso: O turno registrado não possui marcações no período noturno urbano (22h00 às 05h00).'
			);
		}

		if (nightData.extendedNightMinutes > 0) {
			warnings.push(
				`Prorrogação Noturna pós-05h (Súmula 60, II TST): ${Math.round(nightData.extendedNightMinutes / 60 * 10) / 10}h prorrogadas com adicional e hora ficta assegurados.`
			);
		}

		if (hasInsufficientInterval) {
			warnings.push(
				'Intervalo intrajornada inferior a 1 hora em turno superior a 6 horas (Art. 71, § 4º da CLT). Exige indenização com adicional de 50%.'
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
}
