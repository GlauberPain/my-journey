import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
	getTransitionMilestones,
	getTransitionPhase,
	getLegalWeeklyLimit,
	getEffectiveWeeklyLimit,
	getSalaryDivisor,
	calculateSalaryCompensation,
	calculateWeeklySchedule,
} from './legalTransition.ts';
import type { ScheduleDay, EmployeeContract } from './types.ts';

describe('Nova Emenda Constitucional da Jornada de Trabalho (PEC 221/2019)', () => {
	// Marcos esperados com base na data de promulgação de referência (15/10/2026):
	// Fase 1 (+60 dias): 2026-12-14 (limite de 42h, divisor 210)
	// Fase 2 (+12 meses após Fase 1): 2027-12-14 (limite de 40h, divisor 200)

	describe('1. Versionamento e Vigência Baseada em Datas (Date-based thresholds)', () => {
		it('deve calcular corretamente as datas de corte das Fases 1 e 2', () => {
			const milestones = getTransitionMilestones('2026-10-15');
			assert.strictEqual(milestones.promulgationDate, '2026-10-15');
			assert.strictEqual(milestones.phase1EffectiveDate, '2026-12-14');
			assert.strictEqual(milestones.phase2EffectiveDate, '2027-12-14');
		});

		it('deve identificar a Fase Legada (44h) antes da vigência da Fase 1', () => {
			const phase = getTransitionPhase('2026-11-20');
			const limit = getLegalWeeklyLimit('2026-11-20');
			assert.strictEqual(phase, 'LEGACY_44H');
			assert.strictEqual(limit, 44);
		});

		it('deve identificar a Fase 1 (42h) entre 60 dias da promulgação e 12 meses', () => {
			const phase = getTransitionPhase('2027-01-15');
			const limit = getLegalWeeklyLimit('2027-01-15');
			assert.strictEqual(phase, 'PHASE_1_42H');
			assert.strictEqual(limit, 42);
		});

		it('deve identificar a Fase 2 (40h) após 12 meses da Fase 1', () => {
			const phase = getTransitionPhase('2028-02-01');
			const limit = getLegalWeeklyLimit('2028-02-01');
			assert.strictEqual(phase, 'PHASE_2_40H');
			assert.strictEqual(limit, 40);
		});

		it('deve respeitar contratos customizados mais benéficos (ex: 36h ou 30h)', () => {
			const contract36h: EmployeeContract = { weeklyContractHours: 36 };
			const contract30h: EmployeeContract = { weeklyContractHours: 30 };

			// Na vigência da Fase 1 (onde o teto legal é 42h)
			const limit36 = getEffectiveWeeklyLimit('2027-01-15', contract36h);
			const limit30 = getEffectiveWeeklyLimit('2027-01-15', contract30h);

			assert.strictEqual(limit36, 36);
			assert.strictEqual(limit30, 30);
		});
	});

	describe('2. Divisores Mensais e Princípio da Irredutibilidade Salarial (Art. 7º, VI da CF)', () => {
		it('deve calcular os divisores legais correspondentes a cada carga horária', () => {
			assert.strictEqual(getSalaryDivisor(44), 220); // Regra tradicional (44 * 5)
			assert.strictEqual(getSalaryDivisor(42), 210); // Fase 1 (42 * 5)
			assert.strictEqual(getSalaryDivisor(40), 200); // Fase 2 (40 * 5)
			assert.strictEqual(getSalaryDivisor(36), 180); // Teleatendimento / Turnos ininterruptos
			assert.strictEqual(getSalaryDivisor(30), 150); // Saúde / 6h diárias
		});

		it('deve preservar integralmente o salário base e valorizar o salário-hora na redução da jornada', () => {
			const baseSalary = 4400.0; // Salário base de R$ 4.400,00

			// Fase 44h (Divisor 220)
			const calcLegacy = calculateSalaryCompensation(baseSalary, 44);
			// Fase 1 - 42h (Divisor 210)
			const calcPhase1 = calculateSalaryCompensation(baseSalary, 42);
			// Fase 2 - 40h (Divisor 200)
			const calcPhase2 = calculateSalaryCompensation(baseSalary, 40);

			// 1. O salário base é rigorosamente IRREDUTÍVEL
			assert.strictEqual(calcLegacy.baseSalary, baseSalary);
			assert.strictEqual(calcPhase1.baseSalary, baseSalary);
			assert.strictEqual(calcPhase2.baseSalary, baseSalary);

			// 2. Divisores corretos
			assert.strictEqual(calcLegacy.divisor, 220);
			assert.strictEqual(calcPhase1.divisor, 210);
			assert.strictEqual(calcPhase2.divisor, 200);

			// 3. Salário-hora normal: 4400 / 220 = 20,00 | 4400 / 210 ≈ 20,9524 | 4400 / 200 = 22,00
			assert.strictEqual(calcLegacy.regularHourlyRate, 20.0);
			assert.strictEqual(calcPhase1.regularHourlyRate, 4400 / 210);
			assert.strictEqual(calcPhase2.regularHourlyRate, 22.0);

			// 4. Salário-hora com adicional de 50% de hora extra
			// Legado: 20 * 1.5 = 30,00
			assert.strictEqual(calcLegacy.overtimeHourlyRateWeekday, 30.0);
			// Fase 1: (4400 / 210) * 1.5 ≈ 31,42857
			assert.strictEqual(
				calcPhase1.overtimeHourlyRateWeekday.toFixed(2),
				(31.43).toFixed(2)
			);
			// Fase 2: 22 * 1.5 = 33,00
			assert.strictEqual(calcPhase2.overtimeHourlyRateWeekday, 33.0);
		});
	});

	describe('3. Apuração Semanal de Espelho de Ponto e Horas Extras', () => {
		// Helper para criar dias de trabalho padrão
		const createWorkDay = (date: string, startTime: string, endTime: string, breakStart = '12:00', breakEnd = '13:00'): ScheduleDay => {
			const [y, m, d] = date.split('-').map(Number);
			const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
			return {
				date,
				dayOfWeek,
				dayType: 'work',
				startTime,
				endTime,
				breakStartTime: breakStart,
				breakEndTime: breakEnd,
			};
		};

		it('Cenário A: Jornada regular abaixo do teto na vigência da Fase 1', () => {
			// Semana na vigência da Fase 1: 18/01/2027 a 22/01/2027 (5 dias de 8h = 40h)
			// Teto legal da Fase 1: 42h semanais
			const weekDays: ScheduleDay[] = [
				createWorkDay('2027-01-18', '08:00', '17:00'), // 8h
				createWorkDay('2027-01-19', '08:00', '17:00'), // 8h
				createWorkDay('2027-01-20', '08:00', '17:00'), // 8h
				createWorkDay('2027-01-21', '08:00', '17:00'), // 8h
				createWorkDay('2027-01-22', '08:00', '17:00'), // 8h
			];

			const summary = calculateWeeklySchedule(weekDays, '2027-01-18');

			assert.strictEqual(summary.phase, 'PHASE_1_42H');
			assert.strictEqual(summary.legalWeeklyLimitHours, 42);
			assert.strictEqual(summary.effectiveWeeklyLimitHours, 42);
			assert.strictEqual(summary.workedMinutes, 40 * 60); // 2400 minutos
			assert.strictEqual(summary.overtimeMinutes, 0, 'Não deve gerar horas extras pois está abaixo do teto de 42h');
			assert.strictEqual(summary.deficitMinutes, 2 * 60, 'Faltam 2 horas para atingir o teto de 42h');
			assert.strictEqual(summary.formattedWorked, '40:00');
			assert.strictEqual(summary.formattedOvertime, '00:00');
		});

		it('Cenário B: Jornada de exatamente 42h30min na vigência da Fase 1 gerando 30 minutos de hora extra', () => {
			// Semana na vigência da Fase 1: 25/01/2027 a 29/01/2027
			// 5 dias de 8h30min de trabalho líquido:
			// 8h30 * 5 = 42h30min (2550 minutos)
			// Teto legal vigente da Fase 1: 42h (2520 minutos)
			// Excedente esperado: exatamente 30 minutos extras!
			const weekDays: ScheduleDay[] = [
				createWorkDay('2027-01-25', '08:00', '17:30'), // 8h30 (510 min)
				createWorkDay('2027-01-26', '08:00', '17:30'), // 8h30 (510 min)
				createWorkDay('2027-01-27', '08:00', '17:30'), // 8h30 (510 min)
				createWorkDay('2027-01-28', '08:00', '17:30'), // 8h30 (510 min)
				createWorkDay('2027-01-29', '08:00', '17:30'), // 8h30 (510 min)
			];

			const contract: EmployeeContract = {
				baseSalary: 4200.0, // Salário-base R$ 4.200,00
				overtimeRateWeekday: 0.5, // 50%
			};

			const summary = calculateWeeklySchedule(weekDays, '2027-01-25', contract);

			assert.strictEqual(summary.phase, 'PHASE_1_42H');
			assert.strictEqual(summary.legalWeeklyLimitHours, 42);
			assert.strictEqual(summary.effectiveWeeklyLimitMinutes, 2520);
			assert.strictEqual(summary.workedMinutes, 2550, 'Total trabalhado: 42h30min = 2550 min');

			// Verificação estrita do excedente
			assert.strictEqual(summary.overtimeMinutes, 30, 'Deve gerar exatamente 30 minutos de hora extra');
			assert.strictEqual(summary.deficitMinutes, 0);
			assert.strictEqual(summary.formattedWorked, '42:30');
			assert.strictEqual(summary.formattedOvertime, '00:30');
			assert.strictEqual(summary.formattedBalance, '+00:30');

			// Cálculo financeiro da hora extra:
			// Salário base = 4200.00
			// Divisor Fase 1 (42h) = 210
			// Salário-hora = 4200 / 210 = R$ 20,00
			// Hora extra 50% = 20 * 1.5 = R$ 30,00/hora
			// 30 minutos (0.5h) = 30.00 * 0.5 = R$ 15,00
			assert.ok(summary.overtimePayEstimate !== undefined);
			assert.strictEqual(summary.overtimePayEstimate, 15.0);
		});

		it('Cenário C: Contrato com jornada específica de 36h na vigência da Fase 1', () => {
			// Colaborador com contrato de 36h (ex: teleatendimento)
			// Trabalha 38h na semana durante a Fase 1 (25/01/2027)
			// O teto legal é 42h, mas o teto contratual é 36h
			// Logo, o excedente é 2h (120 minutos) extras
			const weekDays: ScheduleDay[] = [
				createWorkDay('2027-01-25', '08:00', '16:00'), // 7h (420 min)
				createWorkDay('2027-01-26', '08:00', '16:00'), // 7h (420 min)
				createWorkDay('2027-01-27', '08:00', '16:00'), // 7h (420 min)
				createWorkDay('2027-01-28', '08:00', '16:00'), // 7h (420 min)
				createWorkDay('2027-01-29', '08:00', '19:00'), // 10h (600 min)
			]; // Total = 38h (2280 min)

			const contract: EmployeeContract = {
				weeklyContractHours: 36,
				baseSalary: 3600.0,
			};

			const summary = calculateWeeklySchedule(weekDays, '2027-01-25', contract);

			assert.strictEqual(summary.effectiveWeeklyLimitHours, 36);
			assert.strictEqual(summary.workedMinutes, 38 * 60);
			assert.strictEqual(summary.overtimeMinutes, 2 * 60, 'Gera 2h extras em relação ao teto contratual de 36h');
			assert.strictEqual(summary.formattedOvertime, '02:00');
		});
	});
});
