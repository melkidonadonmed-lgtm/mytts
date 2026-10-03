import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Sparkles, 
  BookOpen, 
  RotateCcw, 
  Download, 
  MessageSquare,
  Globe,
  Radio,
  Check
} from 'lucide-react';
import { PolyglotMessage, AlignedChunk, FlashcardItem } from '../types/polyglot';
import { ParallelMessageBlock } from './ParallelMessageBlock';
import { AgentInputDock } from './AgentInputDock';
import { FlashcardDeckDrawer } from './FlashcardDeckDrawer';
import { base64ToBlobUrl, revokeAudioUrl } from '../utils/audio';

// Mensagem inicial de exemplo para o usuário ver a experiência multi-pane imediatamente
const INITIAL_DEMO_MESSAGE: PolyglotMessage = {
  id: 'msg-demo-1',
  userPrompt: 'Gostaria de pedir um café expresso e a conta com gentileza.',
  timestamp: Date.now() - 60000,
  chunks: [
    {
      id: 0,
      en: 'Could I please get an espresso,',
      it: 'Potrei avere un caffè espresso, per favore,',
      ja: 'エスプレッソを一杯お願いします、',
      jaPronunciation: 'Esupuresso o ippai onegai shimasu,',
    },
    {
      id: 1,
      en: 'and the check whenever you are ready?',
      it: 'e il conto quando è pronto?',
      ja: 'そしてお会計もお願いできますか？',
      jaPronunciation: 'soshite okaikei mo onegai dekimasu ka?',
    },
  ],
  fullText: {
    en: 'Could I please get an espresso, and the check whenever you are ready?',
    it: 'Potrei avere un caffè espresso, per favore, e il conto quando è pronto?',
    ja: 'エスプレッソを一杯お願いします、そしてお会計もお願いできますか？',
  },
  status: 'ready',
};

export const PolyglotChatStudio: React.FC = () => {
  const [messages, setMessages] = useState<PolyglotMessage[]>([INITIAL_DEMO_MESSAGE]);
  const [isLoading, setIsLoading] = useState(false);
  const [deck, setDeck] = useState<FlashcardItem[]>(() => {
    try {
      const saved = localStorage.getItem('mytts_polyglot_deck');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isDeckDrawerOpen, setIsDeckDrawerOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Estados de áudio
  const [playingAudioKey, setPlayingAudioKey] = useState<string | null>(null);
  const [generatingCardKey, setGeneratingCardKey] = useState<string | null>(null);
  const activeAudioRef = useRef<{ audio: HTMLAudioElement; blobUrl: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Salvar deck no localStorage
  useEffect(() => {
    try {
      localStorage.setItem('mytts_polyglot_deck', JSON.stringify(deck));
    } catch (e) {
      console.warn('Erro ao salvar deck no localStorage:', e);
    }
  }, [deck]);

  // Rolar para a última mensagem ao adicionar conteúdo
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Parar áudio em execução com limpeza segura de memória
  const stopCurrentAudio = useCallback(() => {
    if (activeAudioRef.current) {
      activeAudioRef.current.audio.pause();
      revokeAudioUrl(activeAudioRef.current.blobUrl);
      activeAudioRef.current = null;
    }
    setPlayingAudioKey(null);
  }, []);

  // Envio de nova mensagem para alinhamento em 3 línguas
  const handleSendMessage = async (text: string) => {
    const newMessageId = `msg-${Date.now()}`;
    const placeholderMessage: PolyglotMessage = {
      id: newMessageId,
      userPrompt: text,
      timestamp: Date.now(),
      chunks: [],
      fullText: { en: '', it: '', ja: '' },
      status: 'loading',
    };

    setMessages((prev) => [...prev, placeholderMessage]);
    setIsLoading(true);

    try {
      const resp = await fetch('/api/translate-parallel-chunks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Falha ao processar os chunks paralelos.');
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === newMessageId
            ? {
                ...msg,
                chunks: data.chunks,
                fullText: data.fullText,
                status: 'ready',
              }
            : msg
        )
      );
    } catch (err: any) {
      console.error(err);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === newMessageId
            ? {
                ...msg,
                status: 'error',
                error: err.message || 'Erro de conexão com o Gemini.',
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Reprodução de chunk individual com sotaque nativo
  const handlePlayChunkAudio = async (text: string, language: string) => {
    stopCurrentAudio();
    setPlayingAudioKey(text);

    try {
      const resp = await fetch('/api/synthesize-chunk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language }),
      });

      const data = await resp.json();
      if (data.success && data.audioBase64) {
        const blobUrl = base64ToBlobUrl(data.audioBase64, 'audio/wav');
        const audio = new Audio(blobUrl);
        activeAudioRef.current = { audio, blobUrl };

        audio.onended = () => stopCurrentAudio();
        audio.onerror = () => stopCurrentAudio();
        await audio.play();
      } else {
        throw new Error(data.error || 'Falha ao reproduzir áudio.');
      }
    } catch (e: any) {
      console.warn('Erro ao tocar áudio do chunk:', e);
      stopCurrentAudio();
    }
  };

  // Reprodução do texto completo de uma coluna
  const handlePlayFullText = async (
    text: string,
    language: string,
    voiceId: string,
    speed: number
  ) => {
    stopCurrentAudio();
    const playKey = `${text.slice(0, 20)}-full`;
    setPlayingAudioKey(playKey);

    try {
      const resp = await fetch('/api/synthesize-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voiceId,
          language,
          speed,
          emotion: 'natural',
        }),
      });

      const data = await resp.json();
      if (data.success && data.audioBase64) {
        const blobUrl = base64ToBlobUrl(data.audioBase64, 'audio/wav');
        const audio = new Audio(blobUrl);
        audio.playbackRate = speed;
        activeAudioRef.current = { audio, blobUrl };

        audio.onended = () => stopCurrentAudio();
        audio.onerror = () => stopCurrentAudio();
        await audio.play();
      } else {
        throw new Error(data.error || 'Falha ao sintetizar coluna.');
      }
    } catch (e) {
      console.warn('Erro ao tocar áudio da coluna:', e);
      stopCurrentAudio();
    }
  };

  // Geração de Flashcard via Gemini 3.8 Flash
  const handleCreateFlashcard = async (chunkText: string, language: string) => {
    setGeneratingCardKey(chunkText);

    try {
      const resp = await fetch('/api/generate-flashcard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chunkText, language }),
      });

      const data = await resp.json();
      if (data.success && data.card) {
        setDeck((prev) => [data.card, ...prev]);
        showToast(`Flashcard "${chunkText}" adicionado ao seu Deck!`);
      } else {
        throw new Error(data.error || 'Falha ao criar flashcard.');
      }
    } catch (e: any) {
      console.error(e);
      alert('Erro ao criar flashcard: ' + e.message);
    } finally {
      setGeneratingCardKey(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-950 text-slate-100 font-sans">
      
      {/* 1. Header do Estúdio Poliglota */}
      <header className="sticky top-0 z-10 bg-slate-950/85 backdrop-blur-xl border-b border-slate-800/80 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-400">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
              <span>Chat Poliglota Multimodal</span>
              <span className="text-[10px] font-mono bg-emerald-400/15 text-emerald-300 border border-emerald-400/25 px-2 py-0.2 rounded-full">
                🇺🇸 EN • 🇮🇹 IT • 🇯🇵 JA
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">
              Tradução paralela em chunks interativos com sotaque neural nativo
            </p>
          </div>
        </div>

        {/* Botão de Acesso ao Deck de Flashcards */}
        <button
          onClick={() => setIsDeckDrawerOpen(true)}
          className="min-h-[36px] px-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-400/50 hover:bg-slate-850 text-xs font-semibold text-slate-200 flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95"
        >
          <BookOpen className="w-3.5 h-3.5 text-amber-400" />
          <span>Meu Deck</span>
          <span className="bg-amber-400 text-slate-950 font-bold px-1.5 py-0.2 rounded-full text-[10px] font-mono">
            {deck.length}
          </span>
        </button>
      </header>

      {/* 2. Toast de Feedback Suave */}
      {toastMessage && (
        <div className="fixed top-16 right-4 z-40 bg-emerald-950/90 border border-emerald-600/80 text-emerald-200 px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow-xl animate-in fade-in slide-in-from-top-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 3. Feed de Mensagens do Chat (Canvas Multi-Pane) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 pb-28 flex flex-col gap-6">
        {messages.map((message) => (
          <ParallelMessageBlock
            key={message.id}
            message={message}
            onPlayChunkAudio={handlePlayChunkAudio}
            onPlayFullText={handlePlayFullText}
            onCreateFlashcard={handleCreateFlashcard}
            playingAudioKey={playingAudioKey}
            generatingCardKey={generatingCardKey}
          />
        ))}
        <div ref={messagesEndRef} />
      </main>

      {/* 4. Dock Inferior Multimodal (Agent Input Dock) */}
      <AgentInputDock
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
      />

      {/* 5. Gaveta Lateral Retrátil de Flashcards */}
      <FlashcardDeckDrawer
        isOpen={isDeckDrawerOpen}
        onClose={() => setIsDeckDrawerOpen(false)}
        cards={deck}
        onDeleteCard={(id) => setDeck((prev) => prev.filter((c) => c.id !== id))}
        onClearDeck={() => setDeck([])}
        onPlayCardAudio={handlePlayChunkAudio}
      />
    </div>
  );
};
