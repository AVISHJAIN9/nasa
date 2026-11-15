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
  const reduced = useReducedMotion();

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
