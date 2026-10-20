import { NextRequest, NextResponse } from 'next/server';
import { AiRuleResponse } from '@/lib/types';

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
            'Chave do Gemini (GEMINI_API_KEY) não encontrada. Configure a variável no arquivo .env.local ou insira sua chave no botão de Configurações no cabeçalho.',
        },
        { status: 401 }
      );
    }

    const systemInstruction = `
Você é um especialista em cálculos de jornada de trabalho e escalas (CLT, 5x2, 6x1, 12x36, etc.).
O usuário vai descrever como ele trabalha em linguagem natural.
Sua missão é extrair as regras de horário para cada dia da semana e retornar EXCLUSIVAMENTE um objeto JSON válido.

Regras do retorno:
1. dayOfWeek: número de 0 a 6 (0 = Domingo, 1 = Segunda, 2 = Terça, 3 = Quarta, 4 = Quinta, 5 = Sexta, 6 = Sábado).
2. dayType: "work" para dias trabalhados, "off" para folgas/DSR.
3. startTime, breakStartTime, breakEndTime, endTime: formato "HH:mm" (24h) com 2 dígitos para horas e minutos. Se for folga, use "".
4. formula: resumo curto da fórmula (ex: "44h semanais (8h48 seg-sex)" ou "12x36 diurno").
5. explanation: breve resumo amigável em português explicando a distribuição da carga horária.
6. weeklyTargetHours: total de horas semanais (ex: 40 ou 44).
7. dailyTargetHours: horas por dia trabalhado (ex: 8 ou 8.8).

Exemplo de JSON de saída:
{
  "formula": "44h semanais - 8h48/dia",
  "explanation": "Jornada padrão de 44h semanais compensadas de segunda a sexta, com 1h de almoço.",
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
    let selectedModel = '';
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
          selectedModel = model;
          break;
        } else {
          const errData = await res.json().catch(() => ({}));
          const errMsg = errData?.error?.message || `Status HTTP ${res.status}`;
          lastErrorDetails = `[${model}]: ${errMsg}`;
          console.error(`Falha no modelo ${model}:`, errMsg);

          if (errMsg.toLowerCase().includes('api key') || res.status === 403) {
            break;
          }
        }
      } catch (err: any) {
        lastErrorDetails = err?.message || 'Erro de conexão na requisição.';
        console.error(`Exceção ao chamar ${model}:`, err);
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
    const parsedData: AiRuleResponse = JSON.parse(candidateText);

    return NextResponse.json({
      success: true,
      modelUsed: selectedModel,
      schedule: parsedData,
    });
  } catch (error: any) {
    console.error('Erro na rota /api/generate-schedule:', error);
    return NextResponse.json(
      { error: error?.message || 'Erro interno ao processar a jornada com IA.' },
      { status: 500 }
    );
  }
}
