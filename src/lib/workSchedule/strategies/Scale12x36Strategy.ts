import { BaseScheduleStrategy } from './BaseScheduleStrategy.ts';
import type {
	RawDayPunch,
	EmployeeWorkContract,
	DailyPunchCalculation,
	WorkScheduleMetadata,
	WorkScheduleType,
} from '../types.ts';
import { getTransitionPhase } from '../../legalTransition.ts';

/**
 * Estratégia para Jornada em Escala 12x36 (Art. 59-A da CLT)
 *
 * Características Jurídicas:
 * - 12 horas contínuas de trabalho por 36 horas ininterruptas de descanso.
 * - Não são devidas horas extras pela 9ª até a 12ª hora de labor.
 * - Feriados e DSR trabalhados já são remunerados na remuneração mensal (Art. 59-A, caput).
 * - Intervalo intrajornada (Art. 59-A, § único): facultado o gozo ou indenização.
 */
export class Scale12x36Strategy extends BaseScheduleStrategy {
	readonly type: WorkScheduleType = 'SCALE_12X36';

	getEffectiveWeeklyLimit(_targetDate: string, contract?: EmployeeWorkContract): number {
		// Na escala 12x36 a média semanal é de 36h ou 42h (alternando 3 e 4 plantões na quinzena)
		return contract?.weeklyContractHours ?? 42;
	}

	getMonthlyDivisor(targetDate: string, contract?: EmployeeWorkContract): number {
		if (contract?.customDivisor && contract.customDivisor > 0) {
			return contract.customDivisor;
		}
		const phase = getTransitionPhase(targetDate);
		// Divisor 210 na vigência da Fase 1, 200 na Fase 2, ou 220 no Legado
		return phase === 'PHASE_2_40H' ? 200 : phase === 'PHASE_1_42H' ? 210 : 220;
	}

	getMetadata(targetDate?: string): WorkScheduleMetadata {
		const date = targetDate || new Date().toISOString().slice(0, 10);
		const divisor = this.getMonthlyDivisor(date);

		return {
			type: this.type,
			title: 'Jornada em Escala 12x36',
			legalBasis: 'Art. 59-A da CLT (incluído pela Lei 13.467/2017) e Súmula 444 do TST (mitigada pela Reforma Trabalhista).',
			standardDailyHours: 12.0,
			standardWeeklyHours: 42.0, // média quinzenal
			monthlyDivisor: divisor,
			overtimeEligible: true, // apenas se exceder a 12ª hora do plantão
			nightBonusEligible: true, // plantão noturno tem hora ficta e adicional de 20%
			toleranceApplicable: true,
			description:
        'Regime especial de 12 horas de trabalho seguidas por 36 horas ininterruptas de descanso. Apenas o trabalho excedente a 12 horas diárias configura hora extra.',
			legalPeculiarities: [
				'A remuneração mensal abrange DSR e feriados por presunção legal (Art. 59-A da CLT).',
				'Inaplicabilidade de hora extra entre a 9ª e a 12ª hora.',
				'Intervalo de refeição pode ser indenizado com acréscimo de 50% caso cumprido no posto (Art. 59-A, parágrafo único).',
				'Se o plantão for noturno (19h às 07h), incide a hora ficta noturna e prorrogação pós 05h00 (Súmula 60 TST).',
			],
		};
	}

	calculateDailyPunch(punch: RawDayPunch, contract?: EmployeeWorkContract): DailyPunchCalculation {
		const isPlantaoDay = punch.dayType === 'work' || Boolean(punch.startTime && punch.endTime);
		const expectedDailyMinutes = isPlantaoDay ? 12 * 60 : 0;
		const warnings: string[] = [];

		const {
			nightData,
			effectiveWorkedMinutes,
			hasInsufficientInterval,
		} = this.computeBasicDay(punch, expectedDailyMinutes, contract);

		// Em 12x36, só há hora extra se ultrapassar 12 horas no plantão (720 minutos)
		const dailyOvertimeMinutes = Math.max(0, effectiveWorkedMinutes - expectedDailyMinutes);
		const dailyDeficitMinutes = isPlantaoDay ? Math.max(0, expectedDailyMinutes - effectiveWorkedMinutes) : 0;
		const dailyBalanceMinutes = effectiveWorkedMinutes - expectedDailyMinutes;

		if (hasInsufficientInterval) {
			warnings.push(
				'Plantonista 12x36 com intervalo intrajornada reduzido no posto: período suprimido para refeição deve ser indenizado com adicional de 50% (Art. 59-A, § único da CLT).'
			);
		}

		if (dailyOvertimeMinutes > 0) {
			warnings.push(
				`Plantão prorrogado além das 12 horas legais: apuradas ${Math.round(dailyOvertimeMinutes / 60 * 10) / 10}h extras no plantão.`
			);
		}

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
			expectedDailyMinutes,
			dailyOvertimeMinutes,
			dailyDeficitMinutes,
			dailyBalanceMinutes,
			isHolidayWork: false, // Em 12x36 feriados já são compensados pelo Art. 59-A
			hasInsufficientInterval,
			isArt58ToleranceApplied: false,
			legalWarnings: warnings,
		};
	}
}
