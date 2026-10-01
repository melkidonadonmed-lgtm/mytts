# GEMINI.md - Contexto de Engenharia e Instruções do Workspace

Este documento serve como a especificação técnica central e guia de diretrizes para o desenvolvimento contínuo do **MyTTS Studio** (`mytts`), uma estação de trabalho de áudio neural de altíssima fidelidade inspirada em produtos como Speechify e ElevenLabs, potencializada pelos modelos **Gemini 3.1 Flash TTS Preview**, **Gemini 3.8 Flash** e **Web Audio API**.

---

## 1. Visão Geral do Projeto

### Propósito
O **MyTTS Studio** é uma plataforma fullstack projetada para oferecer síntese de voz neural hiper-realista (com respiração, pausas, modulação de prosódia e direção de estilo *Director's Chair*), estúdio dialético de debates antagônicos entre dois interlocutores de IA, treino de idiomas pelo método lexical (*FastChunks*), ditado inteligente com transcrição e pós-produção profissional de áudio (multitrack com trilha sonora e auto-ducking dinâmico).

### Tecnologias Centrais
- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Motion (`motion/react`), Lucide React, Web Audio API (`AudioContext`, `OfflineAudioContext`, `AnalyserNode`, `GainNode`).
- **Backend**: Node.js 22, Express, TypeScript (`tsx`), `@google/genai` SDK v2.4+, `@google-cloud/firestore`.
- **Processamento de Áudio**:
  - Web Audio API nativa no cliente para reprodução gapless, soundscapes procedurais e renderização offline de master WAV em 44.1kHz.
  - FFmpeg 9.x com filtros nativos (`sidechaincompress`, `amix`, `volume`, `afade`) no backend para mixagem broadcast.
- **Modelos de IA (Google Gemini)**:
  - `gemini-3.1-flash-tts-preview`: Síntese neural de voz com *Director's Chair* e suporte a tags prosódicas (`[deep breath]`, `[sighs]`, `[pause]`, `[laughs]`, `[whispers]`).
  - `gemini-3.8-flash`: Roteirização dramatúrgica de debates, parsing multimodal de PDFs e transcrição com pontuação inteligente de áudio do microfone.
- **Hospedagem & Infraestrutura**: Google Cloud Run (container Linux multi-stage com Node 22 e FFmpeg), Cloud Build, Docker.

---

## 2. Comandos de Construção, Execução e Testes

| Comando | Descrição |
| :--- | :--- |
| `npm run dev` | Inicia o servidor Express em desenvolvimento com middleware do Vite (HMR ativo em `http://localhost:3000`). |
| `npm run build` | Compila o bundle de produção do cliente React via Vite para `dist/`. |
| `npm start` | Inicia o servidor em modo de produção servindo os assets compilados em `dist/`. |
| `npm run lint` | Executa a verificação estrita de tipagem TypeScript em todo o projeto (`tsc --noEmit`). |
| `npm test` | Executa a bateria automatizada de testes de engenharia de áudio (`tsx test-audio-engine.ts`). |
| `npm run clean` | Remove pastas de build (`dist/`) e bundles temporários. |

### Deploy no Google Cloud Run
```powershell
gcloud run deploy mytts `
  --source . `
  --region us-central1 `
  --allow-unauthenticated `
  --project agent-md-506215 `
  --set-env-vars="GEMINI_API_KEY=SUA_CHAVE,GCP_PROJECT_ID=agent-md-506215"
```

---

## 3. Arquitetura do Sistema e Fluxo de Dados

### 3.1. Frontend (`src/`)
- `src/App.tsx`: Orquestrador principal da UI com abas (`reader`, `dictate`, `debate`, `chunks`, `voices`, `architecture`).
- `src/utils/audioEngine.ts`: Motor de áudio de alta precisão (`GaplessAudioPlayer`). Gerencia a fila de turnos, velocidade de reprodução com preservação de pitch, grafo multitrack (voz + trilha), auto-ducking em tempo real e renderização offline de Master Studio.
- `src/utils/proceduralSoundtracks.ts`: Gerador de soundscapes musicais procedurais via `OfflineAudioContext` (4 presets: Lo-Fi Study com calor analógico, Foco Profundo 432Hz com batimentos Theta, Tensão Cinemática com sub-bass pulsante e Tecnologia Minimalista) sem necessidade de download externo.
- `src/utils/audio.ts`: Utilitários para conversão segura de áudio base64 em Blob URLs e revogação de memória.
- `src/components/BottomAudioDock.tsx`: Barra de controle ergonômica tátil (Thumb Zone) com scrubber de progresso, seletor de velocidade, controle de play/pause, gaveta de abas (*Voz & Prosódia* e *Trilha Sonora & Auto-Ducking*) e botão de exportação master.
- `src/components/QuickReader.tsx`: Interface de leitura rápida estilo Speechify com tags prosódicas injetáveis, estimativa de tempo e download de WAV.
- `src/components/ScriptViewer.tsx` & `DebateConfigPanel.tsx`: Visualização e geração do roteiro dramatúrgico de debates dialéticos com cards alternados e avatares.
- `src/components/FastChunkAudioApp.tsx`: Treinamento de frases coloquiais de idiomas com repetição espaçada e síntese neural.
- `src/components/LiveVoiceMic.tsx`: Gravação de microfone com transcrição inteligente via Gemini 3.8.
- `src/components/VoiceLibraryModal.tsx`: Catálogo e audição de amostras de 3 segundos das vozes neurais (Puck, Kore, Fenrir, Aoede, Enceladus).

### 3.2. Backend (`server.ts`)
- `/api/extract-text`: Ingestão de texto puro ou parsing multimodal de PDFs usando Gemini 3.8 Flash.
- `/api/generate-script`: Geração de roteiro dramatúrgico de debate com diretrizes estritas contra concordâncias clichês e com marcações prosódicas.
- `/api/synthesize-speech`: Síntese neural para o Leitor Rápido com calibração de estilo (*Director's Chair*).
- `/api/synthesize-turn`: Síntese individual de turnos do debate com prosódia calibrada.
- `/api/synthesize-full`: Síntese contínua de todo o episódio dialético.
- `/api/mix-audio`: Endpoint de mixagem broadcast no servidor via FFmpeg com compressor sidechain nativo (`sidechaincompress` e `amix`).
- `/api/preview-voice`: Amostra rápida de 3 segundos da voz solicitada.
- `/api/transcribe-audio`: Transcrição de áudio do microfone com pontuação inteligente.
- `/api/generate-chunks` & `/api/chunks`: Gerenciamento e extração de blocos lexicais com persistência no Firestore.

---

## 4. Regras e Padrões Críticos de Engenharia de Áudio

### 4.1. Garantia Canônica do Container WAV RIFF (44 Bytes)
- **Problema de Base**: A API `gemini-3.1-flash-tts-preview` retorna bytes PCM raw puros (24.000 Hz, 16-bit mono) sem cabeçalho WAV. Navegadores e tags `<audio>` não reproduzem áudio raw sem container.
- **Regra Inviolável**: Qualquer payload de áudio retornado pelos endpoints do backend DEVE passar por `ensureWavContainer(base64Audio, sampleRate)`. Se os 4 primeiros bytes não forem `RIFF`, anexa o cabeçalho canônico de 44 bytes estruturado (`fmt `, formato 1 PCM, taxa de amostragem, alinhamento de bloco e chunk `data`).

### 4.2. Gerenciamento de Memória e URLs de Áudio
- **Proibido o uso de Data URIs longas** (`data:audio/wav;base64,...`) em instâncias de reprodução frequentes ou em múltiplos turnos, pois causam estouro de memória no navegador e travamentos no Safari/Chrome móvel.
- **Padrão Obrigatório**: Converter base64 para `Blob` e gerar `URL.createObjectURL(blob)`. Sempre revogar via `URL.revokeObjectURL(url)` ao trocar de turno, pausar ou desmontar o componente.

### 4.3. Grafo Multitrack & Auto-Ducking Dinâmico
- O `GaplessAudioPlayer` opera um grafo de áudio unificado:
  - Trilha Vocal: passa por `voiceGainNode` (reforço de +3dB a +6dB para garantir inteligibilidade).
  - Trilha Musical: passa por `musicGainNode` e recebe curvas dinâmicas de ganho.
  - Ambas as trilhas convergem para o `analyserNode` e `masterGainNode`.
- **Parâmetros de Auto-Ducking**:
  - *Ataque*: ~100ms (`exponentialRampToValueAtTime`) para atenuar a música quando a fala começa, sem gerar cliques de descontinuidade.
  - *Release*: ~450ms nos silêncios, pausas respiratórias e entre-turnos (`preDelayMs`), permitindo que a trilha preencha o ambiente.
  - *Profundidades recomendadas*: Suave (-8dB / ~40% do volume), Studio (-14dB / ~20% do volume), Profundo (-20dB / ~10% do volume).
- **Exportação Master Studio (`exportMasterMixWav`)**:
  - Executada via `OfflineAudioContext(2, sampleRate * totalDuration, 44100)` no cliente.
  - Posiciona todos os turnos sincronizados com prosódia, adiciona introdução musical suave (1.2s), envelopes de ducking precisos e encerramento (outro) com fade-out de 1.5s.
  - Gera arquivo WAV RIFF canônico estéreo de 16-bit em menos de 300ms.

---

## 5. Convenções de Código e Estilo

- **Linguagem & Tipagem**: TypeScript em modo estrito (`tsconfig.json`). Evitar `any`; tipar estados, props e retornos de funções.
- **Design System**: Cores baseadas em `slate-950` (fundo principal), `slate-900` (cards e gavetas), `slate-800` (bordas) e `amber-400` / `amber-500` como cor de destaque e energia vocal.
- **Touch Targets Ergonômicos**: Botões primários e controles no dock inferior devem manter altura/largura mínima de 44px a 56px para manuseio tátil com o polegar.
- **Tratamento Resiliente de Erros**: Qualquer falha na síntese neural ou em chamadas de API deve apresentar feedback visual claro e acionável sem quebrar o estado global da aplicação.
- **Scripts de Teste**: Sempre que alterar a lógica do motor de áudio, execute `npm test` para assegurar conformidade matemática dos ganhos em dB e validade dos cabeçalhos WAV.
