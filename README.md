# ⏰ Calculadora de Jornada de Trabalho com IA (Gemini Flash)

Uma aplicação moderna e inteligente para gestão e cálculo de jornadas de trabalho, escalas (CLT, 5x2, 6x1, 12x36), apuração de intervalos, saldo de banco de horas e geração automatizada com inteligência artificial.

Construída com **Next.js (App Router)**, **Tailwind CSS**, **Shadcn UI** e **Google Gemini Flash API**.

---

## 🚀 Funcionalidades

- **Calendário Mensal Interativo**: visualize todos os dias do mês, turnos de trabalho, folgas e descansos remunerados (DSR). Clique em qualquer dia para editar os horários rapidamente.
- **Tabela Detalhada de Horários**: campos para:
  - Hora de Início
  - Início do Intervalo (almoço)
  - Fim do Intervalo (retorno)
  - Hora de Fim
  - Horas Líquidas (cálculo automático em tempo real)
  - Saldo diário (+ horas extras ou - horas a compensar)
  - Situação (Trabalho, Folga, DSR, Feriado, Atestado)
  - Botão de réplica rápida para todos os dias úteis do mês.
- **Assistente de IA com Gemini Flash (o mais rápido e econômico)**:
  - Descreva sua rotina em português simples (ex: *"Trabalho 5x2 das 08:00 às 17:48 com 1h de almoço"*).
  - A IA extrai as regras, calcula a carga horária e preenche automaticamente o calendário e a tabela.
- **Segurança Total da Chave da API**:
  - A chave da API (`GEMINI_API_KEY`) fica protegida no backend (`/api/generate-schedule`).
  - Visitantes e curiosos **não conseguem ver a sua chave** pelo painel de desenvolvedor (F12 / DevTools).
- **Exportação & Relatórios**:
  - Exportação direta para planilha **Excel (.CSV)**.
  - Impressão formatada e salvamento em **PDF**.
- **Persistência Local**: todos os dados são salvos no navegador (`localStorage`), garantindo total privacidade.

---

## 🛠️ Como Rodar Localmente

1. Clone o repositório e instale as dependências:
   ```bash
   npm install
   ```

2. Configure sua chave da API do Google Gemini:
   - Obtenha uma chave gratuita no [Google AI Studio](https://aistudio.google.com/).
   - Crie ou edite o arquivo `.env.local` na raiz:
     ```env
     GEMINI_API_KEY=sua_chave_do_gemini_aqui
     ```
   *(Ou se preferir, você também pode inserir a chave diretamente pelo botão de "Configurações" na tela da aplicação)*.

3. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
   Acesse [http://localhost:3000](http://localhost:3000) no seu navegador.

---

## ☁️ Como Publicar Gratuitamente na Vercel

1. Suba o código para o seu repositório no **GitHub**.
2. Acesse [vercel.com](https://vercel.com) e faça login com sua conta do GitHub.
3. Clique em **"Add New"** > **"Project"** e selecione o repositório deste projeto.
4. Na seção **"Environment Variables"**, adicione:
   - **Key**: `GEMINI_API_KEY`
   - **Value**: *(sua chave do Gemini obtida no Google AI Studio)*
5. Clique em **"Deploy"**.

Pronto! Sua calculadora estará no ar com link público HTTPS, 100% gratuita e com a sua chave de API segura no servidor.
