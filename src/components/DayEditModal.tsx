'use client';

import React, { useState } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScheduleDay, DayType } from '@/lib/types';
import { calculateDay } from '@/lib/calculator';
import { Calendar, Sparkles } from 'lucide-react';

interface DayEditModalProps {
  day: ScheduleDay | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dailyExpectedMinutes: number;
  onSave: (date: string, updates: Partial<ScheduleDay>) => void;
}

const DAY_NAMES = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

export function DayEditModal({
	day,
	open,
	onOpenChange,
	dailyExpectedMinutes,
	onSave,
}: DayEditModalProps) {
	const [prevDay, setPrevDay] = useState(day);
	const [form, setForm] = useState<ScheduleDay | null>(day);

	if (day !== prevDay) {
		setPrevDay(day);
		setForm(day);
	}

	if (!form) return null;

	const calc = calculateDay(form, dailyExpectedMinutes);
	const isHoliday = form.isHoliday || form.dayType === 'holiday';
	const isWork = form.dayType === 'work' || (isHoliday && form.workedOnHoliday);

	const handleSave = () => {
		onSave(form.date, form);
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogHeader>
				<DialogTitle className="flex items-center gap-2">
					<Calendar className="h-5 w-5 text-primary" />
          Editar Horários do Dia
				</DialogTitle>
				<DialogDescription>
					{form.date.split('-').reverse().join('/')} - {DAY_NAMES[form.dayOfWeek]}
				</DialogDescription>
			</DialogHeader>

			<div className="space-y-4 py-2">
				{/* Banner Especial de Feriado Nacional */}
				{isHoliday ? (
					<div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs space-y-2">
						<div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
							<Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
							<span>Feriado Nacional: {form.holidayName || 'Feriado'}</span>
						</div>
						<p className="text-muted-foreground text-[11px] leading-relaxed">
              A exigência contratual deste dia foi <strong>removida (0h devidas)</strong>. Se você optar por trabalhar neste feriado, todas as horas cumpridas serão computadas como <strong>100% Horas Extras</strong>!
						</p>
						<label className="flex items-center gap-2 pt-2 border-t border-amber-500/20 cursor-pointer font-medium text-foreground text-xs select-none">
							<input
								type="checkbox"
								checked={!!form.workedOnHoliday}
								onChange={(e) => {
									const checked = e.target.checked;
									setForm({
										...form,
										workedOnHoliday: checked,
										dayType: checked ? 'work' : 'holiday',
										startTime: checked ? (form.startTime || '08:00') : '',
										endTime: checked ? (form.endTime || '17:00') : '',
										breakStartTime: checked ? (form.breakStartTime || '12:00') : '',
										breakEndTime: checked ? (form.breakEndTime || '13:00') : '',
									});
								}}
								className="rounded border-input h-4 w-4 text-primary focus:ring-primary"
							/>
							<span className={form.workedOnHoliday ? 'text-emerald-700 dark:text-emerald-400 font-bold' : ''}>
                Vou trabalhar neste feriado (Horas 100% Extras)
							</span>
						</label>
					</div>
				) : (
				/* Tipo de Dia Regular */
					<div className="space-y-1">
						<label className="text-xs font-semibold text-foreground">Situação do Dia</label>
						<select
							value={form.dayType}
							onChange={(e) => setForm({ ...form, dayType: e.target.value as DayType })}
							className="w-full text-sm bg-background border border-input rounded-md px-3 py-2 font-medium"
						>
							<option value="work">Trabalho Presencial / Home Office</option>
							<option value="off">Folga Regular</option>
							<option value="dsr">Descanso Semanal Remunerado (DSR)</option>
							<option value="holiday">Feriado</option>
							<option value="leave">Atestado Médico / Licença</option>
						</select>
					</div>
				)}

				{isWork && (
					<div className="space-y-3 pt-2 border-t border-border">
						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1">
								<label className="text-xs font-semibold text-foreground">Hora de Início</label>
								<Input
									type="time"
									value={form.startTime}
									onChange={(e) => setForm({ ...form, startTime: e.target.value })}
									className="font-mono text-sm"
								/>
							</div>

							<div className="space-y-1">
								<label className="text-xs font-semibold text-foreground">Hora de Fim</label>
								<Input
									type="time"
									value={form.endTime}
									onChange={(e) => setForm({ ...form, endTime: e.target.value })}
									className="font-mono text-sm"
								/>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1">
								<label className="text-xs font-semibold text-foreground">Início Intervalo</label>
								<Input
									type="time"
									value={form.breakStartTime}
									onChange={(e) => setForm({ ...form, breakStartTime: e.target.value })}
									className="font-mono text-sm"
								/>
							</div>

							<div className="space-y-1">
								<label className="text-xs font-semibold text-foreground">Fim Intervalo</label>
								<Input
									type="time"
									value={form.breakEndTime}
									onChange={(e) => setForm({ ...form, breakEndTime: e.target.value })}
									className="font-mono text-sm"
								/>
							</div>
						</div>

						{/* Apuração em tempo real dentro do modal */}
						<div className="p-3 rounded-lg bg-muted/60 border border-border flex items-center justify-between text-xs font-mono">
							<div>
								<span className="text-muted-foreground">Horas Líquidas: </span>
								<span className="font-bold text-foreground">{calc.formattedWorked}</span>
							</div>
							<div>
								<span className="text-muted-foreground">Saldo: </span>
								<span
									className={`font-bold ${
										calc.isHolidayWork
											? 'text-emerald-600 dark:text-emerald-400'
											: calc.isOvertime
												? 'text-emerald-600 dark:text-emerald-400'
												: calc.isDeficit
													? 'text-rose-600 dark:text-rose-400'
													: 'text-foreground'
									}`}
								>
									{calc.formattedBalance} {calc.isHolidayWork ? '(100% Extra)' : ''}
								</span>
							</div>
						</div>
					</div>
				)}

				{/* Observações */}
				<div className="space-y-1">
					<label className="text-xs font-semibold text-foreground">Observação (Opcional)</label>
					<Input
						type="text"
						placeholder="Ex: Escala especial, troca de turno..."
						value={form.notes || ''}
						onChange={(e) => setForm({ ...form, notes: e.target.value })}
						className="text-xs"
					/>
				</div>
			</div>

			<DialogFooter>
				<Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancelar
				</Button>
				<Button onClick={handleSave}>Salvar Alterações</Button>
			</DialogFooter>
		</Dialog>
	);
}
