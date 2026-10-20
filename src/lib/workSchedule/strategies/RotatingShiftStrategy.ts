import { BaseScheduleStrategy } from './BaseScheduleStrategy.ts';
import type {
	RawDayPunch,
	EmployeeWorkContract,
	DailyPunchCalculation,
	WorkScheduleMetadata,
	WorkScheduleType,
} from '../types.ts';

/**
 * Estratégia para Turnos Ininterruptos de Revezamento (Art. 7º, XIV da CF/88 e Súmula 423 do TST)
 *
 * Características Jurídicas:
 * - Carga horária máxima constitucional de 6 horas diárias e 36 horas semanais.
 * - Divisor mensal clássico de 180 (36 * 5).
 * - Súmula 423 do TST: negociação coletiva pode fixar até 8h diárias, mas o que ultrapassar é extra a 50%.
 */
export class RotatingShiftStrategy extends BaseScheduleStrategy {
	readonly type: WorkScheduleType = 'SHIFT_ROTATING_36H';

	getEffectiveWeeklyLimit(_targetDate: string, contract?: EmployeeWorkContract): number {
		return contract?.weeklyContractHours ?? 36;
	}

	getMonthlyDivisor(_targetDate: string, contract?: EmployeeWorkContract): number {
		return contract?.customDivisor ?? 180;
	}

	getMetadata(targetDate?: string): WorkScheduleMetadata {
		const date = targetDate || new Date().toISOString().slice(0, 10);
		const limit = this.getEffectiveWeeklyLimit(date);
		const divisor = this.getMonthlyDivisor(date);

		return {
			type: this.type,
			title: 'Turnos Ininterruptos de Revezamento (6h/dia - 36h/sem)',
			legalBasis: 'Art. 7º, XIV da Constituição Federal de 1988 e Súmula 423 do Tribunal Superior do Trabalho (TST).',
			standardDailyHours: 6.0,
			standardWeeklyHours: limit,
			monthlyDivisor: divisor,
			overtimeEligible: true,
			nightBonusEligible: true,
			toleranceApplicable: true,
			description:
        'Jornada especial constitucional para atividades contínuas em que o trabalhador alterna turnos diurnos e noturnos. Limite de 6 horas por dia e 36 horas semanais (divisor 180).',
			legalPeculiarities: [
				'Limite constitucional máximo de 6 horas diárias para proteção biológica do trabalhador (Art. 7º, XIV CF).',
				'Divisor mensal 180 para apuração do salário-hora.',
				'Súmula 423 do TST: admite ampliação para até 8h diárias apenas mediante Acordo ou Convenção Coletiva de Trabalho (CCT/ACT).',
				'Horas além da 6ª diária (ou 8ª negociada) devem ser remuneradas com adicional extraordinário de 50%.',
			],
		};
	}

	calculateDailyPunch(punch: RawDayPunch, contract?: EmployeeWorkContract): DailyPunchCalculation {
		// 6 horas diárias = 360 minutos (ou contratual até 8h negociadas)
		const expectedDailyMinutes = contract?.weeklyContractHours ? Math.round((contract.weeklyContractHours / 6) * 60) : 6 * 60;
		const warnings: string[] = [];

		const {
			nightData,
			effectiveWorkedMinutes,
			dailyOvertimeMinutes,
			dailyDeficitMinutes,
			hasInsufficientInterval,
		} = this.computeBasicDay(punch, expectedDailyMinutes, contract);

		if (dailyOvertimeMinutes > 0) {
			warnings.push(
				`Excedente ao limite constitucional de 6h do turno ininterrupto: apuradas ${Math.round(dailyOvertimeMinutes / 60 * 10) / 10}h extras no dia.`
			);
		}

		// Em jornada de 6h, o intervalo intrajornada obrigatório é de 15 minutos (Art. 71, § 1º CLT)
		if (effectiveWorkedMinutes > 4 * 60 && nightData.breakMinutes < 15) {
			warnings.push(
				'Intervalo de descanso para jornada de 6h inferior ao mínimo legal de 15 minutos (Art. 71, § 1º da CLT).'
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
