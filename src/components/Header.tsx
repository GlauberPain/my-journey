import React from 'react';
import { Button } from '@/components/ui/button';
import {
	ChevronLeft,
	ChevronRight,
	Download,
	Settings,
	Calendar as CalendarIcon,
	Scale,
	Sun,
	Moon,
} from 'lucide-react';

interface HeaderProps {
  year: number;
  month: number; // 1-12
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onCurrentMonth: () => void;
  onExportCsv: () => void;
  onOpenSettings: () => void;
  onOpenLegalModal: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const MONTH_NAMES = [
	'Janeiro',
	'Fevereiro',
	'Março',
	'Abril',
	'Maio',
	'Junho',
	'Julho',
	'Agosto',
	'Setembro',
	'Outubro',
	'Novembro',
	'Dezembro',
];

export function Header({
	year,
	month,
	onPrevMonth,
	onNextMonth,
	onCurrentMonth,
	onExportCsv,
	onOpenSettings,
	onOpenLegalModal,
	theme,
	onToggleTheme,
}: HeaderProps) {
	return (
		<header className="border-b border-border/80 bg-card/70 backdrop-blur-md sticky top-0 z-30 shadow-xs">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4">
				{/* Lado Esquerdo: Logo & Título */}
				<div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
					<div className="flex items-center gap-3">
						<div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-sm shadow-primary/30 shrink-0">
							<CalendarIcon className="h-5 w-5" />
						</div>
						<div>
							<div className="flex items-center gap-2">
								<h1 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                  Calculadora de Jornada
								</h1>
								<span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 hidden sm:inline-block">
                  IA
								</span>
							</div>
							<p className="text-[11px] text-muted-foreground hidden sm:block">
                Planejamento de escalas, apuração e direitos da jornada
							</p>
						</div>
					</div>

					{/* Botão de Tema visível no mobile no canto */}
					<div className="md:hidden flex items-center gap-1">
						<Button
							variant="ghost"
							size="icon"
							onClick={onToggleTheme}
							className="h-8 w-8 text-foreground"
							title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
						>
							{theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
						</Button>
						<Button
							variant="ghost"
							size="icon"
							onClick={onOpenSettings}
							className="h-8 w-8 text-foreground"
							title="Configurações"
						>
							<Settings className="h-4 w-4" />
						</Button>
					</div>
				</div>

				{/* Centro: Navegador de Mês & Ano */}
				<div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border shadow-xs">
					<Button
						variant="ghost"
						size="icon"
						onClick={onPrevMonth}
						className="h-8 w-8 hover:bg-background"
						title="Mês Anterior"
					>
						<ChevronLeft className="h-4 w-4" />
					</Button>

					<div className="px-3 py-0.5 text-center min-w-[130px]">
						<span className="text-sm font-bold text-foreground">
							{MONTH_NAMES[month - 1]}
						</span>
						<span className="text-xs text-muted-foreground ml-1.5 font-medium">
							{year}
						</span>
					</div>

					<Button
						variant="ghost"
						size="icon"
						onClick={onNextMonth}
						className="h-8 w-8 hover:bg-background"
						title="Próximo Mês"
					>
						<ChevronRight className="h-4 w-4" />
					</Button>

					<Button
						variant="ghost"
						size="sm"
						onClick={onCurrentMonth}
						className="text-xs h-8 px-2.5 text-muted-foreground hover:text-foreground font-medium"
					>
            Hoje
					</Button>
				</div>

				{/* Lado Direito: Ações Principais (Limpo e Organizado) */}
				<div className="hidden md:flex items-center gap-2">
					{/* Botão de Diagnóstico Trabalhista 6x1 */}
					<Button
						variant="outline"
						size="sm"
						onClick={onOpenLegalModal}
						className="gap-1.5 text-xs h-9 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30 transition-colors"
						title="Diagnóstico legal sobre jornada e escala 6x1"
					>
						<Scale className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
						<span className="font-semibold">Diagnóstico 6x1</span>
					</Button>

					{/* Botão de Exportar Planilha */}
					<Button
						variant="outline"
						size="sm"
						onClick={onExportCsv}
						className="gap-1.5 text-xs h-9"
						title="Baixar planilha Excel (.csv)"
					>
						<Download className="h-3.5 w-3.5 text-muted-foreground" />
						<span>Exportar CSV</span>
					</Button>

					{/* Alternar Tema (Ícone limpo) */}
					<Button
						variant="ghost"
						size="icon"
						onClick={onToggleTheme}
						className="h-9 w-9 rounded-lg border border-border/80 hover:bg-accent"
						title={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
						aria-label="Alternar tema"
					>
						{theme === 'dark' ? (
							<Sun className="h-4 w-4 text-amber-400" />
						) : (
							<Moon className="h-4 w-4 text-slate-700" />
						)}
					</Button>

					{/* Configurações (Abre todas as opções, tema, chave da IA, limpeza e reset) */}
					<Button
						variant="default"
						size="sm"
						onClick={onOpenSettings}
						className="gap-1.5 text-xs h-9"
						title="Abrir configurações e preferências"
					>
						<Settings className="h-3.5 w-3.5" />
						<span>Configurações</span>
					</Button>
				</div>
			</div>
		</header>
	);
}
