'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ScheduleDay, MonthSummary, AiRuleResponse } from '@/lib/types';
import {
	generateMonthDays,
	calculateMonthSummary,
	applyAiRulesToMonth,
	exportToCsv,
	calculateShiftWorkedMinutes,
} from '@/lib/calculator';
import { getHolidayName } from '@/lib/holidays';
import { analyzeWorkScheduleLegislation, LegalAnalysisResult } from '@/lib/legalAnalysis';
import {
	Header,
	MONTH_NAMES,
	SummaryCards,
	AiPromptCard,
	CalendarView,
	ScheduleTable,
	SettingsModal,
	DayEditModal,
	LegalRightsModal,
	SplashScreen,
	PrintReport,
} from '@/components';
import { Button } from '@/components/ui';
import { Calendar as CalendarIcon, Table as TableIcon, LayoutGrid, Scale, Inbox, AlertOctagon } from 'lucide-react';

export default function Home() {
	const currentDate = new Date();
	const [year, setYear] = useState<number>(currentDate.getFullYear());
	const [month, setMonth] = useState<number>(currentDate.getMonth() + 1); // 1-12

	const [days, setDays] = useState<ScheduleDay[]>([]);
	const [dailyExpectedMinutes, setDailyExpectedMinutes] = useState<number>(8 * 60); // 8h
	const [customApiKey, setCustomApiKey] = useState<string>('');

	const [selectedDayForEdit, setSelectedDayForEdit] = useState<ScheduleDay | null>(null);
	const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
	const [isLegalModalOpen, setIsLegalModalOpen] = useState<boolean>(false);
	const [activeAiRule, setActiveAiRule] = useState<AiRuleResponse | null>(null);
	const [viewMode, setViewMode] = useState<'both' | 'calendar' | 'table'>('both');

	// Estados de Tema e Splash Screen
	const [theme, setTheme] = useState<'light' | 'dark'>('light');
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [splashStatus, setSplashStatus] = useState<string>('Carregando suas jornadas e preferências...');

	// Inicialização única: Tema, Favicon e Configurações
	useEffect(() => {
		if (typeof window === 'undefined') return;

		// 1. Resolução do tema (localStorage ou preferência do sistema)
		const storedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
		const isDark =
      storedTheme === 'dark' || (!storedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
		const activeTheme = isDark ? 'dark' : 'light';
		setTheme(activeTheme);

		if (isDark) {
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
		}

		const favicon = document.getElementById('dynamic-favicon') as HTMLLinkElement | null;
		if (favicon) {
			favicon.href = isDark ? '/calendar%20dark.svg' : '/calendar%20light.svg';
		}

		// 2. Chave de API personalizada & meta diária
		const savedKey = localStorage.getItem('gemini_custom_key');
		if (savedKey) setCustomApiKey(savedKey);

		const savedTarget = localStorage.getItem('daily_target_minutes');
		if (savedTarget) {
			const parsed = parseInt(savedTarget, 10);
			if (!isNaN(parsed) && parsed > 0) setDailyExpectedMinutes(parsed);
		}
	}, []);

	// Alternar Tema e atualizar Favicon
	const handleToggleTheme = () => {
		const nextTheme = theme === 'dark' ? 'light' : 'dark';
		setTheme(nextTheme);

		if (typeof window !== 'undefined') {
			localStorage.setItem('theme', nextTheme);
			const isDark = nextTheme === 'dark';

			if (isDark) {
				document.documentElement.classList.add('dark');
			} else {
				document.documentElement.classList.remove('dark');
			}

			const favicon = document.getElementById('dynamic-favicon') as HTMLLinkElement | null;
			if (favicon) {
				favicon.href = isDark ? '/calendar%20dark.svg' : '/calendar%20light.svg';
			}
		}
	};

	// Carrega ou recupera os dias do mês do localStorage e libera a splash screen
	useEffect(() => {
		if (typeof window === 'undefined') return;

		const storageKey = `journey_schedule_${year}_${month}`;
		const saved = localStorage.getItem(storageKey);

		if (saved) {
			try {
				setSplashStatus('Recuperando jornadas salvas no seu dispositivo...');
				const parsedDays: ScheduleDay[] = JSON.parse(saved);
				const enriched = parsedDays.map((d) => {
					const holidayName = getHolidayName(d.date);
					return {
						...d,
						isHoliday: !!holidayName,
						holidayName: holidayName || d.holidayName,
						dayType: d.isHoliday && !d.workedOnHoliday && d.dayType === 'work' ? 'holiday' : d.dayType,
					};
				});
				setDays(enriched);
				// Libera após carregar tudo com pequena transição suave
				const timer = setTimeout(() => setIsLoading(false), 500);
				return () => clearTimeout(timer);
			} catch (e) {
				console.error('Erro ao ler dados salvos do mês:', e);
			}
		}

		// Se não tiver para esse mês específico, verifica se o usuário já tem uma regra geral salva
		const savedRules = localStorage.getItem('journey_profile_rules');
		if (savedRules) {
			try {
				setSplashStatus('Aplicando escala de jornada ativa...');
				const parsedRule: AiRuleResponse = JSON.parse(savedRules);
				const blankDays = generateMonthDays(year, month);
				const configured = applyAiRulesToMonth(parsedRule.rules, blankDays);
				setActiveAiRule(parsedRule);
				setDays(configured);
				const timer = setTimeout(() => setIsLoading(false), 500);
				return () => clearTimeout(timer);
			} catch (e) {
				console.error('Erro ao aplicar regras gerais:', e);
			}
		}

		// Se NÃO tiver nada salvo no localStorage: mostra 100% LIMPO e VAZIO (sem horários mocados)
		const emptyDays = generateMonthDays(year, month);
		setDays(emptyDays);
		setActiveAiRule(null);
		const timer = setTimeout(() => setIsLoading(false), 400);
		return () => clearTimeout(timer);
	}, [year, month]);

	// Salva no localStorage sempre que houver alteração nos dias
	const persistDays = (newDays: ScheduleDay[]) => {
		setDays(newDays);
		if (typeof window !== 'undefined') {
			const storageKey = `journey_schedule_${year}_${month}`;
			localStorage.setItem(storageKey, JSON.stringify(newDays));

			// Persiste como regra geral para propagação entre meses caso haja turnos configurados
			const workDays = newDays.filter((d) => d.dayType === 'work' && d.startTime && d.endTime);
			if (workDays.length > 0) {
				const rulesByWeekday: Record<number, ScheduleDay> = {};
				newDays.forEach((d) => {
					if (!rulesByWeekday[d.dayOfWeek] && !d.isHoliday) {
						rulesByWeekday[d.dayOfWeek] = d;
					}
				});
				const rules: AiRuleResponse['rules'] = [];
				for (let w = 0; w <= 6; w++) {
					const sample = rulesByWeekday[w];
					if (sample && sample.dayType === 'work') {
						rules.push({
							dayOfWeek: w,
							dayType: 'work',
							startTime: sample.startTime || '',
							breakStartTime: sample.breakStartTime || '',
							breakEndTime: sample.breakEndTime || '',
							endTime: sample.endTime || '',
						});
					} else {
						rules.push({
							dayOfWeek: w,
							dayType: 'off',
							startTime: '',
							breakStartTime: '',
							breakEndTime: '',
							endTime: '',
						});
					}
				}
				const profileRule: AiRuleResponse = {
					formula: 'Escala Ativa',
					explanation: 'Escala ativa do trabalhador',
					weeklyTargetHours: Math.round((workDays.length * (dailyExpectedMinutes / 60)) * 10) / 10,
					dailyTargetHours: Math.round((dailyExpectedMinutes / 60) * 10) / 10,
					rules,
				};
				localStorage.setItem('journey_profile_rules', JSON.stringify(profileRule));
			}
		}
	};

	// Atualização de um único dia
	const handleUpdateDay = (date: string, updates: Partial<ScheduleDay>) => {
		const updated = days.map((day) => (day.date === date ? { ...day, ...updates } : day));
		persistDays(updated);
	};

	// Replicar horário de um dia para todos os outros dias marcados como 'work'
	const handleApplyTimeToAllWorkdays = (sourceDay: ScheduleDay) => {
		const updated = days.map((d) => {
			if (d.dayType === 'work') {
				return {
					...d,
					startTime: sourceDay.startTime,
					breakStartTime: sourceDay.breakStartTime,
					breakEndTime: sourceDay.breakEndTime,
					endTime: sourceDay.endTime,
				};
			}
			return d;
		});
		persistDays(updated);
	};

	// Aplicação de regras vindas da IA
	const handleApplyAiRules = (aiResponse: AiRuleResponse) => {
		// Calcula a meta diária a partir dos minutos exatos dos turnos gerados, evitando arredondamentos
		const workRules = aiResponse.rules?.filter((r) => r.dayType === 'work' && r.startTime && r.endTime);
		if (workRules && workRules.length > 0) {
			const { workedMinutes } = calculateShiftWorkedMinutes(workRules[0]);
			if (workedMinutes > 0) {
				setDailyExpectedMinutes(workedMinutes);
				localStorage.setItem('daily_target_minutes', String(workedMinutes));
			}
		} else if (aiResponse.dailyTargetHours) {
			const targetMins = Math.round(aiResponse.dailyTargetHours * 60);
			setDailyExpectedMinutes(targetMins);
			localStorage.setItem('daily_target_minutes', String(targetMins));
		}

		setActiveAiRule(aiResponse);
		const updated = applyAiRulesToMonth(aiResponse.rules, days);
		persistDays(updated);

		// Salva o perfil geral da jornada no localStorage para persistir nas próximas visitas
		if (typeof window !== 'undefined') {
			localStorage.setItem('journey_profile_rules', JSON.stringify(aiResponse));
		}

		setIsLegalModalOpen(true);
	};

	// Navegação de meses
	const handlePrevMonth = () => {
		if (month === 1) {
			setMonth(12);
			setYear((y) => y - 1);
		} else {
			setMonth((m) => m - 1);
		}
	};

	const handleNextMonth = () => {
		if (month === 12) {
			setMonth(1);
			setYear((y) => y + 1);
		} else {
			setMonth((m) => m + 1);
		}
	};

	const handleCurrentMonth = () => {
		const now = new Date();
		setYear(now.getFullYear());
		setMonth(now.getMonth() + 1);
	};

	const handleResetMonth = () => {
		if (confirm(`Deseja limpar todos os horários e restaurar este mês vazio (${month}/${year})?`)) {
			const initial = generateMonthDays(year, month);
			persistDays(initial);
			if (typeof window !== 'undefined') {
				localStorage.removeItem(`journey_schedule_${year}_${month}`);
				localStorage.removeItem('journey_profile_rules');
			}
			setActiveAiRule(null);
		}
	};

	const handleResetAllData = () => {
		if (confirm('Atenção: Tem certeza que deseja apagar TODAS as jornadas e configurações salvas no navegador?')) {
			if (typeof window !== 'undefined') {
				Object.keys(localStorage).forEach((key) => {
					if (key.startsWith('journey_')) {
						localStorage.removeItem(key);
					}
				});
			}
			const initial = generateMonthDays(year, month);
			persistDays(initial);
			setActiveAiRule(null);
		}
	};

	// Exportar para CSV
	const handleExportCsv = () => {
		const summary = calculateMonthSummary(days, dailyExpectedMinutes);
		const csvContent = exportToCsv(days, summary);
		const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.setAttribute('download', `jornada_trabalho_${year}_${String(month).padStart(2, '0')}.csv`);
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	};

	// Imprimir
	const handlePrint = () => {
		window.print();
	};

	// Salvar Chave do Usuário
	const handleSaveCustomApiKey = (key: string) => {
		setCustomApiKey(key);
		if (typeof window !== 'undefined') {
			localStorage.setItem('gemini_custom_key', key);
		}
	};

	// Salvar Meta Diária
	const handleSaveDailyExpectedMinutes = (mins: number) => {
		setDailyExpectedMinutes(mins);
		if (typeof window !== 'undefined') {
			localStorage.setItem('daily_target_minutes', String(mins));
		}
	};

	// Data de referência ISO do mês atual (YYYY-MM-01) para verificação temporal da legislação
	const referenceDate = useMemo(() => {
		return `${year}-${String(month).padStart(2, '0')}-01`;
	}, [year, month]);

	// Sumário consolidado do mês
	const summary: MonthSummary = useMemo(() => {
		return calculateMonthSummary(days, dailyExpectedMinutes);
	}, [days, dailyExpectedMinutes]);

	// Verifica se há pelo menos um dia preenchido
	const hasConfiguredDays = useMemo(() => {
		return days.some((d) => d.startTime || d.endTime);
	}, [days]);

	// Análise dinâmica da legislação trabalhista sempre reativa ao mês e ano selecionados
	const legalAnalysis: LegalAnalysisResult | null = useMemo(() => {
		if (!hasConfiguredDays || days.length === 0) return null;
		return analyzeWorkScheduleLegislation(days, activeAiRule, undefined, referenceDate);
	}, [days, hasConfiguredDays, activeAiRule, referenceDate]);

	return (
		<>
			{/* Tela de Splash durante o carregamento inicial */}
			<SplashScreen isLoading={isLoading} statusText={splashStatus} />

			<div className={`min-h-screen flex flex-col bg-background transition-opacity duration-300 print:hidden ${isLoading ? 'opacity-0' : 'opacity-100'}`}>
				{/* Cabeçalho */}
				<Header
					year={year}
					month={month}
					onPrevMonth={handlePrevMonth}
					onNextMonth={handleNextMonth}
					onCurrentMonth={handleCurrentMonth}
					onExportCsv={handleExportCsv}
					onOpenSettings={() => setIsSettingsOpen(true)}
					onOpenLegalModal={() => setIsLegalModalOpen(true)}
					theme={theme}
					onToggleTheme={handleToggleTheme}
				/>

				{/* Conteúdo Principal */}
				<main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
					{/* Card do Assistente de IA */}
					<AiPromptCard
						onApplyRules={handleApplyAiRules}
						customApiKey={customApiKey}
						onOpenSettings={() => setIsSettingsOpen(true)}
						onOpenLegalModal={() => setIsLegalModalOpen(true)}
					/>

					{/* Cards de Métricas da Jornada */}
					<SummaryCards summary={summary} legalAnalysis={legalAnalysis} />

					{/* Alerta de Transição / Alarme Crítico de Violação Legal */}
					{legalAnalysis && (legalAnalysis.isScale6x1 || legalAnalysis.weeklyWorkedHours >= 44 || legalAnalysis.isActiveViolation) && (
						legalAnalysis.isActiveViolation ? (
							// BLOCO VERMELHO DE ALARME (A partir de Janeiro/2027 na vigência das novas regras constitucionais)
							<div className="p-4 rounded-xl border-2 border-rose-500/50 bg-rose-500/10 dark:bg-rose-950/40 text-rose-950 dark:text-rose-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs shadow-sm transition-all duration-300">
								<div className="flex items-start gap-3">
									<div className="h-9 w-9 rounded-lg bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
										<AlertOctagon className="h-5 w-5 animate-pulse" />
									</div>
									<div className="space-y-1">
										<div className="flex items-center gap-2 flex-wrap">
											<span className="px-2 py-0.5 rounded-md bg-rose-600 text-white font-bold text-[10px] uppercase tracking-wider shadow-xs">
												ALARME LEGAL
											</span>
											<p className="font-bold text-foreground text-sm">
												Escala Incompatível com a Legislação Vigente em {MONTH_NAMES[month - 1]} de {year}!
											</p>
										</div>
										<p className="text-muted-foreground text-xs leading-relaxed max-w-4xl">
											{legalAnalysis.isScale6x1 ? (
												<>
													Neste mês selecionado, a <strong>escala 6x1 é inconstitucional e proibida por lei</strong>. A legislação em vigor exige jornada máxima de <strong>{legalAnalysis.effectiveLimitHours}h semanais</strong> e no mínimo <strong>2 dias de descanso semanal remunerado (escala 5x2)</strong>, sem redução de salário. Todo trabalho no 6º dia deve ser pago como hora extraordinária (com adicional mínimo de 50% ou 100%) e sua escala deve ser readequada imediatamente.
												</>
											) : (
												<>
													Neste mês selecionado, sua jornada semanal de <strong>{legalAnalysis.weeklyWorkedHours}h</strong> excede o teto legal de <strong>{legalAnalysis.effectiveLimitHours}h semanais</strong>. A jornada máxima de 44h não é mais permitida por lei! O excesso de <strong>{Math.max(0, Math.round((legalAnalysis.weeklyWorkedHours - legalAnalysis.effectiveLimitHours) * 10) / 10)}h semanais</strong> constitui hora extra obrigatória com adicional de no mínimo 50% ou a carga horária deve ser reduzida para {legalAnalysis.effectiveLimitHours}h com salário integral preservado.
												</>
											)}
										</p>
									</div>
								</div>
								<Button
									variant="destructive"
									size="sm"
									onClick={() => setIsLegalModalOpen(true)}
									className="shrink-0 h-9 px-4 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
								>
									🚨 Ver Alarme & Direitos
								</Button>
							</div>
						) : (
							// BLOCO AMARELO/ÂMBAR DE AVISO PREVENTIVO (Até Dezembro/2026 antes da vigência plena)
							<div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs transition-all duration-300">
								<div className="flex items-start gap-2.5">
									<Scale className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
									<div className="space-y-0.5">
										<div className="flex items-center gap-2 flex-wrap">
											<span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 font-semibold text-[10px] uppercase tracking-wider">
												Aviso Preventivo • {MONTH_NAMES[month - 1]} de {year}
											</span>
											<p className="font-bold text-foreground">
												{legalAnalysis.isScale6x1
													? 'Aviso aos trabalhadores em Escala 6x1:'
													: 'Aviso aos trabalhadores com Jornada de 44h semanais:'}
											</p>
										</div>
										<p className="text-muted-foreground text-[11px] leading-relaxed">
											{legalAnalysis.isScale6x1 ? (
												<>
													Neste mês de {MONTH_NAMES[month - 1]} de {year}, a jornada ainda segue o regime anterior. Porém, a partir de <strong>16 de dezembro de 2026</strong>, a escala 6x1 reduz obrigatoriamente para <strong>5x2</strong> (no mínimo 2 dias de folga por semana sem corte de salário) e o primeiro teto cai para <strong>42h semanais</strong>. A partir de <strong>16 de dezembro de 2027</strong>, reduz para <strong>40h</strong>.
												</>
											) : (
												<>
													Neste mês de {MONTH_NAMES[month - 1]} de {year}, a jornada de 44h ainda é permitida. Contudo, o fim da escala 6x1 não se pauta apenas em um dia a mais de folga, mas também na <strong>redução obrigatória de carga horária</strong>: a jornada máxima semanal cai de 44h para <strong>42h semanais</strong> a partir de <strong>16 de dezembro de 2026</strong> e atinge o limite definitivo de <strong>40h semanais</strong> em <strong>16 de dezembro de 2027</strong>, com garantia de salário integral. Sua carga horária semanal deverá ser reduzida.
												</>
											)}
										</p>
									</div>
								</div>
								<Button
									variant="outline"
									size="sm"
									onClick={() => setIsLegalModalOpen(true)}
									className="shrink-0 h-8 text-xs bg-amber-500/15 border-amber-500/30 text-amber-900 dark:text-amber-100 hover:bg-amber-500/25"
								>
									Ver Diagnóstico
								</Button>
							</div>
						)
					)}

					{/* Banner de Estado Limpo / Vazio (quando não há horários cadastrados) */}
					{!hasConfiguredDays && (
						<div className="p-6 rounded-xl border border-dashed border-border bg-card/40 text-center space-y-3">
							<div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mx-auto">
								<Inbox className="h-6 w-6" />
							</div>
							<div>
								<h3 className="text-base font-semibold text-foreground">Sua jornada está limpa</h3>
								<p className="text-xs text-muted-foreground max-w-md mx-auto mt-1">
                  Nenhum horário foi cadastrado ainda. Use a caixa de texto da inteligência artificial acima para gerar sua escala automaticamente (ex: escala 6x1, 5x2, etc.) ou insira os horários na tabela abaixo.
								</p>
							</div>
							<p className="text-[11px] text-muted-foreground">
                💾 Seus horários ficam salvos com segurança no seu navegador (<code className="text-foreground">localStorage</code>) e reaparecerão na sua próxima visita.
							</p>
						</div>
					)}

					{/* Seletor de Modo de Exibição */}
					<div className="flex items-center justify-between pt-2">
						<div className="flex items-center gap-2">
							<h2 className="text-lg font-bold tracking-tight text-foreground">
                Escala & Apuração de Horários
							</h2>
							{legalAnalysis && (
								<button
									type="button"
									onClick={() => setIsLegalModalOpen(true)}
									className={`hidden sm:inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full border transition-colors font-medium ${
										legalAnalysis.isActiveViolation
											? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40 hover:bg-rose-500/25 animate-pulse'
											: legalAnalysis.isScale6x1 || legalAnalysis.weeklyWorkedHours >= 44 || legalAnalysis.exceedsEffectiveLimit
												? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
												: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
									}`}
								>
									{legalAnalysis.isActiveViolation ? (
										<AlertOctagon className="h-3 w-3 text-rose-600 dark:text-rose-400 shrink-0" />
									) : (
										<Scale className="h-3 w-3 shrink-0" />
									)}
									<span>
										{legalAnalysis.isActiveViolation
											? (legalAnalysis.isScale6x1
												? '🚨 Escala 6x1 Ilegal no Mês Vigente'
												: `🚨 Jornada ${legalAnalysis.weeklyWorkedHours}h Excede Teto Legal (${legalAnalysis.effectiveLimitHours}h)`)
											: legalAnalysis.isScale6x1
												? '⚠️ Escala 6x1 (Redução p/ 5x2 em Dez/2026)'
												: legalAnalysis.weeklyWorkedHours >= 44
													? '⚠️ Jornada 44h (Redução de Carga p/ 42h em Dez/2026)'
													: `Escala ${legalAnalysis.scaleType.toUpperCase()} (Regular)`}
									</span>
								</button>
							)}
						</div>

						<div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border text-xs">
							<button
								type="button"
								onClick={() => setViewMode('both')}
								className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
									viewMode === 'both'
										? 'bg-background text-foreground shadow-sm'
										: 'text-muted-foreground hover:text-foreground'
								}`}
							>
								<LayoutGrid className="h-3.5 w-3.5" />
								<span>Ambos</span>
							</button>

							<button
								type="button"
								onClick={() => setViewMode('calendar')}
								className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
									viewMode === 'calendar'
										? 'bg-background text-foreground shadow-sm'
										: 'text-muted-foreground hover:text-foreground'
								}`}
							>
								<CalendarIcon className="h-3.5 w-3.5" />
								<span>Calendário</span>
							</button>

							<button
								type="button"
								onClick={() => setViewMode('table')}
								className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
									viewMode === 'table'
										? 'bg-background text-foreground shadow-sm'
										: 'text-muted-foreground hover:text-foreground'
								}`}
							>
								<TableIcon className="h-3.5 w-3.5" />
								<span>Tabela</span>
							</button>
						</div>
					</div>

					{/* Visualizações: Calendário e/ou Tabela */}
					<div className="space-y-6">
						{(viewMode === 'both' || viewMode === 'calendar') && (
							<CalendarView
								days={days}
								year={year}
								month={month}
								dailyExpectedMinutes={dailyExpectedMinutes}
								onUpdateDay={handleUpdateDay}
								onSelectDayForEdit={(day) => setSelectedDayForEdit(day)}
							/>
						)}

						{(viewMode === 'both' || viewMode === 'table') && (
							<ScheduleTable
								days={days}
								dailyExpectedMinutes={dailyExpectedMinutes}
								onUpdateDay={handleUpdateDay}
								onApplyTimeToAllWorkdays={handleApplyTimeToAllWorkdays}
							/>
						)}
					</div>
				</main>

				{/* Modal de Diagnóstico Trabalhista & Fim da Escala 6x1 */}
				<LegalRightsModal
					open={isLegalModalOpen}
					onOpenChange={setIsLegalModalOpen}
					analysis={legalAnalysis}
				/>

				{/* Modal de Configurações */}
				<SettingsModal
					open={isSettingsOpen}
					onOpenChange={setIsSettingsOpen}
					customApiKey={customApiKey}
					onSaveCustomApiKey={handleSaveCustomApiKey}
					dailyExpectedMinutes={dailyExpectedMinutes}
					onSaveDailyExpectedMinutes={handleSaveDailyExpectedMinutes}
					theme={theme}
					onToggleTheme={handleToggleTheme}
					onResetMonth={handleResetMonth}
					onResetAllData={handleResetAllData}
					onExportCsv={handleExportCsv}
					onPrint={handlePrint}
					month={month}
					year={year}
				/>

				{/* Modal de Edição de Dia Selecionado */}
				<DayEditModal
					day={selectedDayForEdit}
					open={!!selectedDayForEdit}
					onOpenChange={(open) => !open && setSelectedDayForEdit(null)}
					dailyExpectedMinutes={dailyExpectedMinutes}
					onSave={handleUpdateDay}
				/>

				{/* Rodapé */}
				<footer className="border-t border-border/60 py-6 mt-12 bg-card/30 text-center text-xs text-muted-foreground">
					<p>Desenvolvido por Glauber Pain</p>
				</footer>
			</div>

			{/* Relatório formatado exclusivo para impressão e exportação em PDF */}
			<PrintReport
				days={days}
				summary={summary}
				analysis={legalAnalysis}
				year={year}
				month={month}
				dailyExpectedMinutes={dailyExpectedMinutes}
			/>
		</>
	);
}
