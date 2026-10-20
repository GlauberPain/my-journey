import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScheduleDay, DayType } from '@/lib/types';
import { calculateDay } from '@/lib/calculator';
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
			<CardHeader className="pb-3 flex flex-row items-center justify-between">
				<div className="flex items-center gap-2">
					<TableIcon className="h-5 w-5 text-primary" />
					<div>
						<CardTitle className="text-base font-semibold">Tabela Detalhada de Horários & Feriados</CardTitle>
						<p className="text-xs text-muted-foreground">
              Feriados têm a meta zerada automaticamente. Ao sinalizar trabalho no feriado, todas as horas contam como 100% extras!
						</p>
					</div>
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
								<th className="py-2.5 px-3 min-w-[105px] text-center">Saldo / Extra</th>
								<th className="py-2.5 px-3 min-w-[85px] text-right">Ações</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border/60">
							{days.map((day) => {
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

										{/* Saldo Diário */}
										<td className="py-2 px-3 text-center font-mono">
											{isHoliday && day.workedOnHoliday && (day.startTime || day.endTime) ? (
												<Badge variant="success" className="text-[10px] py-0 px-1 font-bold">
													{calc.formattedBalance} (100%)
												</Badge>
											) : isWork && (day.startTime || day.endTime) ? (
												<span
													className={`font-semibold ${
														calc.isOvertime
															? 'text-emerald-600 dark:text-emerald-400'
															: calc.isDeficit
																? 'text-rose-600 dark:text-rose-400'
																: 'text-muted-foreground'
													}`}
												>
													{calc.formattedBalance}
												</span>
											) : isHoliday ? (
												<span className="text-[10px] text-amber-700 dark:text-amber-400 italic">Folga Feriado</span>
											) : (
												<span className="text-muted-foreground/40">-</span>
											)}
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
						</tbody>
					</table>
				</div>
			</CardContent>
		</Card>
	);
}
