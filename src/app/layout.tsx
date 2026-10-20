import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
	title: 'Calculadora de Jornada de Trabalho & Escalas | IA',
	description:
    'Calcule sua jornada de trabalho com calendário, tabela de horários, apuração de intervalos, conformidade legal e assistente de IA.',
};

export default function RootLayout({
	children,
}: Readonly<{
  children: React.ReactNode;
}>) {
	return (
		<html lang="pt-BR" suppressHydrationWarning>
			<head>
				<link
					id="dynamic-favicon"
					rel="icon"
					type="image/svg+xml"
					href="/calendar%20light.svg"
				/>
				<script
					dangerouslySetInnerHTML={{
						__html: `
              (function() {
                try {
                  var storedTheme = localStorage.getItem('theme');
                  var isDark = storedTheme === 'dark' || (!storedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
                  if (isDark) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                  var favicon = document.getElementById('dynamic-favicon');
                  if (favicon) {
                    favicon.href = isDark ? '/calendar%20dark.svg' : '/calendar%20light.svg';
                  }
                } catch (e) {}
              })();
            `,
					}}
				/>
			</head>
			<body className="min-h-screen bg-background font-sans antialiased text-foreground">
				{children}
			</body>
		</html>
	);
}
