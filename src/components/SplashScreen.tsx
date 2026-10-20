'use client';

import React from 'react';
import { Calendar, Sparkles } from 'lucide-react';

interface SplashScreenProps {
  isLoading: boolean;
  statusText?: string;
}

export function SplashScreen({ isLoading, statusText = 'Carregando suas jornadas e preferências...' }: SplashScreenProps) {
	if (!isLoading) return null;

	return (
		<div
			className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-md transition-all duration-500 animate-in fade-in"
			aria-label="Carregando aplicativo"
		>
			<div className="relative flex flex-col items-center text-center px-4 max-w-sm">
				{/* Ícone com pulso e brilho */}
				<div className="relative mb-6">
					<div className="absolute -inset-2 rounded-2xl bg-primary/20 blur-xl animate-pulse" />
					<div className="relative h-16 w-16 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/30">
						<Calendar className="h-8 w-8 animate-bounce" />
					</div>
					<div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-amber-400 text-amber-950 flex items-center justify-center shadow">
						<Sparkles className="h-3 w-3" />
					</div>
				</div>

				{/* Título */}
				<h1 className="text-xl font-bold tracking-tight text-foreground">
          Calculadora de Jornada
				</h1>
				<p className="text-xs text-muted-foreground mt-1 mb-6">
          Escalas, apuração de horas e conformidade trabalhista
				</p>

				{/* Barra de progresso animada */}
				<div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden mb-3">
					<div className="h-full bg-primary rounded-full animate-[progress_1.2s_ease-in-out_infinite]" />
				</div>

				{/* Texto de Status */}
				<p className="text-xs font-medium text-muted-foreground animate-pulse">
					{statusText}
				</p>
			</div>

			<style jsx>{`
        @keyframes progress {
          0% {
            width: 0%;
            transform: translateX(-100%);
          }
          50% {
            width: 70%;
            transform: translateX(30%);
          }
          100% {
            width: 100%;
            transform: translateX(100%);
          }
        }
      `}</style>
		</div>
	);
}
