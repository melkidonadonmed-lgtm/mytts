# Estado Atual do Workspace (mytts)

## Fase Atual
- **Fase**: Integração Completa de Serviços Firebase (Firestore, Auth, AI Logic) & Motor de Áudio Profissional com Soundscapes e Auto-Ducking.
- **Status da Branch**: `main`.

## Decisões Tomadas
1. **Configuração dos Serviços Firebase (Backend & AI Logic)**:
   - Projeto associado: `agent-md-506215` (agent-md).
   - Registrado Web App `MyTTS Studio` (ID: `1:1044179901556:web:8f3291173cd68f2ee24521`).
   - Inicializado Firestore Database `(default)` e Authentication (`emailPassword`, `anonymous`).
   - Configurado `firestore.rules` com isolamento multi-tenant (`/personalData/{appId}/users/{uid}/...`) e dados públicos com limite (`/publicData/...`).
   - Ativado Firebase AI Logic com SDK oficial Modular (`firebase@12.19.0`) e backend `GoogleAIBackend` (`gemini-2.5-flash`) em `src/services/firebase.ts`.
   - Deploy das regras do Firestore e Auth executado e validado com 100% de sucesso.
2. **Trilhas Sonoras Procedurais (Web Audio API - Zero Download)**:
   - Implementado `src/utils/proceduralSoundtracks.ts` com síntese offline em loop contínuo e crossfade equal-power de 1.5s nos extremos.
   - 4 presets sintetizados (Lo-Fi Study / Rhodes com calor analógico, Deep Focus 432Hz com batimentos binaurais Theta, Tensão Cinemática com sub-bass pulsante e Tecnologia Minimalista) + suporte para upload de arquivo customizado (MP3/WAV).
3. **Grafo Multitrack & Auto-Ducking Dinâmico (`src/utils/audioEngine.ts`)**:
   - `GaplessAudioPlayer` atualizado com nós independentes de ganho para voz (`voiceGainNode` com +3dB a +6dB de presença) e trilha (`musicGainNode`).
   - Auto-Ducking automático com ataque suave de ~100ms ao iniciar fala e release de ~450ms nos silêncios e intervalos entre turnos (`preDelayMs`).
   - Níveis configuráveis: Suave (-8dB), Studio (-14dB) e Profundo (-20dB).
   - Renderização Offline de Master Studio (`exportMasterMixWav`): mixa o episódio completo com todos os turnos sincronizados, prosódia, trilha e curvas de ducking em WAV estéreo de 44.1kHz a 16-bit.
4. **Painel de Mixagem e Indicador em Tempo Real (`src/components/BottomAudioDock.tsx`)**:
   - Gaveta com aba dedicada "Trilha Sonora & Auto-Ducking", seletores visuais, sliders de ganho, upload local e exportação master.
   - Pílula dinâmica na barra recolhida exibindo estado em tempo real com indicador visual de ducking ativo durante a fala.
5. **Endpoint de Mixagem de Retaguarda (`server.ts` e `Dockerfile`)**:
   - Criado `/api/mix-audio` com suporte ao compressor sidechain nativo do FFmpeg (`sidechaincompress=threshold=0.08:ratio=...`).
   - Adicionado `RUN apt-get update && apt-get install -y ffmpeg` no estágio `runner` do Dockerfile para garantir paridade na nuvem (Cloud Run).
6. **Validação e Testes Automatizados**:
   - Criado `test-audio-engine.ts` e adicionado script `npm test`, validando 100% dos cálculos matemáticos de dB, presets e cabeçalhos canônicos WAV RIFF de 44 bytes.
   - `tsc --noEmit` e `npm run build` aprovados sem erros.

## Débitos Técnicos e Blockers
- **Blockers**: Nenhum.
- **Débitos**:
  - `[MÉDIO]`: Adicionar WebSockets para conversação bidirecional streaming ao vivo (Gemini Live API).

## Próximo Ponto de Entrada
- Deploy no Cloud Run e monitoramento da nova revisão em produção.
