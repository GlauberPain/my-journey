import type { TransitionPhase } from '../types.ts';

/**
 * Códigos padronizados de infrações legais trabalhistas
 */
export type LegalViolationCode =
	| 'INTRA_INTERVAL_MISSING_OVER_6H'
	| 'INTRA_INTERVAL_MISSING_4H_TO_6H'
	| 'INTRA_INTERVAL_BELOW_CCT_MINIMUM'
	| 'INTRA_INTERVAL_CCT_UNAUTHORIZED'
	| 'INTER_INTERVAL_VIOLATION_ART_66'
	| 'WEEKLY_LIMIT_EXCEEDED'
	| 'WEEKLY_REST_DAYS_INSUFFICIENT'
	| 'DAILY_LIMIT_EXCEEDED';

/**
 * Nível de severidade da inconsistência legal
 */
export type ViolationSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

/**
 * Versão e vigência das regras legais constitucionais e infraconstitucionais
 */
export interface LegalRuleVersion {
	phase: TransitionPhase;
	validFrom: string; // "YYYY-MM-DD"
	validTo?: string; // "YYYY-MM-DD" | undefined (vigência indeterminada/aberta)
	maxWeeklyHours: number; // 44, 42 ou 40
	minWeeklyRestDays: number; // 1 (Legado) ou 2 (Fase 1 e Fase 2 da PEC)
	defaultDivisor: number; // 220, 210 ou 200
	description: string;
}

/**
 * Parâmetros de Acordo Coletivo de Trabalho (ACT) ou Convenção Coletiva de Trabalho (CCT)
 */
export interface CollectiveAgreement {
	id: string;
	title: string;
	unionName?: string;
	validFrom: string; // "YYYY-MM-DD"
	validTo: string; // "YYYY-MM-DD"
	/**
	 * Art. 611-A, III da CLT: Redução do intervalo intrajornada para até 30 minutos
	 * em jornadas superiores a 6 horas.
	 */
	allowReducedIntraBreak30Min: boolean;
	customWeeklyHours?: number; // Carga semanal negociada inferior à lei
	customDivisor?: number; // Divisor específico acordado
	overtimeRateWeekday?: number; // Adicional hora extra dias úteis (default: 0.5)
	overtimeRateWeekend?: number; // Adicional hora extra folgas/DSR (default: 1.0)
	allow12x36?: boolean; // Autorização expressa para escala 12x36
}

/**
 * Configuração contratual do trabalhador com amarração sindical e de vigência
 */
export interface ContractRuleConfig {
	contractId?: string;
	employeeName?: string;
	baseSalary?: number;
	weeklyContractHours?: number; // Ex: 40h, 36h, 30h
	collectiveAgreement?: CollectiveAgreement;
	is12x36?: boolean;
	isPartTime?: boolean; // Regime de tempo parcial (Art. 58-A CLT)
	isExemptArt62?: boolean; // Cargo de confiança ou teletrabalho por tarefa
}

/**
 * Definição de um turno de trabalho para validação
 */
export interface WorkShift {
	date: string; // "YYYY-MM-DD"
	startTime: string; // "HH:mm" ou ""
	endTime: string; // "HH:mm" ou ""
	breakStartTime?: string; // "HH:mm" ou ""
	breakEndTime?: string; // "HH:mm" ou ""
	dayType?: 'work' | 'off' | 'holiday' | 'dsr' | 'leave';
	notes?: string;
}

/**
 * Detalhe de uma infração ou inconsistência legal identificada
 */
export interface LegalViolation {
	code: LegalViolationCode;
	article: string; // Ex: "Art. 71, caput da CLT", "Art. 66 da CLT", "Art. 7º, XIII da CF"
	severity: ViolationSeverity;
	message: string;
	date: string;
	remediation: string;
	details: {
		requiredMinutes?: number;
		actualMinutes?: number;
		deficitMinutes?: number;
		extraMinutes?: number;
		limitHours?: number;
		actualHours?: number;
		[key: string]: unknown;
	};
}

/**
 * Resultado da validação de um turno diário específico
 */
export interface ShiftValidationResult {
	date: string;
	isValid: boolean;
	grossMinutes: number; // Duração bruta (fim - início)
	breakMinutes: number; // Intervalo intrajornada
	netWorkedMinutes: number; // Duração líquida (bruta - intervalo)
	formattedNetWorked: string;
	violations: LegalViolation[];
}

/**
 * Resultado da validação do intervalo interjornada entre dois turnos consecutivos
 */
export interface InterShiftValidationResult {
	previousDate: string;
	currentDate: string;
	previousEndTime: string;
	currentStartTime: string;
	restMinutes: number;
	requiredRestMinutes: number; // 660 minutos = 11 horas
	deficitMinutes: number;
	isValid: boolean;
	violation?: LegalViolation;
}

/**
 * Entrada para a validação da grade semanal
 */
export interface WeeklyScheduleInput {
	weekStartDate: string; // "YYYY-MM-DD"
	shifts: WorkShift[];
	contract?: ContractRuleConfig;
	customPromulgationDate?: string;
}

/**
 * Resultado consolidado da validação da grade horária semanal
 */
export interface WeeklyScheduleValidationResult {
	isValid: boolean;
	weekStartDate: string;
	weekEndDate: string;
	phase: TransitionPhase;
	legalWeeklyLimitHours: number;
	effectiveWeeklyLimitHours: number;
	totalWorkedMinutes: number;
	totalWorkedHours: number;
	weeklyOvertimeMinutes: number;
	workDaysCount: number;
	restDaysCount: number;
	minRequiredRestDays: number;
	violations: LegalViolation[];
	shiftResults: ShiftValidationResult[];
	interShiftResults: InterShiftValidationResult[];
}
