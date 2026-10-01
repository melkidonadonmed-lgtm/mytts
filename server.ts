import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { GoogleGenAI, Type } from '@google/genai';
import { chunkStorage } from './src/services/chunkStorage';
import { ChunkItem, TargetLang } from './src/types/chunks';

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
      return 'Curious, sharp, slightly skeptical with rhythmic inflections, subtle vocal raises at questions, and organic thinking pauses';
    case 'ironic':
      return 'Subtly sarcastic, dry wit, knowing conversational chuckles, controlled breath exhalations, and wry pauses';
    case 'skeptical':
      return 'Firm objection, deliberative pacing, raised-eyebrows tone, authentic skeptical sighs before counterpoints, and grounded pauses';
    case 'passionate':
      return 'High energetic conviction, accelerated cadence, urgent breath intakes, emotional resonance, and intense emphasis on pivotal words';
    case 'resolute':
      return 'Authoritative, calm, grounding, steady deep breathing, unwavering cadence, and self-assured deliberate delivery';
    case 'thoughtful':
    default:
      return 'Analytical, measured, reflective with authentic breathing pauses, contemplative hesitations, and warm conversational timbre';
  }
}

function formatForTts(text: string): string {
  return text
    .replace(/<breath>/gi, '[deep breath]')
    .replace(/<sigh>/gi, '[sighs]')
    .replace(/<laugh>/gi, '[laughs]')
    .replace(/<gasp>/gi, '[gasp]')
    .replace(/<whisper>/gi, '[whispers]')
    .replace(/<pause>/gi, '[pause]')
    .replace(/\|mhm\|/gi, 'mhm...')
    .replace(/\|yeah\|/gi, 'yeah...')
    .replace(/<[^>]+>/g, '') // remove qualquer tag HTML-like residual
    .trim();
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

2. PONTUAÇÃO PROSÓDICA E AUDIO TAGS PARA SÍNTESE NEURAL (TTS):
   O texto DEVE ser formatado com marcações prosódicas que o decodificador neural do Gemini TTS reconhece nativamente:
   - Use reticências (...) para hesitações deliberadas, raciocínio em andamento e pausas reflexivas.
   - Use travessões (—) para quebras súbitas de pensamento, correções imediatas e interrupções incisivas.
   - Use tags expressivas em inglês entre colchetes diretamente no texto (o decodificador neural foi calibrado sobre elas):
     * [deep breath] -> pausa audível para puxar fôlego antes de uma frase de impacto
     * [sighs] -> suspiro sutil de cansaço ou desabafo cético
     * [pause] -> silêncio reflexivo dramático de 0.5 a 1 segundo
     * [laughs] ou [giggles] -> risadinha sarcástica, irônica ou descontraída
     * [gasp] -> reação imediata de surpresa ou espanto
     * [whispers] -> redução de volume para tom confidencial ou conspiratório
   - Cada fala humana em estúdio tem nuances: inclua ao menos um marcador prosódico (...) ou tag de áudio por turno para garantir que a leitura soe 100% como conversa real e viva, nunca como texto corrido.

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
    const formattedText = formatForTts(turn.text);

    // Prompt no padrão canônico Director's Chair do Gemini 3.1 Flash TTS
    const directorPrompt = `Read the following dialogue turn as ${effectiveSpeaker} with live human conversational realism.
Performance Direction: Deliver with ${emotionStyle}. Ensure natural breathiness, authentic pauses between thoughts, and realistic vocal cadence.

${effectiveSpeaker}: ${formattedText}`;

    // Call Gemini 3.1 Flash TTS
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-tts-preview',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: directorPrompt,
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

    const formattedLines = script.turns
      .map((turn: any) => `${turn.speaker}: ${formatForTts(turn.text)}`)
      .join('\n\n');

    const spk1Style = getEmotionStyle(
      script.turns.find((t: any) => t.speaker === speaker1.name)?.emotion || 'thoughtful'
    );
    const spk2Style = getEmotionStyle(
      script.turns.find((t: any) => t.speaker === speaker2.name)?.emotion || 'skeptical'
    );

    const directorPrompt = `Director's Notes for Studio Podcast Debate:
- Speaker "${speaker1.name}": ${spk1Style}
- Speaker "${speaker2.name}": ${spk2Style}
Deliver this dialogue between ${speaker1.name} and ${speaker2.name} with authentic live realism, natural breathing between sentences, spontaneous conversational friction, and convincing pacing.

${formattedLines}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-tts-preview',
      contents: [
        {
          role: 'user',
          parts: [{ text: directorPrompt }],
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
    const directorPrompt = `Read with natural conversational realism, warm tone, clear pronunciation, and natural breathing:
${speakerName}: ${phrase}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-tts-preview',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: directorPrompt,
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

// 6. FastChunks Neural Synthesis (Gemini 3.1 Flash TTS para Chunks de Idiomas)
app.post('/api/synthesize-chunk', async (req, res) => {
  try {
    const { text, language = 'en-US', voiceId } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Texto do chunk é obrigatório.' });
    }

    const defaultVoices: Record<string, string> = {
      'en-US': 'Puck',
      'it-IT': 'Fenrir',
      'ja-JP': 'Aoede',
    };

    const selectedVoice = voiceId || defaultVoices[language] || 'Puck';
    const cleanText = text.replace(/\(.*?\)/g, '').trim();

    const directorPrompt = `Read this conversational chunk in ${language} with maximum native fluency, authentic colloquial emotion, and natural breathing:
"${cleanText}"`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-tts-preview',
      contents: [
        {
          role: 'user',
          parts: [{ text: directorPrompt }],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: selectedVoice },
          },
        },
      },
    });

    const base64Audio =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      throw new Error('Falha ao sintetizar áudio neural para o chunk.');
    }

    return res.json({
      success: true,
      audioBase64: base64Audio,
      mimeType: 'audio/wav',
    });
  } catch (error: any) {
    console.error('Error in /api/synthesize-chunk:', error);
    return res.status(500).json({
      error: error?.message || 'Falha na síntese do chunk.',
    });
  }
});

// 7. Quick Reader Speech Synthesis (Speechify/ElevenLabs Style com Director's Chair)
app.post('/api/synthesize-speech', async (req, res) => {
  try {
    const { text, voiceId = 'Puck', emotion = 'thoughtful', speed = 1.0, language = 'pt-BR' } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'O texto para leitura é obrigatório.' });
    }

    const emotionStyle = getEmotionStyle(emotion, speed);
    const formattedText = formatForTts(text);

    // Director's Chair prompt
    const directorPrompt = `Read the following text with authentic human conversational realism, natural breathiness, organic hesitation pauses, and convincing emotional delivery.
Performance Direction: Deliver with ${emotionStyle}. Ensure natural breathing between sentences and realistic vocal cadence.

Text:
${formattedText}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-tts-preview',
      contents: [
        {
          role: 'user',
          parts: [{ text: directorPrompt }],
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

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      throw new Error('Nenhum dado de áudio retornado pelo modelo neural de voz.');
    }

    const audioByteLength = Buffer.from(base64Audio, 'base64').length;
    const durationEstimateSec = Math.max(1.0, (audioByteLength - 44) / 48000);
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    return res.json({
      success: true,
      audioBase64: base64Audio,
      mimeType: 'audio/wav',
      durationSec: durationEstimateSec,
      wordCount,
    });
  } catch (error: any) {
    console.error('Error in /api/synthesize-speech:', error);
    return res.status(500).json({
      error: error?.message || 'Falha na síntese de áudio do leitor.',
    });
  }
});

// 8. Transcrição de Áudio do Microfone (Ditado Inteligente via Gemini 3.8 Flash)
app.post('/api/transcribe-audio', async (req, res) => {
  try {
    const { audioData, mimeType = 'audio/webm' } = req.body;

    if (!audioData) {
      return res.status(400).json({ error: 'Nenhum dado de áudio recebido para transcrição.' });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          inlineData: {
            mimeType: mimeType || 'audio/webm',
            data: audioData,
          },
        },
        {
          text: 'Transcreva este áudio com máxima fidelidade, pontuação natural e inteligente (vírgulas, pontos e parágrafos). Retorne estritamente o texto transcrito, sem preâmbulos, aspas extras ou explicações.',
        },
      ],
    });

    const transcript = response.text?.trim() || '';
    return res.json({
      success: true,
      transcript,
      wordCount: transcript.split(/\s+/).filter(Boolean).length,
    });
  } catch (error: any) {
    console.error('Error in /api/transcribe-audio:', error);
    return res.status(500).json({
      error: error?.message || 'Falha ao transcrever gravação do microfone.',
    });
  }
});

// ==========================================
// FastChunks: Endpoints de Treino de Idiomas
// ==========================================

// 1. Geração de Chunks Coloquiais via Gemini 3.8 Flash
app.post('/api/generate-chunks', async (req, res) => {
  try {
    const { textOrPrompt, language = 'en-US', count = 3 } = req.body;
    const userId = (req.headers['x-user-id'] as string) || 'anonymous-user';

    if (!textOrPrompt || typeof textOrPrompt !== 'string') {
      return res.status(400).json({ error: 'Texto ou intenção é obrigatório.' });
    }

    const langMap: Record<string, string> = {
      'en-US': 'Inglês falado nos Estados Unidos (coloquial americano contemporâneo)',
      'it-IT': 'Italiano falado na Itália (linguagem coloquial cotidiana, gírias e reações expressivas)',
      'ja-JP': 'Japonês falado no Japão (coloquial, aizuchi, expressões do dia a dia; obrigatório incluir romaji entre parênteses para pronúncia)',
    };

    const targetLangDesc = langMap[language] || 'Inglês coloquial';

    const systemPrompt = `Você é um linguista nativo de ${targetLangDesc} e especialista internacional no Método Lexical (Chunking / Formulaic Language).
Sua missão: a partir de uma ideia, situação informal ou texto de entrada, extrair ou criar exatamente ${count} blocos de fala natural (chunks coloquiais) prontos para a vida real.

Regras estritas:
1. NUNCA faça traduções literais de dicionário. Use frases que um falante nativo diria espontaneamente em uma conversa real.
2. Forneça o sentimento real / nuance em português do Brasil (ex: "Tô dentro", "Resumindo a ópera", "Nem esquenta").
3. Forneça um guia fonético aproximado simplificado em português (ex: "aim-dáun-fer-thæt", "ma fi-gú-ra-ti", "na-ru-ho-do-ne").
4. Se o idioma for japonês, coloque o texto nativo com kanji/kana seguido da romanização entre parênteses no campo chunk: ex: "なるほどね (Naruhodo ne)".`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Gere ${count} chunks coloquiais de alta fluência para a seguinte situação ou texto:\n"${textOrPrompt}"\n\nIdioma Alvo: ${language}`,
            },
          ],
        },
      ],
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            chunks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  chunk: {
                    type: Type.STRING,
                    description: 'Expressão ou frase nativa no idioma alvo (com romaji entre parênteses se japonês)',
                  },
                  literalOrNuance: {
                    type: Type.STRING,
                    description: 'Equivalente coloquial / sentimento real falado no Brasil',
                  },
                  meaning: {
                    type: Type.STRING,
                    description: 'Explicação concisa do contexto de uso e tom da frase',
                  },
                  context: {
                    type: Type.STRING,
                    description: 'Contexto social curto (ex: Casual entre amigos, Restaurante, Reação espontânea)',
                  },
                  pronunciationHint: {
                    type: Type.STRING,
                    description: 'Guia fonético simplificado aproximado para falantes de português',
                  },
                },
                required: ['chunk', 'literalOrNuance', 'meaning', 'context', 'pronunciationHint'],
              },
            },
          },
          required: ['chunks'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    const rawChunks = parsed.chunks || [];

    const generatedChunks: ChunkItem[] = rawChunks.map((item: any, idx: number) => ({
      id: `gen-${Date.now()}-${idx}-${randomUUID().slice(0, 6)}`,
      chunk: item.chunk,
      literalOrNuance: item.literalOrNuance,
      meaning: item.meaning,
      context: item.context,
      pronunciationHint: item.pronunciationHint,
      userId,
      isCustom: true,
      createdAt: Date.now(),
    }));

    for (const chunk of generatedChunks) {
      await chunkStorage.saveUserChunk(userId, chunk);
    }

    return res.json({
      success: true,
      chunks: generatedChunks,
    });
  } catch (error: any) {
    console.error('Error in /api/generate-chunks:', error);
    return res.status(500).json({
      error: error?.message || 'Falha ao gerar chunks com Gemini.',
    });
  }
});

// 2. Listar Chunks do Usuário
app.get('/api/chunks', async (req, res) => {
  try {
    const userId = (req.headers['x-user-id'] as string) || 'anonymous-user';
    const lang = req.query.lang as TargetLang | undefined;
    const userChunks = await chunkStorage.listUserChunks(userId, lang);
    return res.json({
      success: true,
      chunks: userChunks,
    });
  } catch (error: any) {
    console.error('Error in GET /api/chunks:', error);
    return res.status(500).json({
      error: error?.message || 'Falha ao buscar chunks do usuário.',
    });
  }
});

// 3. Salvar / Criar Chunk Manual
app.post('/api/chunks', async (req, res) => {
  try {
    const userId = (req.headers['x-user-id'] as string) || 'anonymous-user';
    const { chunk, literalOrNuance, meaning, context, pronunciationHint } = req.body;

    if (!chunk || !literalOrNuance || !meaning) {
      return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
    }

    const newChunk: ChunkItem = {
      id: req.body.id || `custom-${Date.now()}-${randomUUID().slice(0, 6)}`,
      chunk,
      literalOrNuance,
      meaning,
      context: context || 'Personalizado',
      pronunciationHint: pronunciationHint || '',
      userId,
      isCustom: true,
      createdAt: Date.now(),
    };

    await chunkStorage.saveUserChunk(userId, newChunk);
    return res.json({
      success: true,
      chunk: newChunk,
    });
  } catch (error: any) {
    console.error('Error in POST /api/chunks:', error);
    return res.status(500).json({
      error: error?.message || 'Falha ao salvar chunk.',
    });
  }
});

// 4. Remover Chunk Personalizado
app.delete('/api/chunks/:id', async (req, res) => {
  try {
    const userId = (req.headers['x-user-id'] as string) || 'anonymous-user';
    const chunkId = req.params.id;
    const deleted = await chunkStorage.deleteUserChunk(userId, chunkId);
    return res.json({
      success: true,
      deleted,
    });
  } catch (error: any) {
    console.error('Error in DELETE /api/chunks/:id:', error);
    return res.status(500).json({
      error: error?.message || 'Falha ao excluir chunk.',
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'DialecticPod & FastChunks API',
    modelTts: 'gemini-3.1-flash-tts-preview',
    modelGen: 'gemini-3.8-flash',
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
