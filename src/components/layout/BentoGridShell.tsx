import React from 'react';

// Estados de UI do BentoGridShell: empty | loading | success | error
export interface BentoGridShellProps {
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  gridState?: 'empty' | 'loading' | 'success' | 'error';
}

export const BentoGridShell: React.FC<BentoGridShellProps> = ({
  children,
  className = '',
  ariaLabel = 'Grade Principal do Estúdio',
}) => {
  return (
    <section
      aria-label={ariaLabel}
      className={`grid grid-cols-1 md:grid-cols-12 gap-6 w-full ${className}`.trim()}
    >
      {children}
    </section>
  );
};
