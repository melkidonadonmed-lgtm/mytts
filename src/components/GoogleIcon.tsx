import React from 'react';

export interface GoogleIconProps {
  name: string;
  size?: number;
  filled?: boolean;
  weight?: 300 | 400 | 500 | 600 | 700;
  grade?: -25 | 0 | 200;
  className?: string;
  title?: string;
}

/**
 * Componente oficial de Ícones do Google (Material Symbols Rounded)
 * Renderiza símbolos vetoriais de altíssima definição com suporte a preenchimento tátil e peso óptico.
 */
export const GoogleIcon: React.FC<GoogleIconProps> = ({
  name,
  size = 20,
  filled = false,
  weight = 400,
  grade = 0,
  className = '',
  title,
}) => {
  return (
    <span
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
      {name}
    </span>
  );
};
