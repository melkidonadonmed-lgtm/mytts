import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
import {
  getVoiceAcousticStyle,
  buildExpressiveTtsTranscript,
} from '../../utils/prosodyEngine';
import {
  capText,
  ensureWavContainer,
  formatGeminiError,
  buildFfmpegMixFilterComplex,
  ALLOWED_PREVIEW_VOICES,
  ALLOWED_PREVIEW_LANGS,
} from '../audioContainer';
import { synthesizeGeminiTtsWav } from '../geminiClient';
import {
  ROUTE_ALLOWED_KEYS,
  safeUnlinkTempFile,
  validateStrictPayload,
} from '../validators';

const execFileAsync = promisify(execFile);

const voicePreviewCache = new Map<string, { wavBase64: string; durationSec: number }>();

const VOICE_PREVIEW_EMOTIONS: Record<string, string> = {
  Puck: 'spontaneous',
  Kore: 'natural',
  Aoede: 'storytelling',
  Fenrir: 'resolute',
  Enceladus: 'thoughtful',
};

function buildExpressivePreviewPhrase(
  voiceId: string,
  speakerName: string,
  language: string
): string {
  const byVoicePtBr: Record<string, string> = {
    Puck: `<breath> Oi! Eu sou ${speakerName}. <chuckle> Percebe como a minha voz tem energia, ritmo vivo <short pause> e respiração natural de conversa real?`,
    Kore: `<breath> Olá, eu sou ${speakerName}. <short pause> Minha leitura combina clareza analítica, presença serena <breath> e entonação humana fluida.`,
    Aoede: `<breath> Olá... eu sou ${speakerName}. <short pause> Gosto de narrar cada ideia com calor humano, pausas suaves <sigh> e muita expressividade.`,
    Fenrir: `<breath> Olá, sou ${speakerName}. <short pause> Trago um timbre grave, firme e articulado, <breath> com peso vocal para debates intensos.`,
    Enceladus: `<heavy breath> Olá... sou ${speakerName}. <short pause> Minha voz tem textura íntima de estúdio, respiração próxima <sigh> e calma reflexiva.`,
  };

  const byVoiceEnUs: Record<string, string> = {
    Puck: `<breath> Hey there! I'm ${speakerName}. <chuckle> Notice how my voice brings lively rhythm, spontaneous warmth, <short pause> and natural human breathing?`,
    Kore: `<breath> Hello, I'm ${speakerName}. <short pause> My delivery blends poised clarity, balanced warmth, <breath> and authentic studio articulation.`,
    Aoede: `<breath> Hello... I'm ${speakerName}. <short pause> I love shaping every story with velvety warmth, gentle pauses, <sigh> and deep emotion.`,
    Fenrir: `<breath> Hello, I'm ${speakerName}. <short pause> I bring a deep, resonant baritone presence <breath> with grounded authority and clear cadence.`,
    Enceladus: `<heavy breath> Hello... I'm ${speakerName}. <short pause> My voice carries an intimate close-mic texture, soft breathing, <sigh> and quiet reflection.`,
  };

  const byVoiceItIt: Record<string, string> = {
    Puck: `<breath> Ciao! Sono ${speakerName}. <chuckle> Senti come la mia voce ha ritmo vivo, calore spontaneo <short pause> e un respiro davvero naturale?`,
    Kore: `<breath> Ciao, sono ${speakerName}. <short pause> La mia voce unisce chiarezza, equilibrio <breath> e un'intonazione italiana autentica.`,
    Aoede: `<breath> Ciao... sono ${speakerName}. <short pause> Amo raccontare ogni storia con calore, pause morbide <sigh> e profonda espressività.`,
    Fenrir: `<breath> Ciao, sono ${speakerName}. <short pause> Porto un timbro profondo, deciso e autorevole, <breath> ideale per il confronto dialettico.`,
    Enceladus: `<heavy breath> Ciao... sono ${speakerName}. <short pause> La mia voce ha una sfumatura intima da studio, respiro vicino <sigh> e calma riflessiva.`,
  };

  const byVoiceJaJp: Record<string, string> = {
    Puck: `<breath> こんにちは、${speakerName}です！ <chuckle> 自然な息遣いと、生き生きとした会話のリズムを感じていただけますか？`,
    Kore: `<breath> こんにちは、${speakerName}です。 <short pause> 明瞭で落ち着いたトーンと、自然な間の取り方で丁寧にお伝えします。`,
    Aoede: `<breath> こんにちは… ${speakerName}です。 <short pause> 温かみのある表現と、豊かな感情を込めて物語をお届けします。`,
    Fenrir: `<breath> こんにちは、${speakerName}です。 <short pause> 深みのある落ち着いた響きで、説得力のある対話を表現します。`,
    Enceladus: `<heavy breath> こんにちは… ${speakerName}です。 <short pause> すぐそばで語りかけるような、静かで親密な息遣いをお聴きください。`,
  };

  if (language === 'en-US' || language === 'en') {
    return byVoiceEnUs[voiceId] || byVoiceEnUs.Puck;
  }
  if (language === 'it-IT' || language === 'it') {
    return byVoiceItIt[voiceId] || byVoiceItIt.Puck;
  }
  if (language === 'ja-JP' || language === 'ja') {
    return byVoiceJaJp[voiceId] || byVoiceJaJp.Puck;
  }
  return byVoicePtBr[voiceId] || byVoicePtBr.Puck;
}

export function createTtsRouter(): Router {
  const router = Router();

  router.post('/api/synthesize-turn', async (req, res) => {
    try {
      const check = validateStrictPayload<{
        turn?: {
          turn?: number;
          speaker?: string;
          voice_id?: string;
          emotion?: string;
          text?: string;
          prosody?: { speech_rate?: number; breath_sound?: boolean };
        };
        speakerName?: string;
        voiceId?: string;
        language?: string;
      }>(req.body, ROUTE_ALLOWED_KEYS.synthesizeTurn);
      if (!check.ok) {
        return res.status(400).json({ error: check.error });
      }

      const { turn, speakerName, voiceId, language = 'pt-BR' } = check.data;
      if (!turn || typeof turn.text !== 'string' || !turn.text.trim()) {
        return res.status(400).json({ error: 'Dados do turno inválidos.' });
      }

      const effectiveVoice = voiceId || turn.voice_id || 'Kore';
      const effectiveSpeaker = speakerName || turn.speaker || effectiveVoice;
      const effectiveLang = typeof language === 'string' && language ? language : 'pt-BR';
      const speechRate = Number(turn.prosody?.speech_rate) || 1.0;
      const turnEmotion = typeof turn.emotion === 'string' && turn.emotion ? turn.emotion : 'natural';

      const voiceAcousticStyle = getVoiceAcousticStyle(
        effectiveVoice,
        turnEmotion,
        speechRate,
        effectiveLang
      );

      let expressiveTranscript = buildExpressiveTtsTranscript(capText(String(turn.text), 5000), {
        enabled: true,
        speed: speechRate,
        language: effectiveLang,
        emotion: turnEmotion,
        injectNaturalBreaths: true,
      });

      if (
        turn.prosody?.breath_sound &&
        !/^<(?:breath|heavy breath|sigh|short pause|long pause)/i.test(expressiveTranscript)
      ) {
        expressiveTranscript = `<breath> ${expressiveTranscript}`;
      }

      const stylePrompt = `${voiceAcousticStyle} Dialogue context: Speaking as ${effectiveSpeaker} in a live, dynamic multi-speaker conversation with natural turn-taking, authentic emotional inflection, and realistic human breathing.`;

      const { wavBase64, durationSec } = await synthesizeGeminiTtsWav(
        expressiveTranscript,
        effectiveVoice,
        { speakerName: effectiveSpeaker, stylePrompt }
      );

      return res.json({
        success: true,
        turnNumber: turn.turn,
        audioBase64: wavBase64,
        mimeType: 'audio/wav',
        durationSec,
      });
    } catch (error: unknown) {
      console.error('Error in /api/synthesize-turn:', error);
      return res.status(500).json({
        error: formatGeminiError(error, 'Falha na síntese de áudio do turno.'),
      });
    }
  });

  router.post('/api/mix-audio', async (req, res) => {
    let tempVoicePath: string | null = null;
    let tempMusicPath: string | null = null;
    let tempOutputPath: string | null = null;

    try {
      const check = validateStrictPayload<{
        voiceAudioBase64?: string;
        soundtrackPreset?: string;
        musicVolume?: number;
        duckingDepthDb?: number;
        voiceBoostDb?: number;
        customMusicBase64?: string;
      }>(req.body, ROUTE_ALLOWED_KEYS.mixAudio);
      if (!check.ok) {
        return res.status(400).json({ error: check.error });
      }

      const {
        voiceAudioBase64,
        soundtrackPreset = 'lofi-warmth',
        musicVolume = 0.2,
        duckingDepthDb = -14,
        voiceBoostDb = 3,
        customMusicBase64,
      } = check.data;

      if (!voiceAudioBase64 || typeof voiceAudioBase64 !== 'string') {
        return res.status(400).json({ error: 'Nenhum áudio de voz fornecido para mixagem.' });
      }

      if (soundtrackPreset === 'none' && !customMusicBase64) {
        return res.json({
          success: true,
          audioBase64: ensureWavContainer(voiceAudioBase64, 24000),
          mimeType: 'audio/wav',
        });
      }

      const tempId = randomUUID();
      tempVoicePath = path.join(os.tmpdir(), `mytts_voice_${tempId}.wav`);
      tempOutputPath = path.join(os.tmpdir(), `mytts_master_${tempId}.wav`);

      const voiceWavBuffer = Buffer.from(ensureWavContainer(voiceAudioBase64, 24000), 'base64');
      await fs.promises.writeFile(tempVoicePath, voiceWavBuffer);

      const safeVoiceBoostDb = Math.max(-6, Math.min(12, Number(voiceBoostDb) || 0));
      const safeDuckingDepthDb = Math.max(-24, Math.min(0, Number(duckingDepthDb) || -14));
      const ratio = Math.max(2, Math.min(20, Math.round(Math.abs(safeDuckingDepthDb) / 2.3)));
      const voiceVol = Math.pow(10, safeVoiceBoostDb / 20).toFixed(2);
      const bgVol = Math.max(0.01, Math.min(1.0, Number(musicVolume) || 0.2)).toFixed(2);

      const filterComplex = buildFfmpegMixFilterComplex(voiceVol, bgVol, ratio);
      let ffmpegArgs: string[] = [];

      if (customMusicBase64 && typeof customMusicBase64 === 'string') {
        tempMusicPath = path.join(os.tmpdir(), `mytts_music_${tempId}.wav`);
        const musicBuf = Buffer.from(customMusicBase64, 'base64');
        await fs.promises.writeFile(tempMusicPath, musicBuf);

        ffmpegArgs = [
          '-y',
          '-i', tempVoicePath,
          '-stream_loop', '-1',
          '-i', tempMusicPath,
          '-filter_complex', filterComplex,
          '-map', '[out]',
          '-c:a', 'pcm_s16le',
          '-ar', '44100',
          tempOutputPath,
        ];
      } else {
        const synthTone =
          soundtrackPreset === 'deep-focus'
            ? 'sine=frequency=432:sample_rate=44100'
            : soundtrackPreset === 'cinematic-pulse'
            ? 'sine=frequency=55:sample_rate=44100'
            : 'sine=frequency=220:sample_rate=44100';

        ffmpegArgs = [
          '-y',
          '-i', tempVoicePath,
          '-f', 'lavfi',
          '-i', synthTone,
          '-filter_complex', filterComplex,
          '-map', '[out]',
          '-c:a', 'pcm_s16le',
          '-ar', '44100',
          tempOutputPath,
        ];
      }

      try {
        await execFileAsync('ffmpeg', ffmpegArgs);
        const outputBuffer = await fs.promises.readFile(tempOutputPath);
        return res.json({
          success: true,
          audioBase64: outputBuffer.toString('base64'),
          mimeType: 'audio/wav',
        });
      } catch (ffmpegErr: unknown) {
        console.warn(
          'FFmpeg mix fallback to direct voiceover:',
          ffmpegErr instanceof Error ? ffmpegErr.message : ffmpegErr
        );
        return res.json({
          success: true,
          audioBase64: ensureWavContainer(voiceAudioBase64, 24000),
          mimeType: 'audio/wav',
          warning: 'FFmpeg não disponível; retornado áudio de voz direto.',
        });
      }
    } catch (error: unknown) {
      console.error('Error in /api/mix-audio:', error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Falha ao realizar a mixagem de estúdio.',
      });
    } finally {
      await Promise.all([
        safeUnlinkTempFile(tempVoicePath),
        safeUnlinkTempFile(tempMusicPath),
        safeUnlinkTempFile(tempOutputPath),
      ]);
    }
  });

  router.post('/api/preview-voice', async (req, res) => {
    try {
      const check = validateStrictPayload<{
        voiceId?: string;
        language?: string;
        speakerName?: string;
      }>(req.body ?? {}, ROUTE_ALLOWED_KEYS.previewVoice);
      if (!check.ok) {
        return res.status(400).json({ error: check.error });
      }

      const rawVoiceId = typeof check.data.voiceId === 'string' ? check.data.voiceId : 'Puck';
      const rawLanguage = typeof check.data.language === 'string' ? check.data.language : 'pt-BR';
      const voiceId = ALLOWED_PREVIEW_VOICES.has(rawVoiceId) ? rawVoiceId : 'Puck';
      const language = ALLOWED_PREVIEW_LANGS.has(rawLanguage) ? rawLanguage : 'pt-BR';
      const speakerName =
        typeof check.data.speakerName === 'string' && check.data.speakerName.trim()
          ? capText(check.data.speakerName.trim(), 40)
          : voiceId;
      const cacheKey = `${voiceId}_${language}_${speakerName}`;

      const cachedPreview = voicePreviewCache.get(cacheKey);
      if (cachedPreview) {
        return res.json({
          success: true,
          audioBase64: cachedPreview.wavBase64,
          mimeType: 'audio/wav',
          durationSec: cachedPreview.durationSec,
        });
      }

      const phrase = buildExpressivePreviewPhrase(voiceId, speakerName, language);
      const previewEmotion = VOICE_PREVIEW_EMOTIONS[voiceId] || 'natural';
      const stylePrompt = getVoiceAcousticStyle(voiceId, previewEmotion, 1.0, language);

      const { wavBase64, durationSec } = await synthesizeGeminiTtsWav(phrase, voiceId, {
        speakerName,
        stylePrompt,
      });
      voicePreviewCache.set(cacheKey, { wavBase64, durationSec });

      return res.json({
        success: true,
        audioBase64: wavBase64,
        mimeType: 'audio/wav',
        durationSec,
      });
    } catch (error: unknown) {
      console.error('Error in /api/preview-voice:', error);
      return res.status(500).json({
        error: formatGeminiError(error, 'Falha ao gerar preview da voz.'),
      });
    }
  });

  router.post('/api/synthesize-chunk', async (req, res) => {
    try {
      const check = validateStrictPayload<{
        text?: string;
        language?: string;
        voiceId?: string;
      }>(req.body, ROUTE_ALLOWED_KEYS.synthesizeChunk);
      if (!check.ok) {
        return res.status(400).json({ error: check.error });
      }

      const { text, language = 'en-US', voiceId } = check.data;
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Texto do chunk é obrigatório.' });
      }

      const defaultVoices: Record<string, string> = {
        'en-US': 'Puck',
        'it-IT': 'Fenrir',
        'ja-JP': 'Aoede',
      };

      const selectedVoice = voiceId || defaultVoices[language] || 'Puck';
      const cleanText = capText(text, 2000).replace(/\(.*?\)/g, '').trim();
      const expressiveChunk = buildExpressiveTtsTranscript(cleanText, {
        enabled: true,
        language,
        emotion: 'spontaneous',
        injectNaturalBreaths: true,
      });
      const stylePrompt = getVoiceAcousticStyle(selectedVoice, 'spontaneous', 1.0, language);

      const { wavBase64 } = await synthesizeGeminiTtsWav(expressiveChunk, selectedVoice, {
        speakerName: selectedVoice,
        stylePrompt,
      });

      return res.json({
        success: true,
        audioBase64: wavBase64,
        mimeType: 'audio/wav',
      });
    } catch (error: unknown) {
      console.error('Error in /api/synthesize-chunk:', error);
      return res.status(500).json({
        error: formatGeminiError(error, 'Falha na síntese do chunk.'),
      });
    }
  });

  router.post('/api/synthesize-speech', async (req, res) => {
    try {
      const check = validateStrictPayload<{
        text?: string;
        voiceId?: string;
        emotion?: string;
        speed?: number;
        autoProsody?: boolean;
        language?: string;
      }>(req.body, ROUTE_ALLOWED_KEYS.synthesizeSpeech);
      if (!check.ok) {
        return res.status(400).json({ error: check.error });
      }

      const {
        text,
        voiceId,
        emotion = 'natural',
        speed = 1.0,
        autoProsody = true,
        language = 'pt-BR',
      } = check.data;

      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return res.status(400).json({ error: 'O texto para leitura é obrigatório.' });
      }

      const resolvedVoiceId =
        voiceId ||
        (language === 'it-IT' || language === 'it'
          ? 'Kore'
          : language === 'ja-JP' || language === 'ja'
            ? 'Aoede'
            : 'Puck');

      const stylePrompt = getVoiceAcousticStyle(resolvedVoiceId, emotion, speed, language);
      const expressiveTranscript = buildExpressiveTtsTranscript(capText(text), {
        enabled: autoProsody,
        speed,
        language,
        emotion,
        injectNaturalBreaths: autoProsody,
      });

      const { wavBase64, durationSec } = await synthesizeGeminiTtsWav(
        expressiveTranscript,
        resolvedVoiceId,
        { speakerName: resolvedVoiceId, stylePrompt }
      );
      const wordCount = text.split(/\s+/).filter(Boolean).length;

      return res.json({
        success: true,
        audioBase64: wavBase64,
        mimeType: 'audio/wav',
        durationSec,
        wordCount,
      });
    } catch (error: unknown) {
      console.error('Error in /api/synthesize-speech:', error);
      return res.status(500).json({
        error: formatGeminiError(error, 'Falha na síntese de áudio do leitor.'),
      });
    }
  });

  return router;
}
