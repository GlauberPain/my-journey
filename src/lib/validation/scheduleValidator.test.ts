import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	validateWorkShift,
	validateInterShiftRest,
	validateWeeklySchedule,
	getLegalRuleForDate,
} from './scheduleValidator.ts';
import type { WorkShift, ContractRuleConfig } from './types.ts';

describe('Validador de Conformidade Trabalhista (CLT e PEC 221/2019)', () => {
	describe('1. Intervalo Intrajornada (Art. 71 da CLT e Art. 611-A, III)', () => {
		it('deve gerar infração se houver redução do intervalo para 30 min SEM autorização em CCT/ACT', () => {
			const shift: WorkShift = {
				date: '2026-10-20',
				startTime: '08:00',
				endTime: '16:30', // 8h30 bruta - 30m intervalo = 8h líquidas (> 6h)
				breakStartTime: '12:00',
				breakEndTime: '12:30', // 30 minutos
				dayType: 'work',
			};

			// Sem CCT
			const result = validateWorkShift(shift);

			assert.strictEqual(result.isValid, false);
			assert.strictEqual(result.violations.length, 1);
			assert.strictEqual(result.violations[0].code, 'INTRA_INTERVAL_CCT_UNAUTHORIZED');
			assert.strictEqual(result.violations[0].details.actualMinutes, 30);
			assert.strictEqual(result.violations[0].details.requiredMinutes, 60);
		});

		it('deve aceitar intervalo de 30 min quando houver CCT/ACT válida com cláusula permissiva (Art. 611-A, III)', () => {
			const shift: WorkShift = {
				date: '2026-10-20',
				startTime: '08:00',
				endTime: '16:30',
				breakStartTime: '12:00',
				breakEndTime: '12:30', // 30 minutos
				dayType: 'work',
			};

			const contractWithCct: ContractRuleConfig = {
				collectiveAgreement: {
					id: 'CCT-2026-TI',
					title: 'Convenção Coletiva Sindpd 2026',
					validFrom: '2026-01-01',
					validTo: '2026-12-31',
					allowReducedIntraBreak30Min: true,
				},
			};

			const result = validateWorkShift(shift, contractWithCct);

			assert.strictEqual(result.isValid, true);
			assert.strictEqual(result.violations.length, 0);
			assert.strictEqual(result.netWorkedMinutes, 8 * 60);
		});

		it('deve gerar infração mesmo com CCT/ACT se o intervalo for reduzido para menos de 30 minutos (ex: 25 min)', () => {
			const shift: WorkShift = {
				date: '2026-10-20',
				startTime: '08:00',
				endTime: '16:25',
				breakStartTime: '12:00',
				breakEndTime: '12:25', // 25 minutos
				dayType: 'work',
			};

			const contractWithCct: ContractRuleConfig = {
				collectiveAgreement: {
					id: 'CCT-2026',
					title: 'CCT 2026',
					validFrom: '2026-01-01',
					validTo: '2026-12-31',
					allowReducedIntraBreak30Min: true,
				},
			};

			const result = validateWorkShift(shift, contractWithCct);

			assert.strictEqual(result.isValid, false);
			assert.strictEqual(result.violations[0].code, 'INTRA_INTERVAL_BELOW_CCT_MINIMUM');
			assert.strictEqual(result.violations[0].details.actualMinutes, 25);
			assert.strictEqual(result.violations[0].details.requiredMinutes, 30);
		});

		it('caso de borda: jornada de 6h05 (> 6h) com intervalo de 45 min sem CCT deve exigir 1 hora', () => {
			// Entrada às 08:00, saída às 14:50 com 45m de almoço = 6h05 líquidas trabalhadas (365 minutos)
			const shift: WorkShift = {
				date: '2026-10-20',
				startTime: '08:00',
				endTime: '14:50',
				breakStartTime: '11:00',
				breakEndTime: '11:45', // 45 min
				dayType: 'work',
			};

			const result = validateWorkShift(shift);

			assert.strictEqual(result.isValid, false);
			assert.strictEqual(result.netWorkedMinutes, 365); // 6h05
			assert.strictEqual(result.violations[0].code, 'INTRA_INTERVAL_CCT_UNAUTHORIZED');
			assert.strictEqual(result.violations[0].details.requiredMinutes, 60);
		});

		it('caso de borda: jornada de exatamente 6h00 com intervalo de 15 min deve ser válida', () => {
			// Entrada às 08:00, saída às 14:15 com 15m de pausa = exatamente 6h00 líquidas (360 minutos)
			const shift: WorkShift = {
				date: '2026-10-20',
				startTime: '08:00',
				endTime: '14:15',
				breakStartTime: '11:00',
				breakEndTime: '11:15', // 15 min
				dayType: 'work',
			};

			const result = validateWorkShift(shift);

			assert.strictEqual(result.isValid, true);
			assert.strictEqual(result.netWorkedMinutes, 360); // 6h00
			assert.strictEqual(result.violations.length, 0);
		});

		it('caso de borda: jornada de 4h01 (> 4h e <= 6h) com intervalo de 10 min deve exigir no mínimo 15 min', () => {
			// Entrada às 08:00, saída às 12:11 com 10 min de pausa = 4h01 líquidas (241 minutos)
			const shift: WorkShift = {
				date: '2026-10-20',
				startTime: '08:00',
				endTime: '12:11',
				breakStartTime: '10:00',
				breakEndTime: '10:10', // 10 min
				dayType: 'work',
			};

			const result = validateWorkShift(shift);

			assert.strictEqual(result.isValid, false);
			assert.strictEqual(result.netWorkedMinutes, 241);
			assert.strictEqual(result.violations[0].code, 'INTRA_INTERVAL_MISSING_4H_TO_6H');
			assert.strictEqual(result.violations[0].details.requiredMinutes, 15);
		});

		it('caso de borda: jornada de até 4h00 não exige intervalo obrigatório', () => {
			const shift: WorkShift = {
				date: '2026-10-20',
				startTime: '08:00',
				endTime: '12:00', // 4h00 exatas
				dayType: 'work',
			};

			const result = validateWorkShift(shift);

			assert.strictEqual(result.isValid, true);
			assert.strictEqual(result.netWorkedMinutes, 240);
			assert.strictEqual(result.violations.length, 0);
		});

		it('deve confirmar que o intervalo intrajornada NÃO integra o cômputo das horas trabalhadas (Art. 71, § 2º)', () => {
			const shift: WorkShift = {
				date: '2026-10-20',
				startTime: '08:00',
				endTime: '17:00', // Permanência de 9 horas na empresa
				breakStartTime: '12:00',
				breakEndTime: '13:00', // 1 hora de almoço
				dayType: 'work',
			};

			const result = validateWorkShift(shift);

			assert.strictEqual(result.grossMinutes, 9 * 60);
			assert.strictEqual(result.breakMinutes, 60);
			assert.strictEqual(result.netWorkedMinutes, 8 * 60); // Apenas 8h trabalhadas computadas
			assert.strictEqual(result.formattedNetWorked, '08:00');
		});
	});

	describe('2. Intervalo Interjornada (Art. 66 da CLT)', () => {
		it('deve apontar infração quando o descanso entre duas jornadas diárias for inferior a 11 horas', () => {
			const prevShift: WorkShift = {
				date: '2026-10-20',
				startTime: '13:00',
				endTime: '22:00',
				dayType: 'work',
			};
			const currShift: WorkShift = {
				date: '2026-10-21',
				startTime: '07:00', // Apenas 9 horas de descanso (22h -> 07h)
				endTime: '16:00',
				dayType: 'work',
			};

			const result = validateInterShiftRest(prevShift, currShift);

			assert.strictEqual(result.isValid, false);
			assert.strictEqual(result.restMinutes, 9 * 60);
			assert.strictEqual(result.requiredRestMinutes, 11 * 60);
			assert.strictEqual(result.deficitMinutes, 120); // 2 horas suprimidas
			assert.strictEqual(result.violation?.code, 'INTER_INTERVAL_VIOLATION_ART_66');
		});

		it('deve aprovar intervalo interjornada de exatamente 11 horas consecutivas', () => {
			const prevShift: WorkShift = {
				date: '2026-10-20',
				startTime: '13:00',
				endTime: '22:00',
				dayType: 'work',
			};
			const currShift: WorkShift = {
				date: '2026-10-21',
				startTime: '09:00', // Exatamente 11 horas de descanso (22h -> 09h)
				endTime: '18:00',
				dayType: 'work',
			};

			const result = validateInterShiftRest(prevShift, currShift);

			assert.strictEqual(result.isValid, true);
			assert.strictEqual(result.restMinutes, 11 * 60);
			assert.strictEqual(result.deficitMinutes, 0);
			assert.strictEqual(result.violation, undefined);
		});
	});

	describe('3. Transição Gradual da Jornada Semanal e Garantia de 2 Descansos (PEC 221/2019)', () => {
		it('deve versionar as regras de vigência corretas por data', () => {
			const legacyRule = getLegalRuleForDate('2026-10-20');
			assert.strictEqual(legacyRule.phase, 'LEGACY_44H');
			assert.strictEqual(legacyRule.maxWeeklyHours, 44);
			assert.strictEqual(legacyRule.minWeeklyRestDays, 1);
			assert.strictEqual(legacyRule.defaultDivisor, 220);

			const phase1Rule = getLegalRuleForDate('2027-01-15');
			assert.strictEqual(phase1Rule.phase, 'PHASE_1_42H');
			assert.strictEqual(phase1Rule.maxWeeklyHours, 42);
			assert.strictEqual(phase1Rule.minWeeklyRestDays, 2); // 2 dias de descanso garantidos
			assert.strictEqual(phase1Rule.defaultDivisor, 210);

			const phase2Rule = getLegalRuleForDate('2028-01-15');
			assert.strictEqual(phase2Rule.phase, 'PHASE_2_40H');
			assert.strictEqual(phase2Rule.maxWeeklyHours, 40);
			assert.strictEqual(phase2Rule.minWeeklyRestDays, 2);
			assert.strictEqual(phase2Rule.defaultDivisor, 200);
		});

		it('deve reprovar escala 6x1 (com apenas 1 descanso) a partir da vigência da Fase 1 (dez/2026)', () => {
			// Escala 6x1: trabalha de Seg a Sáb (6 dias), folga apenas no Domingo (1 folga)
			const shifts: WorkShift[] = [
				{ date: '2027-01-04', startTime: '08:00', endTime: '16:00', breakStartTime: '12:00', breakEndTime: '13:00', dayType: 'work' }, // 7h
				{ date: '2027-01-05', startTime: '08:00', endTime: '16:00', breakStartTime: '12:00', breakEndTime: '13:00', dayType: 'work' }, // 7h
				{ date: '2027-01-06', startTime: '08:00', endTime: '16:00', breakStartTime: '12:00', breakEndTime: '13:00', dayType: 'work' }, // 7h
				{ date: '2027-01-07', startTime: '08:00', endTime: '16:00', breakStartTime: '12:00', breakEndTime: '13:00', dayType: 'work' }, // 7h
				{ date: '2027-01-08', startTime: '08:00', endTime: '16:00', breakStartTime: '12:00', breakEndTime: '13:00', dayType: 'work' }, // 7h
				{ date: '2027-01-09', startTime: '08:00', endTime: '15:00', breakStartTime: '12:00', breakEndTime: '13:00', dayType: 'work' }, // 6h (Total: 41h)
				{ date: '2027-01-10', startTime: '', endTime: '', dayType: 'off' }, // Apenas 1 dia de folga
			];

			const result = validateWeeklySchedule({
				weekStartDate: '2027-01-04',
				shifts,
			});

			assert.strictEqual(result.isValid, false);
			assert.strictEqual(result.restDaysCount, 1);
			assert.strictEqual(result.minRequiredRestDays, 2);

			const restViolation = result.violations.find((v) => v.code === 'WEEKLY_REST_DAYS_INSUFFICIENT');
			assert.ok(restViolation, 'Deveria conter infração de descanso semanal insuficiente');
			assert.strictEqual(restViolation.details.requiredDays, 2);
			assert.strictEqual(restViolation.details.actualDays, 1);
		});

		it('deve reprovar jornada de 43h na Fase 1 (limite 42h) apontando estouro de teto semanal', () => {
			// Escala 5x2 que totaliza 43 horas
			const shifts: WorkShift[] = [
				{ date: '2027-01-04', startTime: '08:00', endTime: '17:36', breakStartTime: '12:00', breakEndTime: '13:00', dayType: 'work' }, // 8.6h
				{ date: '2027-01-05', startTime: '08:00', endTime: '17:36', breakStartTime: '12:00', breakEndTime: '13:00', dayType: 'work' }, // 8.6h
				{ date: '2027-01-06', startTime: '08:00', endTime: '17:36', breakStartTime: '12:00', breakEndTime: '13:00', dayType: 'work' }, // 8.6h
				{ date: '2027-01-07', startTime: '08:00', endTime: '17:36', breakStartTime: '12:00', breakEndTime: '13:00', dayType: 'work' }, // 8.6h
				{ date: '2027-01-08', startTime: '08:00', endTime: '17:36', breakStartTime: '12:00', breakEndTime: '13:00', dayType: 'work' }, // 8.6h (Total: 43h)
				{ date: '2027-01-09', startTime: '', endTime: '', dayType: 'off' },
				{ date: '2027-01-10', startTime: '', endTime: '', dayType: 'off' },
			];

			const result = validateWeeklySchedule({
				weekStartDate: '2027-01-04',
				shifts,
			});

			assert.strictEqual(result.isValid, false);
			assert.strictEqual(result.legalWeeklyLimitHours, 42);
			assert.strictEqual(result.weeklyOvertimeMinutes, 60); // 1 hora de estouro

			const limitViolation = result.violations.find((v) => v.code === 'WEEKLY_LIMIT_EXCEEDED');
			assert.ok(limitViolation, 'Deveria conter infração de estouro de teto semanal');
			assert.strictEqual(limitViolation.details.limitHours, 42);
		});

		it('deve aprovar escala 5x2 em total conformidade na Fase 1 (42h semanais e 2 folgas)', () => {
			// 5 dias de 8h24min (8.4h * 5 = 42h)
			const shifts: WorkShift[] = [
				{ date: '2027-01-04', startTime: '08:00', endTime: '17:24', breakStartTime: '12:00', breakEndTime: '13:00', dayType: 'work' },
				{ date: '2027-01-05', startTime: '08:00', endTime: '17:24', breakStartTime: '12:00', breakEndTime: '13:00', dayType: 'work' },
				{ date: '2027-01-06', startTime: '08:00', endTime: '17:24', breakStartTime: '12:00', breakEndTime: '13:00', dayType: 'work' },
				{ date: '2027-01-07', startTime: '08:00', endTime: '17:24', breakStartTime: '12:00', breakEndTime: '13:00', dayType: 'work' },
				{ date: '2027-01-08', startTime: '08:00', endTime: '17:24', breakStartTime: '12:00', breakEndTime: '13:00', dayType: 'work' },
				{ date: '2027-01-09', startTime: '', endTime: '', dayType: 'off' },
				{ date: '2027-01-10', startTime: '', endTime: '', dayType: 'off' },
			];

			const result = validateWeeklySchedule({
				weekStartDate: '2027-01-04',
				shifts,
			});

			assert.strictEqual(result.isValid, true);
			assert.strictEqual(result.violations.length, 0);
			assert.strictEqual(result.totalWorkedMinutes, 42 * 60);
			assert.strictEqual(result.restDaysCount, 2);
		});

		it('deve respeitar contrato mais benéfico de 36 horas semanais', () => {
			// 5 dias de 8h = 40h semanais. Para a lei (42h) seria ok, mas para o contrato de 36h gera 4h de estouro
			const shifts: WorkShift[] = [
				{ date: '2027-01-04', startTime: '08:00', endTime: '17:00', breakStartTime: '12:00', breakEndTime: '13:00', dayType: 'work' },
				{ date: '2027-01-05', startTime: '08:00', endTime: '17:00', breakStartTime: '12:00', breakEndTime: '13:00', dayType: 'work' },
				{ date: '2027-01-06', startTime: '08:00', endTime: '17:00', breakStartTime: '12:00', breakEndTime: '13:00', dayType: 'work' },
				{ date: '2027-01-07', startTime: '08:00', endTime: '17:00', breakStartTime: '12:00', breakEndTime: '13:00', dayType: 'work' },
				{ date: '2027-01-08', startTime: '08:00', endTime: '17:00', breakStartTime: '12:00', breakEndTime: '13:00', dayType: 'work' },
				{ date: '2027-01-09', startTime: '', endTime: '', dayType: 'off' },
				{ date: '2027-01-10', startTime: '', endTime: '', dayType: 'off' },
			];

			const result = validateWeeklySchedule({
				weekStartDate: '2027-01-04',
				shifts,
				contract: {
					weeklyContractHours: 36, // Mais benéfico que as 42h legais
				},
			});

			assert.strictEqual(result.isValid, false);
			assert.strictEqual(result.effectiveWeeklyLimitHours, 36);
			assert.strictEqual(result.totalWorkedHours, 40);
			assert.strictEqual(result.weeklyOvertimeMinutes, 240); // 4 horas extras contratuais

			const limitViolation = result.violations.find((v) => v.code === 'WEEKLY_LIMIT_EXCEEDED');
			assert.ok(limitViolation);
			assert.strictEqual(limitViolation.details.limitHours, 36);
		});
	});
});
