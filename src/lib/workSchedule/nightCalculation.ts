import { timeToMinutes } from '../calculator.ts';

/**
 * Constantes da legislação brasileira para o trabalho noturno urbano (Art. 73 da CLT)
 */
export const NIGHT_START_MINUTES = 22 * 60; // 22:00 (1320 minutos)
export const NIGHT_END_MINUTES = 5 * 60;    // 05:00 (300 minutos)

/**
 * Fator de conversão da hora ficta noturna:
 * 60 minutos normais / 52.5 minutos legais = 8 / 7 = ~1.14285714...
 */
export const NIGHT_FACTOR = 60 / 52.5;

export interface ShiftIntervalInterval {
  start: number; // minutos a partir das 00:00 do dia de início
  end: number;   // minutos (pode ser > 1440 se cruzar a meia-noite)
}

/**
 * Decompõe um turno (com suporte a virada de noite) em minutos diurnos e noturnos.
 */
export function calculateNightBreakdown(
  startTimeStr: string,
  endTimeStr: string,
  breakStartStr?: string,
  breakEndStr?: string,
  allowPost5amExtension: boolean = true
): {
  grossMinutes: number;
  breakMinutes: number;
  netClockMinutes: number;
  daytimeMinutes: number;
  nightClockMinutes: number;
  nightFictitiousMinutes: number;
  nightBonusMinutes: number;
  extendedNightMinutes: number;
} {
  if (!startTimeStr || !endTimeStr) {
    return {
      grossMinutes: 0,
      breakMinutes: 0,
      netClockMinutes: 0,
      daytimeMinutes: 0,
      nightClockMinutes: 0,
      nightFictitiousMinutes: 0,
      nightBonusMinutes: 0,
      extendedNightMinutes: 0,
    };
  }

  const start = timeToMinutes(startTimeStr);
  let end = timeToMinutes(endTimeStr);

  // Turno que cruza a meia-noite (ex: 22:00 -> 06:00 = 1320 -> 1800)
  if (end < start) {
    end += 24 * 60;
  }

  // Intervalo intrajornada
  let breakStart: number | undefined;
  let breakEnd: number | undefined;
  let totalBreakMinutes = 0;

  if (breakStartStr && breakEndStr) {
    breakStart = timeToMinutes(breakStartStr);
    breakEnd = timeToMinutes(breakEndStr);
    if (breakStart < start) {
      breakStart += 24 * 60;
    }
    if (breakEnd < breakStart) {
      breakEnd += 24 * 60;
    }
    totalBreakMinutes = Math.max(0, breakEnd - breakStart);
  }

  // Varredura minuto a minuto para máxima exatidão jurídica
  let daytimeMinutes = 0;
  let nightClockMinutes = 0;
  let extendedNightMinutes = 0;

  // Critério da Súmula 60, II do TST para prorrogação pós 05h00:
  // Se o turno começou durante o período noturno (ou antes) e trabalhou substancialmente a madrugada até às 05h00,
  // os minutos subsequentes às 05:00 são considerados prorrogação noturna.
  const hasWorkedThroughoutNight = start < 24 * 60 + NIGHT_END_MINUTES && end > 24 * 60 + NIGHT_END_MINUTES;

  for (let m = start; m < end; m++) {
    // Se o minuto estiver dentro do intervalo intrajornada, desconsidera
    if (breakStart !== undefined && breakEnd !== undefined && m >= breakStart && m < breakEnd) {
      continue;
    }

    const minuteInDay = m % (24 * 60);

    // Período Noturno Estrito (22:00 às 05:00)
    // - Antes da meia-noite: >= 22:00 (1320)
    // - Após a meia-noite: < 05:00 (300)
    const isStrictNight = minuteInDay >= NIGHT_START_MINUTES || minuteInDay < NIGHT_END_MINUTES;

    if (isStrictNight) {
      nightClockMinutes++;
    } else {
      // Verifica se é prorrogação noturna pós 05:00 (Súmula 60 TST)
      // Ocorre quando m >= 24 * 60 + 300 (05h do segundo dia) e o trabalhador cumpriu o período noturno
      const isPost5amExtension = allowPost5amExtension && hasWorkedThroughoutNight && m >= (24 * 60 + NIGHT_END_MINUTES);

      if (isPost5amExtension) {
        extendedNightMinutes++;
        nightClockMinutes++;
      } else {
        daytimeMinutes++;
      }
    }
  }

  const grossMinutes = end - start;
  const netClockMinutes = grossMinutes - totalBreakMinutes;

  // Aplicação da hora ficta noturna (fator 60/52.5)
  // Cada minuto relógio noturno equivale a (60 / 52.5) minutos fictos
  const nightFictitiousMinutes = Math.round(nightClockMinutes * NIGHT_FACTOR * 100) / 100;
  const nightBonusMinutes = Math.max(0, Math.round((nightFictitiousMinutes - nightClockMinutes) * 100) / 100);

  return {
    grossMinutes,
    breakMinutes: totalBreakMinutes,
    netClockMinutes,
    daytimeMinutes,
    nightClockMinutes,
    nightFictitiousMinutes,
    nightBonusMinutes,
    extendedNightMinutes,
  };
}
