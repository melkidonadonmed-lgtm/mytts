import React, { useState } from 'react';
import type { SoftCardProps, ComponentFSMState } from '../../types';
import { getBentoSpanClass, TONAL_LAYER_CLASSES } from '../../config/tokens';

export function resolveCardFSMState(params: {
  isLoading?: boolean;
  error?: string | null;
  isPressed?: boolean;
}): ComponentFSMState {
  if (params.error) return 'error';
  if (params.isLoading) return 'loading';
  if (params.isPressed) return 'pressed';
  return 'idle';
}

export function sanitizeCardTitle(rawTitle: string): string {
  return rawTitle.trim();
}

export const SoftCard: React.FC<SoftCardProps> = ({
  title,
  badgeText,
  colSpan = 4,
  layer = 3,
  isLoading = false,
  error = null,
  isEmpty = false,
  emptyMessage = 'Nenhum item disponível nesta camada.',
  children,
  className = '',
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const fsmState = resolveCardFSMState({ isLoading, error, isPressed });
  const spanClass = getBentoSpanClass(colSpan);
  const layerClass = TONAL_LAYER_CLASSES[layer];
  const safeTitle = title ? sanitizeCardTitle(title) : '';

  return (
    <article
      className={`ui-card-soft ${layerClass} ${spanClass} ${className}`.trim()}
      tabIndex={0}
      aria-label={safeTitle || undefined}
      aria-busy={isLoading}
      data-fsm-state={fsmState}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
    >
      {(safeTitle || badgeText) && (
        <div className="flex justify-between items-center mb-5 gap-3">
          {safeTitle && (
            <h3 className="text-xl font-semibold text-primary tracking-tight font-display">
              {safeTitle}
            </h3>
          )}
          {badgeText && (
            <span className="badge-soft btn-anti-squish tabular-nums">{badgeText}</span>
          )}
        </div>
      )}

      {isLoading ? (
        <div
          role="status"
          aria-busy="true"
          aria-live="polite"
          className="surface-inset p-4 rounded-xl text-secondary text-sm"
        >
          Sincronizando camada tonal...
        </div>
      ) : error ? (
        <div
          role="alert"
          aria-live="assertive"
          className="surface-inset p-4 rounded-xl text-rose-500 font-medium text-sm"
        >
          {error}
        </div>
      ) : isEmpty ? (
        <div
          role="region"
          aria-label="Estado vazio"
          className="surface-inset p-4 rounded-xl text-secondary text-sm"
        >
          {emptyMessage}
        </div>
      ) : (
        <div className="card-body w-full">{children}</div>
      )}
    </article>
  );
};
