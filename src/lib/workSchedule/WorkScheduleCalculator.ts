import type {
  WorkScheduleType,
  RawDayPunch,
  EmployeeWorkContract,
  DailyPunchCalculation,
  WorkScheduleMetadata,
  WorkSchedulePeriodSummary,
} from './types.ts';
import type { IWorkScheduleStrategy } from './strategies/IWorkScheduleStrategy.ts';
import { StandardScheduleStrategy } from './strategies/StandardScheduleStrategy.ts';
import { Scale12x36Strategy } from './strategies/Scale12x36Strategy.ts';
import { PartTimeStrategy } from './strategies/PartTimeStrategy.ts';
import { NightShiftStrategy } from './strategies/NightShiftStrategy.ts';
import { RotatingShiftStrategy } from './strategies/RotatingShiftStrategy.ts';
import { ExemptArt62Strategy } from './strategies/ExemptArt62Strategy.ts';

/**
 * Calculador e Orquestrador Central de Espelho de Ponto (Strategy / Policy Pattern)
 *
 * Recebe as marcações brutas e o contrato do colaborador, delegando
 * os cálculos para a estratégia especializada correspondente à modalidade de jornada.
 */
export class WorkScheduleCalculator {
  private static strategies: Map<WorkScheduleType, IWorkScheduleStrategy> = new Map([
    ['STANDARD', new StandardScheduleStrategy('STANDARD')],
    ['STANDARD_44H', new StandardScheduleStrategy('STANDARD_44H')],
    ['STANDARD_42H', new StandardScheduleStrategy('STANDARD_42H')],
    ['STANDARD_40H', new StandardScheduleStrategy('STANDARD_40H')],
    ['SCALE_12X36', new Scale12x36Strategy()],
    ['PART_TIME_30H', new PartTimeStrategy('PART_TIME_30H')],
    ['PART_TIME_26H', new PartTimeStrategy('PART_TIME_26H')],
    ['NIGHT_SHIFT', new NightShiftStrategy()],
    ['SHIFT_ROTATING_36H', new RotatingShiftStrategy()],
    ['EXEMPT_ART_62', new ExemptArt62Strategy()],
  ]);

  /**
   * Obtém a estratégia de apuração para um tipo específico de jornada
   */
  public static getStrategy(type: WorkScheduleType): IWorkScheduleStrategy {
    const strategy = this.strategies.get(type);
    if (!strategy) {
      // Fallback seguro para Standard
      return this.strategies.get('STANDARD')!;
    }
    return strategy;
  }

  /**
   * Retorna os metadados e parecer técnico/legal de uma modalidade de jornada
   */
  public static getMetadata(type: WorkScheduleType, targetDate?: string): WorkScheduleMetadata {
    return this.getStrategy(type).getMetadata(targetDate);
  }

  /**
   * Retorna os metadados de todas as modalidades de jornada catalogadas no sistema
   */
  public static listAllMetadata(targetDate?: string): WorkScheduleMetadata[] {
    const types: WorkScheduleType[] = [
      'STANDARD',
      'STANDARD_44H',
      'STANDARD_42H',
      'STANDARD_40H',
      'SCALE_12X36',
      'PART_TIME_30H',
      'PART_TIME_26H',
      'NIGHT_SHIFT',
      'SHIFT_ROTATING_36H',
      'EXEMPT_ART_62',
    ];
    return types.map((t) => this.getMetadata(t, targetDate));
  }

  /**
   * Calcula a apuração de um registro diário individual
   */
  public static calculateDaily(
    punch: RawDayPunch,
    contract?: EmployeeWorkContract
  ): DailyPunchCalculation {
    const scheduleType = contract?.scheduleType || 'STANDARD';
    const strategy = this.getStrategy(scheduleType);
    return strategy.calculateDailyPunch(punch, contract);
  }

  /**
   * Consolida a apuração de um período completo (semana, quinzena ou mês)
   */
  public static calculatePeriod(
    punches: RawDayPunch[],
    contract?: EmployeeWorkContract
  ): WorkSchedulePeriodSummary {
    const scheduleType = contract?.scheduleType || 'STANDARD';
    const strategy = this.getStrategy(scheduleType);
    return strategy.calculatePeriod(punches, contract);
  }
}
