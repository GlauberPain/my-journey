import { describe, it } from 'node:test';
import assert from 'node:assert';
import { WorkScheduleCalculator } from './WorkScheduleCalculator.ts';
import { evaluateArt58Tolerance } from './tolerance.ts';
import { calculateNightBreakdown } from './nightCalculation.ts';
import type { RawDayPunch, EmployeeWorkContract } from './types.ts';

describe('Módulo de Tipos de Jornadas de Trabalho (CLT, CF/88 e PEC 221/2019)', () => {
  describe('1. Versionamento por Vigência Legal (PEC 221/2019 / Standard)', () => {
    it('deve aplicar teto de 44h e divisor 220 para registros antes de 16/12/2026', () => {
      const punch: RawDayPunch = {
        date: '2026-11-10',
        dayType: 'work',
        startTime: '08:00',
        endTime: '17:48',
        breakStartTime: '12:00',
        breakEndTime: '13:00',
      };
      const contract: EmployeeWorkContract = { scheduleType: 'STANDARD' };
      const result = WorkScheduleCalculator.calculateDaily(punch, contract);

      const metadata = WorkScheduleCalculator.getMetadata('STANDARD', '2026-11-10');
      assert.strictEqual(metadata.standardWeeklyHours, 44);
      assert.strictEqual(metadata.monthlyDivisor, 220);
      assert.strictEqual(result.effectiveWorkedMinutes, 528); // 8h48min
      assert.strictEqual(result.dailyOvertimeMinutes, 0); // dentro da meta diária de 44h 5x2 (528m)
    });

    it('deve aplicar teto de 42h e divisor 210 na Fase 1 (a partir de 16/12/2026)', () => {
      const metadata = WorkScheduleCalculator.getMetadata('STANDARD', '2027-01-15');
      assert.strictEqual(metadata.standardWeeklyHours, 42);
      assert.strictEqual(metadata.monthlyDivisor, 210);

      const punch: RawDayPunch = {
        date: '2027-01-15',
        dayType: 'work',
        startTime: '08:00',
        endTime: '18:00',
        breakStartTime: '12:00',
        breakEndTime: '13:00',
      };
      // 9h trabalhadas = 540 minutos. Na Fase 1 (meta 504 min = 8h24), gera 36 minutos de hora extra
      const result = WorkScheduleCalculator.calculateDaily(punch, { scheduleType: 'STANDARD' });
      assert.strictEqual(result.effectiveWorkedMinutes, 540);
      assert.strictEqual(result.dailyOvertimeMinutes, 36);
    });

    it('deve aplicar teto de 40h e divisor 200 na Fase 2 (a partir de 16/12/2027)', () => {
      const metadata = WorkScheduleCalculator.getMetadata('STANDARD', '2028-02-01');
      assert.strictEqual(metadata.standardWeeklyHours, 40);
      assert.strictEqual(metadata.monthlyDivisor, 200);

      const punch: RawDayPunch = {
        date: '2028-02-01',
        dayType: 'work',
        startTime: '08:00',
        endTime: '17:00',
        breakStartTime: '12:00',
        breakEndTime: '13:00',
      };
      // 8h trabalhadas = 480 minutos. Meta 40h (480 min/dia), saldo zerado
      const result = WorkScheduleCalculator.calculateDaily(punch, { scheduleType: 'STANDARD' });
      assert.strictEqual(result.effectiveWorkedMinutes, 480);
      assert.strictEqual(result.dailyOvertimeMinutes, 0);
    });
  });

  describe('2. Tolerância Legal de Ponto (Art. 58, § 1º CLT e Súmula 366 TST)', () => {
    it('deve considerar dentro da tolerância quando variações individuais <= 5m e soma <= 10m', () => {
      const evalResult = evaluateArt58Tolerance({
        start: { actual: '08:04', scheduled: '08:00' }, // +4m
        end: { actual: '17:03', scheduled: '17:00' },   // +3m
      });
      assert.strictEqual(evalResult.isWithinTolerance, true);
      assert.strictEqual(evalResult.totalVariationMinutes, 7);
      assert.strictEqual(evalResult.hasIndividualExceeded, false);
      assert.strictEqual(evalResult.hasDailyExceeded, false);
    });

    it('deve desconsiderar tolerância se uma marcação individual exceder 5 minutos (Súmula 366 TST)', () => {
      const evalResult = evaluateArt58Tolerance({
        start: { actual: '07:54', scheduled: '08:00' }, // 6 minutos de variação!
        end: { actual: '17:00', scheduled: '17:00' },
      });
      assert.strictEqual(evalResult.isWithinTolerance, false);
      assert.strictEqual(evalResult.hasIndividualExceeded, true);
      assert.strictEqual(evalResult.totalVariationMinutes, 6);
    });

    it('deve desconsiderar tolerância se a soma diária exceder 10 minutos', () => {
      const evalResult = evaluateArt58Tolerance({
        start: { actual: '07:55', scheduled: '08:00' }, // 5 min
        end: { actual: '17:06', scheduled: '17:00' },   // 6 min
      });
      assert.strictEqual(evalResult.isWithinTolerance, false);
      assert.strictEqual(evalResult.totalVariationMinutes, 11); // 5 + 6 = 11 > 10
      assert.strictEqual(evalResult.hasDailyExceeded, true);
    });
  });

  describe('3. Escala 12x36 (Art. 59-A da CLT)', () => {
    it('não deve gerar horas extras pela 9ª até a 12ª hora no plantão regular', () => {
      const punch: RawDayPunch = {
        date: '2026-10-20',
        dayType: 'work',
        startTime: '07:00',
        endTime: '19:00',
        breakStartTime: '12:00',
        breakEndTime: '12:15', // 15 min de lanche no posto
      };
      const contract: EmployeeWorkContract = { scheduleType: 'SCALE_12X36' };
      const result = WorkScheduleCalculator.calculateDaily(punch, contract);

      // 12 horas brutas - 15min = 11h45min (705 minutos trabalhados)
      assert.strictEqual(result.netClockWorkedMinutes, 705);
      // Não excede 12 horas (720 min), logo 0 horas extras
      assert.strictEqual(result.dailyOvertimeMinutes, 0);
    });

    it('deve gerar hora extra apenas quando o plantão ultrapassar 12 horas (720 minutos)', () => {
      const punch: RawDayPunch = {
        date: '2026-10-20',
        dayType: 'work',
        startTime: '07:00',
        endTime: '20:00', // 13 horas de plantão direto
      };
      const contract: EmployeeWorkContract = { scheduleType: 'SCALE_12X36' };
      const result = WorkScheduleCalculator.calculateDaily(punch, contract);

      assert.strictEqual(result.netClockWorkedMinutes, 780); // 13h = 780 min
      assert.strictEqual(result.dailyOvertimeMinutes, 60);    // Exatamente 1h extra excedente a 12h
      assert.ok(result.legalWarnings.some((w) => w.includes('Plantão prorrogado')));
    });
  });

  describe('4. Regime de Tempo Parcial (Art. 58-A da CLT)', () => {
    it('deve vedar horas extras no regime de 30 horas semanais e emitir infração se houver labor extra', () => {
      const metadata = WorkScheduleCalculator.getMetadata('PART_TIME_30H');
      assert.strictEqual(metadata.monthlyDivisor, 150); // 30 * 5 = 150
      assert.strictEqual(metadata.overtimeEligible, false);

      const punch: RawDayPunch = {
        date: '2026-10-20',
        dayType: 'work',
        startTime: '08:00',
        endTime: '15:00', // 7 horas trabalhadas (meta diária é 6h)
      };
      const result = WorkScheduleCalculator.calculateDaily(punch, { scheduleType: 'PART_TIME_30H' });
      assert.strictEqual(result.dailyOvertimeMinutes, 60);
      assert.ok(result.legalWarnings.some((w) => w.includes('INFRAÇÃO LEGAL (Art. 58-A da CLT)')));
    });

    it('deve permitir horas extras até o limite de 6h semanais no regime de 26 horas', () => {
      const metadata = WorkScheduleCalculator.getMetadata('PART_TIME_26H');
      assert.strictEqual(metadata.monthlyDivisor, 130); // 26 * 5 = 130
      assert.strictEqual(metadata.overtimeEligible, true);

      // Simulação semanal com 5 dias
      const punches: RawDayPunch[] = [
        { date: '2026-10-19', dayType: 'work', startTime: '08:00', endTime: '14:12' }, // 6.2h (1h extra)
        { date: '2026-10-20', dayType: 'work', startTime: '08:00', endTime: '14:12' }, // 1h extra
        { date: '2026-10-21', dayType: 'work', startTime: '08:00', endTime: '14:12' }, // 1h extra
        { date: '2026-10-22', dayType: 'work', startTime: '08:00', endTime: '14:12' }, // 1h extra
        { date: '2026-10-23', dayType: 'work', startTime: '08:00', endTime: '14:12' }, // 1h extra
      ];
      // Total de extras na semana: 5 horas extras (<= 6 horas permitidas)
      const summary = WorkScheduleCalculator.calculatePeriod(punches, { scheduleType: 'PART_TIME_26H' });
      assert.strictEqual(summary.legalInfractions.length, 0);

      // Agora adiciona trabalho em dia de folga para extrapolar as 6h semanais permitidas (5h + 2.2h = 7.2h)
      punches.push({ date: '2026-10-24', dayType: 'off', startTime: '08:00', endTime: '10:12' });
      const summaryExceeded = WorkScheduleCalculator.calculatePeriod(punches, { scheduleType: 'PART_TIME_26H' });
      assert.ok(summaryExceeded.legalInfractions.some((w) => w.includes('EXTRAPOLAÇÃO LEGAL (Art. 58-A, § 3º CLT)')));
    });
  });

  describe('5. Jornada Noturna Urbana (Art. 73 da CLT e Súmula 60 TST)', () => {
    it('deve converter 7 horas relógio noturnas (22h-05h) em 8 horas fictas trabalhadas', () => {
      const breakdown = calculateNightBreakdown('22:00', '05:00');
      assert.strictEqual(breakdown.netClockMinutes, 420); // 7h = 420 minutos
      // 420 * (60 / 52.5) = 480 minutos = 8h fictas!
      assert.strictEqual(breakdown.nightFictitiousMinutes, 480);
      assert.strictEqual(breakdown.nightBonusMinutes, 60); // 60 minutos de acréscimo fictício
      assert.strictEqual(breakdown.daytimeMinutes, 0);
    });

    it('deve aplicar prorrogação noturna com hora ficta para horas pós-05h00 (Súmula 60, II TST)', () => {
      // Turno das 22:00 às 07:00 (com 1h de almoço da 01:00 às 02:00)
      // Das 22h às 05h = 6h de relógio. Das 05h às 07h = 2h de relógio prorrogadas
      const breakdown = calculateNightBreakdown('22:00', '07:00', '01:00', '02:00', true);
      assert.strictEqual(breakdown.netClockMinutes, 480); // 8h relógio
      assert.strictEqual(breakdown.extendedNightMinutes, 120); // 2h de prorrogação
      // Todas as 8h relógio recebem a redução ficta noturna: 480 * (60 / 52.5) = 548.57 min
      assert.strictEqual(Math.round(breakdown.nightFictitiousMinutes), 549);
      assert.strictEqual(breakdown.daytimeMinutes, 0);
    });

    it('deve calcular o adicional noturno de 20% no período', () => {
      const punches: RawDayPunch[] = [
        { date: '2026-10-20', dayType: 'work', startTime: '22:00', endTime: '05:00' },
      ];
      const contract: EmployeeWorkContract = {
        scheduleType: 'NIGHT_SHIFT',
        baseSalary: 4400,
        customDivisor: 220, // Salário-hora = 20,00
      };
      const summary = WorkScheduleCalculator.calculatePeriod(punches, contract);
      assert.strictEqual(summary.regularHourlyRate, 20.0);
      // 8 horas fictas * R$ 20,00 * 20% = R$ 32,00 de adicional noturno
      assert.strictEqual(summary.nightAdditionalPay, 32.0);
    });
  });

  describe('6. Turnos Ininterruptos de Revezamento (Art. 7º, XIV da CF/88)', () => {
    it('deve apurar teto de 6h diárias e divisor 180', () => {
      const metadata = WorkScheduleCalculator.getMetadata('SHIFT_ROTATING_36H');
      assert.strictEqual(metadata.standardDailyHours, 6.0);
      assert.strictEqual(metadata.standardWeeklyHours, 36.0);
      assert.strictEqual(metadata.monthlyDivisor, 180);

      const punch: RawDayPunch = {
        date: '2026-10-20',
        dayType: 'work',
        startTime: '06:00',
        endTime: '14:00', // 8 horas trabalhadas
      };
      const result = WorkScheduleCalculator.calculateDaily(punch, { scheduleType: 'SHIFT_ROTATING_36H' });
      assert.strictEqual(result.effectiveWorkedMinutes, 480); // 8h
      assert.strictEqual(result.dailyOvertimeMinutes, 120);   // 2h extras além da 6ª hora constitucional
      assert.ok(result.legalWarnings.some((w) => w.includes('limite constitucional de 6h')));
    });
  });

  describe('7. Isenção de Controle de Ponto (Art. 62 da CLT)', () => {
    it('não deve apurar horas extras nem déficit para cargos de gestão ou teletrabalho por tarefa', () => {
      const metadata = WorkScheduleCalculator.getMetadata('EXEMPT_ART_62');
      assert.strictEqual(metadata.overtimeEligible, false);

      const punch: RawDayPunch = {
        date: '2026-10-20',
        dayType: 'work',
        startTime: '08:00',
        endTime: '22:00', // 14 horas de trabalho
      };
      const result = WorkScheduleCalculator.calculateDaily(punch, { scheduleType: 'EXEMPT_ART_62' });
      assert.strictEqual(result.dailyOvertimeMinutes, 0); // Isento!
      assert.strictEqual(result.dailyDeficitMinutes, 0);  // Isento!
      assert.strictEqual(result.dailyBalanceMinutes, 0);
      assert.ok(result.legalWarnings.some((w) => w.includes('Regime Isento (Art. 62')));
    });
  });
});
