/**
 * Utilitários de Áudio do Frontend
 * Conversão segura de base64 para Blob URLs com gerenciamento de ciclo de vida.
 */

/**
 * Converte uma string base64 de áudio em um Blob URL (object URL) gerenciado pelo navegador.
 * Evita o estouro de tamanho de Data URIs e melhora significativamente a performance de reprodução.
 */
export function base64ToBlobUrl(base64: string, mimeType: string = 'audio/wav'): string {
  // Limpeza de possíveis prefixos data URI residuais
  const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
  const binaryString = window.atob(cleanBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

/**
 * Libera de forma segura uma URL criada por URL.createObjectURL.
 */
export function revokeAudioUrl(url: string | null | undefined): void {
  if (url && url.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // Ignora erro silencioso se a URL já tiver sido liberada
    }
  }
}
