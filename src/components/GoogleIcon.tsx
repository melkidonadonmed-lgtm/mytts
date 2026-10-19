import React from 'react';

export interface GoogleIconProps {
  name: string;
  size?: number;
  filled?: boolean;
  weight?: 300 | 400 | 500 | 600 | 700;
  grade?: -25 | 0 | 200;
  className?: string;
  title?: string;
  state?: 'idle' | 'loading' | 'success' | 'error';
}

export const GoogleIcon: React.FC<GoogleIconProps> = ({
  name,
  size = 20,
  filled = false,
  weight = 400,
  grade = 0,
  className = '',
  title,
  state = 'idle',
}) => {
  const resolvedName = name.trim() || 'help_outline';
  return (
    <span
      data-state={state}
      aria-busy={state === 'loading' ? 'true' : undefined}
      role={state === 'error' ? 'alert' : undefined}
      className={`material-symbols-rounded inline-flex items-center justify-center select-none shrink-0 leading-none align-middle ${className}`}
      style={{
        fontSize: `${size}px`,
        width: `${size}px`,
        height: `${size}px`,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}, 'GRAD' ${grade}, 'opsz' ${size}`,
      }}
      title={title}
      aria-hidden={title ? undefined : 'true'}
    >
      {resolvedName}
    </span>
  );
};

