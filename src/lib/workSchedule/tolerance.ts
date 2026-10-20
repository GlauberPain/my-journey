import { timeToMinutes } from '../calculator.ts';

/**
 * Regra de Tolerância Legal nas Batidas de Ponto (Art. 58, § 1º da CLT e Súmula 366 do TST)
 */
export const MAX_TOLERANCE_PER_PUNCH = 5;  // Limite individual de 5 minutos por registro
export const MAX_DAILY_TOLERANCE = 10;     // Limite máximo consolidado de 10 minutos no dia

export interface PunchPair {
  actual: string;    // Horário batido pelo trabalhador (ex: "08:04")
  scheduled: string; // Horário contratual esperado (ex: "08:00")
}

/**
 * Avalia se as variações de marcação de ponto do dia se enquadram na tolerância legal do Art. 58, § 1º da CLT.
 *
 * Retorna:
 * - isWithinTolerance: boolean
 * - totalVariationMinutes: soma das variações absolutas
 * - adjustedTimes: se dentro da tolerância, retorna os horários contratuais ajustados; caso contrário, os reais
 */
export function evaluateArt58Tolerance(
	punches: {
    start: PunchPair;
    end: PunchPair;
    breakStart?: PunchPair;
    breakEnd?: PunchPair;
  }
): {
  isWithinTolerance: boolean;
  totalVariationMinutes: number;
  hasIndividualExceeded: boolean;
  hasDailyExceeded: boolean;
} {
	const evaluateDiff = (actualStr: string, scheduledStr: string): number => {
		if (!actualStr || !scheduledStr) return 0;
		const actual = timeToMinutes(actualStr);
		const scheduled = timeToMinutes(scheduledStr);
		return Math.abs(actual - scheduled);
	};

	const startDiff = evaluateDiff(punches.start.actual, punches.start.scheduled);
	const endDiff = evaluateDiff(punches.end.actual, punches.end.scheduled);
	const breakStartDiff = punches.breakStart ? evaluateDiff(punches.breakStart.actual, punches.breakStart.scheduled) : 0;
	const breakEndDiff = punches.breakEnd ? evaluateDiff(punches.breakEnd.actual, punches.breakEnd.scheduled) : 0;

	// Súmula 366 TST: Nenhuma batida individual pode exceder 5 minutos
	const hasIndividualExceeded =
    startDiff > MAX_TOLERANCE_PER_PUNCH ||
    endDiff > MAX_TOLERANCE_PER_PUNCH ||
    breakStartDiff > MAX_TOLERANCE_PER_PUNCH ||
    breakEndDiff > MAX_TOLERANCE_PER_PUNCH;

	// Soma diária não pode exceder 10 minutos
	const totalVariationMinutes = startDiff + endDiff + breakStartDiff + breakEndDiff;
	const hasDailyExceeded = totalVariationMinutes > MAX_DAILY_TOLERANCE;

	const isWithinTolerance = !hasIndividualExceeded && !hasDailyExceeded;

	return {
		isWithinTolerance,
		totalVariationMinutes,
		hasIndividualExceeded,
		hasDailyExceeded,
	};
}
