import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Falha ao localizar o container #root (estado vazio/erro de inicialização).');
}
rootElement.setAttribute('data-state', 'idle');
rootElement.setAttribute('aria-busy', 'false');
createRoot(rootElement).render(<App />);

