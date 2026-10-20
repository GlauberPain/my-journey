'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ScheduleDay, MonthSummary, AiRuleResponse } from '@/lib/types';
import {
  generateMonthDays,
  calculateMonthSummary,
  applyAiRulesToMonth,
  exportToCsv,
} from '@/lib/calculator';
import { getHolidayName } from '@/lib/holidays';
import { analyzeWorkScheduleLegislation, LegalAnalysisResult } from '@/lib/legalAnalysis';
import { Header } from '@/components/Header';
import { SummaryCards } from '@/components/SummaryCards';
import { AiPromptCard } from '@/components/AiPromptCard';
import { CalendarView } from '@/components/CalendarView';
import { ScheduleTable } from '@/components/ScheduleTable';
import { SettingsModal } from '@/components/SettingsModal';
import { DayEditModal } from '@/components/DayEditModal';
import { LegalRightsModal } from '@/components/LegalRightsModal';
import { SplashScreen } from '@/components/SplashScreen';
import { PrintReport } from '@/components/PrintReport';
import { Calendar as CalendarIcon, Table as TableIcon, LayoutGrid, Scale, Inbox } from 'lucide-react';

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
  const [legalAnalysis, setLegalAnalysis] = useState<LegalAnalysisResult | null>(null);
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
        setLegalAnalysis(analyzeWorkScheduleLegislation(enriched));
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
        setDays(configured);
        setLegalAnalysis(analyzeWorkScheduleLegislation(configured, parsedRule));
        const timer = setTimeout(() => setIsLoading(false), 500);
        return () => clearTimeout(timer);
      } catch (e) {
        console.error('Erro ao aplicar regras gerais:', e);
      }
    }

    // Se NÃO tiver nada salvo no localStorage: mostra 100% LIMPO e VAZIO (sem horários mocados)
    const emptyDays = generateMonthDays(year, month);
    setDays(emptyDays);
    setLegalAnalysis(null);
    const timer = setTimeout(() => setIsLoading(false), 400);
    return () => clearTimeout(timer);
  }, [year, month]);

  // Salva no localStorage sempre que houver alteração nos dias
  const persistDays = (newDays: ScheduleDay[]) => {
    setDays(newDays);
    if (typeof window !== 'undefined') {
      const storageKey = `journey_schedule_${year}_${month}`;
      localStorage.setItem(storageKey, JSON.stringify(newDays));
      setLegalAnalysis(analyzeWorkScheduleLegislation(newDays));
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
    if (aiResponse.dailyTargetHours) {
      const targetMins = Math.round(aiResponse.dailyTargetHours * 60);
      setDailyExpectedMinutes(targetMins);
      localStorage.setItem('daily_target_minutes', String(targetMins));
    }

    const updated = applyAiRulesToMonth(aiResponse.rules, days);
    persistDays(updated);

    // Salva o perfil geral da jornada no localStorage para persistir nas próximas visitas
    if (typeof window !== 'undefined') {
      localStorage.setItem('journey_profile_rules', JSON.stringify(aiResponse));
    }

    // Calcula a análise legal trabalhista (fim do 6x1, horas extras e redução) e abre o modal
    const analysis = analyzeWorkScheduleLegislation(updated, aiResponse);
    setLegalAnalysis(analysis);
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
      setLegalAnalysis(null);
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
      setLegalAnalysis(null);
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

  // Sumário consolidado do mês
  const summary: MonthSummary = useMemo(() => {
    return calculateMonthSummary(days, dailyExpectedMinutes);
  }, [days, dailyExpectedMinutes]);

  // Verifica se há pelo menos um dia preenchido
  const hasConfiguredDays = useMemo(() => {
    return days.some((d) => d.startTime || d.endTime);
  }, [days]);

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
          onOpenLegalModal={() => {
            if (!legalAnalysis && days.length > 0) {
              setLegalAnalysis(analyzeWorkScheduleLegislation(days));
            }
            setIsLegalModalOpen(true);
          }}
          theme={theme}
          onToggleTheme={handleToggleTheme}
        />

        {/* Conteúdo Principal */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
          {/* Cards de Métricas e Banco de Horas */}
          <SummaryCards summary={summary} />

          {/* Card do Assistente de IA Gemini */}
          <AiPromptCard
            onApplyRules={handleApplyAiRules}
            customApiKey={customApiKey}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenLegalModal={() => setIsLegalModalOpen(true)}
          />

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
                  className="hidden sm:inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-colors font-medium"
                >
                  <Scale className="h-3 w-3" />
                  <span>
                    {legalAnalysis.isScale6x1
                      ? '⚠️ Escala 6x1 (Clique para diagnóstico)'
                      : `Escala ${legalAnalysis.scaleType.toUpperCase()}`}
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
          <p>
            Calculadora de Jornada de Trabalho & Escalas • Construída com Next.js, Shadcn UI e Google
            Gemini 3.5 Flash-Lite
          </p>
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
