import { NextRequest, NextResponse } from 'next/server';
import { AiRuleResponse } from '@/lib/types';
import { calculateShiftWorkedMinutes } from '@/lib/calculator';

export async function GET() {
	const hasServerKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
	return NextResponse.json({ hasServerKey });
}

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const { prompt, customApiKey } = body;

		if (!prompt || typeof prompt !== 'string') {
			return NextResponse.json(
				{ error: 'Por favor, informe a descrição da sua jornada.' },
				{ status: 400 }
			);
		}

		const rawApiKey = (process.env.GEMINI_API_KEY || customApiKey || '').trim();
		const apiKey = rawApiKey.replace(/^["']|["']$/g, '');

		if (!apiKey) {
			return NextResponse.json(
				{
					error:
            'Chave do Gemini (GEMINI_API_KEY) não encontrada. Configure a variável no environment ou insira sua chave no botão de Configurações no cabeçalho.',
				},
				{ status: 401 }
			);
		}

		const systemInstruction = `
Você é um especialista em cálculos de jornada de trabalho e escalas (CLT, 5x2, 6x1, 12x36, etc.).
O usuário vai descrever como ele trabalha em linguagem natural.
Sua missão é extrair as regras de horário para cada dia da semana e retornar EXCLUSIVAMENTE um objeto JSON válido.

REGRA OBRIGATÓRIA DE VALIDAÇÃO (DIAS DE TRABALHO):
Se o usuário esquecer de indicar em quais dias ele trabalha ou não especificar sua escala (por exemplo, enviou apenas "trabalho das 08:00 às 17:00", "faço 8 horas por dia", "entro às 9 e saio às 18 com almoço", sem especificar se é de segunda a sexta, 5x2, 6x1, 12x36, fins de semana, ou quais dias da semana trabalha):
Você NUNCA deve inventar, supor ou preencher dias de trabalho automaticamente.
Nessa situação, retorne OBRIGATORIAMENTE E EXCLUSIVAMENTE o seguinte JSON de erro:
{
  "error": "Falta indicar quais dias você trabalha (por exemplo: de segunda a sexta, escala 6x1, escala 5x2, plantão 12x36, etc.). Por favor, informe os dias da semana para podermos analisar sua jornada."
}

Se o usuário tiver indicado os dias de trabalho ou a escala, siga as regras abaixo:
Regras do retorno:
1. dayOfWeek: número de 0 a 6 (0 = Domingo, 1 = Segunda, 2 = Terça, 3 = Quarta, 4 = Quinta, 5 = Sexta, 6 = Sábado).
2. dayType: "work" para dias trabalhados, "off" para folgas/DSR.
3. startTime, breakStartTime, breakEndTime, endTime: formato "HH:mm" (24h) com 2 dígitos para horas e minutos. Se for folga, use "".
4. formula: resumo curto da fórmula (ex: "44h semanais - 8h48/dia" ou "40h semanais - 8h/dia" ou "12x36 diurno").
5. explanation: breve resumo amigável em português explicando a distribuição da carga horária.
6. weeklyTargetHours: total de horas semanais reais (ex: 40 ou 44).
7. dailyTargetHours: horas por dia trabalhado (ex: 8 para 8h, 8.8 para 8h48, 7.33 para 7h20).

REGRAS CRÍTICAS DE PRECISÃO (NUNCA ARREDONDAR HORAS):
- NUNCA arredonde horas ou minutos. Não transforme 8h48 em 9h, nem 7h20 em 7h, nem 44h em 45h.
- A CLT prevê limite de 44h semanais.
- Na ESCALA 6x1 COMERCIAL PADRÃO (a mais comum no Brasil), o trabalhador faz 8h de segunda a sexta (ex: 08:00 às 17:00 com 1h de almoço) e 4h no sábado (ex: 08:00 às 12:00 sem intervalo), somando exatamente 44h semanais (40h + 4h).
- Na ESCALA 5x2 (5 dias úteis de 44h), a distribuição é de 8h48/dia (08:00 às 17:48 com 1h de almoço) ou 9h seg-qui e 8h na sex.
- Na ESCALA 12x36 PLANTONISTA (hospital, enfermagem, segurança, portaria): plantonistas ficam no posto em plantão direto (ex: 07:00 às 19:00 ou 19:00 às 07:00). Geralmente NÃO têm 1 hora de almoço fora do posto; têm apenas pausa rápida de 15 minutos para lanche (ex: breakStartTime: "12:00", breakEndTime: "12:15").
- Se o usuário mencionar horários específicos (ex: 08:00 às 18:00 seg-sex e 08:00 às 12:00 sáb), monte exatamente esses turnos para cada dia da semana.

Exemplo 1 - Escala 6x1 Comercial Padrão (Seg-Sex 8h + Sáb 4h = 44h):
{
  "formula": "44h semanais (Seg-Sex 8h, Sáb 4h)",
  "explanation": "Escala 6x1 comercial: 8h de segunda a sexta com 1h de almoço e turno reduzido de 4h no sábado, totalizando exatamente 44h semanais.",
  "weeklyTargetHours": 44,
  "dailyTargetHours": 8,
  "rules": [
    { "dayOfWeek": 1, "dayType": "work", "startTime": "08:00", "breakStartTime": "12:00", "breakEndTime": "13:00", "endTime": "17:00" },
    { "dayOfWeek": 2, "dayType": "work", "startTime": "08:00", "breakStartTime": "12:00", "breakEndTime": "13:00", "endTime": "17:00" },
    { "dayOfWeek": 3, "dayType": "work", "startTime": "08:00", "breakStartTime": "12:00", "breakEndTime": "13:00", "endTime": "17:00" },
    { "dayOfWeek": 4, "dayType": "work", "startTime": "08:00", "breakStartTime": "12:00", "breakEndTime": "13:00", "endTime": "17:00" },
    { "dayOfWeek": 5, "dayType": "work", "startTime": "08:00", "breakStartTime": "12:00", "breakEndTime": "13:00", "endTime": "17:00" },
    { "dayOfWeek": 6, "dayType": "work", "startTime": "08:00", "breakStartTime": "", "breakEndTime": "", "endTime": "12:00" },
    { "dayOfWeek": 0, "dayType": "off", "startTime": "", "breakStartTime": "", "breakEndTime": "", "endTime": "" }
  ]
}

Exemplo 2 - Escala 5x2 Padrão 44h (8h48/dia):
{
  "formula": "44h semanais - 8h48/dia",
  "explanation": "Jornada 5x2 de 44h semanais compensadas de segunda a sexta, com 1h de almoço.",
  "weeklyTargetHours": 44,
  "dailyTargetHours": 8.8,
  "rules": [
    { "dayOfWeek": 1, "dayType": "work", "startTime": "08:00", "breakStartTime": "12:00", "breakEndTime": "13:00", "endTime": "17:48" },
    { "dayOfWeek": 2, "dayType": "work", "startTime": "08:00", "breakStartTime": "12:00", "breakEndTime": "13:00", "endTime": "17:48" },
    { "dayOfWeek": 3, "dayType": "work", "startTime": "08:00", "breakStartTime": "12:00", "breakEndTime": "13:00", "endTime": "17:48" },
    { "dayOfWeek": 4, "dayType": "work", "startTime": "08:00", "breakStartTime": "12:00", "breakEndTime": "13:00", "endTime": "17:48" },
    { "dayOfWeek": 5, "dayType": "work", "startTime": "08:00", "breakStartTime": "12:00", "breakEndTime": "13:00", "endTime": "17:48" },
    { "dayOfWeek": 6, "dayType": "off", "startTime": "", "breakStartTime": "", "breakEndTime": "", "endTime": "" },
    { "dayOfWeek": 0, "dayType": "off", "startTime": "", "breakStartTime": "", "breakEndTime": "", "endTime": "" }
  ]
}
`;

		const candidateModels = [
			'gemini-3.5-flash-lite',
			'gemini-3.5-flash',
		];

		let geminiResponse: Response | null = null;
		let lastErrorDetails = '';

		for (const model of candidateModels) {
			const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
			try {
				const res = await fetch(url, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						contents: [
							{
								role: 'user',
								parts: [{ text: `${systemInstruction}\n\nDescrição do usuário:\n${prompt}` }],
							},
						],
						generationConfig: {
							responseMimeType: 'application/json',
							temperature: 0.1,
						},
					}),
				});

				if (res.ok) {
					geminiResponse = res;
					break;
				} else {
					const errData = await res.json().catch(() => ({}));
					const errMsg = errData?.error?.message || `Status HTTP ${res.status}`;
					lastErrorDetails = errMsg;
					console.error('Falha na chamada da API:', errMsg);

					if (errMsg.toLowerCase().includes('api key') || res.status === 403) {
						break;
					}
				}
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : 'Erro de conexão na requisição.';
				lastErrorDetails = msg;
				console.error('Exceção ao chamar API:', err);
			}
		}

		if (!geminiResponse || !geminiResponse.ok) {
			return NextResponse.json(
				{
					error: `Não foi possível conectar com a API do Gemini. Motivo retornado pelo Google: ${lastErrorDetails || 'Chave inválida ou cota esgotada.'}`,
				},
				{ status: 502 }
			);
		}

		const data = await geminiResponse.json();
		const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

		if (!candidateText) {
			return NextResponse.json(
				{ error: 'Resposta em branco recebida da IA.' },
				{ status: 500 }
			);
		}

		// Sanitiza e faz o parse do JSON
		const cleanJson = candidateText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
		const parsedData: (Partial<AiRuleResponse> & { error?: string }) = JSON.parse(cleanJson);

		// Se a IA sinalizou falta de informações ou erro de validação
		if (parsedData.error) {
			return NextResponse.json(
				{ error: parsedData.error },
				{ status: 400 }
			);
		}

		// Se não há regras de dias de trabalho válidas
		const workRules = Array.isArray(parsedData.rules)
			? parsedData.rules.filter((r) => r.dayType === 'work' && r.startTime && r.endTime)
			: [];

		if (workRules.length === 0) {
			return NextResponse.json(
				{ error: 'Falta indicar quais dias você trabalha (por exemplo: de segunda a sexta, escala 6x1, escala 5x2, etc.). Por favor, informe seus dias de trabalho.' },
				{ status: 400 }
			);
		}

		// Recalcula matematicamente as horas a partir dos horários reais das regras, sem arredondar indevidamente
		if (Array.isArray(parsedData.rules)) {
			let totalWeeklyMins = 0;
			workRules.forEach((r) => {
				const { workedMinutes } = calculateShiftWorkedMinutes(r);
				totalWeeklyMins += workedMinutes;
			});

			const avgDailyMins = Math.round(totalWeeklyMins / workRules.length);
			const formatHoursMinutes = (totalMins: number) => {
				const h = Math.floor(totalMins / 60);
				const m = totalMins % 60;
				return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
			};

			const weeklyStr = formatHoursMinutes(totalWeeklyMins);
			const dailyStr = formatHoursMinutes(avgDailyMins);

			const weekdayRules = workRules.filter((r) => r.dayOfWeek >= 1 && r.dayOfWeek <= 5);
			const saturdayRule = workRules.find((r) => r.dayOfWeek === 6);

			let formulaDesc = '';
			if (weekdayRules.length === 5 && saturdayRule) {
				const weekdayMins = calculateShiftWorkedMinutes(weekdayRules[0]).workedMinutes;
				const satMins = calculateShiftWorkedMinutes(saturdayRule).workedMinutes;
				if (weekdayMins !== satMins) {
					formulaDesc = `${weeklyStr} semanais (Seg-Sex ${formatHoursMinutes(weekdayMins)}, Sáb ${formatHoursMinutes(satMins)})`;
				}
			}

			if (!formulaDesc) {
				formulaDesc = `${weeklyStr} semanais - ${dailyStr}/dia`;
			}

			parsedData.weeklyTargetHours = Number((totalWeeklyMins / 60).toFixed(2));
			parsedData.dailyTargetHours = Number((avgDailyMins / 60).toFixed(2));
			parsedData.formula = formulaDesc;
		}

		return NextResponse.json({
			success: true,
			schedule: parsedData,
		});
	} catch (error: unknown) {
		console.error('Erro na rota /api/generate-schedule:', error);
		const errorMsg = error instanceof Error ? error.message : 'Erro interno ao processar a jornada com IA.';
		return NextResponse.json(
			{ error: errorMsg },
			{ status: 500 }
		);
	}
}
