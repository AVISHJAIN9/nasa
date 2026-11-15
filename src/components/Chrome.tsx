import {useState, type MouseEvent} from 'react';
import {brand, nav} from '../content';
import {scrollToHash} from '../lib/scroll';
import {Logo, LogoIcon} from '../app/ui/Logo';
import {useStore} from '../store';

function go(e: MouseEvent<HTMLAnchorElement>, then?: () => void) {
  const hash = e.currentTarget.getAttribute('href');
  if (!hash?.startsWith('#')) return;
  e.preventDefault();
  then?.();
  scrollToHash(hash);
}

export function Header() {
  const [open, setOpen] = useState(false);
  const authUser = useStore((s) => s.authUser);
  const setShowLoginModal = useStore((s) => s.setShowLoginModal);
  const logout = useStore((s) => s.logout);

  return (
    <header className="fixed inset-x-0 top-0 z-50 text-white">
      <div className="flex items-center justify-between px-4 pt-4 sm:px-6 sm:pt-5 md:px-[3vw]">
        <a href="#top" onClick={(e) => go(e)} className="flex items-center gap-2.5" aria-label={`${brand.name} — back to top`}>
          <Logo size={24} />
        </a>
        <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
          {nav.map((item) => (
            <a key={item.href} href={item.href} onClick={(e) => go(e)} className="font-mono text-label text-white/75 uppercase transition-colors hover:text-white">
              {item.label}
            </a>
          ))}

          {/* Unified Email Authentication Trigger */}
          {authUser ? (
            <div className="flex items-center gap-2 font-mono text-label">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/10 text-white border border-white/10">
                <span className="size-2 rounded-full bg-earth" />
                <span className="truncate max-w-[150px]">{authUser.email}</span>
              </span>
              <button
                type="button"
                onClick={logout}
                className="text-regolith/60 hover:text-white uppercase transition-colors px-1.5 py-1 active:scale-[0.97]"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowLoginModal(true)}
              className="font-mono text-label text-white/90 uppercase transition-all duration-150 ease-out hover:text-earth hover:border-earth/50 active:scale-[0.97] touch-manipulation cursor-pointer flex items-center gap-1.5 px-3 py-2 rounded border border-white/20 bg-void/50 backdrop-blur-sm"
            >
              <span>🔑</span> Sign In
            </button>
          )}

          <a href="#launch" onClick={(e) => go(e)} className="rounded-[4px] bg-white px-4 py-2 font-mono text-label text-void uppercase transition-all duration-150 ease-out hover:bg-earth active:scale-[0.97] touch-manipulation cursor-pointer">
            Open console
          </a>
        </nav>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="menu" className="font-mono text-label uppercase md:hidden">
          {open ? 'Close' : 'Menu'}
        </button>
      </div>
      <div id="menu" inert={!open} className={`fixed inset-0 -z-10 flex flex-col justify-center gap-6 bg-void/95 px-6 backdrop-blur-xl transition-opacity md:hidden ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
        {nav.map((item, i) => (
          <a key={item.href} href={item.href} onClick={(e) => go(e, () => setOpen(false))} className="flex items-baseline gap-4 font-display text-[1.75rem] tracking-[0.14em] uppercase">
            <span className="font-mono text-label text-earth">0{i + 1}</span>
            {item.label}
          </a>
        ))}
        <div className="pt-4 border-t border-white/10 flex flex-col gap-3">
          {authUser ? (
            <div className="flex items-center justify-between font-mono text-xs">
              <span className="text-white/80">{authUser.email}</span>
              <button
                type="button"
                onClick={() => {
                  logout();
                  setOpen(false);
                }}
                className="text-earth hover:underline uppercase"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setShowLoginModal(true);
                setOpen(false);
              }}
              className="w-full py-2.5 rounded bg-white/10 font-mono text-xs uppercase text-white hover:bg-white/20"
            >
              Sign In with Email
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-void px-4 py-8 sm:px-6 md:px-[6vw]">
      <div className="flex flex-col gap-4 font-mono text-label text-regolith/50 uppercase md:flex-row md:items-center md:justify-between">
        <span className="flex items-center gap-2.5 text-white/80">
          <LogoIcon size={20} />
          <span>{brand.wordmark} · AstroCare: how should a Mars crew decide when a reply takes 20 minutes? A decision-support prototype on simulated and public data. Not a medical device.</span>
        </span>
        <span>© {new Date().getFullYear()} · Imagery generated for this concept</span>
        <a href="#top" onClick={(e) => go(e)} className="hover:text-white">
          Back to the surface ↑
        </a>
      </div>
    </footer>
  );
}
