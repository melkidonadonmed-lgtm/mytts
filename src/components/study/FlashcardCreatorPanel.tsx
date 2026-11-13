import React, { useEffect, useState } from 'react';
import { GoogleIcon } from '../GoogleIcon';
import { buildManualFlashcardItem } from '../../services/flashcardDeckStorage';
import { requestGenerateFlashcard } from '../../services/polyglotClient';
import { normalizeLanguageBadge } from '../../utils/flashcardParser';
import type { FlashcardItem } from '../../types/polyglot';

export interface FlashcardCreatorPanelProps {
  initialCard?: FlashcardItem | null;
  availableDecks: string[];
  defaultDeckName?: string;
  onSaveCard: (card: FlashcardItem) => void;
  onCancelEdit?: () => void;
  onOpenImporter?: () => void;
}

export const FlashcardCreatorPanel: React.FC<FlashcardCreatorPanelProps> = ({
  initialCard,
  availableDecks,
  defaultDeckName = 'Baralho Principal',
  onSaveCard,
  onCancelEdit,
  onOpenImporter,
}) => {
  const [deckName, setDeckName] = useState(defaultDeckName);
  const [customDeckInput, setCustomDeckInput] = useState('');
  const [isTypingNewDeck, setIsTypingNewDeck] = useState(false);
  const [language, setLanguage] = useState<'auto' | 'EN' | 'IT' | 'JA'>('auto');
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [pronunciation, setPronunciation] = useState('');
  const [example, setExample] = useState('');
  const [exampleTranslation, setExampleTranslation] = useState('');
  const [nuance, setNuance] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [previewFlipped, setPreviewFlipped] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const clearForm = () => {
    setFront('');
    setBack('');
    setPronunciation('');
    setExample('');
    setExampleTranslation('');
    setNuance('');
    setPreviewFlipped(false);
    setAiError(null);
  };

  useEffect(() => {
    if (!statusMessage) return;
    const timer = setTimeout(() => {
      setStatusMessage(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [statusMessage]);

  useEffect(() => {
    if (initialCard) {
      setStatusMessage(null);
      setDeckName(initialCard.deckName || defaultDeckName);
      setLanguage(normalizeLanguageBadge(initialCard.language));
      setFront(initialCard.front || '');
      setBack(initialCard.back || '');
      setPronunciation(initialCard.pronunciation || '');
      setExample(initialCard.example || '');
      setExampleTranslation(initialCard.exampleTranslation || '');
      setNuance(initialCard.nuance || '');
      setShowAdvanced(Boolean(initialCard.pronunciation || initialCard.example || initialCard.nuance));
    } else {
      setDeckName(defaultDeckName);
    }
  }, [initialCard, defaultDeckName]);

  const activeDeck = isTypingNewDeck ? customDeckInput.trim() || 'Baralho Principal' : deckName;

  const handleAiComplete = async () => {
    const trimmedFront = front.trim();
    if (!trimmedFront) return setAiError('Digite a Frente (Expressão/Frase) para a IA completar.');
    setAiError(null);
    if (statusMessage) setStatusMessage(null);
    setIsGenerating(true);
    try {
      const res = await requestGenerateFlashcard(trimmedFront, language === 'auto' ? '' : language);
      if (res.ok && res.card) {
        const c = res.card;
        if (!back.trim() && c.back) setBack(c.back);
        if (!pronunciation.trim() && c.pronunciation) setPronunciation(c.pronunciation);
        if (!example.trim() && c.example) setExample(c.example);
        if (!exampleTranslation.trim() && c.exampleTranslation) setExampleTranslation(c.exampleTranslation);
        if (!nuance.trim() && c.nuance) setNuance(c.nuance);
        if (language === 'auto' && c.language) setLanguage(normalizeLanguageBadge(c.language));
        setShowAdvanced(true);
      } else {
        setAiError(res.error || 'Não foi possível completar os campos via IA.');
      }
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : 'Falha na comunicação com a API de IA.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = (createNext = false) => {
    if (!front.trim() || !back.trim()) return;
    const wasEditing = Boolean(initialCard);
    onSaveCard(
      buildManualFlashcardItem({
        id: initialCard?.id,
        deckName: activeDeck,
        language: language === 'auto' ? undefined : language,
        front,
        back,
        pronunciation,
        example,
        exampleTranslation,
        nuance,
        existing: initialCard || undefined,
      })
    );
    clearForm();
    setStatusMessage(
      wasEditing
        ? 'Flashcard atualizado com sucesso!'
        : createNext
          ? 'Flashcard salvo! Pronto para o próximo.'
          : 'Flashcard salvo no baralho!'
    );
  };

  const handleCancelEdit = () => {
    clearForm();
    setStatusMessage(null);
    onCancelEdit?.();
  };

  const updateField = (setter: React.Dispatch<React.SetStateAction<string>>) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setter(e.target.value);
    if (statusMessage) setStatusMessage(null);
  };

  const allDecks = Array.from(new Set([defaultDeckName, ...availableDecks])).filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-2xl card-matte border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl btn-matte-amber flex items-center justify-center text-white shrink-0">
            <GoogleIcon name={initialCard ? 'edit' : 'add'} size={20} />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-primary font-display">
              {initialCard ? 'Editar Flashcard' : 'Criador de Flashcards (Anki / Brainscape)'}
            </h2>
            <p className="text-xs text-secondary">
              {initialCard ? 'Atualize os dados preservando a repetição espaçada' : 'Crie cards manuais ou acelere com IA'}
            </p>
          </div>
        </div>
        {onOpenImporter && (
          <button type="button" onClick={onOpenImporter} className="min-h-[44px] px-3.5 py-2 rounded-xl btn-matte-dark text-secondary hover:text-primary text-xs font-bold flex items-center gap-2 border border-slate-800 cursor-pointer self-start sm:self-auto">
            <GoogleIcon name="upload_file" size={16} className="text-amber-400" />
            <span>Importar Lote</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-4 p-5 sm:p-6 rounded-3xl card-matte border border-slate-800">
          {statusMessage && (
            <div
              role="status"
              aria-live="polite"
              className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2"
            >
              <GoogleIcon name="check_circle" size={16} className="text-emerald-400 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="deck-select" className="block text-xs font-bold text-secondary">Baralho</label>
              {!isTypingNewDeck ? (
                <div className="flex gap-1.5">
                  <select id="deck-select" value={deckName} onChange={(e) => setDeckName(e.target.value)} className="flex-1 min-h-[44px] px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-primary focus:outline-none cursor-pointer">
                    {allDecks.map((d) => (<option key={d} value={d}>{d}</option>))}
                  </select>
                  <button type="button" onClick={() => setIsTypingNewDeck(true)} className="min-h-[44px] px-3 rounded-xl btn-matte-dark text-amber-300 text-xs font-bold border border-slate-800 cursor-pointer">+ Novo</button>
                </div>
              ) : (
                <div className="flex gap-1.5">
                  <input type="text" value={customDeckInput} onChange={(e) => setCustomDeckInput(e.target.value)} placeholder="Nome do baralho..." className="flex-1 min-h-[44px] px-3 py-2 rounded-xl input-sunken text-xs text-primary border border-slate-800" />
                  <button type="button" onClick={() => setIsTypingNewDeck(false)} className="min-h-[44px] px-3 rounded-xl btn-matte-dark text-secondary text-xs font-bold border border-slate-800 cursor-pointer">Voltar</button>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <span className="block text-xs font-bold text-secondary">Idioma Alvo</span>
              <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800">
                {(['auto', 'EN', 'IT', 'JA'] as const).map((lang) => (
                  <button key={lang} type="button" onClick={() => setLanguage(lang)} className={`min-h-[36px] rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer ${language === lang ? 'bg-amber-500/20 text-amber-300 border border-amber-500/35' : 'text-secondary hover:text-primary'}`}>
                    {lang === 'auto' ? 'AUTO' : lang}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="card-front" className="text-xs font-extrabold text-primary">Frente (Expressão / Frase) *</label>
              <button type="button" onClick={handleAiComplete} disabled={isGenerating || !front.trim()} className="min-h-[36px] px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                <GoogleIcon name="auto_awesome" size={14} />
                <span>{isGenerating ? 'Completando...' : 'Completar com IA'}</span>
              </button>
            </div>
            <textarea id="card-front" rows={2} value={front} onChange={updateField(setFront)} placeholder="Ex: Take it with a grain of salt / Non vedo l'ora / よろしくお願いします" className="w-full px-3.5 py-2.5 rounded-xl input-sunken text-sm text-primary placeholder-slate-500 border border-slate-800 focus:outline-none focus:border-amber-500/40" />
          </div>

          {aiError && <p className="text-xs text-rose-400 bg-rose-950/40 border border-rose-500/30 p-2.5 rounded-xl">{aiError}</p>}

          <div className="space-y-1.5">
            <label htmlFor="card-back" className="block text-xs font-extrabold text-primary">Verso (Tradução / Significado) *</label>
            <textarea id="card-back" rows={2} value={back} onChange={updateField(setBack)} placeholder="Ex: Não leve tão a sério / Mal posso esperar / Conto com você" className="w-full px-3.5 py-2.5 rounded-xl input-sunken text-sm text-emerald-300 placeholder-slate-500 border border-slate-800 focus:outline-none focus:border-emerald-500/40" />
          </div>

          <div className="pt-2 border-t border-slate-800/80">
            <button type="button" onClick={() => setShowAdvanced((prev) => !prev)} className="min-h-[38px] text-xs font-bold text-secondary hover:text-primary flex items-center gap-1.5 cursor-pointer">
              <GoogleIcon name={showAdvanced ? 'expand_less' : 'expand_more'} size={16} />
              <span>{showAdvanced ? 'Ocultar campos opcionais' : 'Mais detalhes (Pronúncia, Exemplo, Nuance)'}</span>
            </button>
            {showAdvanced && (
              <div className="space-y-3 pt-3">
                <div className="space-y-1">
                  <label htmlFor="card-pron" className="block text-xs font-semibold text-secondary">Pronúncia Fonética / Rōmaji</label>
                  <input id="card-pron" type="text" value={pronunciation} onChange={updateField(setPronunciation)} placeholder="Ex: /teɪk ɪt/ ou yoroshiku" className="w-full min-h-[44px] px-3 py-2 rounded-xl input-sunken text-xs text-primary border border-slate-800" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="card-ex" className="block text-xs font-semibold text-secondary">Frase de Exemplo</label>
                    <input id="card-ex" type="text" value={example} onChange={updateField(setExample)} placeholder="Ex: Take his advice..." className="w-full min-h-[44px] px-3 py-2 rounded-xl input-sunken text-xs text-primary border border-slate-800" />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="card-ex-tr" className="block text-xs font-semibold text-secondary">Tradução do Exemplo</label>
                    <input id="card-ex-tr" type="text" value={exampleTranslation} onChange={updateField(setExampleTranslation)} placeholder="Ex: Veja o conselho..." className="w-full min-h-[44px] px-3 py-2 rounded-xl input-sunken text-xs text-secondary border border-slate-800" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label htmlFor="card-nuance" className="block text-xs font-semibold text-secondary">Nuance Cultural / Contexto</label>
                  <input id="card-nuance" type="text" value={nuance} onChange={updateField(setNuance)} placeholder="Ex: Usado no cotidiano..." className="w-full min-h-[44px] px-3 py-2 rounded-xl input-sunken text-xs text-secondary border border-slate-800" />
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-slate-800">
            <button type="button" disabled={!front.trim() || !back.trim()} onClick={() => handleSave(false)} className="min-h-[44px] px-4 py-2.5 rounded-xl btn-matte-amber text-white text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
              <GoogleIcon name="check" size={16} />
              <span>{initialCard ? 'Salvar Alterações' : 'Salvar Card'}</span>
            </button>
            {!initialCard && (
              <button type="button" disabled={!front.trim() || !back.trim()} onClick={() => handleSave(true)} className="min-h-[44px] px-4 py-2.5 rounded-xl btn-matte-dark text-amber-300 hover:text-amber-200 text-xs font-bold flex items-center gap-1.5 border border-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                <GoogleIcon name="add" size={16} />
                <span>Salvar e Criar Próximo</span>
              </button>
            )}
            {initialCard && onCancelEdit && (
              <button type="button" onClick={handleCancelEdit} className="min-h-[44px] px-4 py-2.5 rounded-xl btn-matte-dark text-secondary hover:text-primary text-xs font-bold border border-slate-800 cursor-pointer">Cancelar Edição</button>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between text-xs text-secondary px-1">
            <span className="font-bold">Pré-visualização</span>
            <span className="font-mono text-[11px]">{previewFlipped ? 'Verso (Resposta)' : 'Frente (Pergunta)'}</span>
          </div>
          <div className="p-6 rounded-3xl card-matte border border-slate-800 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono text-[10px] font-bold">
                {language === 'auto' ? 'AUTO' : language} · {activeDeck}
              </span>
              <button type="button" onClick={() => setPreviewFlipped((prev) => !prev)} className="min-h-[36px] px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-secondary hover:text-primary text-xs font-semibold flex items-center gap-1 border border-slate-800 cursor-pointer">
                <GoogleIcon name="flip" size={14} className="text-amber-400" />
                <span>Virar Carta</span>
              </button>
            </div>
            <div className="min-h-[160px] p-5 rounded-2xl surface-inset border border-slate-800/80 flex flex-col items-center justify-center text-center gap-2.5">
              {!previewFlipped ? (
                <>
                  <p className="text-lg font-extrabold text-primary font-display">{front.trim() || 'Digite a frente do card...'}</p>
                  {pronunciation.trim() && (
                    <p className="text-xs font-mono text-amber-300/90 bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20">/{pronunciation.trim()}/</p>
                  )}
                  <span className="text-[11px] text-secondary mt-1">Clique em &quot;Virar Carta&quot; para checar o verso</span>
                </>
              ) : (
                <>
                  <p className="text-base font-extrabold text-emerald-300 font-display">{back.trim() || 'Digite o significado no verso...'}</p>
                  {nuance.trim() && <p className="text-xs text-secondary max-w-xs">{nuance.trim()}</p>}
                  {example.trim() && (
                    <div className="mt-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-left w-full space-y-0.5">
                      <p className="text-xs font-semibold text-primary">{example.trim()}</p>
                      {exampleTranslation.trim() && <p className="text-[11px] text-secondary">{exampleTranslation.trim()}</p>}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
