import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { MonthSummary } from '@/lib/types';
import { Clock, TrendingUp, TrendingDown, CalendarCheck, Coffee, Sparkles } from 'lucide-react';

interface SummaryCardsProps {
  summary: MonthSummary;
}

export function SummaryCards({ summary }: SummaryCardsProps) {
	const isPositive = summary.totalBalanceMinutes >= 0;

	return (
		<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
			{/* Horas Trabalhadas */}
			<Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-card to-card/50">
				<CardContent className="p-5 flex items-center justify-between">
					<div>
						<p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Realizado
						</p>
						<h3 className="text-2xl font-bold mt-1 tracking-tight text-foreground">
							{summary.formattedTotalWorked}
						</h3>
						<p className="text-xs text-muted-foreground mt-0.5">
              Meta: {summary.formattedExpected}
						</p>
					</div>
					<div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
						<Clock className="h-5 w-5" />
					</div>
				</CardContent>
			</Card>

			{/* Saldo de Horas */}
			<Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-card to-card/50">
				<CardContent className="p-5 flex items-center justify-between">
					<div>
						<p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Banco de Horas
						</p>
						<h3
							className={`text-2xl font-bold mt-1 tracking-tight ${
								isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
							}`}
						>
							{summary.formattedBalance}
						</h3>
						<p className="text-xs text-muted-foreground mt-0.5">
							{summary.holidayWorkedMinutes > 0 ? (
								<span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
									<Sparkles className="h-3 w-3" /> Inclui {summary.formattedHolidayWorked} em feriados
								</span>
							) : isPositive ? (
								'Horas extras acumuladas'
							) : (
								'Horas a compensar'
							)}
						</p>
					</div>
					<div
						className={`h-11 w-11 rounded-xl flex items-center justify-center ${
							isPositive
								? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
								: 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
						}`}
					>
						{isPositive ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
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
              Folgas, DSR & Feriados
						</p>
						<h3 className="text-2xl font-bold mt-1 tracking-tight text-foreground">
							{summary.offDaysCount} <span className="text-sm font-normal text-muted-foreground">dias</span>
						</h3>
						<p className="text-xs text-muted-foreground mt-0.5">
							{summary.holidayDaysCount > 0
								? `${summary.holidayDaysCount} feriado(s) no mês`
								: 'Descansos e pausas'}
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
