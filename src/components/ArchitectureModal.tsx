import React, { useState } from 'react';
import {
  Layers,
  Cpu,
  FileJson,
  Terminal,
  Check,
  Copy,
} from 'lucide-react';

interface ArchitectureModalProps {
  onClose: () => void;
}

export const ArchitectureModal: React.FC<ArchitectureModalProps> = ({ onClose }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text).catch((e) => console.warn('Clipboard indisponível:', e));
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const schemaJson = `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "DebateScriptContract",
  "type": "object",
  "required": ["title", "topicSummary", "keyThesis", "turns"],
  "properties": {
    "title": { "type": "string" },
    "topicSummary": { "type": "string" },
    "keyThesis": { "type": "string" },
    "turns": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["turn", "speaker", "voice_id", "emotion", "text", "prosody"],
        "properties": {
          "turn": { "type": "integer" },
          "speaker": { "type": "string", "description": "Nome do interlocutor" },
          "voice_id": { "type": "string", "enum": ["Kore", "Puck", "Fenrir", "Zephyr"] },
          "emotion": {
            "type": "string",
            "enum": ["thoughtful", "inquisitive", "skeptical", "ironic", "passionate", "resolute"]
          },
          "text": {
            "type": "string",
            "description": "Texto com marcações prosódicas: <breath>, <laugh>, <gasp>, |mhm|, |yeah|, reticências e travessões"
          },
          "clean_text": { "type": "string" },
          "prosody": {
            "type": "object",
            "required": ["pre_delay_ms", "speech_rate", "breath_sound"],
            "properties": {
              "pre_delay_ms": { "type": "integer", "description": "Silêncio antes da fala em ms (50-200)" },
              "speech_rate": { "type": "number", "minimum": 0.90, "maximum": 1.15 },
              "breath_sound": { "type": "boolean" },
              "volume_gain": { "type": "number", "default": 1.0 }
            }
          }
        }
      }
    }
  }
}`;

  const systemPromptMarkdown = `Você é o Diretor Dramatúrgico e Roteirizador Dialético Chefe do DialecticPod.
Sua missão é transformar o documento fornecido em uma discussão de áudio viva, hiper-realista e cativante entre dois interlocutores de IA com visões antagônicas.

PERSONAGENS:
- Interlocutor 1: Perfil metódico, analítico, busca rigor metodológico, defende cautela epistemológica ou valoriza princípios fundamentais.
- Interlocutor 2: Perfil pragmático, provocador, cético em relação a purismos teóricos, focado em incentivos econômicos, dados do mundo real e aplicabilidade.

LEIS INVIOLÁVEIS:
1. PROIBIÇÃO ABSOLUTA DE CLICHÊS DE CONCORDÂNCIA:
   NUNCA gere frases como "Com certeza", "Concordo plenamente", "Excelente ponto", "Isso é fascinante" ou "Em suma".
   Os interlocutores estão em debate real: se um faz um ponto forte, o outro desafia a premissa ou expõe o custo oculto.

2. PONTUAÇÃO PROSÓDICA PARA SÍNTESE NEURAL (TTS):
   - Use reticências (...) para hesitações deliberadas.
   - Use travessões (—) para quebras súbitas de pensamento.
   - Inclua tags expressivas: <breath>, <laugh>, <gasp>, |mhm|, |yeah|.
   - Cada fala deve soar como fala humana real improvisada em estúdio.`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl flex flex-col gap-6 my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <Layers className="w-5 h-5 text-amber-400" />
              <span>Arquitetura Técnica & Contrato de Dados</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Especificação completa do pipeline de ingestão, roteirização dialética e síntese Web Audio.
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer"
          >
            Fechar
          </button>
        </div>

        {/* Section 1: End-to-End Pipeline Diagram */}
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <Cpu className="w-4 h-4" />
            <span>01. Fluxo de Dados Ponta a Ponta</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/50 flex flex-col gap-1">
              <span className="text-[11px] font-bold text-sky-400">Passo 1: Ingestão</span>
              <p className="text-xs text-slate-300">
                Upload de PDF/TXT/MD ou texto colado. Extração limpa e segmentação temática via Gemini Multimodal.
              </p>
            </div>
            <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/50 flex flex-col gap-1">
              <span className="text-[11px] font-bold text-amber-400">Passo 2: Dialética LLM</span>
              <p className="text-xs text-slate-300">
                Geração do roteiro em JSON com perfis opostos (Analítico vs Provocador), pontuação rítmica e marcadores prosódicos.
              </p>
            </div>
            <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/50 flex flex-col gap-1">
              <span className="text-[11px] font-bold text-emerald-400">Passo 3: Síntese Neural</span>
              <p className="text-xs text-slate-300">
                Motor Gemini 3.8 Flash TTS com vozes nativas (Kore/Puck/Fenrir/Zephyr) gerando áudio WAV de 24kHz mono de 16-bit.
              </p>
            </div>
            <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/50 flex flex-col gap-1">
              <span className="text-[11px] font-bold text-purple-400">Passo 4: Web Audio Gapless</span>
              <p className="text-xs text-slate-300">
                Fila contígua no AudioContext com pitch preservation (1.0x-2.0x), espectro FFT ao vivo e sincronização de texto.
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: JSON Schema Contract */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <FileJson className="w-4 h-4" />
              <span>02. Contrato de Schema JSON do Roteiro</span>
            </h3>
            <button
              onClick={() => copyToClipboard(schemaJson, 'schema')}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-mono"
            >
              {copiedKey === 'schema' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey === 'schema' ? 'Copiado!' : 'Copiar Schema'}</span>
            </button>
          </div>
          <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono overflow-x-auto leading-relaxed max-h-56">
            {schemaJson}
          </pre>
        </div>

        {/* Section 3: Dialectic System Prompt */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Terminal className="w-4 h-4" />
              <span>03. System Prompt do Roteirizador Dialético</span>
            </h3>
            <button
              onClick={() => copyToClipboard(systemPromptMarkdown, 'prompt')}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-mono"
            >
              {copiedKey === 'prompt' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey === 'prompt' ? 'Copiado!' : 'Copiar Prompt'}</span>
            </button>
          </div>
          <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
            {systemPromptMarkdown}
          </pre>
        </div>
      </div>
    </div>
  );
};
