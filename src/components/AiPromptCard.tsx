import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, AlertCircle, CheckCircle2, Scale } from 'lucide-react';
import { AiRuleResponse } from '@/lib/types';

interface AiPromptCardProps {
  onApplyRules: (response: AiRuleResponse) => void;
  customApiKey?: string;
  onOpenSettings: () => void;
  onOpenLegalModal?: () => void;
}

const PRESETS = [
	{
		label: 'Escala 6x1 (44h)',
		prompt: 'Trabalho na escala 6x1 de segunda a sábado das 08:00 às 16:20 com 1 hora de almoço das 12:00 às 13:00, e folgo aos domingos.',
	},
	{
		label: '5x2 Padrão (8h48/dia)',
		prompt: 'Trabalho de segunda a sexta das 08:00 às 17:48 com 1 hora de almoço das 12:00 às 13:00, folgando sábado e domingo.',
	},
	{
		label: '40h Semanais (8h/dia)',
		prompt: 'Trabalho de segunda a sexta das 08:00 às 17:00 com 1 hora de almoço, finais de semana folga.',
	},
	{
		label: '12x36 Diurno',
		prompt: 'Escala 12x36 das 07:00 às 19:00 com 1 hora de almoço das 12:00 às 13:00.',
	},
];

export function AiPromptCard({
	onApplyRules,
	customApiKey,
	onOpenSettings,
	onOpenLegalModal,
}: AiPromptCardProps) {
	const [prompt, setPrompt] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [lastResult, setLastResult] = useState<AiRuleResponse | null>(null);

	const handleGenerate = async (textToUse?: string) => {
		const text = textToUse || prompt;
		if (!text.trim()) return;

		setLoading(true);
		setError(null);

		try {
			const res = await fetch('/api/generate-schedule', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					prompt: text,
					customApiKey: customApiKey || undefined,
				}),
			});

			const data = await res.json();

			if (!res.ok) {
				throw new Error(data.error || 'Erro ao processar jornada com IA.');
			}

			if (data.schedule) {
				setLastResult(data.schedule);
				onApplyRules(data.schedule);
			}
		} catch (err: unknown) {
			const errMsg = err instanceof Error ? err.message : 'Falha na comunicação com o assistente IA.';
			setError(errMsg);
		} finally {
			setLoading(false);
		}
	};

	return (
		<Card className="border-primary/20 shadow-sm bg-gradient-to-r from-card via-card to-primary/[0.03]">
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
							<Sparkles className="h-4 w-4" />
						</div>
						<div>
							<CardTitle className="text-base font-semibold">Assistente IA de Jornada & Escala 6x1</CardTitle>
							<CardDescription className="text-xs">
                Descreva sua rotina em texto simples. A IA preenche sua tabela e analisa seu enquadramento legal na lei.
							</CardDescription>
						</div>
					</div>
					<Badge variant="secondary" className="text-[11px] font-mono tracking-tight hidden sm:inline-flex bg-primary/10 text-primary border border-primary/20">
            Gemini 3.5 Flash-Lite (Mais Barato)
					</Badge>
				</div>
			</CardHeader>

			<CardContent className="space-y-3">
				<div className="flex flex-col sm:flex-row gap-2">
					<Input
						value={prompt}
						onChange={(e) => setPrompt(e.target.value)}
						placeholder="Ex: Trabalho na escala 6x1 das 08:00 às 16:20 de seg a sáb com 1h de almoço..."
						className="flex-1 text-sm bg-background/80"
						onKeyDown={(e) => {
							if (e.key === 'Enter') handleGenerate();
						}}
					/>
					<Button
						onClick={() => handleGenerate()}
						disabled={loading || !prompt.trim()}
						className="gap-2 sm:w-auto w-full"
					>
						{loading ? (
							<>
								<Loader2 className="h-4 w-4 animate-spin" />
								<span>Calculando...</span>
							</>
						) : (
							<>
								<Sparkles className="h-4 w-4" />
								<span>Criar Jornada & Analisar Lei</span>
							</>
						)}
					</Button>
				</div>

				{/* Exemplos Rápidos */}
				<div className="flex flex-wrap items-center gap-1.5 text-xs">
					<span className="text-muted-foreground font-medium">Exemplos rápidos:</span>
					{PRESETS.map((p, idx) => (
						<button
							key={idx}
							type="button"
							onClick={() => {
								setPrompt(p.prompt);
								handleGenerate(p.prompt);
							}}
							className="text-xs px-2.5 py-1 rounded-full border border-border bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
						>
							{p.label}
						</button>
					))}
				</div>

				{/* Erro */}
				{error && (
					<div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2">
						<AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
						<div className="flex-1">
							<p className="font-medium">{error}</p>
							{error.includes('GEMINI_API_KEY') && (
								<button
									type="button"
									onClick={onOpenSettings}
									className="mt-1 text-xs underline font-semibold hover:opacity-80"
								>
                  Clique aqui para configurar sua chave agora
								</button>
							)}
						</div>
					</div>
				)}

				{/* Sucesso / Último Resultado */}
				{lastResult && !error && (
					<div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
						<div className="flex items-start gap-2.5">
							<CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
							<div className="space-y-1">
								<div className="flex items-center gap-2">
									<span className="font-semibold text-emerald-800 dark:text-emerald-300">
                    Fórmula Gerada: {lastResult.formula}
									</span>
									<Badge variant="outline" className="text-[10px] py-0 border-emerald-500/40 text-emerald-700 dark:text-emerald-300">
										{lastResult.weeklyTargetHours}h semanais
									</Badge>
								</div>
								<p className="text-muted-foreground">{lastResult.explanation}</p>
							</div>
						</div>

						{onOpenLegalModal && (
							<Button
								variant="outline"
								size="sm"
								onClick={onOpenLegalModal}
								className="gap-1.5 text-xs h-8 shrink-0 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
							>
								<Scale className="h-3.5 w-3.5" />
								<span>Ver Diagnóstico Legal</span>
							</Button>
						)}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
