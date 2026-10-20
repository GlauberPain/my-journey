import React from 'react';
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Input,
} from '@/components/ui';
import { ScheduleDay, DayType } from '@/lib/types';
import {
	calculateDay,
	minutesToTime,
	calculateShiftWorkedMinutes,
} from '@/lib/calculator';
import { Table as TableIcon, Copy, Check } from 'lucide-react';

interface ScheduleTableProps {
  days: ScheduleDay[];
  dailyExpectedMinutes: number;
  onUpdateDay: (date: string, updates: Partial<ScheduleDay>) => void;
  onApplyTimeToAllWorkdays: (sourceDay: ScheduleDay) => void;
}

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export function ScheduleTable({
	days,
	dailyExpectedMinutes,
	onUpdateDay,
	onApplyTimeToAllWorkdays,
}: ScheduleTableProps) {
	const [copiedDate, setCopiedDate] = React.useState<string | null>(null);

	// Agrupamento semanal (fecha no Domingo ou no último dia do mês) para apuração de saldo semanal (Art. 7º, XIII CF)
	const weeks: ScheduleDay[][] = React.useMemo(() => {
		const result: ScheduleDay[][] = [];
		let currentWeek: ScheduleDay[] = [];

		days.forEach((day, idx) => {
			currentWeek.push(day);
			const isSunday = day.dayOfWeek === 0;
			const isLast = idx === days.length - 1;

			if (isSunday || isLast) {
				result.push(currentWeek);
				currentWeek = [];
			}
		});

		return result;
	}, [days]);

	const handleCopy = (day: ScheduleDay) => {
		onApplyTimeToAllWorkdays(day);
		setCopiedDate(day.date);
		setTimeout(() => setCopiedDate(null), 2000);
	};

	const handleToggleHolidayWork = (day: ScheduleDay) => {
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
		<Card className="border-border/60 shadow-sm overflow-hidden">
			<CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<TableIcon className="h-5 w-5 text-primary shrink-0" />
					<div>
						<CardTitle className="text-base font-semibold">Tabela Detalhada de Horários & Feriados</CardTitle>
						<p className="text-xs text-muted-foreground">
              Feriados têm a meta zerada automaticamente. Ao sinalizar trabalho no feriado, todas as horas contam como 100% extras!
						</p>
					</div>
				</div>
				<div className="flex items-center gap-2 text-xs text-muted-foreground self-start sm:self-center shrink-0">
					<span className="text-[11px] font-medium text-primary/90 bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20 flex items-center gap-1">
						← Deslize para ver todos os campos →
					</span>
				</div>
			</CardHeader>

			<CardContent className="p-0">
				<div className="overflow-x-auto">
					<table className="w-full text-xs text-left border-collapse">
						<thead>
							<tr className="border-y bg-muted/40 text-muted-foreground font-semibold">
								<th className="py-2.5 px-3 min-w-[85px]">Data</th>
								<th className="py-2.5 px-3 min-w-[95px]">Dia</th>
								<th className="py-2.5 px-3 min-w-[140px]">Situação / Feriado</th>
								<th className="py-2.5 px-3 min-w-[95px]">Início</th>
								<th className="py-2.5 px-3 min-w-[110px]">Intervalo Início</th>
								<th className="py-2.5 px-3 min-w-[110px]">Intervalo Fim</th>
								<th className="py-2.5 px-3 min-w-[95px]">Fim</th>
								<th className="py-2.5 px-3 min-w-[95px] text-center">Horas Líquidas</th>
								<th className="py-2.5 px-3 min-w-[85px] text-right">Ações</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border/60">
							{weeks.map((weekDays, weekIdx) => {
								// Total de horas trabalhadas na semana
								let weekWorked = 0;

								weekDays.forEach((d) => {
									const isHoliday = d.isHoliday || d.dayType === 'holiday';
									if (isHoliday && d.workedOnHoliday) {
										const { workedMinutes } = calculateShiftWorkedMinutes(d);
										weekWorked += workedMinutes;
									} else if (d.dayType === 'work' && (d.startTime || d.endTime)) {
										const { workedMinutes } = calculateShiftWorkedMinutes(d);
										weekWorked += workedMinutes;
									}
								});
								const firstDayStr = weekDays[0].date.split('-').reverse().slice(0, 2).join('/');
								const lastDayStr = weekDays[weekDays.length - 1].date.split('-').reverse().slice(0, 2).join('/');

								return (
									<React.Fragment key={`week-${weekIdx}`}>
										{weekDays.map((day) => {
											const calc = calculateDay(day, dailyExpectedMinutes);
											const isHoliday = day.isHoliday || day.dayType === 'holiday';
											const isWork = day.dayType === 'work' || (isHoliday && day.workedOnHoliday);
											const isWeekend = day.dayOfWeek === 0 || day.dayOfWeek === 6;

											return (
												<tr
													key={day.date}
													className={`transition-colors hover:bg-muted/20 ${
														isHoliday
															? day.workedOnHoliday
																? 'bg-emerald-500/5'
																: 'bg-amber-500/5'
															: !isWork
																? 'bg-muted/10 opacity-75'
																: ''
													}`}
												>
													{/* Data formatada DD/MM */}
													<td className="py-2 px-3 font-medium font-mono text-foreground">
														{day.date.split('-').reverse().slice(0, 2).join('/')}
													</td>

													{/* Dia da semana */}
													<td className={`py-2 px-3 font-medium ${isWeekend ? 'text-rose-500 font-bold' : ''}`}>
														{DAY_NAMES[day.dayOfWeek]}
													</td>

													{/* Situação / Feriado */}
													<td className="py-2 px-3">
														{isHoliday ? (
															<div className="space-y-1">
																<span
																	className="inline-block text-[10px] font-bold text-amber-700 dark:text-amber-400 truncate max-w-[150px]"
																	title={day.holidayName}
																>
                                  🎉 {day.holidayName || 'Feriado'}
																</span>
																<div>
																	<button
																		type="button"
																		onClick={() => handleToggleHolidayWork(day)}
																		className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors border ${
																			day.workedOnHoliday
																				? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
																				: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
																		}`}
																	>
																		{day.workedOnHoliday ? '✓ Trabalhando (100% Extra)' : '+ Trabalhar no Feriado'}
																	</button>
																</div>
															</div>
														) : (
															<select
																value={day.dayType}
																onChange={(e) =>
																	onUpdateDay(day.date, { dayType: e.target.value as DayType })
																}
																className="text-xs bg-background border border-input rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring font-medium"
															>
																<option value="work">Trabalho</option>
																<option value="off">Folga</option>
																<option value="dsr">DSR</option>
																<option value="holiday">Feriado</option>
																<option value="leave">Atestado</option>
															</select>
														)}
													</td>

													{/* Hora Início */}
													<td className="py-2 px-3">
														<Input
															type="time"
															value={day.startTime}
															disabled={!isWork}
															onChange={(e) => onUpdateDay(day.date, { startTime: e.target.value })}
															className="h-8 text-xs font-mono disabled:opacity-30 disabled:bg-transparent"
														/>
													</td>

													{/* Intervalo Início */}
													<td className="py-2 px-3">
														<Input
															type="time"
															value={day.breakStartTime}
															disabled={!isWork}
															onChange={(e) => onUpdateDay(day.date, { breakStartTime: e.target.value })}
															className="h-8 text-xs font-mono disabled:opacity-30 disabled:bg-transparent"
														/>
													</td>

													{/* Intervalo Fim */}
													<td className="py-2 px-3">
														<Input
															type="time"
															value={day.breakEndTime}
															disabled={!isWork}
															onChange={(e) => onUpdateDay(day.date, { breakEndTime: e.target.value })}
															className="h-8 text-xs font-mono disabled:opacity-30 disabled:bg-transparent"
														/>
													</td>

													{/* Hora Fim */}
													<td className="py-2 px-3">
														<Input
															type="time"
															value={day.endTime}
															disabled={!isWork}
															onChange={(e) => onUpdateDay(day.date, { endTime: e.target.value })}
															className="h-8 text-xs font-mono disabled:opacity-30 disabled:bg-transparent"
														/>
													</td>

													{/* Total Horas Líquidas */}
													<td className="py-2 px-3 text-center font-mono font-semibold text-foreground">
														{isWork && (day.startTime || day.endTime) ? calc.formattedWorked : '--:--'}
													</td>

													{/* Ações */}
													<td className="py-2 px-3 text-right">
														{isWork && !isHoliday && (
															<button
																type="button"
																onClick={() => handleCopy(day)}
																title="Replicar este horário para todos os dias de trabalho"
																className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-transparent hover:border-border transition-colors"
															>
																{copiedDate === day.date ? (
																	<>
																		<Check className="h-3 w-3 text-emerald-500" />
																		<span className="text-emerald-600 dark:text-emerald-400 font-medium">Copiado</span>
																	</>
																) : (
																	<>
																		<Copy className="h-3 w-3" />
																		<span className="hidden sm:inline">Replicar</span>
																	</>
																)}
															</button>
														)}
													</td>
												</tr>
											);
										})}

										{/* Linha de Fechamento Semanal */}
										<tr className="bg-muted/40 hover:bg-muted/50 border-y-2 border-border/80 transition-colors text-xs">
											<td colSpan={7} className="py-2.5 px-3">
												<div className="flex flex-wrap items-center justify-between gap-2">
													<span className="font-bold text-foreground flex items-center gap-1.5">
														<span className="h-2 w-2 rounded-full bg-primary/70 inline-block" />
														<span>Total da Semana {weekIdx + 1}</span>
														<span className="text-[11px] font-normal text-muted-foreground">({firstDayStr} a {lastDayStr})</span>
													</span>
												</div>
											</td>
											<td className="py-2.5 px-3 text-center font-mono">
												<div className="flex flex-col items-center">
													<span className="font-bold text-foreground text-sm font-mono">
														{minutesToTime(weekWorked)}
													</span>
													<span className="text-[9px] text-muted-foreground uppercase font-sans tracking-tight">Total Semana</span>
												</div>
											</td>
											<td className="py-2.5 px-3"></td>
										</tr>
									</React.Fragment>
								);
							})}
						</tbody>
					</table>
				</div>
			</CardContent>
		</Card>
	);
}
