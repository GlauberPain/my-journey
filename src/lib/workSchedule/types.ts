import type { TransitionPhase } from '../types.ts';

/**
 * Tipificações formais de Jornada de Trabalho na legislação brasileira (CLT, CF/88 e PEC 221/2019)
 */
export type WorkScheduleType =
  | 'STANDARD'            // Dinâmica: resolve entre 44h, 42h e 40h conforme a data de vigência
  | 'STANDARD_44H'        // Regra Legada: 44h semanais, 8h/dia ou 8h48 compensado 5x2, divisor 220
  | 'STANDARD_42H'        // Fase 1 da Transição: 42h semanais (a partir de 15/12/2026), divisor 210
  | 'STANDARD_40H'        // Fase 2 da Transição: 40h semanais (após 12 meses, 15/12/2027), divisor 200
  | 'SCALE_12X36'         // Art. 59-A da CLT: 12h de trabalho por 36h de descanso ininterrupto
  | 'PART_TIME_30H'       // Art. 58-A da CLT: Tempo parcial de até 30h semanais (vedadas horas extras)
  | 'PART_TIME_26H'       // Art. 58-A da CLT: Tempo parcial de até 26h semanais (até 6h extras semanais)
  | 'NIGHT_SHIFT'         // Art. 73 da CLT: Jornada noturna (22h-05h), hora ficta (52m30s), adicional 20%
  | 'SHIFT_ROTATING_36H'  // Art. 7º, XIV da CF/88: Turnos ininterruptos de revezamento (6h/dia, 36h/sem)
  | 'EXEMPT_ART_62';      // Art. 62 da CLT: Teletrabalho por tarefa/produção ou cargo de gestão (sem controle)

/**
 * Batida bruta de ponto registrada pelo colaborador em um determinado dia
 */
export interface RawDayPunch {
  date: string;            // "YYYY-MM-DD"
  startTime?: string;      // "HH:mm"
  breakStartTime?: string; // "HH:mm"
  breakEndTime?: string;   // "HH:mm"
  endTime?: string;        // "HH:mm"
  dayType?: 'work' | 'off' | 'holiday' | 'dsr';
  isHoliday?: boolean;
  workedOnHoliday?: boolean;
}

/**
 * Contrato de trabalho e preferências do colaborador para a apuração
 */
export interface EmployeeWorkContract {
  employeeId?: string;
  name?: string;
  scheduleType: WorkScheduleType;
  baseSalary?: number;            // Salário base mensal (R$)
  weeklyContractHours?: number;   // Carga contratada específica (se diferente do teto legal)
  customDivisor?: number;         // Divisor específico de CCT/ACT
  overtimeRateWeekday?: number;   // Adicional dia útil (default: 0.50 = 50%)
  overtimeRateWeekend?: number;   // Adicional folga/feriado (default: 1.00 = 100%)
  nightAdditionalRate?: number;   // Adicional noturno (default: 0.20 = 20%)
  applyToleranceArt58?: boolean;  // Aplica tolerância de 5/10 min do Art. 58 § 1º CLT (default: true)
  allowPost5amNightExtension?: boolean; // Aplica Súmula 60, II TST para prorrogação pós 05h (default: true)
}

/**
 * Resultado da decomposição detalhada de horas diurnas e noturnas de um dia de trabalho
 */
export interface DailyPunchCalculation {
  date: string;
  scheduleType: WorkScheduleType;
  // Minutos Relógio (tempo cronológico real)
  grossWorkedMinutes: number;
  breakMinutes: number;
  netClockWorkedMinutes: number;
  // Segregação Diurna vs Noturna
  daytimeWorkedMinutes: number;       // Minutos relógio diurnos (fora de 22h-05h)
  nighttimeClockMinutes: number;      // Minutos relógio no período noturno (22h-05h)
  nighttimeFictitiousMinutes: number; // Minutos após aplicação do fator 60/52.5
  nighttimeBonusMinutes: number;      // Acréscimo fictício decorrente da redução legal (fictício - relógio)
  nighttimeExtendedMinutes: number;   // Minutos de prorrogação pós 05h (Súmula 60 TST)
  // Horas Trabalhadas Efetivas Totais (Diurno + Noturno Fictício)
  effectiveWorkedMinutes: number;
  expectedDailyMinutes: number;
  // Horas Extras e Saldo Diário
  dailyOvertimeMinutes: number;       // Excedente ao teto diário
  dailyDeficitMinutes: number;        // Déficit em relação à meta diária
  dailyBalanceMinutes: number;        // worked - expected
  // Flags e Alertas Legais
  isHolidayWork: boolean;
  hasInsufficientInterval: boolean;   // Intervalo intrajornada inferior a 1h em turnos > 6h (Art. 71 CLT)
  isArt58ToleranceApplied: boolean;   // Se a variação de ponto estava dentro dos 5/10 min
  legalWarnings: string[];            // Violações de tempo parcial, excesso de horas extras, etc.
}

/**
 * Metadados e Documentação Legal de uma modalidade de jornada
 */
export interface WorkScheduleMetadata {
  type: WorkScheduleType;
  title: string;
  legalBasis: string;                 // Artigos da CLT / CF / Súmulas TST
  standardDailyHours: number;         // Horas diárias padrão
  standardWeeklyHours: number;        // Horas semanais padrão
  monthlyDivisor: number;             // Divisor mensal base
  overtimeEligible: boolean;          // Gera horas extras?
  nightBonusEligible: boolean;        // Elegível a adicional noturno?
  toleranceApplicable: boolean;       // Sujeito a tolerância do Art. 58 § 1º CLT?
  description: string;
  legalPeculiarities: string[];       // Particularidades jurídicas da modalidade
}

/**
 * Consolidação Periódica (Semanal ou Mensal) do Espelho de Ponto
 */
export interface WorkSchedulePeriodSummary {
  startDate: string;
  endDate: string;
  scheduleType: WorkScheduleType;
  effectivePhase: TransitionPhase;
  totalDays: number;
  workedDaysCount: number;
  // Totais de Horas
  totalEffectiveWorkedMinutes: number;
  totalExpectedMinutes: number;
  totalDaytimeMinutes: number;
  totalNighttimeClockMinutes: number;
  totalNighttimeFictitiousMinutes: number;
  totalNighttimeBonusMinutes: number;
  // Extras e Saldo
  totalOvertimeMinutesWeekday: number; // Horas extras normais (mínimo 50%)
  totalOvertimeMinutesWeekend: number; // Horas extras em folgas/feriados (100%)
  totalOvertimeMinutesNight: number;   // Horas extras que coincidiram com horário noturno
  totalDeficitMinutes: number;
  totalBalanceMinutes: number;
  // Valores Financeiros Calculados (se salário informado)
  baseSalary?: number;
  monthlyDivisor: number;
  regularHourlyRate?: number;
  overtimePayWeekday?: number;
  overtimePayWeekend?: number;
  nightAdditionalPay?: number;
  totalEarningsEstimate?: number;
  // Violações / Alertas acumulados
  legalInfractions: string[];
}
