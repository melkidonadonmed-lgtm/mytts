import React, { useState } from 'react';
import {
  Play,
  RefreshCw,
  Edit2,
  Check,
  Download,
} from 'lucide-react';
import { DebateScript, DebateTurn } from '../types/debate';
import { base64ToArrayBuffer } from '../utils/audioEngine';

interface ScriptViewerProps {
  script: DebateScript;
  currentTurnIndex: number;
  isPlaying: boolean;
  onPlayTurn: (index: number) => void;
  onSynthesizeTurn: (turnIndex: number) => Promise<void>;
  onUpdateTurnText: (turnIndex: number, newText: string) => void;
  isSynthesizing: boolean;
}

export const ScriptViewer: React.FC<ScriptViewerProps> = ({
  script,
  currentTurnIndex,
  isPlaying,
  onPlayTurn,
  onSynthesizeTurn,
  onUpdateTurnText,
  isSynthesizing,
}) => {
  const [editingTurnIndex, setEditingTurnIndex] = useState<number | null>(null);
  const [editedText, setEditedText] = useState<string>('');
  const [synthesizingTurnIndex, setSynthesizingTurnIndex] = useState<number | null>(null);

  const startEdit = (index: number, text: string) => {
    setEditingTurnIndex(index);
    setEditedText(text);
  };

  const saveEdit = (index: number) => {
    onUpdateTurnText(index, editedText);
    setEditingTurnIndex(null);
  };

  const handleSynthesizeSingle = async (index: number) => {
    setSynthesizingTurnIndex(index);
    try {
      await onSynthesizeTurn(index);
    } finally {
      setSynthesizingTurnIndex(null);
    }
  };

  const handleDownloadTurn = (turn: DebateTurn) => {
    if (!turn.audioBase64) return;
    const blob = new Blob([base64ToArrayBuffer(turn.audioBase64)], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `turn_${turn.turn}_${turn.speaker.toLowerCase()}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Highlights prosody tokens in text (<breath>, <laugh>, <gasp>, |mhm|, |yeah|, dashes)
  const renderProsodicText = (text: string) => {
    const parts = text.split(/(<[^>]+>|\|[^|]+\||—|\.\.\.)/g);
    return parts.map((part, i) => {
      if (part.startsWith('<') && part.endsWith('>')) {
        return (
          <span
            key={i}
            className="text-[11px] font-mono px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 mx-0.5"
            title="Marcador vocal neural"
          >
            {part}
          </span>
        );
      }
      if (part.startsWith('|') && part.endsWith('|')) {
        return (
          <span
            key={i}
            className="text-[11px] font-mono px-1 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 mx-0.5"
            title="Escuta ativa (backchanneling)"
          >
            {part}
          </span>
        );
      }
      if (part === '—' || part === '...') {
        return (
          <span key={i} className="text-amber-400 font-bold mx-0.5">
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header: Debate Thesis and Summary */}
      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-col gap-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <h1 className="text-lg font-bold text-white tracking-tight">{script.title}</h1>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <span>{script.turns.length} turnos de fala</span>
            <span aria-hidden="true">·</span>
            <span className="uppercase text-amber-400">{script.tensionIntensity}</span>
            <span aria-hidden="true">·</span>
            <span>{script.language}</span>
          </div>
        </div>

        <div className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
          <span className="font-semibold text-amber-400 mr-1.5">Tese em Disputa:</span>
          <span>{script.keyThesis}</span>
        </div>
      </div>

      {/* Synchronized Turn-by-Turn Script Thread */}
      <div className="flex flex-col gap-3">
        {script.turns.map((turn, index) => {
          const isActive = currentTurnIndex === index && isPlaying;
          const isSelected = currentTurnIndex === index;
          const speakerInfo =
            script.speakers.find((s) => s.name === turn.speaker) || script.speakers[0];
          const hasAudio = Boolean(turn.audioBase64);
          const isTurnSynthesizing = synthesizingTurnIndex === index;

          return (
            <div
              key={turn.turn}
              className={`p-4 rounded-xl border transition-all ${
                isActive
                  ? 'border-amber-400/90 bg-slate-900/95 ring-1 ring-amber-400/50 shadow-lg shadow-amber-500/10'
                  : isSelected
                  ? 'border-slate-700 bg-slate-900/90'
                  : 'border-slate-800/80 bg-slate-900/60 hover:border-slate-700'
              }`}
            >
              {/* Turn Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-800/60 mb-2.5">
                <div className="flex items-center gap-2.5">
                  {/* Speaker Monogram Avatar */}
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold text-slate-950 shrink-0 shadow-sm"
                    style={{ backgroundColor: speakerInfo.color || '#38bdf8' }}
                  >
                    {speakerInfo.name.charAt(0)}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{speakerInfo.name}</span>
                      <span className="text-[11px] text-slate-400 font-normal">
                        ({speakerInfo.roleTitle})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Prosody & Emotion Metadata */}
                <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                  <span className="capitalize text-slate-300 font-medium">{turn.emotion}</span>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span>{turn.prosody.speech_rate.toFixed(2)}x ritmo</span>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span>+{turn.prosody.pre_delay_ms}ms gap</span>
                  {turn.prosody.breath_sound && (
                    <>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="text-amber-400">respiração</span>
                    </>
                  )}
                </div>
              </div>

              {/* Turn Speech Content */}
              {editingTurnIndex === index ? (
                <div className="flex flex-col gap-2 mt-2">
                  <textarea
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    rows={3}
                    className="w-full bg-slate-950 border border-amber-400/60 rounded-lg p-3 text-sm text-slate-100 leading-relaxed focus:outline-none"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingTurnIndex(null)}
                      className="px-3 py-1 text-xs text-slate-400 hover:text-white"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => saveEdit(index)}
                      className="px-3 py-1 bg-amber-400 text-slate-950 font-semibold text-xs rounded-md flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Salvar Edição</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => onPlayTurn(index)}
                  className="text-sm text-slate-200 leading-relaxed cursor-pointer hover:text-white transition-colors"
                >
                  {renderProsodicText(turn.text)}
                </div>
              )}

              {/* Turn Footer Actions */}
              <div className="flex items-center justify-between mt-3 pt-2 text-xs border-t border-slate-800/40 text-slate-400">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onPlayTurn(index)}
                    className="flex items-center gap-1.5 hover:text-amber-300 transition-colors cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 text-amber-400 fill-current" />
                    <span>{isActive ? 'Tocando...' : 'Ouvir Turno'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => startEdit(index, turn.text)}
                    className="flex items-center gap-1 hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3 h-3 text-slate-400" />
                    <span>Editar Fala</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {hasAudio && (
                    <button
                      type="button"
                      onClick={() => handleDownloadTurn(turn)}
                      className="p-1 hover:text-slate-200 transition-colors"
                      title="Baixar áudio deste turno (.wav)"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleSynthesizeSingle(index)}
                    disabled={isTurnSynthesizing || isSynthesizing}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all text-[11px] disabled:opacity-40 cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-3 h-3 text-amber-400 ${
                        isTurnSynthesizing ? 'animate-spin' : ''
                      }`}
                    />
                    <span>{hasAudio ? 'Re-sintetizar Voz' : 'Sintetizar Voz'}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
