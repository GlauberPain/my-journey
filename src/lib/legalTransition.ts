import type {
	TransitionPhase,
	TransitionMilestones,
	EmployeeContract,
	SalaryHourCalculation,
	WeeklyScheduleSummary,
	ScheduleDay,
} from './types.ts';
import { calculateShiftWorkedMinutes, minutesToTime } from './calculator.ts';

/**
 * Data padrão estimada da promulgação da Emenda Constitucional (outubro/2026).
 * Parametrizável via configuração ou variável de ambiente.
 */
export const DEFAULT_PROMULGATION_DATE = '2026-10-15';

/**
 * Prazos da regra de transição previstos na PEC 221/2019:
 * - Fase 1: 60 dias após a promulgação (redução para 42h semanais, divisor 210)
 * - Fase 2: 12 meses após a entrada em vigor da Fase 1 (redução para 40h semanais, divisor 200)
 */
export const PHASE_1_DAYS_OFFSET = 60;
export const PHASE_2_MONTHS_OFFSET = 12;

/**
 * Formata um objeto Date para "YYYY-MM-DD" em UTC
 */
export function formatDateToIso(date: Date): string {
	const y = date.getUTCFullYear();
	const m = String(date.getUTCMonth() + 1).padStart(2, '0');
	const d = String(date.getUTCDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

/**
 * Converte string "YYYY-MM-DD" para Date UTC
 */
export function parseIsoToDate(isoDate: string): Date {
	const [year, month, day] = isoDate.split('-').map(Number);
	return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Calcula os marcos temporais de vigência legal da Emenda Constitucional
 */
export function getTransitionMilestones(
	promulgationDate: string = DEFAULT_PROMULGATION_DATE
): TransitionMilestones {
	const baseDate = parseIsoToDate(promulgationDate);

	// Fase 1: +60 dias
	const phase1Date = new Date(baseDate.getTime());
	phase1Date.setUTCDate(phase1Date.getUTCDate() + PHASE_1_DAYS_OFFSET);

	// Fase 2: +12 meses a partir do início da Fase 1
	const phase2Date = new Date(phase1Date.getTime());
	phase2Date.setUTCMonth(phase2Date.getUTCMonth() + PHASE_2_MONTHS_OFFSET);

	return {
		promulgationDate,
		phase1EffectiveDate: formatDateToIso(phase1Date),
		phase2EffectiveDate: formatDateToIso(phase2Date),
	};
}

/**
 * Determina a fase da legislação com base na data do registro de ponto (date-based threshold)
 *
 * - date < Fase 1 (ex: < 2026-12-14): 'LEGACY_44H' (limite de 44h semanais)
 * - date >= Fase 1 e < Fase 2 (ex: 2026-12-14 a 2027-12-13): 'PHASE_1_42H' (limite de 42h semanais)
 * - date >= Fase 2 (ex: >= 2027-12-14): 'PHASE_2_40H' (limite de 40h semanais)
 */
export function getTransitionPhase(
	targetDate: string | Date,
	customPromulgationDate: string = DEFAULT_PROMULGATION_DATE
): TransitionPhase {
	const dateStr = typeof targetDate === 'string' ? targetDate.slice(0, 10) : formatDateToIso(targetDate);
	const milestones = getTransitionMilestones(customPromulgationDate);

	if (dateStr < milestones.phase1EffectiveDate) {
		return 'LEGACY_44H';
	}
	if (dateStr < milestones.phase2EffectiveDate) {
		return 'PHASE_1_42H';
	}
	return 'PHASE_2_40H';
}

/**
 * Retorna o limite legal semanal (em horas) vigente para uma determinada data
 */
export function getLegalWeeklyLimit(
	targetDate: string | Date,
	customPromulgationDate: string = DEFAULT_PROMULGATION_DATE
): number {
	const phase = getTransitionPhase(targetDate, customPromulgationDate);
	switch (phase) {
		case 'LEGACY_44H':
			return 44;
		case 'PHASE_1_42H':
			return 42;
		case 'PHASE_2_40H':
			return 40;
	}
}

/**
 * Retorna o teto semanal efetivo a ser aplicado, respeitando:
 * 1. O teto legal da fase vigente na data;
 * 2. Parametrizações contratuais ou sindicais mais benéficas (ex: contrato de 40h, 36h ou 30h).
 * Conforme o princípio de proteção e da norma mais favorável da CLT, se o contrato
 * estipula jornada inferior ao teto constitucional, prevalece o teto contratual.
 */
export function getEffectiveWeeklyLimit(
	targetDate: string | Date,
	contract?: EmployeeContract,
	customPromulgationDate: string = DEFAULT_PROMULGATION_DATE
): number {
	const legalLimit = getLegalWeeklyLimit(targetDate, customPromulgationDate);

	if (contract?.weeklyContractHours && contract.weeklyContractHours > 0) {
		// Se a carga contratada for inferior ao limite legal vigente, prevalece a contratual.
		// Se a carga contratada era superior (ex: contrato antigo de 44h na vigência de 42h), o limite legal impõe o teto.
		return Math.min(legalLimit, contract.weeklyContractHours);
	}

	return legalLimit;
}

/**
 * Calcula o divisor mensal para apuração do salário-hora conforme a carga horária semanal.
 *
 * Fórmula clássica trabalhista (CLT / Súmula 431 TST):
 * Divisor = (Carga Semanal / 6 dias úteis) * 30 dias do mês comercial = Carga Semanal * 5
 *
 * - 44 horas -> Divisor 220
 * - 42 horas -> Divisor 210
 * - 40 horas -> Divisor 200
 * - 36 horas -> Divisor 180 (ex: teleatendimento)
 * - 30 horas -> Divisor 150 (ex: profissionais de saúde/bancários 6h)
 */
export function getSalaryDivisor(weeklyHours: number, customDivisor?: number): number {
	if (customDivisor && customDivisor > 0) {
		return customDivisor;
	}
	return Math.round(weeklyHours * 5);
}

/**
 * Realiza o cálculo do salário-hora e adicionais com garantia estrita do princípio da
 * IRREDUTIBILIDADE SALARIAL (Art. 7º, inciso VI da Constituição Federal).
 *
 * Regra:
 * A redução da jornada semanal de 44h para 42h e posteriormente para 40h NÃO autoriza
 * nenhuma diminuição do salário-base mensal. Consequentemente, o salário-hora aumenta
 * proporcionalmente à redução do divisor:
 *
 * Exemplo prático (Salário Base de R$ 4.400,00):
 * - Legado (44h, Divisor 220): Salário-hora = R$ 20,00 | Hora Extra 50% = R$ 30,00
 * - Fase 1 (42h, Divisor 210): Salário-hora = R$ 20,95 | Hora Extra 50% = R$ 31,43
 * - Fase 2 (40h, Divisor 200): Salário-hora = R$ 22,00 | Hora Extra 50% = R$ 33,00
 */
export function calculateSalaryCompensation(
	baseSalary: number,
	weeklyHours: number,
	options?: {
    overtimeRateWeekday?: number; // default: 0.5 (50%)
    overtimeRateWeekend?: number; // default: 1.0 (100%)
    customDivisor?: number;
    targetDate?: string | Date;
    customPromulgationDate?: string;
  }
): SalaryHourCalculation {
	if (baseSalary < 0) {
		throw new Error('O salário base não pode ser negativo.');
	}
	if (weeklyHours <= 0) {
		throw new Error('A carga horária semanal deve ser maior que zero.');
	}

	const divisor = getSalaryDivisor(weeklyHours, options?.customDivisor);
	const regularHourlyRate = baseSalary / divisor;

	const weekdayAdditional = options?.overtimeRateWeekday ?? 0.5;
	const weekendAdditional = options?.overtimeRateWeekend ?? 1.0;

	const overtimeHourlyRateWeekday = regularHourlyRate * (1 + weekdayAdditional);
	const overtimeHourlyRateWeekend = regularHourlyRate * (1 + weekendAdditional);

	const phase = options?.targetDate
		? getTransitionPhase(options.targetDate, options.customPromulgationDate)
		: weeklyHours <= 40
			? 'PHASE_2_40H'
			: weeklyHours <= 42
				? 'PHASE_1_42H'
				: 'LEGACY_44H';

	return {
		baseSalary, // Irredutível
		weeklyHours,
		divisor,
		regularHourlyRate,
		overtimeHourlyRateWeekday,
		overtimeHourlyRateWeekend,
		effectivePhase: phase,
	};
}

/**
 * Apuração consolidada de uma semana de espelho de ponto.
 *
 * Calcula minutos trabalhados, compara com o teto semanal vigente para o período
 * e apura horas extras com exatidão matemática, aplicando tolerâncias se configuradas.
 */
export function calculateWeeklySchedule(
	days: ScheduleDay[],
	weekStartDate: string,
	contract?: EmployeeContract,
	customPromulgationDate: string = DEFAULT_PROMULGATION_DATE
): WeeklyScheduleSummary {
	const legalWeeklyLimitHours = getLegalWeeklyLimit(weekStartDate, customPromulgationDate);
	const effectiveWeeklyLimitHours = getEffectiveWeeklyLimit(
		weekStartDate,
		contract,
		customPromulgationDate
	);
	const effectiveWeeklyLimitMinutes = Math.round(effectiveWeeklyLimitHours * 60);
	const phase = getTransitionPhase(weekStartDate, customPromulgationDate);

	// Calcula total trabalhado na semana
	let workedMinutes = 0;
	const datesInWeek: string[] = [];

	days.forEach((day) => {
		datesInWeek.push(day.date);
		const isHolidayOff = (day.isHoliday || day.dayType === 'holiday') && !day.workedOnHoliday;
		if (day.dayType === 'work' || day.workedOnHoliday) {
			if (!isHolidayOff) {
				const { workedMinutes: shiftMins } = calculateShiftWorkedMinutes(day);
				workedMinutes += shiftMins;
			}
		}
	});

	datesInWeek.sort();
	const startDate = datesInWeek[0] || weekStartDate;
	const endDate = datesInWeek[datesInWeek.length - 1] || weekStartDate;

	// Apuração de Horas Extras vs Déficit semanal
	const balanceMinutes = workedMinutes - effectiveWeeklyLimitMinutes;
	let overtimeMinutes = 0;
	let deficitMinutes = 0;

	if (balanceMinutes > 0) {
		overtimeMinutes = balanceMinutes;
	} else if (balanceMinutes < 0) {
		deficitMinutes = Math.abs(balanceMinutes);
	}

	// Estimativa financeira caso o colaborador tenha salário cadastrado
	let overtimePayEstimate: number | undefined;
	if (contract?.baseSalary && contract.baseSalary > 0 && overtimeMinutes > 0) {
		const salaryComp = calculateSalaryCompensation(
			contract.baseSalary,
			effectiveWeeklyLimitHours,
			{
				overtimeRateWeekday: contract.overtimeRateWeekday,
				customDivisor: contract.customDivisor,
				targetDate: weekStartDate,
				customPromulgationDate,
			}
		);
		// Valor proporcional aos minutos de hora extra
		const overtimeHoursDecimal = overtimeMinutes / 60;
		overtimePayEstimate = overtimeHoursDecimal * salaryComp.overtimeHourlyRateWeekday;
	}

	// Número da semana do ano (ISO week)
	const d = parseIsoToDate(startDate);
	const target = new Date(d.valueOf());
	const dayNr = (d.getUTCDay() + 6) % 7;
	target.setUTCDate(target.getUTCDate() - dayNr + 3);
	const firstThursday = target.valueOf();
	target.setUTCMonth(0, 1);
	if (target.getUTCDay() !== 4) {
		target.setUTCMonth(0, 1 + ((4 - target.getUTCDay() + 7) % 7));
	}
	const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);

	return {
		weekNumber,
		startDate,
		endDate,
		phase,
		legalWeeklyLimitHours,
		effectiveWeeklyLimitHours,
		effectiveWeeklyLimitMinutes,
		workedMinutes,
		overtimeMinutes,
		deficitMinutes,
		balanceMinutes,
		overtimePayEstimate,
		formattedWorked: minutesToTime(workedMinutes),
		formattedOvertime: minutesToTime(overtimeMinutes),
		formattedBalance: minutesToTime(balanceMinutes, true),
	};
}
