export type DayType = 'work' | 'off' | 'holiday' | 'dsr' | 'leave';

export interface ShiftTime {
  startTime: string;       // "HH:mm" ou ""
  breakStartTime: string;  // "HH:mm" ou ""
  breakEndTime: string;    // "HH:mm" ou ""
  endTime: string;         // "HH:mm" ou ""
}

export interface ScheduleDay extends ShiftTime {
  date: string;            // "YYYY-MM-DD"
  dayOfWeek: number;       // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
  dayType: DayType;
  notes?: string;
  isCustom?: boolean;
  isHoliday?: boolean;
  holidayName?: string;
  workedOnHoliday?: boolean; // Sinalizado pelo usuário que irá trabalhar no feriado
}

export interface DayCalculation {
  workedMinutes: number;
  breakMinutes: number;
  expectedMinutes: number;
  balanceMinutes: number;
  formattedWorked: string;
  formattedBalance: string;
  isOvertime: boolean;
  isDeficit: boolean;
  isHolidayWork: boolean;
}

export interface MonthSummary {
  totalWorkedMinutes: number;
  totalExpectedMinutes: number;
  totalBalanceMinutes: number;
  workDaysCount: number;
  offDaysCount: number;
  holidayDaysCount: number;
  holidayWorkedMinutes: number;
  formattedTotalWorked: string;
  formattedExpected: string;
  formattedBalance: string;
  formattedHolidayWorked: string;
}

export interface AiRuleResponse {
  formula: string;
  explanation: string;
  weeklyTargetHours: number;
  dailyTargetHours: number;
  rules: {
    dayOfWeek: number; // 0 = Domingo, 1 = Seg, ..., 6 = Sáb. Ou -1 para todos os dias úteis
    dayType: DayType;
    startTime: string;
    breakStartTime: string;
    breakEndTime: string;
    endTime: string;
  }[];
}

/**
 * Fases da transição da Emenda Constitucional da jornada de trabalho (PEC 221/2019)
 */
export type TransitionPhase = 'LEGACY_44H' | 'PHASE_1_42H' | 'PHASE_2_40H';

/**
 * Marcos temporais de vigência legal da transição
 */
export interface TransitionMilestones {
  promulgationDate: string; // Ex: "2026-10-15"
  phase1EffectiveDate: string; // Ex: "2026-12-14" (60 dias após)
  phase2EffectiveDate: string; // Ex: "2027-12-14" (12 meses após Fase 1)
}

/**
 * Parametrização contratual ou sindical (CCT/ACT) de jornada por colaborador
 */
export interface EmployeeContract {
  employeeId?: string;
  name?: string;
  baseSalary?: number; // Salário-base mensal (ex: 4400.00)
  weeklyContractHours?: number; // Carga semanal contratada específica (ex: 40, 36, 30). Se omitido, segue a lei vigente.
  customDivisor?: number; // Divisor específico estipulado em CCT/ACT (ex: 180, 200, 210, 220)
  overtimeRateWeekday?: number; // Adicional de hora extra em dias úteis (default: 0.5 = 50%)
  overtimeRateWeekend?: number; // Adicional em folgas e feriados (default: 1.0 = 100%)
  hasCompensationAgreement?: boolean; // Acordo individual ou coletivo de banco de horas/compensação
  toleranceDailyMinutes?: number; // Tolerância máxima diária (CLT Art. 58 § 1º: 10 minutos)
}

/**
 * Apuração e cálculo financeiro do salário-hora e adicionais com garantia de irredutibilidade
 */
export interface SalaryHourCalculation {
  baseSalary: number;
  weeklyHours: number;
  divisor: number;
  regularHourlyRate: number; // Salário-hora normal
  overtimeHourlyRateWeekday: number; // Valor da hora com adicional de dia útil
  overtimeHourlyRateWeekend: number; // Valor da hora em folga/feriado
  effectivePhase: TransitionPhase;
}

/**
 * Apuração consolidada de uma semana do espelho de ponto
 */
export interface WeeklyScheduleSummary {
  weekNumber: number;
  startDate: string; // "YYYY-MM-DD"
  endDate: string; // "YYYY-MM-DD"
  phase: TransitionPhase;
  legalWeeklyLimitHours: number; // 44, 42 ou 40
  effectiveWeeklyLimitHours: number; // Teto efetivo considerando contrato
  effectiveWeeklyLimitMinutes: number;
  workedMinutes: number;
  overtimeMinutes: number; // Minutos excedentes ao teto semanal
  deficitMinutes: number; // Minutos faltantes em relação ao teto
  balanceMinutes: number; // Saldo líquido (worked - limit)
  overtimePayEstimate?: number; // Estimativa monetária das horas extras semanais
  formattedWorked: string;
  formattedOvertime: string;
  formattedBalance: string;
}

