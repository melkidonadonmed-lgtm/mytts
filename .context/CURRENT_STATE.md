# Estado Atual do Workspace (mytts)

## Fase Atual
- **Fase**: Central de Criação Unificada & Motor de Auto-Prosódia em Português Brasileiro (pt-BR) Concluídos com Sucesso.
- **Status da Branch**: `main`.

## Decisões Tomadas
1. **Central de Ingestão Unificada (`src/components/StudioWorkspace.tsx` e `StudioTextEditor.tsx`)**:
   - Ponto de entrada único para colar texto, arrastar e subir arquivos (PDF, TXT, MD) ou ditar por microfone com IA.
   - Alternância em 1 toque entre `[🎙️ Apenas Ler (Solo)]` e `[👥 Transformar em Conversa (2 Vozes)]`, com persistência 100% íntegra do texto durante a troca.
2. **Grade Tátil de Vozes Neurais (`src/components/VoiceCardGrid.tsx`)**:
   - Cards visuais para as 5 vozes (Kore, Puck, Aoede, Fenrir, Enceladus) com avatar, arquétipo, gênero e prévia rápida de 3 segundos embutida no card.
   - Acessibilidade completa por teclado (`tabIndex={0}`, `role="radio"`, `focus-visible`).
   - Gerenciamento atômico de memória revogando Blob URLs anteriores via `URL.revokeObjectURL(url)`.
3. **Motor de Calibração e Auto-Prosódia Acústica (`src/utils/prosodyEngine.ts` e `server.ts`)**:
   - `getEmotionStyle`: Inclusão obrigatória de `Speak strictly in natural Brazilian Portuguese (pt-BR)` e mapeamento de velocidade (`speedAdj`).
   - 4 Presets Práticos em Português: `Natural & Fluido`, `Narrativo & Envolvente`, `Técnico & Notícia`, `Espontâneo & Conversa`.
   - `applyAcousticProsody`: Elimina injeção literal de tags perigosas (como `[deep breath]`, `[pause]`) que corriam risco de serem pronunciadas em voz alta pela IA, substituindo por micro-pontuação acústica orgânica (`...`, `—`, quebras duplas).
4. **Resiliência e Fallback Suave**:
   - Preservação estrita do container WAV RIFF canônico de 44 bytes.
   - Fallback de contingência opcional para a Web Speech API do navegador caso a API do Gemini apresente oscilação de rede ou quota.
5. **Bateria de Testes Automatizados**:
   - Expandido `test-audio-engine.ts` cobrindo 100% das asserções de calibração PT-BR, sanitização anti-leitura de tags e casos de borda críticos (emojis `🚀`, moedas `R$ 1.500,00`, URLs e trechos de código).
   - `npm test`, `npm run lint` e `npm run build` aprovados com código de saída 0.

## Débitos Técnicos e Blockers
- **Blockers**: Nenhum.
- **Débitos**:
  - `[MÉDIO]`: Adicionar WebSockets para conversação bidirecional streaming ao vivo (Gemini Live API).

## Próximo Ponto de Entrada
- Deploy da nova revisão no Google Cloud Run e validação em produção.
