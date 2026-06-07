// Polyfill to safely redirect window.fetch property assignment to prevent sandboxing / iframe getter errors
try {
  const originalFetch = window.fetch;
  let customFetch = originalFetch;

  // Try to define on Window.prototype first, where it's usually configurable in most browser engines
  try {
    Object.defineProperty(Window.prototype, 'fetch', {
      configurable: true,
      enumerable: true,
      get() {
        return customFetch;
      },
      set(newFetch) {
        customFetch = newFetch;
      }
    });
  } catch (e1) {
    // If that fails, try defining on window directly
    try {
      Object.defineProperty(window, 'fetch', {
        configurable: true,
        enumerable: true,
        get() {
          return customFetch;
        },
        set(newFetch) {
          customFetch = newFetch;
        }
      });
    } catch (e2) {
      console.warn("Could not define fetch getter/setter on window:", e2);
    }
  }
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
