import React, { useState } from 'react';
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
	Button,
	Input,
} from '@/components/ui';
import { Sparkles, Loader2, AlertCircle, CheckCircle2, Scale } from 'lucide-react';
import { AiRuleResponse } from '@/lib/types';

interface AiPromptCardProps {
  onApplyRules: (response: AiRuleResponse) => void;
  customApiKey?: string;
  onOpenSettings: () => void;
  onOpenLegalModal?: () => void;
}

interface PresetItem {
	label: string;
	prompt: string;
	schedule: AiRuleResponse;
}

const PRESETS: PresetItem[] = [
	{
		label: '6x1 Comercial (Seg-Sex 8h + Sáb 4h)',
		prompt: 'Escala 6x1 de segunda a sexta das 08:00 às 17:00 com 1 hora de intervalo, e no sábado das 08:00 às 12:00.',
		schedule: {
			formula: '44h semanais (Seg-Sex 8h, Sáb 4h)',
			explanation: 'Escala 6x1: 8h diárias de segunda a sexta e 4h no sábado, totalizando 44h semanais.',
			weeklyTargetHours: 44,
			dailyTargetHours: 8,
			rules: [
				{ dayOfWeek: 1, dayType: 'work', startTime: '08:00', breakStartTime: '12:00', breakEndTime: '13:00', endTime: '17:00' },
				{ dayOfWeek: 2, dayType: 'work', startTime: '08:00', breakStartTime: '12:00', breakEndTime: '13:00', endTime: '17:00' },
				{ dayOfWeek: 3, dayType: 'work', startTime: '08:00', breakStartTime: '12:00', breakEndTime: '13:00', endTime: '17:00' },
				{ dayOfWeek: 4, dayType: 'work', startTime: '08:00', breakStartTime: '12:00', breakEndTime: '13:00', endTime: '17:00' },
				{ dayOfWeek: 5, dayType: 'work', startTime: '08:00', breakStartTime: '12:00', breakEndTime: '13:00', endTime: '17:00' },
				{ dayOfWeek: 6, dayType: 'work', startTime: '08:00', breakStartTime: '', breakEndTime: '', endTime: '12:00' },
				{ dayOfWeek: 0, dayType: 'off', startTime: '', breakStartTime: '', breakEndTime: '', endTime: '' },
			],
		},
	},
	{
		label: '6x1 Integral (Seg-Sex 8h-18h + Sáb 8h-12h)',
		prompt: 'Escala 6x1 de segunda a sexta das 08:00 às 18:00 com 1 hora de intervalo, e no sábado das 08:00 às 12:00.',
		schedule: {
			formula: '49h semanais (Seg-Sex 9h, Sáb 4h)',
			explanation: 'Escala 6x1: 9h diárias de segunda a sexta e 4h no sábado, totalizando 49h semanais.',
			weeklyTargetHours: 49,
			dailyTargetHours: 9,
			rules: [
				{ dayOfWeek: 1, dayType: 'work', startTime: '08:00', breakStartTime: '12:00', breakEndTime: '13:00', endTime: '18:00' },
				{ dayOfWeek: 2, dayType: 'work', startTime: '08:00', breakStartTime: '12:00', breakEndTime: '13:00', endTime: '18:00' },
				{ dayOfWeek: 3, dayType: 'work', startTime: '08:00', breakStartTime: '12:00', breakEndTime: '13:00', endTime: '18:00' },
				{ dayOfWeek: 4, dayType: 'work', startTime: '08:00', breakStartTime: '12:00', breakEndTime: '13:00', endTime: '18:00' },
				{ dayOfWeek: 5, dayType: 'work', startTime: '08:00', breakStartTime: '12:00', breakEndTime: '13:00', endTime: '18:00' },
				{ dayOfWeek: 6, dayType: 'work', startTime: '08:00', breakStartTime: '', breakEndTime: '', endTime: '12:00' },
				{ dayOfWeek: 0, dayType: 'off', startTime: '', breakStartTime: '', breakEndTime: '', endTime: '' },
			],
		},
	},
	{
		label: '5x2 Escritório (8h48/dia - 44h)',
		prompt: 'Jornada 5x2 de segunda a sexta das 08:00 às 17:48 com 1 hora de intervalo.',
		schedule: {
			formula: '44h semanais (8h48/dia)',
			explanation: 'Jornada 5x2: 8h48 diárias de segunda a sexta-feira, totalizando 44h semanais.',
			weeklyTargetHours: 44,
			dailyTargetHours: 8.8,
			rules: [
				{ dayOfWeek: 1, dayType: 'work', startTime: '08:00', breakStartTime: '12:00', breakEndTime: '13:00', endTime: '17:48' },
				{ dayOfWeek: 2, dayType: 'work', startTime: '08:00', breakStartTime: '12:00', breakEndTime: '13:00', endTime: '17:48' },
				{ dayOfWeek: 3, dayType: 'work', startTime: '08:00', breakStartTime: '12:00', breakEndTime: '13:00', endTime: '17:48' },
				{ dayOfWeek: 4, dayType: 'work', startTime: '08:00', breakStartTime: '12:00', breakEndTime: '13:00', endTime: '17:48' },
				{ dayOfWeek: 5, dayType: 'work', startTime: '08:00', breakStartTime: '12:00', breakEndTime: '13:00', endTime: '17:48' },
				{ dayOfWeek: 6, dayType: 'off', startTime: '', breakStartTime: '', breakEndTime: '', endTime: '' },
				{ dayOfWeek: 0, dayType: 'off', startTime: '', breakStartTime: '', breakEndTime: '', endTime: '' },
			],
		},
	},
	{
		label: '5x2 Seg-Qui 9h + Sex 8h (44h)',
		prompt: 'Jornada 5x2 de segunda a quinta das 08:00 às 18:00 e sexta das 08:00 às 17:00, com 1 hora de intervalo.',
		schedule: {
			formula: '44h semanais (Seg-Qui 9h, Sex 8h)',
			explanation: 'Jornada 5x2: 9h de segunda a quinta e 8h na sexta-feira, totalizando 44h semanais.',
			weeklyTargetHours: 44,
			dailyTargetHours: 8.8,
			rules: [
				{ dayOfWeek: 1, dayType: 'work', startTime: '08:00', breakStartTime: '12:00', breakEndTime: '13:00', endTime: '18:00' },
				{ dayOfWeek: 2, dayType: 'work', startTime: '08:00', breakStartTime: '12:00', breakEndTime: '13:00', endTime: '18:00' },
				{ dayOfWeek: 3, dayType: 'work', startTime: '08:00', breakStartTime: '12:00', breakEndTime: '13:00', endTime: '18:00' },
				{ dayOfWeek: 4, dayType: 'work', startTime: '08:00', breakStartTime: '12:00', breakEndTime: '13:00', endTime: '18:00' },
				{ dayOfWeek: 5, dayType: 'work', startTime: '08:00', breakStartTime: '12:00', breakEndTime: '13:00', endTime: '17:00' },
				{ dayOfWeek: 6, dayType: 'off', startTime: '', breakStartTime: '', breakEndTime: '', endTime: '' },
				{ dayOfWeek: 0, dayType: 'off', startTime: '', breakStartTime: '', breakEndTime: '', endTime: '' },
			],
		},
	},
	{
		label: '5x2 Padrão 40h (8h/dia)',
		prompt: 'Jornada 5x2 de segunda a sexta das 08:00 às 17:00 com 1 hora de intervalo.',
		schedule: {
			formula: '40h semanais (8h/dia)',
			explanation: 'Jornada 5x2: 8h diárias de segunda a sexta-feira, totalizando 40h semanais.',
			weeklyTargetHours: 40,
			dailyTargetHours: 8,
			rules: [
				{ dayOfWeek: 1, dayType: 'work', startTime: '08:00', breakStartTime: '12:00', breakEndTime: '13:00', endTime: '17:00' },
				{ dayOfWeek: 2, dayType: 'work', startTime: '08:00', breakStartTime: '12:00', breakEndTime: '13:00', endTime: '17:00' },
				{ dayOfWeek: 3, dayType: 'work', startTime: '08:00', breakStartTime: '12:00', breakEndTime: '13:00', endTime: '17:00' },
				{ dayOfWeek: 4, dayType: 'work', startTime: '08:00', breakStartTime: '12:00', breakEndTime: '13:00', endTime: '17:00' },
				{ dayOfWeek: 5, dayType: 'work', startTime: '08:00', breakStartTime: '12:00', breakEndTime: '13:00', endTime: '17:00' },
				{ dayOfWeek: 6, dayType: 'off', startTime: '', breakStartTime: '', breakEndTime: '', endTime: '' },
				{ dayOfWeek: 0, dayType: 'off', startTime: '', breakStartTime: '', breakEndTime: '', endTime: '' },
			],
		},
	},
	{
		label: '12x36 Plantonista (Hospital/Segurança)',
		prompt: 'Escala 12x36 das 07:00 às 19:00 com intervalo de 15 minutos.',
		schedule: {
			formula: 'Escala 12x36 (07:00 às 19:00)',
			explanation: 'Escala 12x36: turno de 12 horas das 07:00 às 19:00 com 15 minutos de intervalo e 36 horas de descanso.',
			weeklyTargetHours: 42,
			dailyTargetHours: 11.75,
			rules: [
				{ dayOfWeek: 1, dayType: 'work', startTime: '07:00', breakStartTime: '12:00', breakEndTime: '12:15', endTime: '19:00' },
				{ dayOfWeek: 2, dayType: 'off', startTime: '', breakStartTime: '', breakEndTime: '', endTime: '' },
				{ dayOfWeek: 3, dayType: 'work', startTime: '07:00', breakStartTime: '12:00', breakEndTime: '12:15', endTime: '19:00' },
				{ dayOfWeek: 4, dayType: 'off', startTime: '', breakStartTime: '', breakEndTime: '', endTime: '' },
				{ dayOfWeek: 5, dayType: 'work', startTime: '07:00', breakStartTime: '12:00', breakEndTime: '12:15', endTime: '19:00' },
				{ dayOfWeek: 6, dayType: 'off', startTime: '', breakStartTime: '', breakEndTime: '', endTime: '' },
				{ dayOfWeek: 0, dayType: 'off', startTime: '', breakStartTime: '', breakEndTime: '', endTime: '' },
			],
		},
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
				throw new Error(data.error || 'Erro ao analisar jornada com IA.');
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
							<CardTitle className="text-base font-semibold">Assistente IA de Análise de Jornada & Escala</CardTitle>
							<CardDescription className="text-xs">
                Descreva sua rotina em texto simples. A IA analisa sua escala de trabalho e diagnostica seus direitos trabalhistas.
							</CardDescription>
						</div>
					</div>
				</div>
			</CardHeader>

			<CardContent className="space-y-3">
				<div className="flex flex-col sm:flex-row gap-2">
					<Input
						value={prompt}
						onChange={(e) => setPrompt(e.target.value)}
						placeholder="Ex: Trabalho de seg a sex das 08:00 às 17:00 e sáb das 08:00 às 12:00..."
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
								<span>Analisando Escala...</span>
							</>
						) : (
							<>
								<Sparkles className="h-4 w-4" />
								<span>Analisar Jornada & Direitos</span>
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
								setError(null);
								setLastResult(null);
								onApplyRules(p.schedule);
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
                    Escala Identificada: {lastResult.formula}
									</span>
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
