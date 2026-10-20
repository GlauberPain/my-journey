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
							variant={analysis.isScale6x1 ? 'destructive' : 'secondary'}
							className="text-xs font-semibold py-1 px-2.5"
						>
							{analysis.isScale6x1 ? '⚠️ Escala 6x1 Detectada' : `Escala ${analysis.scaleType.toUpperCase()}`}
						</Badge>

						<Badge variant="outline" className="text-xs py-1 px-2.5 font-mono">
							{analysis.weeklyWorkedHours}h semanais ({analysis.workDaysPerWeek} dias de trabalho / {analysis.offDaysPerWeek} de descanso)
						</Badge>

						{analysis.exceeds44Hours ? (
							<Badge variant="destructive" className="text-xs py-1 px-2.5">
                Excede o Limite Máximo da CLT (44h)
							</Badge>
						) : analysis.isScale6x1 ? (
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
					<div className="p-3.5 rounded-xl border border-border bg-card/60 space-y-2">
						<div className="flex items-center gap-2 text-sm font-bold text-foreground">
							<Clock className="h-4 w-4 text-primary shrink-0" />
							<span>Você tem direito à redução de carga horária?</span>
						</div>
						<p className="text-muted-foreground leading-relaxed">
							{analysis.reductionReason}
						</p>
					</div>

					{/* 2. A partir de que dia você deve conseguir essa redução ou compensação? */}
					<div className="p-3.5 rounded-xl border border-border bg-card/60 space-y-2">
						<div className="flex items-center gap-2 text-sm font-bold text-foreground">
							<Calendar className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
							<span>A partir de que dia você tem esse direito?</span>
						</div>
						<div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 font-medium leading-relaxed">
							{analysis.effectiveDateInfo}
						</div>
						{analysis.isScale6x1 && (
							<p className="text-muted-foreground leading-relaxed pt-1">
                Com o fim da escala 6x1 aprovado no Congresso Nacional, a lei impõe que todo trabalhador
                tenha garantido no mínimo <strong>dois dias de descanso semanal</strong> sem que seu salário seja reduzido.
                Empresas que insistirem na escala 6x1 devem arcar com pagamento extraordinário ou compensação obrigatória.
							</p>
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
										<strong>Almoço violado:</strong> tempo suprimido deve ser indenizado com <strong>50% de adicional</strong> (Art. 71 CLT).
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
