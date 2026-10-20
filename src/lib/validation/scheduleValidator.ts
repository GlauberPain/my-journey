import type {
	WorkShift,
	LegalViolation,
	ShiftValidationResult,
	InterShiftValidationResult,
	WeeklyScheduleInput,
	WeeklyScheduleValidationResult,
	LegalRuleVersion,
	ContractRuleConfig,
} from './types.ts';
import {
	getTransitionPhase,
	getTransitionMilestones,
	DEFAULT_PROMULGATION_DATE,
} from '../legalTransition.ts';
import { timeToMinutes, minutesToTime, calculateShiftWorkedMinutes } from '../calculator.ts';

/**
 * Retorna a versão da regra legal constitucional/trabalhista aplicável para uma data
 */
export function getLegalRuleForDate(
	targetDate: string | Date,
	customPromulgationDate: string = DEFAULT_PROMULGATION_DATE
): LegalRuleVersion {
	const phase = getTransitionPhase(targetDate, customPromulgationDate);
	const milestones = getTransitionMilestones(customPromulgationDate);

	switch (phase) {
		case 'LEGACY_44H':
			return {
				phase: 'LEGACY_44H',
				validFrom: '1988-10-05',
				validTo: milestones.phase1EffectiveDate,
				maxWeeklyHours: 44,
				minWeeklyRestDays: 1, // 1 dia de DSR (escala 6x1 permitida)
				defaultDivisor: 220,
				description: 'Regra Constitucional Legada (CF/88 Art. 7º, XIII): Limite de 44h semanais e descanso semanal remunerado preferencialmente aos domingos.',
			};
		case 'PHASE_1_42H':
			return {
				phase: 'PHASE_1_42H',
				validFrom: milestones.phase1EffectiveDate,
				validTo: milestones.phase2EffectiveDate,
				maxWeeklyHours: 42,
				minWeeklyRestDays: 2, // 2 dias de descanso garantidos (vedação à 6x1 tradicional de 44h)
				defaultDivisor: 210,
				description: 'Fase 1 da Emenda Constitucional (60 dias da promulgação): Redução para 42h semanais e garantia estrita de 2 dias de descanso semanal.',
			};
		case 'PHASE_2_40H':
			return {
				phase: 'PHASE_2_40H',
				validFrom: milestones.phase2EffectiveDate,
				maxWeeklyHours: 40,
				minWeeklyRestDays: 2, // 2 dias de descanso garantidos (escala 5x2 ou 4x3)
				defaultDivisor: 200,
				description: 'Fase 2 da Emenda Constitucional (12 meses após Fase 1): Teto semanal definitivo de 40h semanais com 2 dias de descanso semanal.',
			};
	}
}

/**
 * Valida um turno de trabalho individual quanto ao cumprimento estrito dos
 * intervalos intrajornada (Art. 71 CLT) e limites diários (Art. 59 CLT).
 *
 * Regras do Art. 71 da CLT:
 * 1. Jornada diária > 6h: Mínimo de 1 hora de intervalo.
 *    - Tolerância de redução para até 30 min SOMENTE mediante autorização em CCT/ACT (Art. 611-A, III).
 *    - Se for < 60 min sem CCT/ACT -> Violação Grave.
 *    - Se for < 30 min mesmo com CCT/ACT -> Violação Gravíssima (o piso absoluto sob CCT é 30 min).
 * 2. Jornada diária > 4h e <= 6h: Mínimo de 15 minutos de intervalo (Art. 71, § 1º).
 * 3. Jornada diária <= 4h: Intervalo obrigatório dispensado.
 * 4. O intervalo intrajornada NÃO integra a jornada de trabalho (Art. 71, § 2º).
 */
export function validateWorkShift(
	shift: WorkShift,
	contract?: ContractRuleConfig
): ShiftValidationResult {
	const isWorkDay = shift.dayType === 'work' || (!shift.dayType && Boolean(shift.startTime && shift.endTime));

	if (!isWorkDay || !shift.startTime || !shift.endTime) {
		return {
			date: shift.date,
			isValid: true,
			grossMinutes: 0,
			breakMinutes: 0,
			netWorkedMinutes: 0,
			formattedNetWorked: '00:00',
			violations: [],
		};
	}

	const { workedMinutes: netWorkedMinutes, breakMinutes } = calculateShiftWorkedMinutes({
		startTime: shift.startTime,
		endTime: shift.endTime,
		breakStartTime: shift.breakStartTime || '',
		breakEndTime: shift.breakEndTime || '',
	});

	const startMins = timeToMinutes(shift.startTime);
	let endMins = timeToMinutes(shift.endTime);
	if (endMins < startMins) {
		endMins += 24 * 60;
	}
	const grossMinutes = Math.max(0, endMins - startMins);

	const violations: LegalViolation[] = [];

	// Validações do Intervalo Intrajornada (Art. 71 da CLT)
	// A regra legal é aferida sobre a duração do trabalho contínuo / tempo líquido trabalhado
	const hasCctAgreement = Boolean(contract?.collectiveAgreement?.allowReducedIntraBreak30Min);

	if (netWorkedMinutes > 6 * 60) {
		// Jornada > 6h: exige 1h de intervalo (ou min 30 min se previsto em CCT/ACT)
		if (hasCctAgreement) {
			if (breakMinutes < 30) {
				violations.push({
					code: 'INTRA_INTERVAL_BELOW_CCT_MINIMUM',
					article: 'Art. 71, caput c/c Art. 611-A, III da CLT',
					severity: 'CRITICAL',
					message: `Intervalo intrajornada de ${breakMinutes} min viola o piso legal mínimo de 30 minutos autorizado em CCT/ACT.`,
					date: shift.date,
					remediation: 'Mesmo com previsão em Convenção ou Acordo Coletivo de Trabalho, o intervalo para jornadas superiores a 6 horas jamais pode ser reduzido para menos de 30 minutos.',
					details: {
						requiredMinutes: 30,
						actualMinutes: breakMinutes,
						deficitMinutes: 30 - breakMinutes,
					},
				});
			}
		} else {
			// Sem CCT/ACT: mínimo de 60 minutos
			if (breakMinutes < 60) {
				const isBetween30and59 = breakMinutes >= 30;
				violations.push({
					code: isBetween30and59 ? 'INTRA_INTERVAL_CCT_UNAUTHORIZED' : 'INTRA_INTERVAL_MISSING_OVER_6H',
					article: 'Art. 71, caput da CLT',
					severity: 'CRITICAL',
					message: isBetween30and59
						? `Intervalo intrajornada concedido de ${breakMinutes} min é inferior a 1 hora. A redução para 30 a 59 minutos em jornadas superiores a 6 horas exige Acordo ou Convenção Coletiva de Trabalho (CCT/ACT).`
						: `Jornada superior a 6 horas (${minutesToTime(netWorkedMinutes)}) exige intervalo intrajornada mínimo de 1 hora. Foi concedido apenas ${breakMinutes} min de descanso.`,
					date: shift.date,
					remediation: isBetween30and59
						? 'Para validar a redução do intervalo de almoço para até 30 minutos, vincule a respectiva cláusula de CCT/ACT ao contrato do colaborador, ou restabeleça o intervalo de 1 hora.'
						: 'Conceda no mínimo 1 hora (60 minutos) de intervalo intrajornada para refeição e descanso em jornadas superiores a 6 horas.',
					details: {
						requiredMinutes: 60,
						actualMinutes: breakMinutes,
						deficitMinutes: 60 - breakMinutes,
					},
				});
			}
		}
	} else if (netWorkedMinutes > 4 * 60 && netWorkedMinutes <= 6 * 60) {
		// Jornada > 4h e <= 6h: exige 15 min de intervalo
		if (breakMinutes < 15) {
			violations.push({
				code: 'INTRA_INTERVAL_MISSING_4H_TO_6H',
				article: 'Art. 71, § 1º da CLT',
				severity: 'CRITICAL',
				message: `Jornada de ${minutesToTime(netWorkedMinutes)} (superior a 4h e até 6h) exige intervalo intrajornada obrigatório de no mínimo 15 minutos. Concedidos: ${breakMinutes} min.`,
				date: shift.date,
				remediation: 'Conceda ao menos 15 minutos contínuos de intervalo para repouso em jornadas entre 4h e 6h.',
				details: {
					requiredMinutes: 15,
					actualMinutes: breakMinutes,
					deficitMinutes: 15 - breakMinutes,
				},
			});
		}
	}

	// Limite diário de horas trabalhadas (Art. 59 da CLT: máx 8h normais + 2h extras = 10h), exceto se 12x36
	if (!contract?.is12x36 && !contract?.isExemptArt62 && netWorkedMinutes > 10 * 60) {
		violations.push({
			code: 'DAILY_LIMIT_EXCEEDED',
			article: 'Art. 59, caput da CLT',
			severity: 'WARNING',
			message: `Jornada diária líquida de ${minutesToTime(netWorkedMinutes)} excede o limite máximo legal de 10 horas diárias (8 horas normais + 2 horas suplementares).`,
			date: shift.date,
			remediation: 'Limite a jornada de trabalho diária a no máximo 10 horas, salvo escalas especiais como 12x36 amparadas por lei.',
			details: {
				limitHours: 10,
				actualHours: Math.round((netWorkedMinutes / 60) * 100) / 100,
				extraMinutes: netWorkedMinutes - 10 * 60,
			},
		});
	}

	return {
		date: shift.date,
		isValid: violations.length === 0,
		grossMinutes,
		breakMinutes,
		netWorkedMinutes,
		formattedNetWorked: minutesToTime(netWorkedMinutes),
		violations,
	};
}

/**
 * Valida o descanso interjornada entre dois turnos consecutivos (Art. 66 da CLT: mínimo de 11h).
 */
export function validateInterShiftRest(
	previousShift: WorkShift,
	currentShift: WorkShift
): InterShiftValidationResult {
	const REQUIRED_REST_MINUTES = 11 * 60; // 660 minutos = 11 horas

	// Constrói timestamps precisos considerando data e horário
	const prevDate = previousShift.date;
	const currDate = currentShift.date;

	const prevEndMins = timeToMinutes(previousShift.endTime);
	const prevStartMins = timeToMinutes(previousShift.startTime);
	const currStartMins = timeToMinutes(currentShift.startTime);

	// Se o turno anterior virou a noite (ex: 22:00 às 06:00 do dia seguinte)
	const prevCrossesMidnight = prevEndMins < prevStartMins;

	// Calcula a diferença real em minutos entre o término do anterior e o início do atual
	const [pYear, pMonth, pDay] = prevDate.split('-').map(Number);
	const [cYear, cMonth, cDay] = currDate.split('-').map(Number);

	const prevEndDt = new Date(Date.UTC(pYear, pMonth - 1, pDay));
	if (prevCrossesMidnight) {
		prevEndDt.setUTCDate(prevEndDt.getUTCDate() + 1);
	}
	prevEndDt.setUTCHours(Math.floor(prevEndMins / 60), prevEndMins % 60, 0, 0);

	const currStartDt = new Date(Date.UTC(cYear, cMonth - 1, cDay, Math.floor(currStartMins / 60), currStartMins % 60, 0, 0));

	const diffMs = currStartDt.getTime() - prevEndDt.getTime();
	const restMinutes = Math.max(0, Math.floor(diffMs / (1000 * 60)));

	if (restMinutes < REQUIRED_REST_MINUTES) {
		const deficitMinutes = REQUIRED_REST_MINUTES - restMinutes;
		const violation: LegalViolation = {
			code: 'INTER_INTERVAL_VIOLATION_ART_66',
			article: 'Art. 66 da CLT e Súmula 110 do TST',
			severity: 'CRITICAL',
			message: `Intervalo interjornada de ${minutesToTime(restMinutes)} entre o término de ${prevDate} (${previousShift.endTime}) e o início de ${currDate} (${currentShift.startTime}) é inferior ao descanso obrigatório de 11 horas consecutivas.`,
			date: currDate,
			remediation: `O período de descanso suprimido de ${deficitMinutes} minutos (${minutesToTime(deficitMinutes)}) deve ser pago como horas extras com adicional mínimo de 50%, sem prejuízo da remuneração da jornada normal.`,
			details: {
				requiredMinutes: REQUIRED_REST_MINUTES,
				actualMinutes: restMinutes,
				deficitMinutes,
			},
		};

		return {
			previousDate: prevDate,
			currentDate: currDate,
			previousEndTime: previousShift.endTime,
			currentStartTime: currentShift.startTime,
			restMinutes,
			requiredRestMinutes: REQUIRED_REST_MINUTES,
			deficitMinutes,
			isValid: false,
			violation,
		};
	}

	return {
		previousDate: prevDate,
		currentDate: currDate,
		previousEndTime: previousShift.endTime,
		currentStartTime: currentShift.startTime,
		restMinutes,
		requiredRestMinutes: REQUIRED_REST_MINUTES,
		deficitMinutes: 0,
		isValid: true,
	};
}

/**
 * Validação abrangente de uma grade de horários semanal:
 * - Valida cada turno diário (intrajornada e limites diários).
 * - Valida os intervalos interjornada entre turnos sucessivos.
 * - Avalia o teto semanal legal e contratual pela vigência da data (44h -> 42h -> 40h).
 * - Assegura a garantia de pelo menos 2 dias de descanso semanal a partir da nova PEC.
 */
export function validateWeeklySchedule(input: WeeklyScheduleInput): WeeklyScheduleValidationResult {
	const { weekStartDate, shifts, contract, customPromulgationDate = DEFAULT_PROMULGATION_DATE } = input;

	// Ordena os turnos cronologicamente por data
	const sortedShifts = [...shifts].sort((a, b) => a.date.localeCompare(b.date));

	const legalRule = getLegalRuleForDate(weekStartDate, customPromulgationDate);

	// Teto efetivo considerando contrato mais benéfico (ex: 36h ou 40h)
	let effectiveWeeklyLimitHours = legalRule.maxWeeklyHours;
	if (contract?.weeklyContractHours && contract.weeklyContractHours > 0) {
		effectiveWeeklyLimitHours = Math.min(legalRule.maxWeeklyHours, contract.weeklyContractHours);
	}
	const effectiveWeeklyLimitMinutes = Math.round(effectiveWeeklyLimitHours * 60);

	const allViolations: LegalViolation[] = [];
	const shiftResults: ShiftValidationResult[] = [];
	const interShiftResults: InterShiftValidationResult[] = [];

	let totalWorkedMinutes = 0;
	let workDaysCount = 0;
	let restDaysCount = 0;

	// 1. Validação individual de cada turno (Intrajornada Art. 71)
	const workedShiftsList: WorkShift[] = [];

	sortedShifts.forEach((shift) => {
		const isWork = shift.dayType === 'work' || (!shift.dayType && Boolean(shift.startTime && shift.endTime));

		if (isWork) {
			workDaysCount++;
			workedShiftsList.push(shift);
			const shiftRes = validateWorkShift(shift, contract);
			shiftResults.push(shiftRes);
			totalWorkedMinutes += shiftRes.netWorkedMinutes;

			if (!shiftRes.isValid) {
				allViolations.push(...shiftRes.violations);
			}
		} else {
			restDaysCount++;
			shiftResults.push({
				date: shift.date,
				isValid: true,
				grossMinutes: 0,
				breakMinutes: 0,
				netWorkedMinutes: 0,
				formattedNetWorked: '00:00',
				violations: [],
			});
		}
	});

	// Se a semana informada tiver menos de 7 dias, computa os dias ausentes como folga/repouso
	if (sortedShifts.length < 7) {
		const missingDays = 7 - sortedShifts.length;
		restDaysCount += missingDays;
	}

	// 2. Validação dos descansos interjornada (Art. 66 CLT)
	for (let i = 0; i < workedShiftsList.length - 1; i++) {
		const prev = workedShiftsList[i];
		const curr = workedShiftsList[i + 1];

		if (prev.endTime && curr.startTime) {
			const interRes = validateInterShiftRest(prev, curr);
			interShiftResults.push(interRes);
			if (!interRes.isValid && interRes.violation) {
				allViolations.push(interRes.violation);
			}
		}
	}

	// 3. Validação do Descanso Semanal (PEC 221/2019: garantia de 2 dias de descanso)
	if (restDaysCount < legalRule.minWeeklyRestDays) {
		allViolations.push({
			code: 'WEEKLY_REST_DAYS_INSUFFICIENT',
			article: 'Art. 7º, XIII da CF / PEC 221/2019',
			severity: 'CRITICAL',
			message: `A legislação vigente para esta data exige no mínimo ${legalRule.minWeeklyRestDays} dias de descanso semanal. Foram concedidos apenas ${restDaysCount} dia(s) de repouso nesta semana.`,
			date: weekStartDate,
			remediation: `Adequar a escala para assegurar ao menos ${legalRule.minWeeklyRestDays} dias de descanso semanal (ex: escala 5x2 ou 4x3), vedando a escala 6x1 tradicional de descanso único.`,
			details: {
				requiredDays: legalRule.minWeeklyRestDays,
				actualDays: restDaysCount,
				deficitDays: legalRule.minWeeklyRestDays - restDaysCount,
			},
		});
	}

	// 4. Validação do Teto Semanal de Horas Trabalhadas
	const weeklyOvertimeMinutes = Math.max(0, totalWorkedMinutes - effectiveWeeklyLimitMinutes);
	if (weeklyOvertimeMinutes > 0) {
		const totalWorkedHours = Math.round((totalWorkedMinutes / 60) * 100) / 100;
		allViolations.push({
			code: 'WEEKLY_LIMIT_EXCEEDED',
			article: 'Art. 7º, XIII da Constituição Federal',
			severity: 'CRITICAL',
			message: `A jornada semanal acumulada de ${totalWorkedHours}h (${minutesToTime(totalWorkedMinutes)}) ultrapassa o teto semanal vigente de ${effectiveWeeklyLimitHours}h em ${minutesToTime(weeklyOvertimeMinutes)}.`,
			date: weekStartDate,
			remediation: `Remunerar as ${minutesToTime(weeklyOvertimeMinutes)} excedentes com adicional extraordinário mínimo de 50% ou ajustar a grade semanal para não ultrapassar ${effectiveWeeklyLimitHours}h.`,
			details: {
				limitHours: effectiveWeeklyLimitHours,
				actualHours: totalWorkedHours,
				extraMinutes: weeklyOvertimeMinutes,
			},
		});
	}

	const endDate = sortedShifts.length > 0 ? sortedShifts[sortedShifts.length - 1].date : weekStartDate;

	return {
		isValid: allViolations.length === 0,
		weekStartDate,
		weekEndDate: endDate,
		phase: legalRule.phase,
		legalWeeklyLimitHours: legalRule.maxWeeklyHours,
		effectiveWeeklyLimitHours,
		totalWorkedMinutes,
		totalWorkedHours: Math.round((totalWorkedMinutes / 60) * 100) / 100,
		weeklyOvertimeMinutes,
		workDaysCount,
		restDaysCount,
		minRequiredRestDays: legalRule.minWeeklyRestDays,
		violations: allViolations,
		shiftResults,
		interShiftResults,
	};
}
