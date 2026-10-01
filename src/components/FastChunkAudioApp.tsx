import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Volume2, 
  RotateCcw, 
  Sparkles, 
  Play, 
  Pause, 
  Copy, 
  Check, 
  Search,
  BookOpen,
  Plus,
  Trash2,
  X,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { ChunkItem, TargetLang } from '../types/chunks';
import { base64ToBlobUrl, revokeAudioUrl } from '../utils/audio';

// Banco inicial offline para teste imediato de alta fluência
const CHUNK_PRESETS: Record<TargetLang, Record<string, ChunkItem[]>> = {
  'en-US': {
    geral: [
      {
        id: 'en-1',
        chunk: "I'm down for that.",
        literalOrNuance: "Tô dentro / topo na hora",
        meaning: "Usado para concordar imediatamente com um plano ou convite de forma bem natural.",
        context: "Casual entre amigos",
        pronunciationHint: "aim-dáun-fer-thæt"
      },
      {
        id: 'en-2',
        chunk: "Long story short...",
        literalOrNuance: "Resumindo a ópera...",
        meaning: "Corta os detalhes chatos de um relato longo e vai direto ao ponto central.",
        context: "Transição de conversa",
        pronunciationHint: "lóng-stóri-shórt"
      },
      {
        id: 'en-3',
        chunk: "Don't sweat it.",
        literalOrNuance: "Esquenta a cabeça não / rlx",
        meaning: "Equivalente mais solto e coloquial para 'you're welcome' ou 'no problem'.",
        context: "Alívio de tensão / agradecimento",
        pronunciationHint: "dôunt-suét-it"
      },
      {
        id: 'en-4',
        chunk: "Fair enough.",
        literalOrNuance: "Justo / faz sentido",
        meaning: "Concordância rápida mesmo quando você não concorda 100%, mas respeita a lógica do outro.",
        context: "Debates e alinhamento",
        pronunciationHint: "fér-i-nâf"
      }
    ]
  },
  'it-IT': {
    geral: [
      {
        id: 'it-1',
        chunk: "Ma figurati!",
        literalOrNuance: "Imagina! / Que nada!",
        meaning: "Resposta coloquial para desfazer formalidades quando alguém agradece ou pede desculpas.",
        context: "Dia a dia italiano",
        pronunciationHint: "ma fi-gú-ra-ti"
      },
      {
        id: 'it-2',
        chunk: "Ci sta.",
        literalOrNuance: "Faz sentido / combina / topo",
        meaning: "Gíria moderna universal usada para aprovar uma ideia, plano ou combinação.",
        context: "Jovens e informal",
        pronunciationHint: "tchi-stá"
      },
      {
        id: 'it-3',
        chunk: "Meno male!",
        literalOrNuance: "Ainda bem! / Menos mal!",
        meaning: "Expressão de alívio puro ao ouvir uma notícia positiva ou solução de problema.",
        context: "Reação espontânea",
        pronunciationHint: "mé-no má-le"
      },
      {
        id: 'it-4',
        chunk: "Che ne pensi?",
        literalOrNuance: "O que você acha disso?",
        meaning: "Puxador de conversa clássico e ágil para passar a bola de volta ao interlocutor.",
        context: "Engajamento de fala",
        pronunciationHint: "ke ne pén-si"
      }
    ]
  },
  'ja-JP': {
    geral: [
      {
        id: 'ja-1',
        chunk: "なるほどね (Naruhodo ne)",
        literalOrNuance: "Ah, entendi / faz sentido total",
        meaning: "Aizuchi (reação auditiva) indispensável para mostrar que você está ouvindo com atenção.",
        context: "Conversação natural",
        pronunciationHint: "na-ru-ho-do-ne"
      },
      {
        id: 'ja-2',
        chunk: "とりあえず (Toriaezu)",
        literalOrNuance: "Por enquanto / pra começar...",
        meaning: "Usado para tomar uma decisão rápida sem compromisso definitivo (ex: 'vamos pedir isso primeiro').",
        context: "Restaurantes e decisões",
        pronunciationHint: "to-ri-a-e-zu"
      },
      {
        id: 'ja-3',
        chunk: "お疲れ様！ (Otsukaresama!)",
        literalOrNuance: "Bom trabalho / valeu por hoje!",
        meaning: "A saudação de encerramento mais natural do japonês após qualquer esforço conjunto.",
        context: "Trabalho, estudos e academia",
        pronunciationHint: "o-tsu-ka-re-sa-ma"
      },
      {
        id: 'ja-4',
        chunk: "気にしないで (Ki ni shinaide)",
        literalOrNuance: "Não esquenta com isso / relaxa",
        meaning: "Maneira calorosa e suave de dizer 'não foi nada' para alguém que se desculpou.",
        context: "Informal e acolhedor",
        pronunciationHint: "ki ni shi-nai-de"
      }
    ]
  }
};

export const FastChunkAudioApp: React.FC = () => {
  const [selectedLang, setSelectedLang] = useState<TargetLang>('en-US');
  const [searchTerm, setSearchTerm] = useState('');
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [loopDrillId, setLoopDrillId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Estado de Chunks Customizados persistidos no Backend
  const [customChunks, setCustomChunks] = useState<ChunkItem[]>([]);
  const [isLoadingBackend, setIsLoadingBackend] = useState(false);

  // Cache e estado de síntese neural Gemini (Director's Chair TTS)
  const [neuralAudioMap, setNeuralAudioMap] = useState<Record<string, string>>({});
  const [loadingNeuralId, setLoadingNeuralId] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Modal de Ingestão / Geração por IA
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const loopTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Identificador Anônimo de Dispositivo (Persistente no navegador)
  const userId = useMemo(() => {
    try {
      const stored = localStorage.getItem('fastchunks_user_id');
      if (stored) return stored;
      const newId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('fastchunks_user_id', newId);
      return newId;
    } catch {
      return 'guest-user';
    }
  }, []);

  // Idiomas disponíveis com bandeiras e identificadores
  const languages: { code: TargetLang; label: string; flag: string }[] = [
    { code: 'en-US', label: 'Inglês', flag: '🇺🇸' },
    { code: 'it-IT', label: 'Italiano', flag: '🇮🇹' },
    { code: 'ja-JP', label: 'Japonês', flag: '🇯🇵' },
  ];

  // Interrompe o áudio caso o componente desmonte ou mude de idioma
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
      if (loopTimerRef.current) clearTimeout(loopTimerRef.current);
    };
  }, [selectedLang]);

  // Modern Web Guidance: Pré-carregamento assíncrono de vozes do sintetizador
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      const onVoicesChanged = () => {
        window.speechSynthesis.getVoices();
      };
      window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
      return () => window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
    }
  }, []);

  // Modern Web Guidance: Pausa segura de áudio e loop drill quando a aba fica em segundo plano
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        window.speechSynthesis?.cancel();
        if (loopTimerRef.current) clearTimeout(loopTimerRef.current);
        setLoopDrillId(null);
        setSpeakingId(null);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Modern Web Guidance: Tecla Escape para fechamento acessível de modal
  useEffect(() => {
    if (!isModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  // Carregar chunks do backend para o usuário atual
  const fetchUserChunks = useCallback(async () => {
    try {
      setIsLoadingBackend(true);
      const res = await fetch(`/api/chunks?lang=${selectedLang}`, {
        headers: { 'X-User-Id': userId },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.chunks) {
          setCustomChunks(data.chunks);
        }
      }
    } catch (err) {
      console.warn('Falha ao carregar chunks da nuvem:', err);
    } finally {
      setIsLoadingBackend(false);
    }
  }, [selectedLang, userId]);

  useEffect(() => {
    fetchUserChunks();
  }, [fetchUserChunks]);

  // Função central de reprodução de voz via Web Speech API nativa (sem necessidade de API key)
  const speakChunk = (text: string, id: string, onEndCallback?: () => void) => {
    if (!('speechSynthesis' in window)) {
      alert('Seu navegador não suporta síntese de voz nativa.');
      return;
    }

    window.speechSynthesis.cancel();

    // Remove parênteses com romanização (ex: em japonês) para tocar apenas o idioma nativo limpo
    const cleanText = text.replace(/\(.*?\)/g, '').trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = selectedLang;
    utterance.rate = playbackRate;
    utterance.pitch = 1.0;

    setSpeakingId(id);

    utterance.onend = () => {
      setSpeakingId(null);
      if (onEndCallback) onEndCallback();
    };

    utterance.onerror = () => {
      setSpeakingId(null);
      if (loopTimerRef.current) clearTimeout(loopTimerRef.current);
      setLoopDrillId(null);
    };

    window.speechSynthesis.speak(utterance);
  };

  // Reprodução de Áudio Ultra-Realista via Gemini 3.1 Flash TTS (Director's Chair)
  const speakNeuralChunk = async (text: string, id: string) => {
    window.speechSynthesis?.cancel();
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }

    try {
      if (neuralAudioMap[id]) {
        const blobUrl = base64ToBlobUrl(neuralAudioMap[id], 'audio/wav');
        const audio = new Audio(blobUrl);
        audio.playbackRate = playbackRate;
        audioPlayerRef.current = audio;
        setSpeakingId(id);
        audio.onended = () => {
          setSpeakingId(null);
          revokeAudioUrl(blobUrl);
        };
        audio.onerror = () => {
          setSpeakingId(null);
          revokeAudioUrl(blobUrl);
        };
        await audio.play();
        return;
      }

      setLoadingNeuralId(id);
      const res = await fetch('/api/synthesize-chunk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language: selectedLang }),
      });
      const data = await res.json();
      if (data.success && data.audioBase64) {
        setNeuralAudioMap((prev) => ({ ...prev, [id]: data.audioBase64 }));
        const blobUrl = base64ToBlobUrl(data.audioBase64, 'audio/wav');
        const audio = new Audio(blobUrl);
        audio.playbackRate = playbackRate;
        audioPlayerRef.current = audio;
        setSpeakingId(id);
        audio.onended = () => {
          setSpeakingId(null);
          revokeAudioUrl(blobUrl);
        };
        audio.onerror = () => {
          setSpeakingId(null);
          revokeAudioUrl(blobUrl);
        };
        await audio.play();
      } else {
        // Fallback gracioso para Web Speech
        speakChunk(text, id);
      }
    } catch (err) {
      console.warn('Fallback para Web Speech nativo:', err);
      speakChunk(text, id);
    } finally {
      setLoadingNeuralId(null);
    }
  };

  // Alterna o modo Drill (looping contínuo com pausa de 1.8s para shadowing)
  const toggleLoopDrill = (chunkText: string, id: string) => {
    if (loopDrillId === id) {
      if (loopTimerRef.current) clearTimeout(loopTimerRef.current);
      window.speechSynthesis.cancel();
      setLoopDrillId(null);
      setSpeakingId(null);
      return;
    }

    if (loopTimerRef.current) clearTimeout(loopTimerRef.current);
    setLoopDrillId(id);

    const runLoop = () => {
      speakChunk(chunkText, id, () => {
        loopTimerRef.current = setTimeout(() => {
          runLoop();
        }, 1800);
      });
    };

    runLoop();
  };

  // Copia o chunk para a área de transferência
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // Excluir chunk customizado
  const handleDeleteCustomChunk = async (id: string) => {
    try {
      const res = await fetch(`/api/chunks/${id}`, {
        method: 'DELETE',
        headers: { 'X-User-Id': userId },
      });
      if (res.ok) {
        setCustomChunks((prev) => prev.filter((c) => c.id !== id));
      }
    } catch (err) {
      console.error('Erro ao deletar chunk:', err);
    }
  };

  // Gerar Chunks via Gemini 3.8 Flash
  const handleGenerateChunks = async () => {
    if (!inputText.trim()) return;
    setIsGenerating(true);
    setGenerateError(null);

    try {
      const res = await fetch('/api/generate-chunks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId,
        },
        body: JSON.stringify({
          textOrPrompt: inputText.trim(),
          language: selectedLang,
          count: 3,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao gerar blocos coloquiais.');
      }

      const newChunks: ChunkItem[] = data.chunks || [];
      setCustomChunks((prev) => [...newChunks, ...prev]);
      setInputText('');
      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      setGenerateError(err.message || 'Erro ao consultar o Gemini.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Combina presets estáticos com os chunks customizados do usuário
  const allCurrentChunks = useMemo(() => {
    const presets = CHUNK_PRESETS[selectedLang]?.geral || [];
    // Filtrar customChunks do usuário pelo contexto ou garantir presença
    return [...customChunks, ...presets];
  }, [selectedLang, customChunks]);

  // Filtra chunks pelo termo digitado
  const filteredChunks = allCurrentChunks.filter((item) => 
    item.chunk.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.literalOrNuance.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.meaning.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.pronunciationHint && item.pronunciationHint.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-24 selection:bg-amber-500/20">
      
      {/* 1. Header Focado e Rápido */}
      <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 px-4 py-3.5 sm:px-6">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Sparkles className="h-5 w-5 fill-current" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                FastChunks
                <span className="text-[10px] font-mono bg-amber-400/10 text-amber-300 border border-amber-400/20 rounded-full px-2 py-0.2">
                  Áudio Direto
                </span>
              </h1>
              <p className="text-[11px] text-slate-400">Blocos de fala natural e treino auditivo</p>
            </div>
          </div>

          {/* Seletor Rápido de Velocidade da Fala */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
            {[0.8, 1.0, 1.25].map((rate) => (
              <button
                key={rate}
                onClick={() => setPlaybackRate(rate)}
                className={`min-h-[32px] px-2.5 rounded-md text-xs font-mono font-semibold transition-all cursor-pointer ${
                  playbackRate === rate
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={`Velocidade de reprodução: ${rate}x`}
              >
                {rate}x
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* 2. Conteúdo Central Mobile-First */}
      <main className="max-w-xl w-full mx-auto px-4 py-4 flex-1 flex flex-col gap-4">
        
        {/* Seletor de Idioma em Barra Horizontal Tátil */}
        <div className="grid grid-cols-3 gap-2">
          {languages.map((lang) => {
            const isSelected = selectedLang === lang.code;
            return (
              <button
                key={lang.code}
                onClick={() => {
                  setSelectedLang(lang.code);
                  setLoopDrillId(null);
                  window.speechSynthesis?.cancel();
                }}
                className={`min-h-[44px] flex items-center justify-center gap-2 rounded-xl border text-xs font-semibold transition-all active:scale-95 cursor-pointer ${
                  isSelected
                    ? 'border-amber-400/60 bg-amber-400/10 text-amber-200 shadow-sm shadow-amber-500/10'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <span className="text-base">{lang.flag}</span>
                <span>{lang.label}</span>
              </button>
            );
          })}
        </div>

        {/* Botão de Destaque: Gerar com IA / Extrair Chunks */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="min-h-[46px] w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 active:scale-[0.99] transition-all cursor-pointer"
        >
          <Sparkles className="w-4 h-4 fill-current" />
          <span>✨ Extrair ou Criar Chunks com Gemini AI</span>
        </button>

        {/* Campo de Busca Rápida de Situação / Expressão */}
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por situação (ex: topo, relaxa, resumindo)..."
            className="min-h-[46px] w-full rounded-xl border border-slate-800 bg-slate-900/80 px-4 pl-10 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-400/70 focus:outline-none transition-colors"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        </div>

        {/* Status de Sincronização */}
        {isLoadingBackend && (
          <div className="flex items-center justify-center gap-2 text-xs text-amber-400/80 py-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Sincronizando chunks na nuvem...</span>
          </div>
        )}

        {/* Lista de Cartões de Chunks */}
        <div className="flex flex-col gap-3">
          {filteredChunks.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl p-6">
              <BookOpen className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400">Nenhum chunk encontrado para essa busca.</p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="mt-3 text-xs text-amber-400 hover:underline"
              >
                Criar novo chunk com IA agora
              </button>
            </div>
          ) : (
            filteredChunks.map((item) => {
              const isSpeaking = speakingId === item.id;
              const isDrilling = loopDrillId === item.id;

              return (
                <article
                  key={item.id}
                  className={`relative rounded-2xl border p-4 transition-all duration-200 ${
                    isDrilling
                      ? 'border-amber-400/70 bg-gradient-to-b from-amber-500/10 to-slate-900/90 shadow-lg shadow-amber-500/10'
                      : 'border-slate-800/80 bg-slate-900/60 hover:border-slate-700/80'
                  }`}
                >
                  {/* Cabeçalho do Card: Contexto, Tag de Custom e Botão Copiar */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                        {item.context}
                      </span>
                      {item.isCustom && (
                        <span className="text-[9px] font-mono text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
                          Salvo na Nuvem
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {item.isCustom && (
                        <button
                          onClick={() => handleDeleteCustomChunk(item.id)}
                          className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                          title="Remover chunk salvo"
                          aria-label="Remover chunk salvo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleCopy(item.chunk, item.id)}
                        className="text-slate-500 hover:text-slate-300 transition-colors p-1"
                        aria-label="Copiar chunk"
                        title="Copiar texto"
                      >
                        {copiedId === item.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Frase / Expressão Nativa em Destaque */}
                  <h2 className="text-lg font-bold text-slate-100 tracking-tight leading-snug mb-1">
                    {item.chunk}
                  </h2>

                  {/* Guia Fonético */}
                  {item.pronunciationHint && (
                    <p className="text-xs font-mono text-amber-400/80 mb-2">
                      🗣️ {item.pronunciationHint}
                    </p>
                  )}

                  {/* Equivalência da Vida Real & Explicação */}
                  <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/60 mb-3 space-y-1">
                    <p className="text-xs font-bold text-emerald-300">
                      → {item.literalOrNuance}
                    </p>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {item.meaning}
                    </p>
                  </div>

                  {/* Barra de Ação de Áudio com suporte a Voz Neural Ultra-Realista */}
                  <div className="grid grid-cols-12 gap-2">
                    {/* Voz Neural Gemini (Director's Chair TTS) */}
                    <button
                      type="button"
                      disabled={loadingNeuralId === item.id}
                      onClick={() => speakNeuralChunk(item.chunk, item.id)}
                      title="Ouvir com voz neural hiper-realista do Gemini (respiração e tom natural)"
                      className="col-span-6 min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-amber-600/20 hover:from-amber-500/30 hover:to-amber-600/30 text-amber-300 active:scale-95 transition-all text-xs font-bold cursor-pointer border border-amber-500/40 shadow-sm"
                    >
                      {loadingNeuralId === item.id ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Sintetizando...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 fill-current text-amber-400" />
                          <span>{isSpeaking ? 'Tocando...' : 'Voz Neural IA'}</span>
                        </>
                      )}
                    </button>

                    {/* Ouvir Web Speech Nativo Rápido */}
                    <button
                      type="button"
                      onClick={() => speakChunk(item.chunk, item.id)}
                      title="Síntese rápida local do navegador"
                      className="col-span-3 min-h-[44px] flex items-center justify-center gap-1 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-300 active:scale-95 transition-all text-xs font-semibold cursor-pointer border border-slate-700/60"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>Nativo</span>
                    </button>

                    {/* Modo Drill Repetição (Shadowing) */}
                    <button
                      type="button"
                      onClick={() => toggleLoopDrill(item.chunk, item.id)}
                      title="Repetição contínua para treinar fala"
                      className={`col-span-3 min-h-[44px] flex items-center justify-center gap-1 rounded-xl border text-xs font-semibold transition-all active:scale-95 cursor-pointer ${
                        isDrilling
                          ? 'border-amber-400 bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      {isDrilling ? (
                        <>
                          <Pause className="w-3.5 h-3.5 fill-current" />
                          <span>Parar</span>
                        </>
                      ) : (
                        <>
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Drill</span>
                        </>
                      )}
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </main>

      {/* Modal / Gaveta de Ingestão com Gemini (Modern Web: Light-Dismiss e ARIA) */}
      {isModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsModalOpen(false);
            }
          }}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="generator-modal-title"
            className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl flex flex-col gap-4 animate-in slide-in-from-bottom-6"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h3 id="generator-modal-title" className="text-sm font-bold text-slate-100">
                  Gerador de Chunks de Bolso (Gemini 3.8)
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1 cursor-pointer"
                aria-label="Fechar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Cole uma intenção informal (ex: <em>"como pedir desculpas sem parecer muito formal"</em>) ou cole um trecho de notícia/podcast para extrair os chunks mais coloquiais.
            </p>

            <textarea
              autoFocus
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Digite uma situação ou cole o parágrafo..."
              rows={4}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />

            {generateError && (
              <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2 rounded-lg">
                {generateError}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 min-h-[44px] rounded-xl border border-slate-800 text-xs font-semibold text-slate-400 hover:text-slate-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isGenerating || !inputText.trim()}
                onClick={handleGenerateChunks}
                className="flex-1 min-h-[44px] rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Extraindo...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 fill-current" />
                    <span>Gerar 3 Chunks</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
