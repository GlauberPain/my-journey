import React from 'react';
import { Card, CardContent } from '@/components/ui';
import { MonthSummary } from '@/lib/types';
import { LegalAnalysisResult } from '@/lib/legalAnalysis';
import { Clock, CalendarCheck, Coffee, Scale } from 'lucide-react';

interface SummaryCardsProps {
  summary: MonthSummary;
  legalAnalysis?: LegalAnalysisResult | null;
}

export function SummaryCards({ summary, legalAnalysis }: SummaryCardsProps) {
	const weeklyHours = legalAnalysis ? legalAnalysis.weeklyWorkedHours : null;
	const isExceeding = legalAnalysis ? legalAnalysis.weeklyWorkedHours > legalAnalysis.effectiveLimitHours : false;

	return (
		<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
			{/* Horas Trabalhadas */}
			<Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-card to-card/50">
				<CardContent className="p-5 flex items-center justify-between">
					<div>
						<p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total no Mês
						</p>
						<h3 className="text-2xl font-bold mt-1 tracking-tight text-foreground">
							{summary.formattedTotalWorked}
						</h3>
						<p className="text-xs text-muted-foreground mt-0.5">
							{summary.holidayWorkedMinutes > 0
								? `Inclui ${summary.formattedHolidayWorked} em feriados`
								: 'Horas totais apuradas'}
						</p>
					</div>
					<div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
						<Clock className="h-5 w-5" />
					</div>
				</CardContent>
			</Card>

			{/* Carga Semanal Apurada */}
			<Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-card to-card/50">
				<CardContent className="p-5 flex items-center justify-between">
					<div>
						<p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Carga Semanal
						</p>
						<h3
							className={`text-2xl font-bold mt-1 tracking-tight ${
								isExceeding
									? 'text-rose-600 dark:text-rose-400'
									: 'text-foreground'
							}`}
						>
							{weeklyHours !== null ? (
								<>
									{weeklyHours}h <span className="text-sm font-normal text-muted-foreground">/ sem</span>
								</>
							) : (
								'--'
							)}
						</h3>
						<p className="text-xs text-muted-foreground mt-0.5">
							{legalAnalysis
								? `Teto CLT: ${legalAnalysis.effectiveLimitHours}h • ${legalAnalysis.isScale6x1 ? 'Escala 6x1' : legalAnalysis.scaleType ? `Escala ${legalAnalysis.scaleType}` : 'Jornada apurada'}`
								: 'Defina os turnos na tabela'}
						</p>
					</div>
					<div
						className={`h-11 w-11 rounded-xl flex items-center justify-center ${
							isExceeding
								? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
								: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
						}`}
					>
						<Scale className="h-5 w-5" />
					</div>
				</CardContent>
			</Card>

			{/* Dias Trabalhados */}
			<Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-card to-card/50">
				<CardContent className="p-5 flex items-center justify-between">
					<div>
						<p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Dias Trabalhados
						</p>
						<h3 className="text-2xl font-bold mt-1 tracking-tight text-foreground">
							{summary.workDaysCount} <span className="text-sm font-normal text-muted-foreground">dias</span>
						</h3>
						<p className="text-xs text-muted-foreground mt-0.5">
              Escala ativa no mês
						</p>
					</div>
					<div className="h-11 w-11 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
						<CalendarCheck className="h-5 w-5" />
					</div>
				</CardContent>
			</Card>

			{/* Dias de Folga & Feriados */}
			<Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-card to-card/50">
				<CardContent className="p-5 flex items-center justify-between">
					<div>
						<p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Folgas & Descansos
						</p>
						<h3 className="text-2xl font-bold mt-1 tracking-tight text-foreground">
							{summary.offDaysCount} <span className="text-sm font-normal text-muted-foreground">dias</span>
						</h3>
						<p className="text-xs text-muted-foreground mt-0.5">
							{summary.holidayDaysCount > 0
								? `${summary.holidayDaysCount} feriado(s) no mês`
								: 'Descansos e pausas semanais'}
						</p>
					</div>
					<div className="h-11 w-11 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
						<Coffee className="h-5 w-5" />
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
