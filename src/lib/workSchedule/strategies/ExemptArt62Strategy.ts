import { BaseScheduleStrategy } from './BaseScheduleStrategy.ts';
import type {
	RawDayPunch,
	EmployeeWorkContract,
	DailyPunchCalculation,
	WorkScheduleMetadata,
	WorkScheduleType,
} from '../types.ts';

/**
 * Estratégia para Empregados Isentos de Controle de Jornada (Art. 62 da CLT)
 *
 * Abrange:
 * - Art. 62, II: Gerentes e exercentes de cargos de gestão com gratificação de função (>= 40%).
 * - Art. 62, III: Empregados em regime de teletrabalho que prestam serviços por produção ou tarefa (Lei 14.442/2022).
 *
 * Consequências Jurídicas:
 * - Isenção de controle de horários e batidas de ponto.
 * - Inexistência de direito a horas extras, banco de horas ou adicionais intrajornada,
 *   salvo se houver previsão expressa contrária pactuada em contrato individual ou CCT.
 */
export class ExemptArt62Strategy extends BaseScheduleStrategy {
	readonly type: WorkScheduleType = 'EXEMPT_ART_62';

	getEffectiveWeeklyLimit(_targetDate: string, contract?: EmployeeWorkContract): number {
		return contract?.weeklyContractHours ?? 40;
	}

	getMonthlyDivisor(_targetDate: string, contract?: EmployeeWorkContract): number {
		return contract?.customDivisor ?? 200;
	}

	getMetadata(targetDate?: string): WorkScheduleMetadata {
		const date = targetDate || new Date().toISOString().slice(0, 10);
		const divisor = this.getMonthlyDivisor(date);

		return {
			type: this.type,
			title: 'Isenção de Controle de Jornada (Art. 62 da CLT)',
			legalBasis: 'Art. 62, incisos II e III da CLT (com alterações da Lei 14.442/2022 para teletrabalho por produção/tarefa).',
			standardDailyHours: 8.0,
			standardWeeklyHours: 40.0,
			monthlyDivisor: divisor,
			overtimeEligible: false,
			nightBonusEligible: false,
			toleranceApplicable: false,
			description:
        'Regime sem submissão a controle de jornada para teletrabalho por tarefa/produção ou cargos de confiança/gestão. Não gera horas extras nem controle de banco de horas.',
			legalPeculiarities: [
				'Não aplicação das regras do Capítulo II da CLT (duração do trabalho).',
				'Inexistência de horas extras ou apuração de déficit de horários.',
				'Necessidade de anotação expressa da condição do Art. 62 na CTPS e no contrato individual de trabalho.',
				'Se o empregador fiscalizar horários (softwares espiões, login/logout obrigatório), o regime pode ser descaracterizado judicialmente gerando passivo de horas extras.',
			],
		};
	}

	calculateDailyPunch(punch: RawDayPunch, contract?: EmployeeWorkContract): DailyPunchCalculation {
		// Para registro estatístico, apura minutos se o usuário tiver preenchido batida
		const { nightData } = this.computeBasicDay(punch, 0, contract);

		const warnings: string[] = [
			'Regime Isento (Art. 62 da CLT): Os horários registrados são meramente informativos. Não há apuração de horas extras nem banco de horas.'
		];

		return {
			date: punch.date,
			scheduleType: this.type,
			grossWorkedMinutes: nightData.grossMinutes,
			breakMinutes: nightData.breakMinutes,
			netClockWorkedMinutes: nightData.netClockMinutes,
			daytimeWorkedMinutes: nightData.daytimeMinutes,
			nighttimeClockMinutes: 0, // isento de adicional noturno por ausência de controle
			nighttimeFictitiousMinutes: 0,
			nighttimeBonusMinutes: 0,
			nighttimeExtendedMinutes: 0,
			effectiveWorkedMinutes: nightData.netClockMinutes,
			expectedDailyMinutes: 0,
			dailyOvertimeMinutes: 0,  // Sempre zero
			dailyDeficitMinutes: 0,   // Sempre zero
			dailyBalanceMinutes: 0,   // Sempre zero
			isHolidayWork: false,
			hasInsufficientInterval: false,
			isArt58ToleranceApplied: false,
			legalWarnings: warnings,
		};
	}
}
