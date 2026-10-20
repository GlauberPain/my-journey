import { ScheduleDay, AiRuleResponse } from './types';
import { calculateShiftWorkedMinutes, timeToMinutes } from './calculator';

export interface LegalAnalysisResult {
  weeklyWorkedHours: number;
  workDaysPerWeek: number;
  offDaysPerWeek: number;
  scaleType: '6x1' | '5x2' | '4x3' | '12x36' | 'outro';
  isScale6x1: boolean;
  exceeds44Hours: boolean;
  exceeds40Hours: boolean;
  hasInsufficientInterval: boolean;
  eligibleForReduction: boolean;
  reductionReason: string;
  effectiveDateInfo: string;
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
  aiResponse?: AiRuleResponse | null
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
    // Pode ser escala 12x36 dependendo da duração do turno
    if (weeklyWorkedHours >= 36 && weeklyWorkedHours <= 42) {
      scaleType = '12x36';
    }
  }

  const exceeds44Hours = weeklyWorkedHours > 44;
  const exceeds40Hours = weeklyWorkedHours > 40;
  const weeklyOvertimeHours = Math.max(0, Math.round((weeklyWorkedHours - 44) * 10) / 10);

  // Elegibilidade para redução de carga horária
  let eligibleForReduction = false;
  let reductionReason = '';

  if (isScale6x1) {
    eligibleForReduction = true;
    reductionReason =
      'Sua jornada é na escala 6x1 (6 dias de trabalho por apenas 1 de descanso). Você tem direito garantido à transição para a garantia de no mínimo 2 dias de descanso semanal e redução de carga horária sem redução de salário.';
  } else if (exceeds44Hours) {
    eligibleForReduction = true;
    reductionReason = `Sua jornada semanal atual de ${weeklyWorkedHours}h ultrapassa o limite constitucional máximo de 44 horas semanais (Art. 7º, XIII da CF). Esse excesso é ilegal sem a devida compensação.`;
  } else if (exceeds40Hours) {
    eligibleForReduction = true;
    reductionReason = `Sua jornada de ${weeklyWorkedHours}h/semana está elegível para o novo teto de 40h semanais aprovado na Emenda Constitucional da jornada de trabalho.`;
  } else {
    reductionReason = `Sua carga horária de ${weeklyWorkedHours}h semanais já se encontra dentro dos parâmetros legais previstos para a sua escala (${activeWorkdaysCount} dias trabalhados por semana).`;
  }

  // A partir de que dia o trabalhador consegue a redução ou compensação
  let effectiveDateInfo = '';
  if (exceeds44Hours) {
    effectiveDateInfo =
      'DIREITO IMEDIATO: Como sua carga horária ultrapassa o limite máximo da CLT (44h), o direito à compensação em dinheiro (horas extras) ou em folgas é IMEDIATO a partir do primeiro dia em que você trabalhou além do limite legal.';
  } else if (isScale6x1) {
    effectiveDateInfo =
      'VIGÊNCIA LEGAL: A Emenda Constitucional promulgada pelo Congresso Nacional que extingue a escala 6x1 estabelece prazo para que as empresas e acordos coletivos façam a migração para a garantia de 2 dias de descanso semanal. Se a empresa não realizar o ajuste, qualquer trabalho no 6º dia deve ser compensado integralmente.';
  } else {
    effectiveDateInfo =
      'REGULAR: Sua jornada atual já respeita os limites legais de descanso e de carga horária estabelecidos na legislação.';
  }

  // Recomendações práticas
  const recommendations: string[] = [];

  if (exceeds44Hours) {
    recommendations.push(
      `Exigir o pagamento de ${weeklyOvertimeHours}h extras por semana com adicional mínimo de 50% sobre o valor da hora normal (Art. 59 da CLT).`
    );
  }

  if (isScale6x1) {
    recommendations.push(
      'Negociar a migração para escala 5x2 (dois dias de folga semanal) sem qualquer redução salarial, conforme os novos termos constitucionais.'
    );
    recommendations.push(
      'Caso trabalhe aos domingos ou no dia oficial de repouso sem folga substitutiva na mesma semana, exigir remuneração em dobro (adicional de 100% - Súmula 146 do TST).'
    );
  }

  if (hasIntervalViolation) {
    recommendations.push(
      'Intervalo de almoço inferior a 1 hora em turnos superiores a 6 horas: você tem direito à indenização do período suprimido com adicional de 50% (Art. 71, § 4º da CLT).'
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      'Sua jornada de trabalho está equilibrada e em total conformidade com a legislação trabalhista brasileira.'
    );
  }

  return {
    weeklyWorkedHours,
    workDaysPerWeek: activeWorkdaysCount,
    offDaysPerWeek,
    scaleType,
    isScale6x1,
    exceeds44Hours,
    exceeds40Hours,
    hasInsufficientInterval: hasIntervalViolation,
    eligibleForReduction,
    reductionReason,
    effectiveDateInfo,
    moneyCompensation: {
      eligible: exceeds44Hours || isScale6x1 || hasIntervalViolation,
      weekdayOvertimeRate: '50%',
      weekendOvertimeRate: '100%',
      weeklyOvertimeHours,
      description:
        'Pela CLT (Art. 59) e CF (Art. 7º, XVI), horas que excedam a jornada legal devem ser pagas com no mínimo 50% de adicional em dias normais e 100% em folgas ou feriados trabalhados.',
    },
    timeOffCompensation: {
      eligible: true,
      description:
        'A compensação em folga só é válida se houver Banco de Horas instituído por acordo formal (prazo máximo de 6 meses por acordo individual escrito ou 1 ano por convenção coletiva). Se não for usufruído no prazo, a empresa é obrigada a pagar tudo em dinheiro com os adicionais.',
    },
    recommendations,
  };
}
