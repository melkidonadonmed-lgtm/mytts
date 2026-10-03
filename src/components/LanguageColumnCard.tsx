import React, { useState, useRef } from 'react';
import { 
  Volume2, 
  Play, 
  Pause, 
  Loader2, 
  Sparkles, 
  Copy, 
  Check, 
  Settings2,
  ChevronDown 
} from 'lucide-react';
import { AlignedChunk } from '../types/polyglot';
import { GEMINI_VOICES, VoiceProfile } from '../types/voices';

interface LanguageColumnCardProps {
  languageCode: 'en' | 'it' | 'ja';
  languageTitle: string;
  flag: string;
  badgeText: string;
  chunks: AlignedChunk[];
  fullText: string;
  hoveredChunkId: number | null;
  onHoverChunk: (id: number | null) => void;
  onClickChunk: (chunkText: string, language: string, event: React.MouseEvent) => void;
  onPlayFullText: (text: string, language: string, voiceId: string, speed: number) => Promise<void>;
  isPlayingFull: boolean;
}

export const LanguageColumnCard: React.FC<LanguageColumnCardProps> = ({
  languageCode,
  languageTitle,
  flag,
  badgeText,
  chunks,
  fullText,
  hoveredChunkId,
  onHoverChunk,
  onClickChunk,
  onPlayFullText,
  isPlayingFull,
}) => {
  // Configuração padrão de vozes inteligentes por idioma
  const defaultVoiceId = languageCode === 'it' ? 'Kore' : languageCode === 'ja' ? 'Aoede' : 'Puck';
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(defaultVoiceId);
  const [speed, setSpeed] = useState<number>(1.0);
  const [isVoicePickerOpen, setIsVoicePickerOpen] = useState(false);
  const [copiedFull, setCopiedFull] = useState(false);

  const handleCopyFull = () => {
    navigator.clipboard.writeText(fullText);
    setCopiedFull(true);
    setTimeout(() => setCopiedFull(false), 1500);
  };

  const getLanguageTag = (code: string) => {
    if (code === 'it') return 'it-IT';
    if (code === 'ja') return 'ja-JP';
    return 'en-US';
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-md shadow-black/20 transition-all hover:border-slate-750">
      
      {/* 1. Cabeçalho do Card de Idioma */}
      <div className="px-4 py-3 bg-slate-950/70 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl" role="img" aria-label={languageTitle}>
            {flag}
          </span>
          <div>
            <h3 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
              <span>{languageTitle}</span>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-800/80 px-1.5 py-0.2 rounded font-normal">
                {badgeText}
              </span>
            </h3>
          </div>
        </div>

        <button
          onClick={handleCopyFull}
          title="Copiar texto completo deste idioma"
          className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors cursor-pointer"
        >
          {copiedFull ? (
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* 2. Corpo do Texto com Chunks Interativos */}
      <div className="p-4 flex-1 flex flex-col justify-start text-sm leading-relaxed select-text">
        <div className="flex flex-wrap gap-x-1 gap-y-1 items-baseline">
          {chunks.map((chunk) => {
            const chunkText = languageCode === 'en' ? chunk.en : languageCode === 'it' ? chunk.it : chunk.ja;
            const isHovered = hoveredChunkId === chunk.id;

            return (
              <span
                key={chunk.id}
                onMouseEnter={() => onHoverChunk(chunk.id)}
                onMouseLeave={() => onHoverChunk(null)}
                onClick={(e) => onClickChunk(chunkText, getLanguageTag(languageCode), e)}
                title="Clique para ouvir esta frase ou criar flashcard"
                className={`cursor-pointer rounded px-1 py-0.5 transition-all duration-150 relative group ${
                  isHovered
                    ? 'bg-amber-400/25 text-amber-200 font-semibold border-b-2 border-amber-400 shadow-sm shadow-amber-500/20'
                    : 'hover:bg-slate-800/80 text-slate-200'
                }`}
              >
                {chunkText}
                {languageCode === 'ja' && chunk.jaPronunciation && (
                  <span className="block text-[9px] font-mono text-amber-400/70 -mt-0.5 tracking-tight pointer-events-none">
                    {chunk.jaPronunciation}
                  </span>
                )}
              </span>
            );
          })}
        </div>
      </div>

      {/* 3. Rodapé com Controles de Áudio, Voz e Velocidade */}
      <div className="px-3 py-2.5 bg-slate-950/80 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
        
        {/* Botão Play/Pause do Texto Completo */}
        <button
          onClick={() => onPlayFullText(fullText, getLanguageTag(languageCode), selectedVoiceId, speed)}
          disabled={isPlayingFull}
          className={`min-h-[34px] px-3 rounded-xl flex items-center gap-1.5 font-bold transition-all cursor-pointer active:scale-95 ${
            isPlayingFull
              ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white'
          }`}
        >
          {isPlayingFull ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Tocando...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current text-amber-400" />
              <span>Ouvir Tudo</span>
            </>
          )}
        </button>

        {/* Controles de Voz & Velocidade */}
        <div className="flex items-center gap-1.5">
          
          {/* Seletor de Velocidade */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
            {[0.8, 1.0, 1.25].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition-all cursor-pointer ${
                  speed === s
                    ? 'bg-amber-400/20 text-amber-300 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Dropdown de Voz */}
          <div className="relative">
            <button
              onClick={() => setIsVoicePickerOpen(!isVoicePickerOpen)}
              className="flex items-center gap-1 bg-slate-900 border border-slate-800 hover:border-slate-700 px-2 py-1 rounded-lg text-[11px] font-medium text-slate-300 transition-colors cursor-pointer"
            >
              <span>{selectedVoiceId}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {isVoicePickerOpen && (
              <div className="absolute bottom-full mb-1 right-0 w-36 bg-slate-900 border border-slate-700 rounded-xl p-1 shadow-xl z-30">
                {GEMINI_VOICES.map((v) => (
                  <button
                    key={v.name}
                    onClick={() => {
                      setSelectedVoiceId(v.name);
                      setIsVoicePickerOpen(false);
                    }}
                    className={`w-full text-left px-2 py-1 rounded-lg text-[11px] flex items-center justify-between cursor-pointer ${
                      selectedVoiceId === v.name
                        ? 'bg-amber-400/20 text-amber-300 font-bold'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span>{v.name}</span>
                    <span className="text-[9px] text-slate-500">{v.gender === 'male' ? 'M' : 'F'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
