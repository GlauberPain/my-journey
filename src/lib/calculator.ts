import type { ScheduleDay, ShiftTime, DayCalculation, MonthSummary, AiRuleResponse } from './types.ts';
import { getHolidayName } from './holidays.ts';

/**
 * Converte "HH:mm" em total de minutos a partir de 00:00
 */
export function timeToMinutes(time: string | undefined): number {
	if (!time || !time.includes(':')) return 0;
	const [hours, minutes] = time.split(':').map(Number);
	if (isNaN(hours) || isNaN(minutes)) return 0;
	return hours * 60 + minutes;
}

/**
 * Converte minutos para string formatada "HH:mm" ou "+HH:mm" / "-HH:mm"
 */
export function minutesToTime(minutes: number, showSign: boolean = false): string {
	const isNegative = minutes < 0;
	const absMinutes = Math.abs(minutes);
	const hours = Math.floor(absMinutes / 60);
	const mins = absMinutes % 60;

	const paddedHours = String(hours).padStart(2, '0');
	const paddedMins = String(mins).padStart(2, '0');
	const formatted = `${paddedHours}:${paddedMins}`;

	if (showSign) {
		if (minutes === 0) return '00:00';
		return isNegative ? `-${formatted}` : `+${formatted}`;
	}

	return formatted;
}

/**
 * Calcula os minutos trabalhados em um turno diário considerando início, fim e intervalo.
 * Suporta turnos normais e turnos que viram a noite (ex: 22:00 às 06:00).
 */
export function calculateShiftWorkedMinutes(shift: ShiftTime): { workedMinutes: number; breakMinutes: number } {
	if (!shift.startTime || !shift.endTime) {
		return { workedMinutes: 0, breakMinutes: 0 };
	}

	const start = timeToMinutes(shift.startTime);
	let end = timeToMinutes(shift.endTime);

	// Turno noturno que vira a meia-noite (ex: 22:00 -> 06:00)
	if (end < start) {
		end += 24 * 60;
	}

	const grossMinutes = Math.max(0, end - start);

	let breakMinutes = 0;
	if (shift.breakStartTime && shift.breakEndTime) {
		const breakStart = timeToMinutes(shift.breakStartTime);
		let breakEnd = timeToMinutes(shift.breakEndTime);

		if (breakEnd < breakStart) {
			breakEnd += 24 * 60;
		}

		breakMinutes = Math.max(0, breakEnd - breakStart);
	}

	const workedMinutes = Math.max(0, grossMinutes - breakMinutes);
	return { workedMinutes, breakMinutes };
}

/**
 * Apuração individual de um dia (com suporte especial a Feriados e Horas Extras 100%)
 */
export function calculateDay(
	day: ScheduleDay,
	dailyExpectedMinutes: number = 8 * 60 // 8h padrão
): DayCalculation {
	const isHoliday = day.isHoliday || day.dayType === 'holiday';

	// Caso 1: FERIADO
	if (isHoliday) {
		// Se a pessoa sinalizou que vai trabalhar no feriado e tem horários
		if (day.workedOnHoliday && (day.startTime || day.endTime)) {
			const { workedMinutes, breakMinutes } = calculateShiftWorkedMinutes(day);
			// No feriado, a meta esperada é REMOVIDA (0). Logo, todas as horas trabalhadas são 100% EXTRAS!
			const expectedMinutes = 0;
			const balanceMinutes = workedMinutes;

			return {
				workedMinutes,
				breakMinutes,
				expectedMinutes,
				balanceMinutes,
				formattedWorked: minutesToTime(workedMinutes),
				formattedBalance: minutesToTime(balanceMinutes, true),
				isOvertime: workedMinutes > 0,
				isDeficit: false,
				isHolidayWork: true,
			};
		}

		// Feriado usufruído como descanso: horas removidas da exigência, sem saldo a compensar
		return {
			workedMinutes: 0,
			breakMinutes: 0,
			expectedMinutes: 0,
			balanceMinutes: 0,
			formattedWorked: '00:00',
			formattedBalance: '00:00',
			isOvertime: false,
			isDeficit: false,
			isHolidayWork: false,
		};
	}

	// Caso 2: DIA REGULAR (NÃO É FERIADO)
	if (day.dayType !== 'work') {
		return {
			workedMinutes: 0,
			breakMinutes: 0,
			expectedMinutes: 0,
			balanceMinutes: 0,
			formattedWorked: '00:00',
			formattedBalance: '00:00',
			isOvertime: false,
			isDeficit: false,
			isHolidayWork: false,
		};
	}

	const { workedMinutes, breakMinutes } = calculateShiftWorkedMinutes(day);
	const expectedMinutes = dailyExpectedMinutes;
	const balanceMinutes = workedMinutes - expectedMinutes;

	return {
		workedMinutes,
		breakMinutes,
		expectedMinutes,
		balanceMinutes,
		formattedWorked: minutesToTime(workedMinutes),
		formattedBalance: minutesToTime(balanceMinutes, true),
		isOvertime: balanceMinutes > 0,
		isDeficit: balanceMinutes < 0,
		isHolidayWork: false,
	};
}

/**
 * Apuração consolidada do mês
 */
export function calculateMonthSummary(
	days: ScheduleDay[],
	dailyExpectedMinutes: number = 8 * 60
): MonthSummary {
	let totalWorkedMinutes = 0;
	let totalExpectedMinutes = 0;
	let workDaysCount = 0;
	let offDaysCount = 0;
	let holidayDaysCount = 0;
	let holidayWorkedMinutes = 0;

	days.forEach((day) => {
		const isHoliday = day.isHoliday || day.dayType === 'holiday';

		if (isHoliday) {
			holidayDaysCount++;
			if (day.workedOnHoliday && (day.startTime || day.endTime)) {
				const { workedMinutes } = calculateShiftWorkedMinutes(day);
				totalWorkedMinutes += workedMinutes;
				holidayWorkedMinutes += workedMinutes;
				// As horas de feriado trabalhado NÃO aumentam a meta esperada (são 100% bônus/extras)
			} else {
				offDaysCount++;
			}
		} else if (day.dayType === 'work' && (day.startTime || day.endTime)) {
			workDaysCount++;
			const { workedMinutes } = calculateShiftWorkedMinutes(day);
			totalWorkedMinutes += workedMinutes;
			totalExpectedMinutes += dailyExpectedMinutes;
		} else {
			offDaysCount++;
		}
	});

	const totalBalanceMinutes = totalWorkedMinutes - totalExpectedMinutes;

	return {
		totalWorkedMinutes,
		totalExpectedMinutes,
		totalBalanceMinutes,
		workDaysCount,
		offDaysCount,
		holidayDaysCount,
		holidayWorkedMinutes,
		formattedTotalWorked: minutesToTime(totalWorkedMinutes),
		formattedExpected: minutesToTime(totalExpectedMinutes),
		formattedBalance: minutesToTime(totalBalanceMinutes, true),
		formattedHolidayWorked: minutesToTime(holidayWorkedMinutes),
	};
}

/**
 * Gera todos os dias de um mês específico com detecção automática de feriados nacionais
 */
export function generateMonthDays(year: number, month: number): ScheduleDay[] {
	const daysInMonth = new Date(year, month, 0).getDate();
	const days: ScheduleDay[] = [];

	for (let d = 1; d <= daysInMonth; d++) {
		const dateObj = new Date(year, month - 1, d);
		const dayOfWeek = dateObj.getDay(); // 0 = Domingo, 6 = Sábado
		const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

		const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
		const holidayName = getHolidayName(dateStr);
		const isHoliday = !!holidayName;

		days.push({
			date: dateStr,
			dayOfWeek,
			dayType: isHoliday ? 'holiday' : isWeekend ? 'off' : 'work',
			isHoliday,
			holidayName: holidayName || undefined,
			workedOnHoliday: false,
			startTime: '',
			breakStartTime: '',
			breakEndTime: '',
			endTime: '',
		});
	}

	return days;
}

/**
 * Aplica as regras retornadas pela IA no conjunto de dias do mês,
 * preservando a detecção e proteção dos feriados nacionais.
 */
export function applyAiRulesToMonth(
	rules: AiRuleResponse['rules'],
	currentDays: ScheduleDay[]
): ScheduleDay[] {
	return currentDays.map((day) => {
		// Se for feriado nacional e o usuário não marcou trabalho explícito nele, mantém feriado protegido
		if (day.isHoliday) {
			return {
				...day,
				dayType: day.workedOnHoliday ? 'work' : 'holiday',
			};
		}

		// Procura regra específica para o dia da semana
		const matchingRule = rules.find((r) => r.dayOfWeek === day.dayOfWeek || r.dayOfWeek === -1);

		if (!matchingRule) return day;

		return {
			...day,
			dayType: matchingRule.dayType,
			startTime: matchingRule.dayType === 'work' ? matchingRule.startTime || '' : '',
			breakStartTime: matchingRule.dayType === 'work' ? matchingRule.breakStartTime || '' : '',
			breakEndTime: matchingRule.dayType === 'work' ? matchingRule.breakEndTime || '' : '',
			endTime: matchingRule.dayType === 'work' ? matchingRule.endTime || '' : '',
			isCustom: true,
		};
	});
}

/**
 * Exporta os dados para formato CSV (compatível com Excel)
 */
export function exportToCsv(days: ScheduleDay[], summary: MonthSummary): string {
	const headers = [
		'Data',
		'Dia da Semana',
		'Situação',
		'Feriado Nacional',
		'Trabalhou no Feriado?',
		'Início',
		'Início Intervalo',
		'Fim Intervalo',
		'Fim',
		'Horas Trabalhadas',
		'Saldo',
		'Observações',
	];

	const dayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

	const rows = days.map((day) => {
		const calc = calculateDay(day);
		const dayName = dayNames[day.dayOfWeek];
		return [
			day.date,
			dayName,
			day.dayType.toUpperCase(),
			day.isHoliday ? `"${(day.holidayName || '').replace(/"/g, '""')}"` : '-',
			day.isHoliday ? (day.workedOnHoliday ? 'SIM (100% Extra)' : 'NÃO (Folga)') : '-',
			day.startTime || '-',
			day.breakStartTime || '-',
			day.breakEndTime || '-',
			day.endTime || '-',
			calc.formattedWorked,
			calc.formattedBalance,
			`"${(day.notes || '').replace(/"/g, '""')}"`,
		].join(';');
	});

	const summaryRow = [
		'',
		'',
		'TOTAIS',
		'',
		'',
		'',
		'',
		'',
		'',
		summary.formattedTotalWorked,
		summary.formattedBalance,
		`Trabalhados: ${summary.workDaysCount} dias | Horas em Feriados: ${summary.formattedHolidayWorked}`,
	].join(';');

	return [headers.join(';'), ...rows, '', summaryRow].join('\r\n');
}
