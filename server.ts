import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Server-side Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

function getEmotionStyle(emotion: string, rate: number = 1.0): string {
  switch (emotion) {
    case 'inquisitive':
      return 'Curious, sharp, slightly skeptical with rhythmic inflections';
    case 'ironic':
      return 'Subtly sarcastic, dry wit, conversational chuckles';
    case 'skeptical':
      return 'Firm objection, deliberative pacing, raised eyebrows tone';
    case 'passionate':
      return 'High energetic conviction, accelerated cadence, urgent';
    case 'resolute':
      return 'Authoritative, calm, grounding, unwavering cadence';
    case 'thoughtful':
    default:
      return 'Analytical, measured, reflective with authentic pauses';
  }
}

// 1. Text Ingestion & Parsing
app.post('/api/extract-text', async (req, res) => {
  try {
    const { text, fileData, fileName, mimeType } = req.body;

    if (fileData && mimeType === 'application/pdf') {
      // Ingest PDF using Gemini Multimodal document parsing
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: fileData,
            },
          },
          {
            text: 'Extract the full clean text of this document verbatim, omitting repeated headers/footers. Then at the bottom provide a 2-sentence executive summary and key philosophical/practical tension points for debate.',
          },
        ],
      });

      const extracted = response.text || '';
      return res.json({
        success: true,
        text: extracted,
        fileName: fileName || 'document.pdf',
        wordCount: extracted.split(/\s+/).filter(Boolean).length,
      });
    }

    if (text) {
      return res.json({
        success: true,
        text: text.trim(),
        fileName: fileName || 'pasted-text.txt',
        wordCount: text.split(/\s+/).filter(Boolean).length,
      });
    }

    return res.status(400).json({ error: 'Nenhum texto ou arquivo recebido.' });
  } catch (error: any) {
    console.error('Error in /api/extract-text:', error);
    return res.status(500).json({
      error: error?.message || 'Falha ao processar e extrair documento.',
    });
  }
});

// 2. Dialectic Debate Script Generator
app.post('/api/generate-script', async (req, res) => {
  try {
    const {
      documentText,
      language = 'pt-BR',
      audienceLevel = 'intermediate',
      tensionIntensity = 'provocative',
      speakers,
      maxTurns = 6,
    } = req.body;

    if (!documentText || documentText.trim().length === 0) {
      return res.status(400).json({ error: 'O texto do documento é obrigatório.' });
    }

    const speaker1 = speakers?.[0] || {
      name: 'Sofia',
      roleTitle: 'Analista Teórica & Fundamentada',
      voiceId: 'Kore',
    };
    const speaker2 = speakers?.[1] || {
      name: 'Lucas',
      roleTitle: 'Provocador Pragmático & Cético',
      voiceId: 'Puck',
    };

    const languageDirectives: Record<string, string> = {
      'pt-BR': `Idioma estrito: Português do Brasil natural, contemporâneo e oralizado. Use marcadores rítmicos brasileiros autênticos ("Olha...", "Mas espera aí...", "Não é bem assim", "Na prática...").`,
      'en-US': `Strict language: Natural spoken American English. Use authentic conversational debate rhythm ("Wait a second...", "Come on, look at the incentives", "Let's be real here...").`,
      'it-IT': `Lingua rigorosa: Italiano naturale, colloquiale ma argomentativo. Usa intercalari e ritmo dialettico ("Ma fermiamoci un attimo...", "Non prendiamoci in giro", "I numeri dicono l'opposto").`,
      'ja-JP': `厳格な言語：自然で流暢な現代日本語。知的で歯切れの良い討論トーン。漢字の誤読を避ける自然な文脈構成にし、口語表現と知的反論を両立（「ちょっと待ってください」「机上の空論に過ぎないのでは」「現場を直視すべきです」）。`,
    };

    const tensionDirectives: Record<string, string> = {
      reflective: `Tensão Moderada: Foco em contra-exemplos, nuances conceituais e limites das premissas. Discussão ponderada com atrito intelectual civilizado.`,
      balanced: `Tensão Dinâmica: Ataques incisivos a premissas fracas, defesas vigorosas e exigência de provas factuais. Ritmo ágil.`,
      provocative: `Tensão Fervorosa & Incisiva: Desconstrução impiedosa de dogmas, confronto aberto entre teoria pura e realidade bruta, ironia socrática elegante, réplicas rápidas e objeções sem rodeios. Zero complacência.`,
    };

    const audienceDirectives: Record<string, string> = {
      layman: `Nível Leigo: Analogias vivas, exemplos do cotidiano, vocabulário claro sem hermetismo burocrático, porém sem subestimar a inteligência do ouvinte.`,
      intermediate: `Nível Intermediário: Equilíbrio perfeito entre clareza e densidade conceitual, citando trade-offs e impactos reais.`,
      expert: `Nível Especialista: Rigor conceitual elevado, terminologia técnica precisa, análise epistemológica e de sistemas complexos.`,
    };

    const systemInstruction = `Você é o Diretor Dramatúrgico e Roteirizador Dialético Chefe do DialecticPod.
Sua missão é transformar o documento fornecido em uma discussão de áudio viva, hiper-realista e cativante entre dois interlocutores de IA com visões antagônicas.

PERSONAGENS:
- Interlocutor 1: "${speaker1.name}" (${speaker1.roleTitle}) — Perfil metódico, analítico, busca rigor metodológico, defende cautela epistemológica ou valoriza princípios fundamentais.
- Interlocutor 2: "${speaker2.name}" (${speaker2.roleTitle}) — Perfil pragmático, provocador, cético em relação a purismos teóricos, focado em incentivos econômicos, dados do mundo real e aplicabilidade.

DIRETRIZES FUNDAMENTAIS (LEIS INVIOLÁVEIS):
1. PROIBIÇÃO ABSOLUTA DE CLICHÊS DE CONCORDÂNCIA:
   NUNCA gere frases como:
   - "Com certeza / Concordo plenamente"
   - "Excelente ponto / Esse é um ótimo argumento"
   - "Isso é fascinante / É muito interessante pensar nisso"
   - "Em suma / Para resumir / Em conclusão"
   Os interlocutores estão em debate real: se um faz um ponto forte, o outro desafia a premissa, expõe o custo oculto ou contra-ataca com um contra-exemplo prático.

2. PONTUAÇÃO PROSÓDICA PARA SÍNTESE NEURAL (TTS):
   O texto DEVE ser formatado com pontuação dramática calculada para síntese neural:
   - Use reticências (...) para hesitações deliberadas e pausas reflexivas.
   - Use travessões (—) para quebras súbitas de pensamento e interpelações.
   - Inclua tags expressivas suportadas: <breath> (respiração/pausa de fôlego), <laugh> (risadinha sarcástica ou bem-humorada), <gasp> (reação de espanto ou choque), e marcadores de escuta ativa como |mhm| ou |yeah|.
   - Cada fala deve soar como fala humana real improvisada em estúdio, não como um texto lido roboticamente.

3. IDIOMA E CALIBRAÇÃO:
   ${languageDirectives[language] || languageDirectives['pt-BR']}
   ${tensionDirectives[tensionIntensity] || tensionDirectives['balanced']}
   ${audienceDirectives[audienceLevel] || audienceDirectives['intermediate']}

4. ESTRUTURA:
   - Gere exatamente entre 6 e ${Math.min(maxTurns, 8)} turnos alternados entre ${speaker1.name} e ${speaker2.name}.
   - Inicie o debate in media res, já no centro da tensão do documento, sem introduções pomposas tipo "Olá ouvintes do podcast".`;

    const prompt = `Analise detalhadamente o seguinte documento e produza o roteiro de debate dialético estruturado em JSON:

--- CONTEÚDO DO DOCUMENTO ---
${documentText.slice(0, 10000)}
--- FIM DO DOCUMENTO ---

Gere a resposta em formato JSON correspondente ao esquema solicitado.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.7,
        topP: 0.95,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: 'Título instigante e provocativo do debate',
            },
            topicSummary: {
              type: Type.STRING,
              description: 'Resumo conciso de 1 frase sobre o embate central',
            },
            keyThesis: {
              type: Type.STRING,
              description: 'A tese principal colocada à prova na discussão',
            },
            turns: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  turn: { type: Type.INTEGER },
                  speaker: { type: Type.STRING },
                  voice_id: { type: Type.STRING },
                  emotion: {
                    type: Type.STRING,
                    enum: [
                      'thoughtful',
                      'inquisitive',
                      'skeptical',
                      'ironic',
                      'passionate',
                      'resolute',
                    ],
                  },
                  text: {
                    type: Type.STRING,
                    description:
                      'Fala completa com marcações prosódicas (<breath>, <laugh>, reticências, travessões)',
                  },
                  clean_text: {
                    type: Type.STRING,
                    description: 'Texto sem as tags <breath>, <laugh>, etc.',
                  },
                  prosody: {
                    type: Type.OBJECT,
                    properties: {
                      pre_delay_ms: { type: Type.INTEGER },
                      speech_rate: { type: Type.NUMBER },
                      breath_sound: { type: Type.BOOLEAN },
                    },
                    required: ['pre_delay_ms', 'speech_rate', 'breath_sound'],
                  },
                },
                required: ['turn', 'speaker', 'voice_id', 'emotion', 'text', 'prosody'],
              },
            },
          },
          required: ['title', 'topicSummary', 'keyThesis', 'turns'],
        },
      },
    });

    const rawJson = response.text?.trim() || '{}';
    const parsed = JSON.parse(rawJson);

    // Ensure voice IDs match the selected speaker configuration
    parsed.turns = parsed.turns.map((t: any) => {
      const isSpk1 = t.speaker.toLowerCase().includes(speaker1.name.toLowerCase());
      const selectedVoice = isSpk1 ? speaker1.voiceId : speaker2.voiceId;
      const clean =
        t.clean_text ||
        t.text.replace(/<[^>]+>/g, '').replace(/\|[^|]+\|/g, '').trim();

      return {
        ...t,
        speaker: isSpk1 ? speaker1.name : speaker2.name,
        voice_id: selectedVoice,
        clean_text: clean,
        prosody: {
          pre_delay_ms: t.prosody?.pre_delay_ms || 100,
          speech_rate: Math.min(1.15, Math.max(0.9, t.prosody?.speech_rate || 1.0)),
          breath_sound: !!t.prosody?.breath_sound,
        },
      };
    });

    return res.json({
      success: true,
      script: {
        id: `debate-${Date.now()}`,
        title: parsed.title,
        topicSummary: parsed.topicSummary,
        keyThesis: parsed.keyThesis,
        language,
        audienceLevel,
        tensionIntensity,
        speakers: [speaker1, speaker2],
        turns: parsed.turns,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error in /api/generate-script:', error);
    return res.status(500).json({
      error: error?.message || 'Falha ao gerar roteiro dialético.',
    });
  }
});

// 3. Turn-by-Turn Neural TTS Synthesis (Gemini 3.8 Flash TTS)
app.post('/api/synthesize-turn', async (req, res) => {
  try {
    const { turn, speakerName, voiceId, language } = req.body;

    if (!turn || !turn.text) {
      return res.status(400).json({ error: 'Dados do turno inválidos.' });
    }

    const effectiveVoice = voiceId || turn.voice_id || 'Kore';
    const effectiveSpeaker = speakerName || turn.speaker || 'Speaker';
    const emotionStyle = getEmotionStyle(turn.emotion, turn.prosody?.speech_rate);

    // Call Gemini 3.8 Flash TTS
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${effectiveSpeaker}: ${turn.text}`,
              speechMetadata: {
                speaker: effectiveSpeaker,
                style: emotionStyle,
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: effectiveVoice },
          },
        },
      },
    });

    const base64Audio =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      throw new Error('Nenhum dado de áudio retornado pelo modelo neural de voz.');
    }

    // Estimate duration: 24kHz, 16-bit mono = 48,000 bytes per second
    const audioByteLength = Buffer.from(base64Audio, 'base64').length;
    const durationEstimateSec = Math.max(1.0, (audioByteLength - 44) / 48000);

    return res.json({
      success: true,
      turnNumber: turn.turn,
      audioBase64: base64Audio,
      mimeType: 'audio/wav',
      durationSec: durationEstimateSec,
    });
  } catch (error: any) {
    console.error('Error in /api/synthesize-turn:', error);
    return res.status(500).json({
      error: error?.message || 'Falha na síntese de áudio do turno.',
    });
  }
});

// 4. Multi-Speaker Full Master Episode Synthesis (Gemini 3.8 Flash TTS multiSpeakerVoiceConfig)
app.post('/api/synthesize-full', async (req, res) => {
  try {
    const { script } = req.body;

    if (!script || !script.turns || script.turns.length === 0) {
      return res.status(400).json({ error: 'Roteiro inválido.' });
    }

    const speaker1 = script.speakers[0];
    const speaker2 = script.speakers[1];

    const parts = script.turns.map((turn: any) => ({
      text: `${turn.speaker}: ${turn.text}`,
      speechMetadata: {
        speaker: turn.speaker,
        style: getEmotionStyle(turn.emotion, turn.prosody?.speech_rate),
      },
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-tts',
      contents: [
        {
          role: 'user',
          parts,
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: [
              {
                speaker: speaker1.name,
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: speaker1.voiceId || 'Kore' },
                },
              },
              {
                speaker: speaker2.name,
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: speaker2.voiceId || 'Puck' },
                },
              },
            ],
          },
        },
      },
    });

    const base64Audio =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      throw new Error('Falha ao gerar o master estéreo do debate.');
    }

    return res.json({
      success: true,
      audioBase64: base64Audio,
      mimeType: 'audio/wav',
    });
  } catch (error: any) {
    console.error('Error in /api/synthesize-full:', error);
    return res.status(500).json({
      error: error?.message || 'Falha ao sintetizar o episódio completo.',
    });
  }
});

// 5. Short Voice Sample Preview (3-second demonstration)
const voicePreviewCache = new Map<string, string>();

app.post('/api/preview-voice', async (req, res) => {
  try {
    const { voiceId = 'Puck', speakerName = 'Orador', language = 'pt-BR' } = req.body;
    const cacheKey = `${voiceId}_${language}`;

    if (voicePreviewCache.has(cacheKey)) {
      return res.json({
        success: true,
        audioBase64: voicePreviewCache.get(cacheKey),
        mimeType: 'audio/wav',
        durationSec: 3.0,
      });
    }

    const previewPhrases: Record<string, string> = {
      'pt-BR': `Olá, sou ${speakerName}. Esta é uma demonstração de síntese da minha voz neural no estúdio dialético.`,
      'en-US': `Hello, I'm ${speakerName}. This is a demonstration sample of my neural voice in the dialectic studio.`,
      'it-IT': `Ciao, sono ${speakerName}. Questo è un campione dimostrativo della mia voce neurale nello studio dialettico.`,
      'ja-JP': `こんにちは、${speakerName}です。こちらは私のニューラル音声サンプルのプレビューです。`,
    };

    const phrase = previewPhrases[language] || previewPhrases['pt-BR'];

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${speakerName}: ${phrase}`,
              speechMetadata: {
                speaker: speakerName,
                style: 'Clear, engaging, articulate podcast host voice',
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceId },
          },
        },
      },
    });

    const base64Audio =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      throw new Error('Nenhum dado retornado para a amostra de voz.');
    }

    voicePreviewCache.set(cacheKey, base64Audio);

    return res.json({
      success: true,
      audioBase64: base64Audio,
      mimeType: 'audio/wav',
      durationSec: 3.0,
    });
  } catch (error: any) {
    console.error('Error in /api/preview-voice:', error);
    return res.status(500).json({
      error: error?.message || 'Falha ao gerar preview da voz.',
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'DialecticPod AI Studio API',
    modelTts: 'gemini-3.8-flash-tts',
  });
});

// Vite Middleware for Dev, Static serving for Production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DialecticPod server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
