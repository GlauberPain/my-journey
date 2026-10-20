'use client';

import React, { useState } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Key,
  ShieldCheck,
  Info,
  Clock,
  RotateCcw,
  Trash2,
  Download,
  Printer,
  Sun,
  Moon,
  Laptop,
  Database,
  Sliders,
} from 'lucide-react';

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customApiKey: string;
  onSaveCustomApiKey: (key: string) => void;
  dailyExpectedMinutes: number;
  onSaveDailyExpectedMinutes: (minutes: number) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onResetMonth: () => void;
  onResetAllData: () => void;
  onExportCsv: () => void;
  onPrint: () => void;
  month: number;
  year: number;
}

export function SettingsModal({
  open,
  onOpenChange,
  customApiKey,
  onSaveCustomApiKey,
  dailyExpectedMinutes,
  onSaveDailyExpectedMinutes,
  theme,
  onToggleTheme,
  onResetMonth,
  onResetAllData,
  onExportCsv,
  onPrint,
  month,
  year,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'ai' | 'data'>('general');
  const [apiKeyInput, setApiKeyInput] = useState(customApiKey);
  const [hoursInput, setHoursInput] = useState(
    `${String(Math.floor(dailyExpectedMinutes / 60)).padStart(2, '0')}:${String(
      dailyExpectedMinutes % 60
    ).padStart(2, '0')}`
  );

  const handleSave = () => {
    onSaveCustomApiKey(apiKeyInput.trim());

    const [h, m] = hoursInput.split(':').map(Number);
    if (!isNaN(h) && !isNaN(m)) {
      onSaveDailyExpectedMinutes(h * 60 + m);
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <div className="max-h-[85vh] overflow-y-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pr-1">
        <DialogHeader className="text-left pb-2 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Configurações & Preferências
              </DialogTitle>
              <DialogDescription className="text-xs">
                Ajuste a carga horária, tema, chave da IA e gerencie seus dados salvos.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Abas de navegação dentro do modal */}
        <div className="flex items-center gap-1 border-b border-border pt-3 pb-2 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeTab === 'general'
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Geral & Jornada
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ai')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeTab === 'ai'
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            IA & Gemini API
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('data')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              activeTab === 'data'
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Dados & Backup
          </button>
        </div>

        <div className="space-y-4 py-4 text-xs">
          {/* ABA 1: GERAL & JORNADA */}
          {activeTab === 'general' && (
            <div className="space-y-4">
              {/* Tema da Interface */}
              <div className="space-y-2">
                <label className="font-semibold text-foreground flex items-center justify-between">
                  <span>Aparência da Aplicação</span>
                  <span className="text-[11px] text-muted-foreground font-normal">
                    {theme === 'dark' ? 'Modo Escuro Ativo' : 'Modo Claro Ativo'}
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (theme !== 'light') onToggleTheme();
                    }}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border transition-all ${
                      theme === 'light'
                        ? 'border-primary bg-primary/5 text-primary font-semibold shadow-sm'
                        : 'border-border bg-card text-muted-foreground hover:border-border/80'
                    }`}
                  >
                    <Sun className="h-4 w-4 text-amber-500" />
                    <span>Tema Claro</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (theme !== 'dark') onToggleTheme();
                    }}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border transition-all ${
                      theme === 'dark'
                        ? 'border-primary bg-primary/5 text-primary font-semibold shadow-sm'
                        : 'border-border bg-card text-muted-foreground hover:border-border/80'
                    }`}
                  >
                    <Moon className="h-4 w-4 text-slate-700 dark:text-slate-300" />
                    <span>Tema Escuro</span>
                  </button>
                </div>
              </div>

              {/* Meta Diária */}
              <div className="space-y-2 pt-3 border-t border-border">
                <label className="font-semibold text-foreground flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-primary" />
                  <span>Carga Horária Contratual Diária (HH:mm)</span>
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={hoursInput}
                    onChange={(e) => setHoursInput(e.target.value)}
                    className="w-32 font-mono text-sm"
                  />
                  <div className="flex gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setHoursInput('08:00')}
                      className="px-2.5 py-1.5 rounded-md border border-border hover:bg-muted text-muted-foreground"
                    >
                      08:00 (40h/sem)
                    </button>
                    <button
                      type="button"
                      onClick={() => setHoursInput('08:48')}
                      className="px-2.5 py-1.5 rounded-md border border-border hover:bg-muted text-muted-foreground"
                    >
                      08:48 (44h/sem)
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Base usada para calcular horas extras ou horas a compensar em cada dia de trabalho.
                </p>
              </div>
            </div>
          )}

          {/* ABA 2: IA & GEMINI API */}
          {activeTab === 'ai' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-foreground flex items-center gap-1.5">
                  <Key className="h-4 w-4 text-primary" />
                  <span>Chave da Google Gemini API</span>
                </label>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" /> Protegido
                </span>
              </div>

              <Input
                type="password"
                placeholder="AIzaSy... (ou deixe vazio se configurou no .env.local)"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                className="text-sm font-mono"
              />

              <div className="p-3 rounded-xl bg-muted/40 border border-border text-[11px] text-muted-foreground space-y-1.5 leading-relaxed">
                <p className="flex items-start gap-1.5">
                  <Info className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                  <span>
                    <strong>Segurança de Servidor:</strong> A sua chave nunca é exposta no navegador (F12). O backend do Next.js faz a chamada protegida diretamente para o Google Gemini.
                  </span>
                </p>
                <p>
                  O modelo ativo é o <strong>Gemini 3.5 Flash-Lite</strong>, a versão mais rápida e econômica disponível.
                </p>
              </div>
            </div>
          )}

          {/* ABA 3: DADOS & BACKUP */}
          {activeTab === 'data' && (
            <div className="space-y-4">
              {/* Exportações */}
              <div className="space-y-2">
                <label className="font-semibold text-foreground flex items-center gap-1.5">
                  <Download className="h-4 w-4 text-primary" />
                  <span>Exportar Relatório do Mês Atual ({month}/{year})</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onExportCsv();
                      onOpenChange(false);
                    }}
                    className="gap-1.5 text-xs h-9 justify-center"
                  >
                    <Download className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Planilha CSV (Excel)</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onPrint();
                      onOpenChange(false);
                    }}
                    className="gap-1.5 text-xs h-9 justify-center"
                  >
                    <Printer className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Imprimir / PDF</span>
                  </Button>
                </div>
              </div>

              {/* Gerenciamento de Memória */}
              <div className="space-y-2 pt-3 border-t border-border">
                <label className="font-semibold text-foreground flex items-center gap-1.5">
                  <Database className="h-4 w-4 text-rose-500" />
                  <span>Gerenciar Dados & Memória Local</span>
                </label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card">
                    <div>
                      <p className="font-medium text-foreground">Limpar mês atual ({month}/{year})</p>
                      <p className="text-[11px] text-muted-foreground">Remove todos os horários deste mês selecionado.</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onResetMonth();
                        onOpenChange(false);
                      }}
                      className="text-xs h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      Limpar
                    </Button>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg border border-destructive/20 bg-destructive/5">
                    <div>
                      <p className="font-medium text-destructive">Redefinir tudo do zero</p>
                      <p className="text-[11px] text-muted-foreground">Apaga todas as jornadas salvas no navegador.</p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        onResetAllData();
                        onOpenChange(false);
                      }}
                      className="text-xs h-8"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Apagar Tudo
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>Salvar Alterações</Button>
        </DialogFooter>
      </div>
    </Dialog>
  );
}
