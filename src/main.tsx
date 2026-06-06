// Polyfill to safely redirect window.fetch property assignment to prevent sandboxing / iframe getter errors
try {
  let originalFetch = window.fetch;
  Object.defineProperty(window, 'fetch', {
    configurable: true,
    enumerable: true,
    get() {
      return originalFetch;
    },
    set(newFetch) {
      originalFetch = newFetch;
    }
  });
} catch (e) {
  console.warn("Could not patch window.fetch:", e);
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
