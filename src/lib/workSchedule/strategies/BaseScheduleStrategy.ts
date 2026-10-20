import type { IWorkScheduleStrategy } from './IWorkScheduleStrategy.ts';
import type {
	RawDayPunch,
	EmployeeWorkContract,
	DailyPunchCalculation,
	WorkScheduleMetadata,
	WorkSchedulePeriodSummary,
	WorkScheduleType,
} from '../types.ts';
import { calculateNightBreakdown } from '../nightCalculation.ts';
import { getTransitionPhase } from '../../legalTransition.ts';

/**
 * Classe base abstrata contendo métodos utilitários e consolidação de período
 */
export abstract class BaseScheduleStrategy implements IWorkScheduleStrategy {
	abstract readonly type: WorkScheduleType;

	abstract getMetadata(targetDate?: string): WorkScheduleMetadata;
	abstract getEffectiveWeeklyLimit(targetDate: string, contract?: EmployeeWorkContract): number;
	abstract getMonthlyDivisor(targetDate: string, contract?: EmployeeWorkContract): number;
	abstract calculateDailyPunch(punch: RawDayPunch, contract?: EmployeeWorkContract): DailyPunchCalculation;

	/**
	 * Consolida a apuração de múltiplos dias no espelho de ponto
	 */
	calculatePeriod(
		punches: RawDayPunch[],
		contract?: EmployeeWorkContract
	): WorkSchedulePeriodSummary {
		if (punches.length === 0) {
			const today = new Date().toISOString().slice(0, 10);
			return {
				startDate: today,
				endDate: today,
				scheduleType: this.type,
				effectivePhase: getTransitionPhase(today),
				totalDays: 0,
				workedDaysCount: 0,
				totalEffectiveWorkedMinutes: 0,
				totalExpectedMinutes: 0,
				totalDaytimeMinutes: 0,
				totalNighttimeClockMinutes: 0,
				totalNighttimeFictitiousMinutes: 0,
				totalNighttimeBonusMinutes: 0,
				totalOvertimeMinutesWeekday: 0,
				totalOvertimeMinutesWeekend: 0,
				totalOvertimeMinutesNight: 0,
				totalDeficitMinutes: 0,
				totalBalanceMinutes: 0,
				monthlyDivisor: this.getMonthlyDivisor(today, contract),
				legalInfractions: [],
			};
		}

		const sorted = [...punches].sort((a, b) => a.date.localeCompare(b.date));
		const startDate = sorted[0].date;
		const endDate = sorted[sorted.length - 1].date;
		const effectivePhase = getTransitionPhase(startDate);
		const monthlyDivisor = this.getMonthlyDivisor(startDate, contract);

		let workedDaysCount = 0;
		let totalEffectiveWorkedMinutes = 0;
		let totalExpectedMinutes = 0;
		let totalDaytimeMinutes = 0;
		let totalNighttimeClockMinutes = 0;
		let totalNighttimeFictitiousMinutes = 0;
		let totalNighttimeBonusMinutes = 0;
		let totalOvertimeMinutesWeekday = 0;
		let totalOvertimeMinutesWeekend = 0;
		let totalOvertimeMinutesNight = 0;
		let totalDeficitMinutes = 0;
		const legalInfractions: string[] = [];

		sorted.forEach((punch) => {
			const daily = this.calculateDailyPunch(punch, contract);

			if (daily.effectiveWorkedMinutes > 0) {
				workedDaysCount++;
			}

			totalEffectiveWorkedMinutes += daily.effectiveWorkedMinutes;
			totalExpectedMinutes += daily.expectedDailyMinutes;
			totalDaytimeMinutes += daily.daytimeWorkedMinutes;
			totalNighttimeClockMinutes += daily.nighttimeClockMinutes;
			totalNighttimeFictitiousMinutes += daily.nighttimeFictitiousMinutes;
			totalNighttimeBonusMinutes += daily.nighttimeBonusMinutes;

			// Apuração de horas extras
			if (daily.dailyOvertimeMinutes > 0) {
				if (daily.isHolidayWork || punch.dayType === 'off' || punch.dayType === 'dsr') {
					totalOvertimeMinutesWeekend += daily.dailyOvertimeMinutes;
				} else {
					totalOvertimeMinutesWeekday += daily.dailyOvertimeMinutes;
				}

				// Se houve hora noturna no dia com extra, apura a proporção noturna
				if (daily.nighttimeFictitiousMinutes > 0) {
					totalOvertimeMinutesNight += Math.min(daily.dailyOvertimeMinutes, daily.nighttimeFictitiousMinutes);
				}
			}

			totalDeficitMinutes += daily.dailyDeficitMinutes;

			daily.legalWarnings.forEach((w) => {
				if (!legalInfractions.includes(w)) {
					legalInfractions.push(w);
				}
			});
		});

		const totalBalanceMinutes = totalEffectiveWorkedMinutes - totalExpectedMinutes;

		// Cálculo Financeiro (se salário base informado)
		let regularHourlyRate: number | undefined;
		let overtimePayWeekday: number | undefined;
		let overtimePayWeekend: number | undefined;
		let nightAdditionalPay: number | undefined;
		let totalEarningsEstimate: number | undefined;

		if (contract?.baseSalary && contract.baseSalary > 0) {
			regularHourlyRate = contract.baseSalary / monthlyDivisor;
			const rateWeekday = contract.overtimeRateWeekday ?? 0.5;
			const rateWeekend = contract.overtimeRateWeekend ?? 1.0;
			const rateNight = contract.nightAdditionalRate ?? 0.2;

			overtimePayWeekday = (totalOvertimeMinutesWeekday / 60) * regularHourlyRate * (1 + rateWeekday);
			overtimePayWeekend = (totalOvertimeMinutesWeekend / 60) * regularHourlyRate * (1 + rateWeekend);
			nightAdditionalPay = (totalNighttimeFictitiousMinutes / 60) * regularHourlyRate * rateNight;

			totalEarningsEstimate = contract.baseSalary + overtimePayWeekday + overtimePayWeekend + nightAdditionalPay;
		}

		return {
			startDate,
			endDate,
			scheduleType: this.type,
			effectivePhase,
			totalDays: sorted.length,
			workedDaysCount,
			totalEffectiveWorkedMinutes,
			totalExpectedMinutes,
			totalDaytimeMinutes,
			totalNighttimeClockMinutes,
			totalNighttimeFictitiousMinutes,
			totalNighttimeBonusMinutes,
			totalOvertimeMinutesWeekday,
			totalOvertimeMinutesWeekend,
			totalOvertimeMinutesNight,
			totalDeficitMinutes,
			totalBalanceMinutes,
			baseSalary: contract?.baseSalary,
			monthlyDivisor,
			regularHourlyRate,
			overtimePayWeekday,
			overtimePayWeekend,
			nightAdditionalPay,
			totalEarningsEstimate,
			legalInfractions,
		};
	}

	/**
	 * Helper comum para decomposição e apuração básica de dia
	 */
	protected computeBasicDay(
		punch: RawDayPunch,
		expectedDailyMinutes: number,
		contract?: EmployeeWorkContract
	): {
		nightData: ReturnType<typeof calculateNightBreakdown>;
		effectiveWorkedMinutes: number;
		dailyOvertimeMinutes: number;
		dailyDeficitMinutes: number;
		hasInsufficientInterval: boolean;
	} {
		const isHoliday = punch.isHoliday || punch.dayType === 'holiday';
		const isOff = punch.dayType === 'off' || punch.dayType === 'dsr';
		const hasWorkedTimes = Boolean(punch.startTime && punch.endTime);

		// Se feriado usufruído como descanso
		if (isHoliday && !punch.workedOnHoliday) {
			return {
				nightData: calculateNightBreakdown('', ''),
				effectiveWorkedMinutes: 0,
				dailyOvertimeMinutes: 0,
				dailyDeficitMinutes: 0,
				hasInsufficientInterval: false,
			};
		}

		// Se folga regular usufruída
		if (isOff && !hasWorkedTimes) {
			return {
				nightData: calculateNightBreakdown('', ''),
				effectiveWorkedMinutes: 0,
				dailyOvertimeMinutes: 0,
				dailyDeficitMinutes: 0,
				hasInsufficientInterval: false,
			};
		}

		const allowPost5am = contract?.allowPost5amNightExtension ?? true;
		const nightData = calculateNightBreakdown(
			punch.startTime || '',
			punch.endTime || '',
			punch.breakStartTime,
			punch.breakEndTime,
			allowPost5am
		);

		// Minutos efetivos = Diurno + Noturno Fictício
		const effectiveWorkedMinutes = Math.round(nightData.daytimeMinutes + nightData.nightFictitiousMinutes);

		// Se trabalhou no feriado ou em folga, a meta diária esperada é 0 e todo o tempo é hora extra
		const isRestDayWork = (isHoliday && punch.workedOnHoliday) || (isOff && hasWorkedTimes);
		const expected = isRestDayWork ? 0 : expectedDailyMinutes;

		const dailyOvertimeMinutes = isRestDayWork ? effectiveWorkedMinutes : Math.max(0, effectiveWorkedMinutes - expected);
		const dailyDeficitMinutes = isRestDayWork ? 0 : Math.max(0, expected - effectiveWorkedMinutes);

		// Intervalo de almoço inferior a 1h em turnos superiores a 6h (Art. 71 CLT)
		const hasInsufficientInterval = nightData.netClockMinutes > 6 * 60 && nightData.breakMinutes < 60;

		return {
			nightData,
			effectiveWorkedMinutes,
			dailyOvertimeMinutes,
			dailyDeficitMinutes,
			hasInsufficientInterval,
		};
	}
}
