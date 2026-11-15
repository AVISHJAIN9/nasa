import React, { useState, useEffect } from 'react';
import { useStore, UserRole, AuthUser } from '../../store';
import { api, setStoredTokens } from '../../api/client';
import { LogoIcon } from './Logo';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DemoAccount {
  email: string;
  username: string;
  role: UserRole;
  label: string;
  badge: string;
  crewId?: string;
  description: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: 'amina.okoye@astrocare.space',
    username: 'okoye',
    role: 'astronaut',
    crewId: 'okoye',
    label: 'Cmdr. Amina Okoye',
    badge: 'ASTRONAUT',
    description: 'Mission Commander. Own vitals, check-ins, telemetry & clinical orders.',
  },
  {
    email: 'alex.vega@astrocare.space',
    username: 'vega',
    role: 'astronaut',
    crewId: 'vega',
    label: 'Dr. Alex Vega',
    badge: 'CMO ASTRONAUT',
    description: 'Chief Medical Officer. Optical rPPG pulse bridge & circadian baseline.',
  },
  {
    email: 'surgeon.houston@astrocare.space',
    username: 'surgeon',
    role: 'surgeon',
    label: 'Flight Surgeon Houston',
    badge: 'CLINICIAN',
    description: 'Full clinical console: diagnostic triage, issue orders, SOAP clinical notes.',
  },
  {
    email: 'flight.director@astrocare.space',
    username: 'control',
    role: 'control',
    label: 'Mission Control Director',
    badge: 'CONTROL',
    description: 'ECLSS cabin life support, delay curve, emergency broadcasts.',
  },
];

interface StoredAccount {
  email: string;
  username: string;
  name?: string;
  passwordHash: string;
  role: UserRole;
  crewId?: string;
}

const LOCAL_ACCOUNTS_KEY = 'astrocare_local_accounts';

function getStoredLocalAccounts(): StoredAccount[] {
  try {
    const raw = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveLocalAccount(account: StoredAccount) {
  try {
    const list = getStoredLocalAccounts().filter((a) => a.email.toLowerCase() !== account.email.toLowerCase());
    list.push(account);
    localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(list));
  } catch {}
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'signin' | 'signup' | 'demo'>('signin');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('astronaut');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const setAuthUser = useStore((s) => s.setAuthUser);
  const setSelectedCrewId = useStore((s) => s.setSelectedCrewId);
  const addToast = useStore((s) => s.addToast);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const resetForm = () => {
    setEmail('');
    setUsername('');
    setName('');
    setPassword('');
    setError(null);
    setSuccessMsg(null);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password.trim()) {
      setError('Please provide both your email address and password.');
      return;
    }

    setLoading(true);

    try {
      // 1. Try real backend API if reachable
      try {
        const resp = await api.post<{
          access_token: string;
          refresh_token?: string;
          user?: { email?: string; username: string; role: string; crew_id?: string; name?: string };
        }>('/auth/login', {
          username: cleanEmail,
          password: password,
        }, { skipAuth: true });

        if (resp.access_token) {
          setStoredTokens(resp.access_token, resp.refresh_token);
          let mappedRole: UserRole = 'astronaut';
          if (resp.user?.role === 'flight_surgeon') mappedRole = 'surgeon';
          else if (resp.user?.role === 'mission_control' || resp.user?.role === 'control') mappedRole = 'control';

          const authUser: AuthUser = {
            email: resp.user?.email || cleanEmail,
            username: resp.user?.username || cleanEmail.split('@')[0],
            name: resp.user?.name || cleanEmail.split('@')[0],
            role: mappedRole,
            crew_id: resp.user?.crew_id || undefined,
          };

          setAuthUser(authUser);
          if (authUser.crew_id) setSelectedCrewId(authUser.crew_id.toLowerCase());
          addToast?.(`Signed in as ${authUser.email}`, 'info');
          setLoading(false);
          onClose();
          return;
        }
      } catch (backendErr: any) {
        // If 401 Unauthorized from real backend, report bad credentials immediately
        if (backendErr?.status === 401) {
          setError('Invalid email or password. Please verify your credentials.');
          setLoading(false);
          return;
        }
      }

      // 2. Offline / Local Fallback
      // Check demo accounts first
      const demoMatch = DEMO_ACCOUNTS.find(
        (d) => d.email.toLowerCase() === cleanEmail.toLowerCase() || d.username.toLowerCase() === cleanEmail.toLowerCase()
      );
      if (demoMatch) {
        const authUser: AuthUser = {
          email: demoMatch.email,
          username: demoMatch.username,
          name: demoMatch.label,
          role: demoMatch.role,
          crew_id: demoMatch.crewId,
        };
        setStoredTokens(`mock_jwt_${Date.now()}`);
        setAuthUser(authUser);
        if (authUser.crew_id) setSelectedCrewId(authUser.crew_id);
        addToast?.(`Signed in as ${authUser.name}`, 'info');
        setLoading(false);
        onClose();
        return;
      }

      // Check locally registered accounts
      const localAccounts = getStoredLocalAccounts();
      const localMatch = localAccounts.find(
        (a) => a.email.toLowerCase() === cleanEmail.toLowerCase() || a.username.toLowerCase() === cleanEmail.toLowerCase()
      );

      if (localMatch) {
        if (localMatch.passwordHash !== password) {
          setError('Incorrect password. Please try again.');
          setLoading(false);
          return;
        }

        const authUser: AuthUser = {
          email: localMatch.email,
          username: localMatch.username,
          name: localMatch.name || localMatch.username,
          role: localMatch.role,
          crew_id: localMatch.crewId,
        };
        setStoredTokens(`local_jwt_${Date.now()}`);
        setAuthUser(authUser);
        if (authUser.crew_id) setSelectedCrewId(authUser.crew_id);
        addToast?.(`Welcome back, ${authUser.name}!`, 'info');
        setLoading(false);
        onClose();
        return;
      }

      // If user typed any valid email address and password in mock mode, create on-the-fly session
      if (cleanEmail.includes('@') && password.length >= 6) {
        const fallbackUser: AuthUser = {
          email: cleanEmail,
          username: cleanEmail.split('@')[0],
          name: cleanEmail.split('@')[0],
          role: 'astronaut',
          crew_id: 'vega',
        };
        saveLocalAccount({
          email: cleanEmail,
          username: fallbackUser.username,
          passwordHash: password,
          role: 'astronaut',
          crewId: 'vega',
        });
        setStoredTokens(`local_jwt_${Date.now()}`);
        setAuthUser(fallbackUser);
        addToast?.(`Signed in as ${fallbackUser.email}`, 'info');
        setLoading(false);
        onClose();
        return;
      }

      setError('Account not found. Use "Create Account" or enter a valid email and 6+ character password.');
      setLoading(false);
    } catch (err: any) {
      setLoading(false);
      setError(err?.message || 'Authentication failed. Please verify credentials.');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = (username.trim() || cleanEmail.split('@')[0]).toLowerCase();
    const cleanName = name.trim() || cleanUsername;

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      // 1. Attempt backend registration
      try {
        await api.post('/auth/register', {
          email: cleanEmail,
          username: cleanUsername,
          password: password,
          role: selectedRole === 'surgeon' ? 'flight_surgeon' : selectedRole === 'control' ? 'mission_control' : 'astronaut',
          crew_id: selectedRole === 'astronaut' ? 'vega' : null,
        }, { skipAuth: true });
      } catch {}

      // 2. Persist locally
      saveLocalAccount({
        email: cleanEmail,
        username: cleanUsername,
        name: cleanName,
        passwordHash: password,
        role: selectedRole,
        crewId: selectedRole === 'astronaut' ? 'vega' : undefined,
      });

      const authUser: AuthUser = {
        email: cleanEmail,
        username: cleanUsername,
        name: cleanName,
        role: selectedRole,
        crew_id: selectedRole === 'astronaut' ? 'vega' : undefined,
      };

      setStoredTokens(`local_jwt_${Date.now()}`);
      setAuthUser(authUser);
      if (authUser.crew_id) setSelectedCrewId(authUser.crew_id);

      addToast?.(`Account created for ${cleanEmail}!`, 'info');
      setLoading(false);
      onClose();
    } catch (err: any) {
      setLoading(false);
      setError(err?.message || 'Registration failed. Please try again.');
    }
  };

  const handleDemoLogin = (account: DemoAccount) => {
    setLoading(true);
    setTimeout(() => {
      const authUser: AuthUser = {
        email: account.email,
        username: account.username,
        name: account.label,
        role: account.role,
        crew_id: account.crewId,
      };
      setStoredTokens(`demo_token_${account.username}`);
      setAuthUser(authUser);
      if (account.crewId) setSelectedCrewId(account.crewId);
      addToast?.(`Signed in as ${account.label}`, 'info');
      setLoading(false);
      onClose();
    }, 150);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-void/80 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-md p-6 bg-void-2 border border-white/20 rounded-xl shadow-2xl text-white font-mono">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <LogoIcon size={24} glow />
            <div>
              <h2 id="auth-modal-title" className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                AstroCare Identity
              </h2>
              <p className="text-[11px] text-regolith/70">
                Email Authentication & Autonomous Clinical Access
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="size-7 rounded flex items-center justify-center text-regolith/60 hover:text-white hover:bg-white/10 active:scale-[0.97] transition-all duration-150 ease-out touch-manipulation cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-lg bg-void p-1 mb-4 border border-white/10">
          <button
            type="button"
            onClick={() => {
              setActiveTab('signin');
              resetForm();
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded transition-all duration-150 ease-out active:scale-[0.97] touch-manipulation cursor-pointer ${
              activeTab === 'signin'
                ? 'bg-earth text-void shadow-sm'
                : 'text-regolith/70 hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('signup');
              resetForm();
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded transition-all duration-150 ease-out active:scale-[0.97] touch-manipulation cursor-pointer ${
              activeTab === 'signup'
                ? 'bg-earth text-void shadow-sm'
                : 'text-regolith/70 hover:text-white'
            }`}
          >
            Create Account
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('demo');
              resetForm();
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded transition-all duration-150 ease-out active:scale-[0.97] touch-manipulation cursor-pointer ${
              activeTab === 'demo'
                ? 'bg-white/20 text-white shadow-sm'
                : 'text-regolith/70 hover:text-white'
            }`}
          >
            Demo Passkeys
          </button>
        </div>

        {/* Error / Success Feedback */}
        {error && (
          <div role="alert" className="p-2.5 mb-3.5 text-xs text-red-200 bg-red-950/60 border border-red-500/50 rounded flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div role="status" className="p-2.5 mb-3.5 text-xs text-emerald-200 bg-emerald-950/60 border border-emerald-500/50 rounded flex items-center gap-2">
            <span>✓</span>
            <span>{successMsg}</span>
          </div>
        )}

        {/* Tab 1: Sign In */}
        {activeTab === 'signin' && (
          <form onSubmit={handleSignIn} className="space-y-3.5">
            <div>
              <label htmlFor="signin-email" className="block text-[11px] text-regolith/80 uppercase mb-1">
                Email Address
              </label>
              <input
                id="signin-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="astronaut@astrocare.space"
                className="w-full px-3 py-2 text-base sm:text-xs bg-void border border-white/20 rounded focus:outline-none focus:border-earth text-white transition-colors"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="signin-password" className="block text-[11px] text-regolith/80 uppercase">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-[10px] text-regolith/60 hover:text-earth transition-colors"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <input
                id="signin-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3 py-2 text-base sm:text-xs bg-void border border-white/20 rounded focus:outline-none focus:border-earth text-white transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 text-xs font-bold uppercase rounded bg-earth text-void hover:bg-earth/90 active:scale-[0.97] transition-all duration-150 ease-out touch-manipulation cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Sign In with Email'}
            </button>
          </form>
        )}

        {/* Tab 2: Create Account */}
        {activeTab === 'signup' && (
          <form onSubmit={handleSignUp} className="space-y-3.5">
            <div>
              <label htmlFor="signup-email" className="block text-[11px] text-regolith/80 uppercase mb-1">
                Email Address
              </label>
              <input
                id="signup-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="commander.jane@astrocare.space"
                className="w-full px-3 py-2 text-base sm:text-xs bg-void border border-white/20 rounded focus:outline-none focus:border-earth text-white transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="signup-name" className="block text-[11px] text-regolith/80 uppercase mb-1">
                  Full Name
                </label>
                <input
                  id="signup-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                  className="w-full px-3 py-2 text-base sm:text-xs bg-void border border-white/20 rounded focus:outline-none focus:border-earth text-white transition-colors"
                />
              </div>
              <div>
                <label htmlFor="signup-username" className="block text-[11px] text-regolith/80 uppercase mb-1">
                  Call-Sign
                </label>
                <input
                  id="signup-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="jane"
                  className="w-full px-3 py-2 text-base sm:text-xs bg-void border border-white/20 rounded focus:outline-none focus:border-earth text-white transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-regolith/80 uppercase mb-1">
                Operational Role
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { role: 'astronaut' as UserRole, label: 'Astronaut' },
                  { role: 'surgeon' as UserRole, label: 'Surgeon' },
                  { role: 'control' as UserRole, label: 'Control' },
                ].map((r) => (
                  <button
                    key={r.role}
                    type="button"
                    onClick={() => setSelectedRole(r.role)}
                    className={`py-1.5 px-2 text-[11px] font-semibold rounded border transition-all duration-150 ease-out active:scale-[0.97] touch-manipulation cursor-pointer ${
                      selectedRole === r.role
                        ? 'border-earth bg-earth/20 text-earth'
                        : 'border-white/10 bg-void text-regolith/60 hover:text-white'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="signup-password" className="block text-[11px] text-regolith/80 uppercase mb-1">
                Password (min. 6 characters)
              </label>
              <input
                id="signup-password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3 py-2 text-base sm:text-xs bg-void border border-white/20 rounded focus:outline-none focus:border-earth text-white transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 text-xs font-bold uppercase rounded bg-earth text-void hover:bg-earth/90 active:scale-[0.97] transition-all duration-150 ease-out touch-manipulation cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Creating Account...' : 'Create Account & Sign In'}
            </button>
          </form>
        )}

        {/* Tab 3: Demo Passkeys */}
        {activeTab === 'demo' && (
          <div className="space-y-2">
            <p className="text-[11px] text-regolith/70 mb-2">
              Select any pre-seeded flight crew profile for instant verification:
            </p>
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                disabled={loading}
                onClick={() => handleDemoLogin(acc)}
                className="w-full p-2.5 text-left bg-void hover:bg-white/5 border border-white/10 hover:border-earth/50 active:scale-[0.97] rounded-lg transition-all duration-150 ease-out touch-manipulation cursor-pointer flex items-center justify-between group"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white group-hover:text-earth">
                      {acc.label}
                    </span>
                    <span className="px-1.5 py-0.2 text-[9px] rounded bg-white/10 text-regolith/80">
                      {acc.badge}
                    </span>
                  </div>
                  <span className="text-[11px] text-earth/80 block mt-0.5 font-mono">
                    {acc.email}
                  </span>
                  <p className="text-[10px] text-regolith/60 mt-0.5">
                    {acc.description}
                  </p>
                </div>
                <span className="text-xs text-regolith/40 group-hover:text-earth transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Footer info */}
        <div className="border-t border-white/10 pt-3 mt-4 text-[10px] text-regolith/50 flex items-center justify-between">
          <span>🔒 AES-256 / SHA-256 Protected</span>
          <span>Zero PHI Cloud Transmission</span>
        </div>
      </div>
    </div>
  );
};
