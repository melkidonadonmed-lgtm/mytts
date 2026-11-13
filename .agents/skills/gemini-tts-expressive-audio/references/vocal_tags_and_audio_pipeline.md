# Catálogo de Tags Vocais Canônicas (`gemini-3.8-flash-tts`) & Pipeline FFmpeg/Audio

Referência técnica complementar de [`SKILL.md`](../SKILL.md) para síntese expressiva e processamento de áudio no MyTTS Studio.

---

## 1. As 42 Tags Vocais Inline (`part.text` em `speech-generation.md#vocal-bursts`)

Usar exclusivamente dentro de `part.text` (sempre em inglês, independentemente do idioma falado — `pt-BR`, `it-IT`, `ja-JP`, etc.), nunca dentro de `speechMetadata.style`:

- **Respiração e fisiologia:** `<breath>`, `<heavy breath>`, `<exhales>`, `<pant>`, `<sigh>`, `<sighs>`, `<gasp>`, `<yawn>`, `<cough>`, `<sneeze>`, `<snort>`, `<throat-clearing>` (alias `throat clear` normalizado para `<throat-clearing>`), `<groan>`, `<grunt>`, `<growl>`, `<grr>`, `<argh>`, `<hiss>`, `<moan>`, `<pff>`, `<phew>`, `<tsk>`
- **Riso e emoção:** `<laugh>`, `<laughter>`, `<chuckle>`, `<chuckles>`, `<giggle>`, `<snicker>`, `<cackle>`, `<cheer>`, `<cry>`, `<sob>`, `<whimper>`, `<scream>`, `<shout>`, `<shriek>`
- **Sussurro pontual:** `<whisper>`, `<whispers>`, `<whispering>`
- **Pausas:** `<short pause>`, `<long pause>` *(não existe `<medium pause>`; velocidade/pitch contínuos pertencem a `speechMetadata.style`)*

## 2. Personas, Emoções e Heurística de Fôlego (`prosodyEngine.ts`)

- **5 Personas:** `Puck`, `Kore`, `Aoede`, `Fenrir`, `Enceladus`.
- **12 Emoções (`getEmotionStyle`):** `natural`, `storytelling`, `technical`, `spontaneous`, `thoughtful`, `inquisitive`, `skeptical`, `ironic`, `passionate`, `resolute`, `expressive`, `calm`.
- **Entre parágrafos:** Injetar `<short pause> <breath> ` quando o parágrafo atual tiver `>= 6` palavras ou o anterior tiver `>= 10` palavras.
- **Orações longas (`> 20` palavras):** Injetar `<short pause> <breath>` (ou `<breath>` em `passionate`/`expressive`) após os primeiros 35% da frase em ponto de articulação (`,`, `;` ou ` — `) caso `withoutLeadingTags` ainda não contenha tag de respiração/pausa.

## 3. Mixagem FFmpeg (`/api/mix-audio` em `src/server/audioContainer.ts`)

- Usar `asplit=2[voice_sc][voice_mix]` antes de referenciar o stream `[voice]` duas vezes.
- Aplicar `aresample=44100` em ambas as entradas e passar `[bg]` como primeiro input e `[voice_sc]` como segundo input (gatilho sidechain) em `[bg][voice_sc]sidechaincompress`.
- Duração exata WAV 24 kHz mono PCM 16-bit: `Math.max(0, wavBuffer.length - 44) / (24000 * 2)`.
