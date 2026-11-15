import {useEffect, useState, useMemo, lazy, Suspense} from 'react';
import {
  useStore,
  MODES,
  getIndependenceLevel,
  LEVELS,
  type UserRole,
  type MissionMode,
  type AppPage,
} from '../store';
import {ErrorBoundary, PageSkeleton, Logo, TourEngine} from './ui';
import {DemoPanel} from './DemoPanel';
import {ConsentModal} from './ui/ConsentModal';
import {OnboardingWizard} from './ui/OnboardingWizard';

const Astronaut = lazy(() => import('./pages/Astronaut').then((m) => ({default: m.Astronaut})));
const Surgeon = lazy(() => import('./pages/Surgeon').then((m) => ({default: m.Surgeon})));
const Control = lazy(() => import('./pages/Control').then((m) => ({default: m.Control})));
const WaitOrAct = lazy(() => import('./pages/WaitOrAct').then((m) => ({default: m.WaitOrAct})));
const Assistant = lazy(() => import('./pages/Assistant').then((m) => ({default: m.Assistant})));
const Protocols = lazy(() => import('./pages/Protocols').then((m) => ({default: m.Protocols})));
const Proof = lazy(() => import('./pages/Proof').then((m) => ({default: m.Proof})));
const Limits = lazy(() => import('./pages/Limits').then((m) => ({default: m.Limits})));
const Wellness = lazy(() => import('./pages/Wellness').then((m) => ({default: m.Wellness})));
const Notes = lazy(() => import('./pages/Notes').then((m) => ({default: m.Notes})));
const Orders = lazy(() => import('./pages/Orders').then((m) => ({default: m.Orders})));
const Brief = lazy(() => import('./pages/Brief').then((m) => ({default: m.Brief})));
const WhatIf = lazy(() => import('./pages/WhatIf').then((m) => ({default: m.WhatIf})));
const Audit = lazy(() => import('./pages/Audit').then((m) => ({default: m.Audit})));
const Supplies = lazy(() => import('./pages/Supplies').then((m) => ({default: m.Supplies})));
const Syndromes = lazy(() => import('./pages/Syndromes').then((m) => ({default: m.Syndromes})));
const Forecast = lazy(() => import('./pages/Forecast').then((m) => ({default: m.Forecast})));
const TeleSession = lazy(() => import('./pages/TeleSession').then((m) => ({default: m.TeleSession})));
const Broadcast = lazy(() => import('./pages/Broadcast').then((m) => ({default: m.Broadcast})));
const Roadmap = lazy(() => import('./pages/Roadmap').then((m) => ({default: m.Roadmap})));
const Integration = lazy(() => import('./pages/Integration').then((m) => ({default: m.Integration})));
const TypingPointer = lazy(() => import('./pages/TypingPointer').then((m) => ({default: m.TypingPointer})));
const SensorsConsent = lazy(() => import('./pages/SensorsConsent').then((m) => ({default: m.SensorsConsent})));

interface NavItem {
  id: AppPage;
  label: string;
  icon: string;
}

interface NavGroup {
  id: string;
  title: string;
  items: NavItem[];
}

export function AppShell() {
  const role = useStore((s) => s.role);
  const setRole = useStore((s) => s.setRole);
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const setView = useStore((s) => s.setView);
  const page = useStore((s) => s.page);
  const setPage = useStore((s) => s.setPage);
  const aiDegraded = useStore((s) => s.aiDegraded);
  const aiDegradedReason = useStore((s) => s.aiDegradedReason);
  const timeScale = useStore((s) => s.timeScale);
  const tick = useStore((s) => s.tick);
  const crew = useStore((s) => s.crew);
  const toasts = useStore((s) => s.toasts);
  const removeToast = useStore((s) => s.removeToast);
  const linkUp = useStore((s) => s.linkUp);
  const authUser = useStore((s) => s.authUser);
  const logout = useStore((s) => s.logout);
  const showLoginModal = useStore((s) => s.showLoginModal);
  const setShowLoginModal = useStore((s) => s.setShowLoginModal);
  const pendingOfflineCount = useStore((s) => s.pendingOfflineCount);
  const a11yMode = useStore((s) => s.a11yMode);
  const toggleA11yMode = useStore((s) => s.toggleA11yMode);
  const mlAlertsEnabled = useStore((s) => s.mlAlertsEnabled);
  const narrationCaption = useStore((s) => s.narrationCaption);
  const storyRunning = useStore((s) => s.storyRunning);
  const startMarsStory = useStore((s) => s.startMarsStory);
  const stopMarsStory = useStore((s) => s.stopMarsStory);
  const resetDemoState = useStore((s) => s.resetDemoState);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showExitTourModal, setShowExitTourModal] = useState(false);
  const [clock, setClock] = useState(() => new Date().toLocaleTimeString());

  const handleBrandHomeClick = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (storyRunning) {
      setShowExitTourModal(true);
      return;
    }
    setPage('home');
    window.location.hash = '#home';
    window.scrollTo({top: 0, behavior: 'smooth'});
  };

  // Close drawer on route or role change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [page, role]);

  // Synchronize hash routing bidirectionally
  useEffect(() => {
    const validPages: AppPage[] = [
      'home', 'woa', 'assistant', 'protocols', 'proof', 'limits',
      'wellness', 'notes', 'orders', 'brief', 'whatif', 'audit',
      'supplies', 'syndromes', 'forecast', 'telesession', 'broadcast',
      'roadmap', 'integration'
    ];

    const handleHash = () => {
      const h = window.location.hash.replace('#', '').trim();
      if (validPages.includes(h as AppPage)) {
        setPage(h as AppPage);
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [setPage]);

  // Keep location hash in sync with page
  useEffect(() => {
    if (page && window.location.hash !== `#${page}`) {
      window.location.hash = page;
    }
  }, [page]);

  // Set default role if null
  useEffect(() => {
    if (!role) {
      setRole('surgeon');
    }
  }, [role, setRole]);

  // Live Clock
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 1s Tick Interval (scaled by timeScale)
  useEffect(() => {
    const intervalMs = Math.max(50, Math.floor(1000 / timeScale));
    const timer = setInterval(() => {
      tick();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [timeScale, tick]);

  // Native scroll to top on page change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);

  // Keyboard navigation: Escape key handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (toasts.length > 0) {
          removeToast(toasts[toasts.length - 1].id);
        }
        if (mobileMenuOpen) {
          setMobileMenuOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toasts, removeToast, mobileMenuOpen]);

  const indLevel = getIndependenceLevel(mode);
  const levelInfo = LEVELS[indLevel];
  const modeInfo = MODES[mode];
  const rttSec = modeInfo.delaySec * 2;
  const mm = String(Math.floor(rttSec / 60)).padStart(2, '0');
  const ss = String(Math.floor(rttSec % 60)).padStart(2, '0');

  // Dynamic provenance counts computation
  let realCount = 0;
  let simulatedCount = 0;
  crew.forEach((c) => {
    Object.values(c.readings).forEach((stream) => {
      stream.forEach((r) => {
        if (r.provenance === 'REAL') realCount++;
        else simulatedCount++;
      });
    });
  });

  // Navigation definition per role
  const groups: NavGroup[] = useMemo(() => {
    const activeRole = role || 'surgeon';
    const list: NavGroup[] = [];

    if (activeRole === 'astronaut') {
      list.push({
        id: 'health',
        title: 'Health',
        items: [
          {id: 'wellness', label: 'Wellness', icon: '❤️'},
          {id: 'typing', label: 'Typing & Pointer', icon: '⌨️'},
          {id: 'assistant', label: 'Assistant', icon: '🤖'},
          {id: 'protocols', label: 'Protocols', icon: '📋'},
        ],
      });
      list.push({
        id: 'mission',
        title: 'Mission',
        items: [
          {id: 'woa', label: 'Wait-or-Act', icon: '⚖️'},
          {id: 'orders', label: 'Orders', icon: '📦'},
          {id: 'broadcast', label: 'Broadcast', icon: '📢'},
          {id: 'telesession', label: 'Tele-session', icon: '💬'},
        ],
      });
    } else if (activeRole === 'surgeon') {
      list.push({
        id: 'patients',
        title: 'Patients',
        items: [
          {id: 'notes', label: 'Notes', icon: '📝'},
          {id: 'brief', label: 'Daily Brief', icon: '📰'},
          {id: 'syndromes', label: 'Syndromes', icon: '🧬'},
          {id: 'forecast', label: 'Forecast', icon: '📈'},
          {id: 'whatif', label: 'What-If', icon: '🔮'},
        ],
      });
      list.push({
        id: 'operations',
        title: 'Operations',
        items: [
          {id: 'orders', label: 'Orders', icon: '📦'},
          {id: 'telesession', label: 'Tele-session', icon: '💬'},
          {id: 'broadcast', label: 'Broadcast', icon: '📢'},
          {id: 'supplies', label: 'Supplies', icon: '🧰'},
          {id: 'woa', label: 'Wait-or-Act', icon: '⚖️'},
        ],
      });
    } else {
      // Mission Control
      list.push({
        id: 'operations',
        title: 'Operations',
        items: [
          {id: 'woa', label: 'Wait-or-Act', icon: '⚖️'},
          {id: 'broadcast', label: 'Broadcast', icon: '📢'},
          {id: 'supplies', label: 'Supplies', icon: '🧰'},
          {id: 'telesession', label: 'Tele-session', icon: '💬'},
        ],
      });
    }

    // System group for all roles
    list.push({
      id: 'system',
      title: 'System',
      items: [
        {id: 'assistant', label: 'Assistant', icon: '🤖'},
        {id: 'typing', label: 'Typing & Pointer', icon: '⌨️'},
        {id: 'sensors', label: 'Sensors & Consent', icon: '🛡️'},
        {id: 'proof', label: 'Proof', icon: '🔬'},
        {id: 'limits', label: 'Limits', icon: '🛡️'},
        {id: 'audit', label: 'Audit', icon: '🔐'},
        {id: 'roadmap', label: 'Roadmap', icon: '🗺️'},
        {id: 'integration', label: 'Integration', icon: '⚡'},
      ],
    });

    return list;
  }, [role]);

  // Accordion open group state
  const [openGroup, setOpenGroup] = useState<string | null>(() => {
    for (const g of groups) {
      if (g.items.some((item) => item.id === page)) return g.id;
    }
    return groups[0]?.id || null;
  });

  // Automatically open group when page changes
  useEffect(() => {
    for (const g of groups) {
      if (g.items.some((item) => item.id === page)) {
        setOpenGroup(g.id);
        return;
      }
    }
  }, [page, groups]);

  const toggleGroup = (groupId: string) => {
    setOpenGroup((prev) => (prev === groupId ? null : groupId));
  };

  const navTo = (targetPage: AppPage) => {
    setPage(targetPage);
    setMobileMenuOpen(false);
  };

  const roleSegments: Array<{id: UserRole; label: string}> = [
    {id: 'astronaut', label: 'Astronaut'},
    {id: 'surgeon', label: 'Surgeon'},
    {id: 'control', label: 'Control'},
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full justify-between p-4 space-y-6">
      <div className="space-y-5">
        {/* Brand Wordmark & Home Navigation */}
        <div className="flex items-center justify-between">
          <a
            href="#home"
            onClick={handleBrandHomeClick}
            className="flex items-center gap-2.5 text-left group focus-visible:ring-2 focus-visible:ring-earth rounded-md p-1 -m-1 transition-transform duration-150 active:scale-95 cursor-pointer"
            aria-label="AstroCare — Return to Home"
          >
            <Logo size={26} glow />
          </a>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden text-regolith/60 hover:text-white p-1"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        {/* Compact Segmented Role Switcher */}
        <div>
          <span className="font-mono text-[11px] text-regolith/50 uppercase tracking-wider block mb-1.5">
            Role Console
          </span>
          <div className="grid grid-cols-3 gap-1 p-1 bg-void-2 rounded-lg border border-white/10">
            {roleSegments.map((r) => {
              const active = role === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setRole(r.id);
                    setPage('home');
                  }}
                  className={`py-1.5 px-2 text-center font-mono text-[11px] uppercase rounded transition-colors ${
                    active
                      ? 'bg-earth text-void font-bold shadow-sm'
                      : 'text-regolith/70 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
          {authUser ? (
            <div className="mt-2 p-2 rounded bg-void border border-white/10 space-y-1.5 font-mono">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11px] text-white font-medium truncate max-w-[150px]">
                  <span className="size-2 rounded-full bg-earth" />
                  {authUser.name || authUser.email.split('@')[0]}
                </span>
                <span className="px-1.5 py-0.2 text-[9px] rounded bg-white/10 text-earth font-bold uppercase">
                  {authUser.role}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-regolith/60">
                <span className="truncate max-w-[130px]">{authUser.email}</span>
                <button
                  type="button"
                  onClick={logout}
                  className="text-red-400 hover:text-red-300 uppercase hover:underline ml-1 cursor-pointer active:scale-[0.97]"
                >
                  Sign out
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between mt-1.5 px-0.5">
              <span className="font-mono text-[10px] text-regolith/50">Unified Identity</span>
              <button
                type="button"
                onClick={() => setShowLoginModal(true)}
                className="text-[10px] font-mono text-earth hover:underline flex items-center gap-1 active:scale-[0.97] cursor-pointer"
              >
                <span>🔑</span> Sign In with Email
              </button>
            </div>
          )}
        </div>

        {/* Navigation list */}
        <nav className="space-y-1.5">
          {/* Home Item */}
          <button
            type="button"
            onClick={() => navTo('home')}
            className={`w-full h-9 px-3 flex items-center justify-between text-xs font-mono rounded transition-colors ${
              page === 'home'
                ? 'border-l-2 border-earth bg-white/10 text-white font-semibold'
                : 'border-l-2 border-transparent text-regolith/75 hover:bg-white/5 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <span>📊</span>
              <span>Home Console</span>
            </span>
            {page === 'home' && <span className="text-earth text-xs">●</span>}
          </button>

          {/* Accordion Groups */}
          {groups.map((group) => {
            const isOpen = openGroup === group.id;
            const hasActiveItem = group.items.some((i) => i.id === page);

            return (
              <div key={group.id} className="pt-1">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className={`w-full px-2 py-1 flex items-center justify-between font-mono text-[11px] uppercase tracking-wider transition-colors rounded ${
                    hasActiveItem ? 'text-earth font-bold' : 'text-regolith/50 hover:text-regolith'
                  }`}
                >
                  <span>{group.title}</span>
                  <span className="text-[11px]">{isOpen ? '▾' : '▸'}</span>
                </button>

                {isOpen && (
                  <div className="mt-1 space-y-0.5 pl-1">
                    {group.items.map((item) => {
                      const isActive = page === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => navTo(item.id)}
                          className={`w-full h-9 px-2.5 flex items-center justify-between text-xs font-mono rounded transition-colors ${
                            isActive
                              ? 'border-l-2 border-earth bg-white/10 text-white font-semibold'
                              : 'border-l-2 border-transparent text-regolith/75 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <span className="flex items-center gap-2 truncate">
                            <span>{item.icon}</span>
                            <span className="truncate">{item.label}</span>
                          </span>
                          {isActive && <span className="text-earth text-xs">›</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Sidebar Footer */}
      <div className="pt-4 border-t border-white/10 space-y-3 font-mono">
        {/* Mode Selector */}
        <div>
          <span className="text-[11px] text-regolith/50 uppercase tracking-wider block mb-1">
            Mission Mode
          </span>
          <div className="grid grid-cols-3 gap-1">
            {(['ISS', 'MOON', 'MARS'] as MissionMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`py-1 text-[11px] font-bold uppercase rounded border transition-colors ${
                  mode === m
                    ? 'bg-white/20 text-white border-white/30'
                    : 'bg-void-2 text-regolith/60 border-white/5 hover:text-white'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* A11Y Mode */}
        <button
          type="button"
          onClick={toggleA11yMode}
          aria-pressed={a11yMode}
          className={`w-full py-1.5 px-2.5 rounded text-xs uppercase flex items-center justify-between border transition-all ${
            a11yMode
              ? 'bg-earth text-void border-earth font-bold'
              : 'bg-void-2 text-regolith/70 border-white/10 hover:text-white hover:border-white/20'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <span>♿</span>
            <span>A11Y Mode</span>
          </span>
          <span className="text-[11px]">[{a11yMode ? 'ON' : 'OFF'}]</span>
        </button>

        {/* Back to landing */}
        <button
          type="button"
          onClick={() => {
            setView('landing');
            window.scrollTo({top: 0, behavior: 'instant'});
          }}
          className="w-full text-left text-xs text-regolith/60 hover:text-white uppercase transition-colors flex items-center gap-1.5 py-1"
        >
          <span>←</span> Back to landing site
        </button>
      </div>
    </div>
  );

  return (
    <div className={`min-h-[100svh] bg-void text-regolith md:grid md:grid-cols-[260px_1fr] flex flex-col ${a11yMode ? 'a11y-mode' : ''}`}>
      {/* Consent Modal (F006) */}
      <ConsentModal />

      {/* Onboarding Wizard (F007) */}
      <OnboardingWizard />

      {/* Toast Notifications */}
      {toasts.length > 0 && (
        <div role="status" aria-live="polite" className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              onClick={() => removeToast(t.id)}
              className={`pointer-events-auto rounded-lg px-4 py-3 shadow-2xl border text-xs font-mono flex items-center justify-between gap-3 animate-fade-in ${
                t.type === 'warn'
                  ? 'bg-mars/90 text-white border-mars'
                  : t.type === 'success'
                  ? 'bg-emerald-950/90 text-emerald-200 border-emerald-600'
                  : 'bg-void-2 text-white border-white/20'
              }`}
            >
              <span>{t.message}</span>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                aria-label="Dismiss notification"
                className="text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Desktop Sticky Sidebar */}
      <aside
        data-lenis-prevent
        className="hidden md:block sticky top-0 h-[100svh] overflow-y-auto overscroll-contain bg-void border-r border-white/10"
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden" role="dialog" aria-modal="true" aria-label="Navigation drawer">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div
            data-lenis-prevent
            className="relative w-72 max-w-[85vw] h-full bg-void border-r border-white/10 overflow-y-auto z-10 shadow-2xl"
          >
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main Column */}
      <div className="min-w-0 flex flex-col flex-1">
        {/* Single Combined Sticky Header (max 72px, z-30, backdrop blur, solid background 96% opacity) */}
        <header className="sticky top-0 z-30 max-h-[72px] h-[72px] backdrop-blur-md bg-[#0a0605]/96 border-b border-white/10 px-4 md:px-8 flex items-center justify-between font-mono text-xs">
          {/* Left: Clock, Mobile Hamburger, Live Provenance Chips */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-1.5 rounded border border-white/10 text-white hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-earth focus-visible:outline-none"
              aria-label="Open navigation menu"
            >
              <svg viewBox="0 0 24 24" className="size-5 fill-none stroke-currentColor stroke-2">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <a
              href="#home"
              onClick={handleBrandHomeClick}
              className="md:hidden flex items-center p-1 rounded hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-earth cursor-pointer"
              aria-label="AstroCare — Return to Home"
            >
              <Logo size={20} showWordmark={false} />
            </a>

            <span className="text-white font-bold tracking-wider hidden sm:inline">
              SOL 142 · {clock} UTC
            </span>

            {/* Live Provenance Chips */}
            <div className="flex items-center gap-1.5 text-[11px] uppercase font-bold">
              <span className="rounded bg-earth/20 text-earth border border-earth/40 px-2 py-0.5">
                {realCount} REAL
              </span>
              <span className="rounded bg-white/5 text-regolith/70 border border-white/10 px-2 py-0.5">
                {simulatedCount} SIMULATED
              </span>
              {pendingOfflineCount > 0 && (
                <span className="rounded bg-mars/20 text-mars border border-mars/40 px-2 py-0.5 animate-pulse">
                  Sync ({pendingOfflineCount})
                </span>
              )}
            </div>

            {timeScale > 1 && (
              <span className="rounded bg-mars/20 text-mars border border-mars/40 px-2 py-0.5 text-[11px] font-bold">
                {timeScale}x
              </span>
            )}
          </div>

          {/* Right: Link State, Delay, Level N Segmented Bar */}
          <div className="flex items-center gap-3 md:gap-4">
            {/* Link state */}
            <div className="flex items-center gap-1.5">
              <span
                className={`size-2 rounded-full ${
                  linkUp ? 'bg-earth animate-pulse' : 'bg-mars'
                }`}
              />
              <span className={`text-[11px] font-bold hidden sm:inline ${linkUp ? 'text-earth' : 'text-mars'}`}>
                {linkUp ? 'DSN LOCK' : 'OFFLINE'}
              </span>
            </div>

            {/* RTT Delay */}
            <div className="text-[11px] text-regolith/80">
              <span className="text-white font-bold tabular-nums">{mm}:{ss}</span> RTT
            </div>

            {/* Level indicator & 4-step bar */}
            <div className="flex items-center gap-2 pl-2 border-l border-white/10">
              <span
                className={`text-[11px] font-bold uppercase ${
                  indLevel === 3
                    ? 'text-mars'
                    : indLevel === 2
                    ? 'text-[#e0b03a]'
                    : 'text-earth'
                }`}
              >
                L{indLevel} · {levelInfo.label}
              </span>

              <div className="hidden sm:flex items-center gap-1">
                {[0, 1, 2, 3].map((step) => {
                  const active = step <= indLevel;
                  const stepColor =
                    indLevel === 3 ? 'bg-mars' : indLevel === 2 ? 'bg-[#e0b03a]' : 'bg-earth';
                  return (
                    <div
                      key={step}
                      className={`h-2 w-4 rounded-sm transition-all duration-300 ${
                        active ? stepColor : 'bg-white/10'
                      }`}
                      title={`Level ${step}: ${LEVELS[step].label}`}
                    />
                  );
                })}
              </div>

              {!storyRunning && (
                <button
                  type="button"
                  onClick={() => {
                    resetDemoState();
                    startMarsStory();
                  }}
                  id="start-demo-tour-button"
                  className="rounded-lg bg-earth px-3 py-1.5 font-mono text-xs font-bold text-void uppercase hover:bg-earth/90 transition-all shadow-[0_0_12px_rgba(111,182,255,0.3)] flex items-center gap-1.5 min-h-[36px] cursor-pointer active:scale-[0.97]"
                  title="Launch 8-Minute Mars Demonstration Timeline"
                >
                  <span>⚡</span>
                  <span className="hidden md:inline">Mars Demo (8:00)</span>
                </button>
              )}

              {/* User Account / Sign In Status */}
              <div className="hidden lg:flex items-center pl-2 border-l border-white/10 font-mono">
                {authUser ? (
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 border border-white/10 text-white text-[11px]">
                      <span className="size-2 rounded-full bg-earth" />
                      <span className="truncate max-w-[120px]">{authUser.email}</span>
                    </span>
                    <button
                      type="button"
                      onClick={logout}
                      className="text-[10px] uppercase text-regolith/60 hover:text-white transition-colors cursor-pointer active:scale-[0.97]"
                    >
                      Sign out
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowLoginModal(true)}
                    className="px-2.5 py-1 rounded border border-white/15 bg-white/5 text-white/90 hover:text-earth hover:border-earth/40 text-[11px] uppercase transition-all duration-150 active:scale-[0.97] cursor-pointer"
                  >
                    Sign In
                  </button>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* AI Degraded Watchdog Banner */}
        {aiDegraded && (
          <div role="status" aria-live="assertive" data-tour="ch9-watchdog-banner" className="bg-[#e0b03a]/15 border-b border-[#e0b03a]/40 px-4 py-2 font-mono text-xs text-[#e0b03a] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>⚠️</span>
              <span className="font-bold">
                AI DEGRADED: RULES ONLY — reason: {aiDegradedReason || 'sensor quality'}
              </span>
              <span className="hidden sm:inline text-regolith/80">
                — Algorithmic anomaly models halted. Hard failsafe rules remain active.
              </span>
            </div>
            <button
              type="button"
              onClick={() => useStore.getState().clearScenarios()}
              className="rounded bg-[#e0b03a]/20 border border-[#e0b03a]/40 px-2 py-0.5 text-[11px] text-[#e0b03a] uppercase font-bold hover:bg-[#e0b03a] hover:text-void transition-colors focus-visible:ring-2 focus-visible:ring-[#e0b03a]"
            >
              Restore AI
            </button>
          </div>
        )}

        {/* ML Alerts Disabled Banner (F141) */}
        {!mlAlertsEnabled && (
          <div role="status" aria-live="polite" className="bg-[#e0b03a]/15 border-b border-[#e0b03a]/40 px-4 py-2 font-mono text-xs text-[#e0b03a] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>⚙️</span>
              <span className="font-bold">
                ML off: rules only
              </span>
              <span className="hidden sm:inline text-regolith/80">
                — Machine learning anomaly detectors suspended. Hard failsafe rules remain active.
              </span>
            </div>
          </div>
        )}

        {/* Main Content Viewport */}
        <main className="flex-1">
          <div className="max-w-[1400px] w-full mx-auto px-6 md:px-10 py-8 pb-[120px]">
            <ErrorBoundary>
              <Suspense fallback={<PageSkeleton />}>
                {page === 'home' && (
                  <>
                    {role === 'astronaut' && <Astronaut />}
                    {role === 'surgeon' && <Surgeon />}
                    {role === 'control' && <Control />}
                    {!role && <Surgeon />}
                  </>
                )}
                {page === 'woa' && <WaitOrAct />}
                {page === 'assistant' && <Assistant />}
                {page === 'protocols' && <Protocols />}
                {page === 'wellness' && <Wellness />}
                {page === 'proof' && <Proof />}
                {page === 'limits' && <Limits />}
                {page === 'notes' && <Notes />}
                {page === 'orders' && <Orders />}
                {page === 'brief' && <Brief />}
                {page === 'whatif' && <WhatIf />}
                {page === 'audit' && <Audit />}
                {page === 'supplies' && <Supplies />}
                {page === 'syndromes' && <Syndromes />}
                {page === 'forecast' && <Forecast />}
                {page === 'telesession' && <TeleSession />}
                {page === 'broadcast' && <Broadcast />}
                {page === 'roadmap' && <Roadmap />}
                {page === 'integration' && <Integration />}
                {page === 'typing' && <TypingPointer />}
                {page === 'sensors' && <SensorsConsent />}
              </Suspense>
            </ErrorBoundary>

            <footer className="border-t border-white/10 mt-16 pt-6 text-center font-mono text-[11px] text-regolith/50">
              AstroCare · Prototype. Simulated data unless tagged REAL. Not a medical device.
            </footer>
          </div>
        </main>
      </div>

      {/* Story Narration Overlay */}
      {narrationCaption && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-xl w-[92%] sm:w-auto rounded-xl bg-void-2/95 border border-earth/50 px-5 py-3 text-center font-mono text-xs text-white shadow-2xl backdrop-blur-md"
        >
          <div className="flex items-center justify-center gap-2 text-earth font-bold text-[11px] uppercase tracking-wider mb-0.5">
            <span className="animate-pulse">●</span> MARS 8-MINUTE TIMELINE
          </div>
          <p className="text-regolith leading-relaxed">{narrationCaption}</p>
        </aside>
      )}

      {/* Exit Demo Tour Confirmation Modal (A8) */}
      {showExitTourModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="exit-tour-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
        >
          <div className="w-full max-w-sm rounded-xl bg-void-2 border border-white/20 p-5 font-mono text-xs shadow-2xl">
            <h4 id="exit-tour-title" className="font-display text-sm uppercase text-white font-bold mb-2">
              Leave Demo Tour?
            </h4>
            <p className="text-regolith/80 mb-5 leading-relaxed">
              Leave the demo? Progress will be paused.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowExitTourModal(false)}
                className="rounded px-3 py-1.5 border border-white/10 text-regolith/80 hover:text-white uppercase font-bold focus-visible:ring-2 focus-visible:ring-earth min-h-[36px]"
              >
                Stay in Tour
              </button>
              <button
                type="button"
                onClick={() => {
                  stopMarsStory();
                  setShowExitTourModal(false);
                  setPage('home');
                  window.location.hash = '#home';
                  window.scrollTo({top: 0, behavior: 'smooth'});
                }}
                className="rounded bg-mars px-3 py-1.5 text-white uppercase font-bold hover:bg-mars/90 shadow-md focus-visible:ring-2 focus-visible:ring-mars min-h-[36px]"
              >
                Leave Demo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8-Minute Mars Demonstration Tour Engine */}
      <TourEngine />

      {/* Floating Demo Simulation Lab Panel */}
      <DemoPanel />

    </div>
  );
}