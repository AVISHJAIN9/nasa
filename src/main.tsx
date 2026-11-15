import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './index.css';
import {useStore} from './store';

// Expose store for test/automation
(window as unknown as {useStore: typeof useStore}).useStore = useStore;

// The pinned stages depend on scroll position; always start at the top.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
