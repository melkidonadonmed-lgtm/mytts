import React from 'react';
import { SoftCard } from '../ui/SoftCard';
import type { SoftCardProps } from '../../types';

export interface BentoStudioCardProps extends SoftCardProps {
  metricValue?: string;
  metricUnit?: string;
  statusState?: 'empty' | 'loading' | 'success' | 'error';
}

export const BentoStudioCard: React.FC<BentoStudioCardProps> = ({
  metricValue,
  metricUnit,
  children,
  ...cardProps
}) => {
  return (
    <SoftCard {...cardProps}>
      {metricValue !== undefined && (
        <div className="mb-3 flex items-baseline gap-1.5">
          <span className="text-2xl font-extrabold text-primary font-display tabular-nums">
            {metricValue}
          </span>
          {metricUnit && (
            <span className="text-xs font-mono text-secondary tabular-nums">
              {metricUnit}
            </span>
          )}
        </div>
      )}
      {children}
    </SoftCard>
  );
};
