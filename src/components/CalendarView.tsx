import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScheduleDay } from '@/lib/types';
import { calculateDay } from '@/lib/calculator';
import { Calendar as CalendarIcon, Clock } from 'lucide-react';

interface CalendarViewProps {
  days: ScheduleDay[];
  year: number;
  month: number;
  dailyExpectedMinutes: number;
  onUpdateDay: (date: string, updates: Partial<ScheduleDay>) => void;
  onSelectDayForEdit: (day: ScheduleDay) => void;
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function CalendarView({
	days,
	year,
	month,
	dailyExpectedMinutes,
	onUpdateDay,
	onSelectDayForEdit,
}: CalendarViewProps) {
	// Primeiro dia do mês para saber o deslocamento (offset)
	const firstDayOfWeek = new Date(year, month - 1, 1).getDay();

	// Dias em branco antes do início do mês
	const blanks = Array.from({ length: firstDayOfWeek });

	const handleToggleHoliday = (e: React.MouseEvent, day: ScheduleDay) => {
		e.stopPropagation();
		const willWork = !day.workedOnHoliday;
		onUpdateDay(day.date, {
			workedOnHoliday: willWork,
			dayType: willWork ? 'work' : 'holiday',
			startTime: willWork ? (day.startTime || '08:00') : '',
			endTime: willWork ? (day.endTime || '17:00') : '',
			breakStartTime: willWork ? (day.breakStartTime || '12:00') : '',
			breakEndTime: willWork ? (day.breakEndTime || '13:00') : '',
		});
	};

	return (
		<Card className="border-border/60 shadow-sm">
			<CardHeader className="pb-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<CalendarIcon className="h-5 w-5 text-primary" />
						<CardTitle className="text-base font-semibold">Visão de Calendário Mensal</CardTitle>
					</div>
					<span className="text-xs text-muted-foreground">
            Feriados nacionais são identificados automaticamente com isenção de meta contratual
					</span>
				</div>
			</CardHeader>

			<CardContent>
				{/* Cabeçalho dos dias da semana */}
				<div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center text-xs font-semibold text-muted-foreground">
					{WEEKDAYS.map((name, index) => (
						<div
							key={name}
							className={`py-2 rounded-md ${
								index === 0 || index === 6 ? 'text-rose-500 font-bold' : ''
							}`}
						>
							{name}
						</div>
					))}
				</div>

				{/* Grade de Dias */}
				<div className="grid grid-cols-7 gap-1 sm:gap-2">
					{/* Espaços vazios do início do mês */}
					{blanks.map((_, i) => (
						<div
							key={`blank-${i}`}
							className="min-h-[90px] sm:min-h-[115px] rounded-lg border border-dashed border-border/40 bg-muted/10 p-2 opacity-40"
						/>
					))}

					{/* Dias do mês */}
					{days.map((day) => {
						const dayNum = parseInt(day.date.split('-')[2], 10);
						const calc = calculateDay(day, dailyExpectedMinutes);
						const isHoliday = day.isHoliday || day.dayType === 'holiday';
						const isWork = day.dayType === 'work';
						const isWeekend = day.dayOfWeek === 0 || day.dayOfWeek === 6;

						return (
							<div
								key={day.date}
								onClick={() => onSelectDayForEdit(day)}
								className={`min-h-[90px] sm:min-h-[115px] rounded-lg border p-1.5 sm:p-2.5 flex flex-col justify-between transition-all cursor-pointer group hover:border-primary hover:shadow-sm ${
									isHoliday
										? day.workedOnHoliday
											? 'border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10'
											: 'border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10'
										: isWork
											? 'border-border/80 bg-card hover:bg-accent/40'
											: 'border-border/40 bg-muted/30 text-muted-foreground hover:bg-muted/50'
								}`}
							>
								{/* Linha superior: número do dia + status/badge */}
								<div className="flex items-start justify-between gap-1">
									<span
										className={`text-xs sm:text-sm font-bold ${
											isHoliday ? 'text-amber-600 dark:text-amber-400' : isWeekend ? 'text-rose-500' : 'text-foreground'
										}`}
									>
										{dayNum}
									</span>

									{isHoliday ? (
										<Badge
											variant="outline"
											className={`text-[8px] sm:text-[9px] px-1 py-0 font-semibold truncate max-w-[85px] sm:max-w-[100px] ${
												day.workedOnHoliday
													? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
													: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
											}`}
											title={day.holidayName || 'Feriado Nacional'}
										>
											{day.workedOnHoliday ? '100% Extra' : (day.holidayName || 'Feriado')}
										</Badge>
									) : (
										<Badge
											variant={isWork ? 'default' : 'secondary'}
											className={`text-[9px] sm:text-[10px] px-1.5 py-0 font-normal ${
												isWork
													? 'bg-primary/15 text-primary border border-primary/20 hover:bg-primary/20'
													: 'bg-muted text-muted-foreground'
											}`}
										>
											{isWork ? 'Trabalho' : 'Folga'}
										</Badge>
									)}
								</div>

								{/* Conteúdo central: Horários / Feriado */}
								{isHoliday ? (
									<div className="my-1 space-y-1">
										<p className="text-[9px] font-medium text-amber-700 dark:text-amber-400 truncate" title={day.holidayName}>
											{day.holidayName || 'Feriado Nacional'}
										</p>

										{day.workedOnHoliday ? (
											<div className="text-[9px] sm:text-[10px] font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
												{day.startTime} - {day.endTime}
											</div>
										) : (
											<button
												type="button"
												onClick={(e) => handleToggleHoliday(e, day)}
												className="text-[9px] px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 font-medium transition-colors"
											>
                        + Trabalhar (Extra)
											</button>
										)}
									</div>
								) : isWork ? (
									<div className="my-1 space-y-0.5 text-[10px] sm:text-xs">
										{day.startTime && day.endTime ? (
											<>
												<div className="flex items-center gap-1 font-mono text-muted-foreground">
													<Clock className="h-3 w-3 shrink-0 text-primary/70" />
													<span>
														{day.startTime} - {day.endTime}
													</span>
												</div>
												{day.breakStartTime && (
													<div className="text-[9px] sm:text-[10px] text-muted-foreground truncate">
                            Almoço: {day.breakStartTime} - {day.breakEndTime}
													</div>
												)}
											</>
										) : (
											<div className="py-1 text-[10px] text-muted-foreground/60 italic group-hover:text-primary transition-colors">
                        + Definir horário
											</div>
										)}
									</div>
								) : (
									<div className="my-auto py-1 text-center text-[10px] sm:text-xs text-muted-foreground/70 italic">
                    Descanso
									</div>
								)}

								{/* Linha inferior: Total trabalhado e Saldo */}
								{(isWork || (isHoliday && day.workedOnHoliday)) && (day.startTime || day.endTime) && (
									<div className="flex items-center justify-between pt-1 border-t border-border/40 text-[10px] sm:text-xs">
										<span className="font-semibold text-foreground font-mono">
											{calc.formattedWorked}
										</span>
										<span
											className={`text-[10px] font-mono font-bold ${
												calc.isHolidayWork
													? 'text-emerald-600 dark:text-emerald-400'
													: calc.isOvertime
														? 'text-emerald-600 dark:text-emerald-400'
														: calc.isDeficit
															? 'text-rose-600 dark:text-rose-400'
															: 'text-muted-foreground'
											}`}
										>
											{calc.formattedBalance}
										</span>
									</div>
								)}
							</div>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
}
