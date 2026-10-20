import React from 'react';
import { ScheduleDay, MonthSummary } from '@/lib/types';
import { LegalAnalysisResult } from '@/lib/legalAnalysis';
import { calculateDay } from '@/lib/calculator';

interface PrintReportProps {
  days: ScheduleDay[];
  summary: MonthSummary;
  analysis: LegalAnalysisResult | null;
  year: number;
  month: number;
  dailyExpectedMinutes: number;
}

const MONTH_NAMES = [
	'Janeiro',
	'Fevereiro',
	'Março',
	'Abril',
	'Maio',
	'Junho',
	'Julho',
	'Agosto',
	'Setembro',
	'Outubro',
	'Novembro',
	'Dezembro',
];

const DAY_SHORT_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const DAY_TYPE_LABELS: Record<string, string> = {
	work: 'Trabalho',
	off: 'Folga',
	dsr: 'DSR',
	holiday: 'Feriado',
	leave: 'Atestado',
};

export function PrintReport({
	days,
	summary,
	analysis,
	year,
	month,
	dailyExpectedMinutes,
}: PrintReportProps) {
	const currentDate = new Date().toLocaleDateString('pt-BR', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});

	return (
		<div className="hidden print:block w-full bg-white text-black p-4 text-[11px] leading-tight font-sans">
			{/* 1. CABEÇALHO DO RELATÓRIO */}
			<div className="border-b-2 border-slate-800 pb-2 mb-3 flex items-start justify-between">
				<div>
					<h1 className="text-base font-extrabold uppercase tracking-tight text-slate-900">
            Espelho de Ponto & Diagnóstico Legal de Jornada
					</h1>
					<p className="text-[10px] text-slate-600 mt-0.5">
            Apuração mensal de horários, cálculo de banco de horas e conformidade trabalhista (CLT / CF)
					</p>
				</div>
				<div className="text-right text-[10px]">
					<p className="font-bold text-slate-800 text-xs">
            Competência: {MONTH_NAMES[month - 1]} / {year}
					</p>
					<p className="text-slate-500 mt-0.5">Emitido em: {currentDate}</p>
				</div>
			</div>

			{/* 2. RESUMO CONSOLIDADO DE HORAS */}
			<div className="grid grid-cols-5 gap-2 mb-3 text-center border border-slate-300 rounded p-1.5 bg-slate-50">
				<div className="border-r border-slate-200 pr-1">
					<span className="block text-[9px] uppercase font-bold text-slate-500">Horas Realizadas</span>
					<span className="text-xs font-bold font-mono text-slate-900">{summary.formattedTotalWorked}</span>
				</div>
				<div className="border-r border-slate-200 pr-1">
					<span className="block text-[9px] uppercase font-bold text-slate-500">Carga Prevista</span>
					<span className="text-xs font-bold font-mono text-slate-700">{summary.formattedExpected}</span>
				</div>
				<div className="border-r border-slate-200 pr-1">
					<span className="block text-[9px] uppercase font-bold text-slate-500">Banco de Horas</span>
					<span className={`text-xs font-bold font-mono ${summary.totalBalanceMinutes >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
						{summary.formattedBalance}
					</span>
				</div>
				<div className="border-r border-slate-200 pr-1">
					<span className="block text-[9px] uppercase font-bold text-slate-500">Dias Trabalhados</span>
					<span className="text-xs font-bold text-slate-800">{summary.workDaysCount} dias</span>
				</div>
				<div>
					<span className="block text-[9px] uppercase font-bold text-slate-500">Folgas & DSR</span>
					<span className="text-xs font-bold text-slate-800">{summary.offDaysCount} dias</span>
				</div>
			</div>

			{/* 3. QUADRO DE DIAGNÓSTICO LEGAL & FIM DA ESCALA 6x1 */}
			{analysis && (
				<div className="mb-3 border border-slate-300 rounded p-2 bg-slate-50/80">
					<div className="flex items-center justify-between border-b border-slate-200 pb-1 mb-1.5">
						<span className="font-bold text-[11px] uppercase text-slate-800 flex items-center gap-1.5">
              ⚖️ Diagnóstico Trabalhista & Redução de Jornada (Escala 6x1 / CLT)
						</span>
						<span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-slate-300 bg-white">
							{analysis.isScale6x1 ? 'Escala 6x1 Detectada' : `Escala ${analysis.scaleType.toUpperCase()}`} • {analysis.weeklyWorkedHours}h semanais
						</span>
					</div>

					<div className="grid grid-cols-2 gap-2 text-[10px] leading-tight">
						<div>
							<p className="font-semibold text-slate-700">Enquadramento Legal & Redução:</p>
							<p className="text-slate-600 mt-0.5">{analysis.reductionReason}</p>
							<p className="font-semibold text-slate-700 mt-1">Direito e Vigência:</p>
							<p className="text-slate-600 mt-0.5">{analysis.effectiveDateInfo}</p>
						</div>

						<div className="border-l border-slate-200 pl-2">
							<p className="font-semibold text-slate-700">Regras de Compensação Asseguradas por Lei:</p>
							<ul className="list-disc list-inside text-slate-600 mt-0.5 space-y-0.5">
								<li>
									<strong>Em Dinheiro:</strong> Horas extras com adicional mínimo de 50% em dias úteis e 100% em folgas/feriados (Súmula 146 TST).
								</li>
								<li>
									<strong>Em Folga (Banco de Horas):</strong> Válido somente com acordo formal por até 6 meses. Se não for concedido no prazo, é devido o pagamento em dinheiro com os acréscimos.
								</li>
								{analysis.hasInsufficientInterval && (
									<li className="text-rose-700 font-medium">
										<strong>Intervalo Intrajornada violado:</strong> período suprimido indenizado com 50% de adicional (Art. 71 CLT).
									</li>
								)}
							</ul>
						</div>
					</div>
				</div>
			)}

			{/* 4. TABELA CONCISA DE HORÁRIOS */}
			<table className="w-full border-collapse border border-slate-300 text-[10px] mb-4">
				<thead>
					<tr className="bg-slate-200 text-slate-800 uppercase font-bold text-[9px]">
						<th className="border border-slate-300 px-1.5 py-1 text-center w-12">Data</th>
						<th className="border border-slate-300 px-1.5 py-1 text-center w-10">Dia</th>
						<th className="border border-slate-300 px-1.5 py-1 text-center w-16">Situação</th>
						<th className="border border-slate-300 px-1.5 py-1 text-center w-12">Entrada</th>
						<th className="border border-slate-300 px-1.5 py-1 text-center w-14">Int. Saída</th>
						<th className="border border-slate-300 px-1.5 py-1 text-center w-14">Int. Retorno</th>
						<th className="border border-slate-300 px-1.5 py-1 text-center w-12">Saída</th>
						<th className="border border-slate-300 px-1.5 py-1 text-center w-14">Líquido</th>
						<th className="border border-slate-300 px-1.5 py-1 text-center w-14">Saldo</th>
						<th className="border border-slate-300 px-1.5 py-1 text-left">Observações</th>
					</tr>
				</thead>
				<tbody>
					{days.map((day) => {
						const calc = calculateDay(day, dailyExpectedMinutes);
						const isHoliday = day.isHoliday || day.dayType === 'holiday';
						const isWork = day.dayType === 'work' || (isHoliday && day.workedOnHoliday);
						const dayNum = day.date.split('-').reverse().slice(0, 2).join('/');
						const hasHours = day.startTime || day.endTime;

						let situacaoLabel = DAY_TYPE_LABELS[day.dayType] || day.dayType;
						if (isHoliday) {
							situacaoLabel = day.workedOnHoliday ? 'Feriado (100% Extra)' : 'Feriado (Folga)';
						}

						return (
							<tr
								key={day.date}
								className={`border-b border-slate-200 ${
									isHoliday
										? day.workedOnHoliday
											? 'bg-emerald-50/60 font-medium'
											: 'bg-amber-50/50 text-slate-600'
										: !isWork
											? 'bg-slate-50/70 text-slate-500'
											: ''
								}`}
							>
								<td className="border border-slate-300 px-1 py-0.5 text-center font-mono font-medium">
									{dayNum}
								</td>
								<td className="border border-slate-300 px-1 py-0.5 text-center font-medium">
									{DAY_SHORT_NAMES[day.dayOfWeek]}
								</td>
								<td className="border border-slate-300 px-1 py-0.5 text-center font-medium">
									{situacaoLabel}
								</td>
								<td className="border border-slate-300 px-1 py-0.5 text-center font-mono">
									{isWork && day.startTime ? day.startTime : '-'}
								</td>
								<td className="border border-slate-300 px-1 py-0.5 text-center font-mono">
									{isWork && day.breakStartTime ? day.breakStartTime : '-'}
								</td>
								<td className="border border-slate-300 px-1 py-0.5 text-center font-mono">
									{isWork && day.breakEndTime ? day.breakEndTime : '-'}
								</td>
								<td className="border border-slate-300 px-1 py-0.5 text-center font-mono">
									{isWork && day.endTime ? day.endTime : '-'}
								</td>
								<td className="border border-slate-300 px-1 py-0.5 text-center font-mono font-semibold">
									{isWork && hasHours ? calc.formattedWorked : '-'}
								</td>
								<td className="border border-slate-300 px-1 py-0.5 text-center font-mono font-semibold">
									{isWork && hasHours ? (
										<span className={calc.isHolidayWork || calc.isOvertime ? 'text-emerald-700 font-bold' : calc.isDeficit ? 'text-rose-700' : ''}>
											{calc.formattedBalance} {calc.isHolidayWork ? '(100%)' : ''}
										</span>
									) : (
										'-'
									)}
								</td>
								<td className="border border-slate-300 px-1.5 py-0.5 text-slate-600 truncate max-w-[140px]">
									{isHoliday ? (day.holidayName ? `Feriado: ${day.holidayName}` : day.notes || '') : day.notes || ''}
								</td>
							</tr>
						);
					})}
				</tbody>
				<tfoot>
					<tr className="bg-slate-100 font-bold border-t-2 border-slate-400 text-slate-900">
						<td colSpan={7} className="border border-slate-300 px-2 py-1 text-right uppercase text-[9px]">
              Totais do Mês ({summary.workDaysCount} dias de trabalho):
						</td>
						<td className="border border-slate-300 px-1 py-1 text-center font-mono text-xs">
							{summary.formattedTotalWorked}
						</td>
						<td className="border border-slate-300 px-1 py-1 text-center font-mono text-xs">
							<span className={summary.totalBalanceMinutes >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
								{summary.formattedBalance}
							</span>
						</td>
						<td className="border border-slate-300 px-1 py-1 text-[9px] text-slate-500 font-normal">
              Saldo apurado
						</td>
					</tr>
				</tfoot>
			</table>

			{/* 5. TERMO DE CIÊNCIA E ASSINATURAS */}
			<div className="pt-2 border-t border-slate-300 text-[9px] text-slate-600">
				<p className="text-center italic mb-6">
          Declaro para os devidos fins que os horários e informações acima representam a jornada efetivamente cumprida no período de referência.
				</p>

				<div className="grid grid-cols-2 gap-8 px-6 text-center">
					<div>
						<div className="border-t border-slate-400 pt-1">
							<p className="font-bold text-slate-800">Assinatura do Trabalhador(a)</p>
							<p className="text-[8px] text-slate-500">Data: ____/____/________</p>
						</div>
					</div>
					<div>
						<div className="border-t border-slate-400 pt-1">
							<p className="font-bold text-slate-800">Visto da Empresa / Gestor de RH</p>
							<p className="text-[8px] text-slate-500">Data: ____/____/________</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
