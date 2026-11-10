import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';

const rootElement = document.getElementById('root');
if (rootElement === null) throw new Error('root element is missing');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
