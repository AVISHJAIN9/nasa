import {useEffect} from 'react';
import {Footer, Header} from './components/Chrome';
import {Earthrise} from './components/Earthrise';
import {Trajectory} from './components/Trajectory';
import {Launch} from './components/Launch';
import {AppShell} from './app/AppShell';
import {useReducedMotion} from './hooks/useReducedMotion';
import {startScroll} from './lib/scroll';
import {useStore} from './store';

export default function App() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const setPage = useStore((s) => s.setPage);
  const reduced = useReducedMotion();

  useEffect(() => {
    const checkHash = () => {
      const h = window.location.hash.replace('#', '').trim();
      const consolePages = [
        'home', 'woa', 'assistant', 'protocols', 'proof', 'limits',
        'wellness', 'notes', 'orders', 'brief', 'whatif', 'audit',
        'supplies', 'syndromes', 'forecast', 'telesession', 'broadcast',
        'roadmap', 'integration', 'typing', 'sensors'
      ];
      if (consolePages.includes(h)) {
        setView('app');
        setPage(h as any);
      }
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, [setView, setPage]);

  useEffect(() => {
    if (view === 'landing') {
      return startScroll(reduced);
    }
  }, [view, reduced]);

  if (view === 'app') {
    return <AppShell />;
  }

  return (
    <>
      <Header />
      <main>
        <Earthrise />
        <Trajectory />
        <Launch />
      </main>
      <Footer />
    </>
  );
}
