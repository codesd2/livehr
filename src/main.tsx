import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';

// Filter out cross-origin iframe security error noises from breaking parent context analytics
if (typeof window !== 'undefined') {
  const isScriptError = (message: any, url: any) => {
    return (
      message === 'Script error.' ||
      message === 'Script error' ||
      (typeof message === 'string' && message.includes('Script error')) ||
      url === '' ||
      !url
    );
  };

  window.addEventListener('error', (event) => {
    if (isScriptError(event.message, event.filename)) {
      event.preventDefault();
      event.stopPropagation();
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = reason instanceof Error ? reason.message : String(reason);
    if (isScriptError(msg, '')) {
      event.preventDefault();
      event.stopPropagation();
    }
  });

  const originalOnError = window.onerror;
  window.onerror = function (message, url, line, col, error) {
    if (isScriptError(message, url)) {
      return true; // prevent firing default action / bubbling
    }
    if (originalOnError) {
      return originalOnError.apply(this, arguments as any);
    }
    return false;
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

