import type {
  RawDayPunch,
  EmployeeWorkContract,
  DailyPunchCalculation,
  WorkScheduleMetadata,
  WorkSchedulePeriodSummary,
} from '../types.ts';

/**
 * Interface Strategy para apuração e regras de negócio de Jornadas de Trabalho
 */
export interface IWorkScheduleStrategy {
  /**
   * Retorna os metadados e documentação técnica/jurídica da modalidade de jornada
   */
  getMetadata(targetDate?: string): WorkScheduleMetadata;

  /**
   * Retorna o teto semanal legal em horas vigente para a modalidade
   */
  getEffectiveWeeklyLimit(targetDate: string, contract?: EmployeeWorkContract): number;

  /**
   * Retorna o divisor mensal da jornada para cálculo do salário-hora
   */
  getMonthlyDivisor(targetDate: string, contract?: EmployeeWorkContract): number;

  /**
   * Realiza a apuração de um registro de ponto diário
   */
  calculateDailyPunch(punch: RawDayPunch, contract?: EmployeeWorkContract): DailyPunchCalculation;

  /**
   * Consolida a apuração de um conjunto de batidas de ponto em um período (semana/mês)
   */
  calculatePeriod(
    punches: RawDayPunch[],
    contract?: EmployeeWorkContract
  ): WorkSchedulePeriodSummary;
}
