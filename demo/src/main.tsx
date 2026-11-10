import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import { I18nProvider } from './i18n/i18n-context';
import { applyDocumentLocale, detectLocale } from './i18n/locale';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';

const rootElement = document.getElementById('root');
if (rootElement === null) throw new Error('root element is missing');

// Apply the detected language before the first paint
applyDocumentLocale(detectLocale());

createRoot(rootElement).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
);
