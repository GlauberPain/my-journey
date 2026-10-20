/**
 * Cálculo e lista oficial dos feriados nacionais brasileiros (fixos e móveis).
 * Inclui o Dia da Consciência Negra (20 de novembro - Lei 14.759/2023)
 * e o cálculo astronômico da Páscoa (Meeus/Jones/Butcher) para Carnaval,
 * Sexta-feira Santa e Corpus Christi.
 */

export interface Holiday {
  date: string; // "YYYY-MM-DD"
  name: string;
  type: 'national';
}

/**
 * Calcula a data do Domingo de Páscoa para um determinado ano
 */
function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(year, month - 1, day);
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Retorna todos os feriados nacionais para o ano especificado
 */
export function getBrazilianHolidays(year: number): Record<string, string> {
  const holidays: Record<string, string> = {
    // Feriados Nacionais Fixos (Leis Federais nº 662/1949, 10.607/2002 e 14.759/2023)
    [`${year}-01-01`]: 'Confraternização Universal (Ano Novo)',
    [`${year}-04-21`]: 'Tiradentes',
    [`${year}-05-01`]: 'Dia do Trabalho',
    [`${year}-09-07`]: 'Independência do Brasil',
    [`${year}-10-12`]: 'Nossa Senhora Aparecida (Padroeira do Brasil)',
    [`${year}-11-02`]: 'Finados',
    [`${year}-11-15`]: 'Proclamação da República',
    [`${year}-11-20`]: 'Dia Nacional de Zumbi e da Consciência Negra',
    [`${year}-12-25`]: 'Natal',
  };

  // Feriados Móveis baseados na Páscoa
  const easter = getEasterSunday(year);

  // Terça-feira de Carnaval (Páscoa - 47 dias)
  const carnival = addDays(easter, -47);
  holidays[formatDate(carnival)] = 'Carnaval';

  // Sexta-feira Santa / Paixão de Cristo (Páscoa - 2 dias)
  const goodFriday = addDays(easter, -2);
  holidays[formatDate(goodFriday)] = 'Sexta-feira Santa (Paixão de Cristo)';

  // Domingo de Páscoa
  holidays[formatDate(easter)] = 'Páscoa';

  // Corpus Christi (Páscoa + 60 dias)
  const corpusChristi = addDays(easter, 60);
  holidays[formatDate(corpusChristi)] = 'Corpus Christi';

  return holidays;
}

/**
 * Verifica se uma data específica (YYYY-MM-DD) é feriado nacional
 */
export function getHolidayName(dateStr: string): string | null {
  if (!dateStr) return null;
  const year = parseInt(dateStr.split('-')[0], 10);
  if (isNaN(year)) return null;

  const holidays = getBrazilianHolidays(year);
  return holidays[dateStr] || null;
}
