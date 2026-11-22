/**
 * Turn queue & Blob URL lifecycle reconciler for GaplessAudioPlayer.
 */

import { base64ToArrayBuffer } from './wavUtils';

export interface PlayerTurnEntry {
  turnNumber: number;
  audioBase64: string;
  blobUrl?: string;
  duration?: number;
  preDelayMs: number;
}

export interface IncomingTurnSpec {
  turnNumber: number;
  audioBase64: string;
  preDelayMs?: number;
}

export interface ReconcileTurnsResult {
  nextTurns: PlayerTurnEntry[];
  nextTurnIdx: number;
  shouldUpdateSrc: boolean;
  nextSrcUrl?: string;
}

/**
 * Reconciles incoming turns against existing entries, reusing unchanged Blob URLs
 * and revoking replaced or removed ones to prevent memory leaks.
 */
export function reconcilePlayerTurns(params: {
  existingTurns: PlayerTurnEntry[];
  incomingTurns: IncomingTurnSpec[];
  currentTurnIdx: number;
  isPlaying: boolean;
  currentTime: number;
  hasCurrentSrc: boolean;
}): ReconcileTurnsResult {
  const {
    existingTurns,
    incomingTurns,
    currentTurnIdx,
    isPlaying,
    currentTime,
    hasCurrentSrc,
  } = params;

  const existingByTurn = new Map<number, { audioBase64: string; blobUrl?: string }>();
  for (const prev of existingTurns) {
    existingByTurn.set(prev.turnNumber, {
      audioBase64: prev.audioBase64,
      blobUrl: prev.blobUrl,
    });
  }

  const keptUrls = new Set<string>();
  const nextTurns: PlayerTurnEntry[] = incomingTurns.map((t) => {
    const existing = existingByTurn.get(t.turnNumber);
    if (existing && existing.audioBase64 === t.audioBase64 && existing.blobUrl) {
      keptUrls.add(existing.blobUrl);
      return {
        turnNumber: t.turnNumber,
        audioBase64: t.audioBase64,
        blobUrl: existing.blobUrl,
        preDelayMs: t.preDelayMs || 100,
      };
    }

    const blob = new Blob([base64ToArrayBuffer(t.audioBase64)], {
      type: 'audio/wav',
    });
    const url = URL.createObjectURL(blob);
    keptUrls.add(url);
    return {
      turnNumber: t.turnNumber,
      audioBase64: t.audioBase64,
      blobUrl: url,
      preDelayMs: t.preDelayMs || 100,
    };
  });

  // Revoke only replaced or removed turn URLs
  existingTurns.forEach((t) => {
    if (t.blobUrl && !keptUrls.has(t.blobUrl)) {
      URL.revokeObjectURL(t.blobUrl);
    }
  });

  const activeTurnNumber = existingTurns[currentTurnIdx]?.turnNumber;
  const activeTurnUrl = existingTurns[currentTurnIdx]?.blobUrl;

  if (nextTurns.length === 0) {
    return { nextTurns, nextTurnIdx: 0, shouldUpdateSrc: false };
  }

  const preservedIdx =
    activeTurnNumber !== undefined
      ? nextTurns.findIndex((t) => t.turnNumber === activeTurnNumber)
      : -1;

  if (preservedIdx >= 0 && (isPlaying || currentTime > 0)) {
    const currentTarget = nextTurns[preservedIdx];
    const shouldUpdate = Boolean(currentTarget.blobUrl && currentTarget.blobUrl !== activeTurnUrl);
    return {
      nextTurns,
      nextTurnIdx: preservedIdx,
      shouldUpdateSrc: shouldUpdate,
      nextSrcUrl: shouldUpdate ? currentTarget.blobUrl : undefined,
    };
  }

  const nextTurnIdx = preservedIdx >= 0 ? preservedIdx : 0;
  const target = nextTurns[nextTurnIdx];
  const shouldUpdate = Boolean(
    target?.blobUrl && (!hasCurrentSrc || target.blobUrl !== activeTurnUrl)
  );
  return {
    nextTurns,
    nextTurnIdx,
    shouldUpdateSrc: shouldUpdate,
    nextSrcUrl: shouldUpdate ? target?.blobUrl : undefined,
  };
}

export function revokeTurnBlobUrls(turns: PlayerTurnEntry[]): void {
  turns.forEach((t) => {
    if (t.blobUrl) URL.revokeObjectURL(t.blobUrl);
  });
}
