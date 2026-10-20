'use client';

import React from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LegalAnalysisResult } from '@/lib/legalAnalysis';
import {
	Scale,
	Calendar,
	Coins,
	Clock,
	CheckCircle2,
	FileText,
	CalendarCheck,
	AlertOctagon,
} from 'lucide-react';

interface LegalRightsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analysis: LegalAnalysisResult | null;
}

export function LegalRightsModal({ open, onOpenChange, analysis }: LegalRightsModalProps) {
	if (!analysis) return null;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<div className="max-h-[85vh] overflow-y-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pr-1">
				<DialogHeader className="text-left pb-2 border-b border-border">
					<div className="flex items-center gap-2">
						<div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
							<Scale className="h-5 w-5" />
						</div>
						<div>
							<DialogTitle className="text-base font-bold text-foreground">
                Diagnóstico Legal: Escala de Trabalho & Fim do 6x1
							</DialogTitle>
							<DialogDescription className="text-xs">
                Análise com base na CLT, Constituição Federal e nas novas regras do fim da escala 6x1.
							</DialogDescription>
						</div>
					</div>
				</DialogHeader>

				<div className="space-y-4 py-3 text-xs">
					{/* Badges de Resumo */}
					<div className="flex flex-wrap items-center gap-2">
						<Badge
							variant={analysis.isActiveViolation || analysis.isScale6x1 ? 'destructive' : 'secondary'}
							className="text-xs font-semibold py-1 px-2.5"
						>
							{analysis.isActiveViolation
								? (analysis.isScale6x1 ? '🚨 Escala 6x1 Ilegal no Mês' : `🚨 Carga ${analysis.weeklyWorkedHours}h Excede Teto Legal`)
								: analysis.isScale6x1
									? '⚠️ Escala 6x1 Detectada'
									: `Escala ${analysis.scaleType.toUpperCase()}`}
						</Badge>

						<Badge variant="outline" className="text-xs py-1 px-2.5 font-mono">
							{analysis.weeklyWorkedHours}h semanais ({analysis.workDaysPerWeek} dias de trabalho / {analysis.offDaysPerWeek} de descanso)
						</Badge>

						{analysis.referenceMonthYear && (
							<Badge variant="outline" className="text-xs py-1 px-2.5">
								Mês em Análise: {analysis.referenceMonthYear}
							</Badge>
						)}

						{analysis.isActiveViolation ? (
							<Badge variant="destructive" className="text-xs py-1 px-2.5 font-bold animate-pulse">
								🚨 Violação da Legislação Vigente
							</Badge>
						) : analysis.exceeds44Hours ? (
							<Badge variant="destructive" className="text-xs py-1 px-2.5">
								Excede o Limite Máximo da CLT (44h)
							</Badge>
						) : analysis.isScale6x1 || analysis.weeklyWorkedHours >= 44 ? (
							<Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-xs py-1 px-2.5">
								Alvo de Redução Obrigatória
							</Badge>
						) : (
							<Badge variant="success" className="text-xs py-1 px-2.5">
								Em Conformidade Legal
							</Badge>
						)}
					</div>

					{/* 1. Você tem direito à redução de carga horária? */}
					<div className={`p-3.5 rounded-xl border space-y-2 ${
						analysis.isActiveViolation
							? 'border-rose-500/30 bg-rose-500/5'
							: 'border-border bg-card/60'
					}`}>
						<div className="flex items-center gap-2 text-sm font-bold text-foreground">
							{analysis.isActiveViolation ? (
								<AlertOctagon className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 animate-pulse" />
							) : (
								<Clock className="h-4 w-4 text-primary shrink-0" />
							)}
							<span>{analysis.isActiveViolation ? 'Violação da Jornada Legal & Direito à Redução' : 'Você tem direito à redução de carga horária?'}</span>
						</div>
						<p className="text-muted-foreground leading-relaxed">
							{analysis.reductionReason}
						</p>
					</div>

					{/* 2. A partir de que dia você deve conseguir essa redução ou compensação? */}
					<div className={`p-3.5 rounded-xl border space-y-2 ${
						analysis.isActiveViolation
							? 'border-rose-500/30 bg-rose-500/5'
							: 'border-border bg-card/60'
					}`}>
						<div className="flex items-center gap-2 text-sm font-bold text-foreground">
							{analysis.isActiveViolation ? (
								<AlertOctagon className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
							) : analysis.isScale6x1 || analysis.exceedsEffectiveLimit ? (
								<Calendar className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
							) : (
								<CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
							)}
							<span>{analysis.isActiveViolation ? 'Situação no Mês Selecionado (Direito Imediato)' : (analysis.isScale6x1 || analysis.exceedsEffectiveLimit ? 'A partir de que dia você tem esse direito?' : 'Situação da sua jornada')}</span>
						</div>
						<div
							className={`p-3 rounded-lg border font-medium leading-relaxed ${
								analysis.isActiveViolation
									? 'bg-rose-500/15 border-rose-500/30 text-rose-950 dark:text-rose-100'
									: analysis.isScale6x1 || analysis.weeklyWorkedHours >= 44 || analysis.exceedsEffectiveLimit
										? 'bg-amber-500/10 border-amber-500/20 text-amber-900 dark:text-amber-200'
										: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-900 dark:text-emerald-200'
							}`}
						>
							{analysis.effectiveDateInfo}
						</div>
						{(analysis.isScale6x1 || analysis.weeklyWorkedHours >= 44) && (
							<div className="p-3 rounded-lg bg-muted/50 border border-border text-muted-foreground leading-relaxed space-y-1">
								<p className="font-semibold text-foreground">
									📅 Cronograma de Transição e Redução de Carga Horária:
								</p>
								<ul className="list-disc list-inside space-y-1.5 text-[11px]">
									<li>
										<strong>16 de dezembro de 2026 (60 dias após a promulgação):</strong> A jornada máxima permitida cai de 44 para <strong>42 horas semanais</strong>, e passa a ser obrigatório o direito a dois dias de descanso remunerado na semana (preferencialmente aos domingos, escala <strong>5x2</strong>), sem redução salarial.
									</li>
									<li>
										<strong>16 de dezembro de 2027 (1 ano após a 1ª etapa):</strong> A jornada semanal atinge o limite definitivo de <strong>40 horas semanais</strong>.
									</li>
									<li className="list-none text-[10.5px] italic text-muted-foreground/90 pt-1">
										💡 O fim da escala 6x1 não se resume a dias de descanso, mas à redução mandatória da jornada semanal sem perda salarial. Durante o 1º ano de transição (dez/2026 a dez/2027), acordos e convenções coletivas podem organizar a redistribuição diária de horários para acomodar as 42h mantendo as 2 folgas semanais.
									</li>
								</ul>
							</div>
						)}
					</div>

					{/* 3. Como funciona a compensação: Em Dinheiro ou em Folga? */}
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
						{/* Dinheiro */}
						<div className="p-3 rounded-xl border border-border bg-card/60 space-y-1.5">
							<div className="flex items-center gap-1.5 font-bold text-foreground">
								<Coins className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
								<span>Compensação em Dinheiro</span>
							</div>
							<ul className="space-y-1 text-muted-foreground text-[11px] list-disc list-inside">
								<li>
									<strong>Dias úteis:</strong> adicional mínimo de <strong>50%</strong> por hora extra (Art. 59 da CLT).
								</li>
								<li>
									<strong>Domingos e Feriados:</strong> adicional de <strong>100%</strong> (em dobro) caso não haja folga compensatória na mesma semana (Súmula 146 TST).
								</li>
								{analysis.hasInsufficientInterval && (
									<li className="text-rose-600 dark:text-rose-400 font-medium">
										<strong>{analysis.scaleType === '12x36' ? 'Plantão direto (sem 1h de almoço):' : 'Almoço violado:'}</strong>{' '}
										{analysis.scaleType === '12x36'
											? 'em plantão 12x36 contínuo com pausas curtas de 15min para lanche, se não houver 1h para refeição externa, o período deve ser indenizado com 50% de adicional (Art. 59-A e Art. 71 CLT).'
											: 'tempo suprimido deve ser indenizado com 50% de adicional (Art. 71 CLT).'}
									</li>
								)}
							</ul>
						</div>

						{/* Folga */}
						<div className="p-3 rounded-xl border border-border bg-card/60 space-y-1.5">
							<div className="flex items-center gap-1.5 font-bold text-foreground">
								<CalendarCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
								<span>Compensação em Folga</span>
							</div>
							<ul className="space-y-1 text-muted-foreground text-[11px] list-disc list-inside">
								<li>
                  Válida somente se existir <strong>Banco de Horas</strong> formal.
								</li>
								<li>
									<strong>Acordo individual escrito:</strong> prazo máximo de <strong>6 meses</strong> para conceder a folga.
								</li>
								<li>
                  Se a empresa não liberar a folga no prazo legal, <strong>é obrigada a pagar tudo em dinheiro com os adicionais</strong>.
								</li>
							</ul>
						</div>
					</div>

					{/* 4. Recomendações Práticas */}
					<div className="p-3.5 rounded-xl border border-border bg-muted/30 space-y-2">
						<div className="flex items-center gap-2 font-bold text-foreground">
							<FileText className="h-4 w-4 text-primary" />
							<span>O que você deve fazer agora:</span>
						</div>
						<ul className="space-y-1.5 text-muted-foreground">
							{analysis.recommendations.map((rec, idx) => (
								<li key={idx} className="flex items-start gap-2">
									<CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
									<span>{rec}</span>
								</li>
							))}
						</ul>
					</div>
				</div>

				<DialogFooter className="border-t border-border pt-3">
					<Button onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Entendido, fechar diagnóstico
					</Button>
				</DialogFooter>
			</div>
		</Dialog>
	);
}
