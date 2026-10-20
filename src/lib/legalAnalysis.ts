import type { ScheduleDay, AiRuleResponse, EmployeeContract, TransitionPhase } from './types.ts';
import { calculateShiftWorkedMinutes } from './calculator.ts';
import {
	getEffectiveWeeklyLimit,
	getTransitionPhase,
	getSalaryDivisor,
	formatDateToIso,
} from './legalTransition.ts';

export interface LegalAnalysisResult {
  weeklyWorkedHours: number;
  workDaysPerWeek: number;
  offDaysPerWeek: number;
  scaleType: '6x1' | '5x2' | '4x3' | '12x36' | 'outro';
  isScale6x1: boolean;
  currentPhase: TransitionPhase;
  effectiveLimitHours: number;
  exceedsEffectiveLimit: boolean;
  exceeds44Hours: boolean;
  exceeds40Hours: boolean;
  isActiveViolation: boolean;
  violationSeverity: 'NONE' | 'WARNING_UPCOMING' | 'CRITICAL_ALARM';
  hasInsufficientInterval: boolean;
  eligibleForReduction: boolean;
  reductionReason: string;
  effectiveDateInfo: string;
  divisor: number;
  referenceMonthYear: string;
  moneyCompensation: {
    eligible: boolean;
    weekdayOvertimeRate: string; // "50%"
    weekendOvertimeRate: string; // "100%"
    weeklyOvertimeHours: number;
    description: string;
  };
  timeOffCompensation: {
    eligible: boolean;
    description: string;
  };
  recommendations: string[];
}

/**
 * Analisa a jornada do usuário à luz da CLT, da Constituição Federal e da
 * Emenda Constitucional / PEC do Fim da Escala 6x1 (Redução de Jornada).
 */
export function analyzeWorkScheduleLegislation(
	days: ScheduleDay[],
	aiResponse?: AiRuleResponse | null,
	contract?: EmployeeContract,
	referenceDate?: string | Date
): LegalAnalysisResult {
	// 1. Identificar padrões por dia da semana (0 a 6)
	const daysByWeekday: Record<number, ScheduleDay[]> = {};
	for (let i = 0; i <= 6; i++) {
		daysByWeekday[i] = [];
	}

	days.forEach((day) => {
		daysByWeekday[day.dayOfWeek]?.push(day);
	});

	// Conta quantos dias na semana típica têm trabalho ativo
	let activeWorkdaysCount = 0;
	let typicalWeeklyMinutes = 0;
	let hasIntervalViolation = false;

	for (let w = 0; w <= 6; w++) {
		const list = daysByWeekday[w];
		if (!list || list.length === 0) continue;

		// Pega o primeiro dia representativo preenchido desse dia da semana
		const sample = list.find((d) => d.dayType === 'work' && d.startTime && d.endTime);
		if (sample) {
			activeWorkdaysCount++;
			const { workedMinutes, breakMinutes } = calculateShiftWorkedMinutes(sample);
			typicalWeeklyMinutes += workedMinutes;

			// Verificação do Art. 71 CLT: jornada acima de 6h exige no mínimo 1h (60 min) de intervalo
			if (workedMinutes > 6 * 60 && breakMinutes < 60) {
				hasIntervalViolation = true;
			}
		}
	}

	// Se tivermos aiResponse direto, usamos as regras estruturadas para mais precisão
	if (aiResponse && aiResponse.rules && aiResponse.rules.length > 0) {
		const workRules = aiResponse.rules.filter((r) => r.dayType === 'work' && r.startTime && r.endTime);
		activeWorkdaysCount = workRules.length;
		typicalWeeklyMinutes = 0;
		workRules.forEach((r) => {
			const { workedMinutes, breakMinutes } = calculateShiftWorkedMinutes(r);
			typicalWeeklyMinutes += workedMinutes;
			if (workedMinutes > 6 * 60 && breakMinutes < 60) {
				hasIntervalViolation = true;
			}
		});
	}

	const weeklyWorkedHours = Math.round((typicalWeeklyMinutes / 60) * 10) / 10;
	const offDaysPerWeek = 7 - activeWorkdaysCount;

	// Determinar o tipo de escala
	let scaleType: LegalAnalysisResult['scaleType'] = 'outro';
	let isScale6x1 = false;

	if (activeWorkdaysCount === 6) {
		scaleType = '6x1';
		isScale6x1 = true;
	} else if (activeWorkdaysCount === 5) {
		scaleType = '5x2';
	} else if (activeWorkdaysCount === 4) {
		scaleType = '4x3';
	} else if (activeWorkdaysCount === 3 || activeWorkdaysCount === 4) {
		// Escala 12x36 (em média 3 a 4 plantões por semana de 12h)
		if (weeklyWorkedHours >= 34 && weeklyWorkedHours <= 48) {
			scaleType = '12x36';
		}
	}

	// Resolução da vigência legal com base na data de referência dos registros
	const targetDate = referenceDate || (days.length > 0 ? days[0].date : formatDateToIso(new Date()));
	const targetDateStr = typeof targetDate === 'string' ? targetDate.slice(0, 10) : formatDateToIso(targetDate);
	const currentPhase = getTransitionPhase(targetDate);
	const effectiveLimitHours = getEffectiveWeeklyLimit(targetDate, contract);
	const divisor = getSalaryDivisor(effectiveLimitHours, contract?.customDivisor);

	const [targetYear, targetMonth] = targetDateStr.split('-').map(Number);
	const MONTH_NAMES = [
		'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
		'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
	];
	const referenceMonthYear = targetYear && targetMonth ? `${MONTH_NAMES[targetMonth - 1]} de ${targetYear}` : '';

	const exceedsEffectiveLimit = weeklyWorkedHours > effectiveLimitHours;
	const exceeds44Hours = weeklyWorkedHours > 44;
	const exceeds40Hours = weeklyWorkedHours > 40;
	const weeklyOvertimeHours = Math.max(0, Math.round((weeklyWorkedHours - effectiveLimitHours) * 10) / 10);

	// Determina se a escala no mês de referência constitui violação ativa e ilegal
	// Até dezembro de 2026 (fase legada até 15/12/2026), 44h e 6x1 são legais -> AVISO PREVENTIVO (WARNING_UPCOMING).
	// A partir da Fase 1 (16/12/2026 e a partir de janeiro de 2027), o teto é 42h e 6x1 é inconstitucional:
	// - Carga > 42h (ex: 44h) ou escala 6x1 -> ALARME CRÍTICO (CRITICAL_ALARM / isActiveViolation = true).
	let isActiveViolation = false;
	let violationSeverity: 'NONE' | 'WARNING_UPCOMING' | 'CRITICAL_ALARM' = 'NONE';

	if (currentPhase === 'LEGACY_44H') {
		if (weeklyWorkedHours > 44) {
			isActiveViolation = true;
			violationSeverity = 'CRITICAL_ALARM';
		} else if (isScale6x1 || weeklyWorkedHours >= 44 || weeklyWorkedHours > 42) {
			isActiveViolation = false;
			violationSeverity = 'WARNING_UPCOMING';
		}
	} else if (currentPhase === 'PHASE_1_42H') {
		if (isScale6x1 || weeklyWorkedHours > 42) {
			isActiveViolation = true;
			violationSeverity = 'CRITICAL_ALARM';
		} else if (weeklyWorkedHours > 40) {
			isActiveViolation = false;
			violationSeverity = 'WARNING_UPCOMING'; // Redução futura para 40h na Fase 2
		}
	} else if (currentPhase === 'PHASE_2_40H') {
		if (isScale6x1 || weeklyWorkedHours > 40) {
			isActiveViolation = true;
			violationSeverity = 'CRITICAL_ALARM';
		}
	}

	// Elegibilidade para redução de carga horária e diagnóstico legal
	let eligibleForReduction = false;
	let reductionReason: string;

	if (isActiveViolation) {
		eligibleForReduction = true;
		if (isScale6x1) {
			reductionReason = `🚨 ALARME: Em ${referenceMonthYear || 'neste mês'}, a escala 6x1 é ilegal e inconstitucional perante a legislação vigente! A Emenda Constitucional já está em pleno vigor e proíbe a escala 6x1, exigindo no mínimo 2 dias de folga semanal (escala 5x2) com teto máximo de ${effectiveLimitHours}h semanais, sem redução salarial.`;
		} else {
			reductionReason = `🚨 ALARME: Em ${referenceMonthYear || 'neste mês'}, sua jornada semanal de ${weeklyWorkedHours}h ultrapassa o teto legal vigente de ${effectiveLimitHours}h semanais! A jornada de 44h não é mais permitida por lei. O excesso de ${weeklyOvertimeHours}h semanais constitui sobrejornada extraordinária e deve ser pago como hora extra ou a carga deve ser reduzida para ${effectiveLimitHours}h com salário integral preservado.`;
		}
	} else if (isScale6x1) {
		eligibleForReduction = true;
		reductionReason =
      'Sua jornada atual é na escala 6x1 (6 dias de trabalho por apenas 1 de folga). A partir de 16 de dezembro de 2026, a escala 6x1 será reduzida para 5x2 (garantindo no mínimo 2 dias de folga semanal sem redução salarial), com o primeiro teto caindo para 42h semanais e, após 12 meses (16 de dezembro de 2027), para 40h semanais.';
	} else if (weeklyWorkedHours >= 44) {
		eligibleForReduction = true;
		reductionReason =
      'Sua jornada semanal atual é de 44h. O fim da escala 6x1 não se resume a dias de folga, mas na redução mandatória da carga horária de trabalho: o limite máximo cai para 42h semanais a partir de 16 de dezembro de 2026 e para 40h em 16 de dezembro de 2027, com irredutibilidade salarial.';
	} else if (exceedsEffectiveLimit) {
		eligibleForReduction = true;
		reductionReason = `Sua jornada semanal atual de ${weeklyWorkedHours}h ultrapassa o limite vigente de ${effectiveLimitHours}h semanais. Esse excesso de ${weeklyOvertimeHours}h semanais deve ser pago como hora extra ou compensado.`;
	} else if (currentPhase === 'PHASE_1_42H' && weeklyWorkedHours > 40) {
		eligibleForReduction = true;
		reductionReason = `Sua jornada de ${weeklyWorkedHours}h semanais está adequada ao teto de 42h da Fase 1, e estará elegível para a redução da Fase 2 (teto de 40h semanais após 12 meses).`;
	} else {
		reductionReason = weeklyWorkedHours === effectiveLimitHours
			? `Sua jornada de ${weeklyWorkedHours}h semanais atinge o limite legal permitido e está em conformidade com as regras trabalhistas.`
			: `Sua jornada de ${weeklyWorkedHours}h semanais está abaixo do teto legal de ${effectiveLimitHours}h e em conformidade com as regras trabalhistas.`;
	}

	// A partir de que dia o trabalhador consegue a redução ou compensação
	let effectiveDateInfo: string;
	if (isActiveViolation) {
		if (isScale6x1) {
			effectiveDateInfo = `Escala Ilegal no Mês Vigente (${referenceMonthYear || 'mês atual'}): A nova lei já está em vigor. Trabalhar 6 dias com apenas 1 folga ou exceder o teto de ${effectiveLimitHours}h semanais gera direito imediato ao pagamento do trabalho no dia de descanso como hora extra extraordinária (mínimo de 50% em dias úteis ou 100% aos domingos/feriados), além do direito à alteração da escala para 5x2 com salário mantido.`;
		} else {
			effectiveDateInfo = `Carga Horária Excedente no Mês Vigente (${referenceMonthYear || 'mês atual'}): O teto constitucional neste período é de ${effectiveLimitHours}h semanais. Como você cumpre ${weeklyWorkedHours}h, há um excesso de ${weeklyOvertimeHours}h por semana que deve ser pago imediatamente como hora extra (adicional mínimo de 50%) ou compensado em banco de horas formal, preservando integralmente o salário base.`;
		}
	} else if (exceedsEffectiveLimit) {
		effectiveDateInfo = `Você tem direito imediato a horas extras: como a sua carga ultrapassa o teto legal de ${effectiveLimitHours}h semanais, as ${weeklyOvertimeHours}h excedentes devem ser pagas com adicional (mínimo de 50%) ou compensadas com banco de horas, com garantia de salário integral.`;
	} else if (isScale6x1) {
		effectiveDateInfo =
      'Atenção para quem trabalha em escala 6x1: A partir de 16 de dezembro de 2026, a sua escala será reduzida para 5x2 (garantindo no mínimo 2 dias de descanso semanal sem redução de salário) e o primeiro teto de horas passa para 42h semanais. Após 12 meses (16 de dezembro de 2027), a jornada reduzirá em definitivo para 40h semanais.';
	} else if (weeklyWorkedHours >= 44) {
		effectiveDateInfo =
      'Atenção para quem cumpre jornada de 44h semanais: O fim da escala 6x1 não se pauta apenas em um dia a mais de folga, mas na redução obrigatória da carga de trabalho: o limite máximo cai de 44h para 42h semanais a partir de 16 de dezembro de 2026 e para 40h em 16 de dezembro de 2027, sem redução salarial. Sua carga horária semanal deverá ser reduzida para se adequar aos novos limites.';
	} else {
		effectiveDateInfo = `Sua carga horária semanal respeita o limite legal de ${effectiveLimitHours}h e cumpre todas as normas e intervalos de descanso.`;
	}

	// Recomendações práticas
	const recommendations: string[] = [];

	if (isActiveViolation) {
		recommendations.push(
			`Readequação Compulsória de Escala: Exigir o ajuste imediato da jornada para o teto legal vigente de ${effectiveLimitHours}h semanais (divisor ${divisor}), sem qualquer redução salarial.`
		);
		if (isScale6x1) {
			recommendations.push(
				'Conversão Imediata de 6x1 para 5x2: Exigir a concessão de no mínimo 2 dias de descanso semanal remunerado por semana, conforme vigência da Emenda Constitucional.'
			);
			recommendations.push(
				'Cobrança de Horas Extras e DSR: Todo trabalho realizado além de 42h semanais ou no 6º dia deve ser quitado como hora extra com adicionais legais de 50% ou 100% (Súmula 146 do TST).'
			);
		} else {
			recommendations.push(
				`Pagamento de ${weeklyOvertimeHours}h Extras Semanais: Cobrar o pagamento das horas excedentes ao teto de ${effectiveLimitHours}h com adicional de no mínimo 50% sobre o salário-hora (divisor ${divisor}).`
			);
		}
	} else if (exceedsEffectiveLimit) {
		recommendations.push(
			`Exigir o cômputo e pagamento de ${weeklyOvertimeHours}h extras por semana com adicional de ${contract?.overtimeRateWeekday ? `${contract.overtimeRateWeekday * 100}%` : 'no mínimo 50%'} sobre o salário-hora (divisor ${divisor}), preservando integralmente o salário-base.`
		);
	}

	if (!isActiveViolation && (isScale6x1 || weeklyWorkedHours >= 44)) {
		if (isScale6x1) {
			recommendations.push(
				'Transição 6x1 para 5x2: A partir de 16 de dezembro de 2026, quem trabalha 6x1 passa a ter direito à escala 5x2 (mínimo de 2 dias de folga semanal) com primeiro teto de 42h semanais, sem qualquer redução no salário base.'
			);
		} else {
			recommendations.push(
				'Redução de Carga de 44h para 42h: A partir de 16 de dezembro de 2026, a carga horária semanal máxima permitida cai para 42h (divisor 210), devendo haver redução proporcional de horários sem diminuição salarial.'
			);
		}
		recommendations.push(
			'Redução definitiva para 40h: A partir de 16 de dezembro de 2027, o limite de horas cai em definitivo para 40h semanais (divisor 200).'
		);
		if (isScale6x1) {
			recommendations.push(
				'Caso a empresa convoque para trabalhar no segundo dia de descanso ou folga oficial, exigir a remuneração com adicional extraordinário de no mínimo 50% em dias úteis ou 100% aos domingos/feriados (Súmula 146 do TST).'
			);
		}
	}

	if (hasIntervalViolation) {
		if (scaleType === '12x36') {
			recommendations.push(
				'Plantonista 12x36 em plantão direto (Art. 59-A e Art. 71 da CLT): a permanência direta no posto com pausas de 15 minutos para lanche é padrão em hospitais e segurança. Caso o intervalo integral de 1h fora do posto não seja concedido, o período suprimido deve ser pago com adicional indenizatório de 50%.'
			);
		} else {
			recommendations.push(
				'Intervalo de almoço inferior a 1 hora em turnos superiores a 6 horas: você tem direito à indenização do período suprimido com adicional de 50% (Art. 71, § 4º da CLT).'
			);
		}
	}

	if (recommendations.length === 0) {
		recommendations.push(
			`Sua jornada de trabalho está equilibrada e em total conformidade com a legislação trabalhista brasileira (teto de ${effectiveLimitHours}h semanais, divisor ${divisor}).`
		);
	}

	return {
		weeklyWorkedHours,
		workDaysPerWeek: activeWorkdaysCount,
		offDaysPerWeek,
		scaleType,
		isScale6x1,
		currentPhase,
		effectiveLimitHours,
		exceedsEffectiveLimit,
		exceeds44Hours,
		exceeds40Hours,
		isActiveViolation,
		violationSeverity,
		hasInsufficientInterval: hasIntervalViolation,
		eligibleForReduction,
		reductionReason,
		effectiveDateInfo,
		divisor,
		referenceMonthYear,
		moneyCompensation: {
			eligible: exceedsEffectiveLimit || isScale6x1 || hasIntervalViolation || isActiveViolation,
			weekdayOvertimeRate: contract?.overtimeRateWeekday ? `${contract.overtimeRateWeekday * 100}%` : '50%',
			weekendOvertimeRate: contract?.overtimeRateWeekend ? `${contract.overtimeRateWeekend * 100}%` : '100%',
			weeklyOvertimeHours,
			description:
        'Pela CLT (Art. 59) e CF (Art. 7º, XVI), horas que excedam o teto legal vigente devem ser pagas com no mínimo 50% de adicional em dias úteis e 100% em folgas ou feriados trabalhados.',
		},
		timeOffCompensation: {
			eligible: true,
			description:
        'A compensação em folga só é válida se houver Banco de Horas instituído por acordo formal (prazo máximo de 6 meses por acordo individual escrito ou 1 ano por convenção coletiva). Se não for usufruído no prazo, a empresa é obrigada a pagar tudo em dinheiro com os adicionais.',
		},
		recommendations,
	};
}

