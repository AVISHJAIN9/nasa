import React, { useState } from 'react';
import { useStore, UserRole } from '../../store';
import { api, setStoredTokens } from '../../api/client';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DemoAccount {
  username: string;
  role: UserRole;
  label: string;
  badge: string;
  crewId?: string;
  description: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    username: 'okoye',
    role: 'astronaut',
    crewId: 'okoye',
    label: 'Cmdr. Amina Okoye',
    badge: 'ASTRONAUT',
    description: 'Mission Commander. Own vitals, check-ins, ack clinical orders.',
  },
  {
    username: 'vega',
    role: 'astronaut',
    crewId: 'vega',
    label: 'Dr. Alex Vega',
    badge: 'ASTRONAUT',
    description: 'CMO Astronaut. Personal circadian baseline & wellness check-ins.',
  },
  {
    username: 'surgeon',
    role: 'surgeon',
    label: 'Flight Surgeon Houston',
    badge: 'CLINICIAN',
    description: 'Full clinical console: diagnostic triage, issue orders, SOAP notes.',
  },
  {
    username: 'control',
    role: 'control',
    label: 'Mission Control Director',
    badge: 'CONTROL',
    description: 'Cabin life support, delay slider, send emergency broadcasts.',
  },
  {
    username: 'admin',
    role: 'control',
    label: 'System Administrator',
    badge: 'ADMIN',
    description: 'Security audit, feature flags runtime toggle, system governance.',
  },
];

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const setRole = useStore((s) => s.setRole);
  const setSelectedCrewId = useStore((s) => s.setSelectedCrewId);

  if (!isOpen) return null;

  const handleLogin = async (user: string, pass: string, targetRole: UserRole, crewId?: string) => {
    setError(null);
    setLoading(true);

    const isMock = import.meta.env.VITE_USE_MOCKS !== 'false';

    if (isMock) {
      // Offline simulation fallback
      setRole(targetRole);
      if (crewId) setSelectedCrewId(crewId);
      setLoading(false);
      onClose();
      return;
    }

    try {
      const resp = await api.post<{
        access_token: string;
        refresh_token?: string;
        user?: { role: string; crew_id?: string; username: string };
      }>('/auth/login', {
        username: user,
        password: pass,
      }, { skipAuth: true });

      setStoredTokens(resp.access_token, resp.refresh_token);

      // Map backend role to UI UserRole
      let mappedRole: UserRole = targetRole;
      if (resp.user?.role === 'flight_surgeon') mappedRole = 'surgeon';
      else if (resp.user?.role === 'mission_control' || resp.user?.role === 'admin') mappedRole = 'control';
      else mappedRole = 'astronaut';

      setRole(mappedRole);
      if (resp.user?.crew_id) {
        setSelectedCrewId(resp.user.crew_id.toLowerCase());
      } else if (crewId) {
        setSelectedCrewId(crewId);
      }

      setLoading(false);
      onClose();
    } catch (err: any) {
      setLoading(false);
      setError(err?.message || 'Login failed. Please verify credentials.');
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Username and password are required.');
      return;
    }
    // Default to astronaut if not recognized
    handleLogin(username.trim(), password.trim(), 'astronaut');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg p-6 bg-void-2 border border-white/20 rounded-xl shadow-2xl text-white">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
          <div>
            <h2 className="text-lg font-bold font-mono tracking-tight flex items-center gap-2">
              <span className="text-earth">🛡️</span> AstroCare Authentication
            </h2>
            <p className="text-xs text-regolith/70 font-mono">
              Sign in with unified JWT credentials or select a pre-seeded demo profile
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-regolith/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="p-3 mb-4 text-xs font-mono text-red-200 bg-red-950/60 border border-red-500/50 rounded-lg">
            ⚠️ {error}
          </div>
        )}

        {/* Real Form Login */}
        <form onSubmit={handleFormSubmit} className="space-y-3 mb-6">
          <div>
            <label className="block text-[11px] font-mono text-regolith/80 uppercase mb-1">
              Username or Call-Sign
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. okoye, surgeon, control"
              className="w-full px-3 py-2 text-xs font-mono bg-void border border-white/20 rounded focus:outline-none focus:border-earth text-white"
            />
          </div>
          <div>
            <label className="block text-[11px] font-mono text-regolith/80 uppercase mb-1">
              Security Key / Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3 py-2 text-xs font-mono bg-void border border-white/20 rounded focus:outline-none focus:border-earth text-white"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 text-xs font-mono font-bold uppercase rounded bg-earth text-void hover:bg-earth/90 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        {/* Demo Quick-Login Accounts */}
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-regolith/60">
              Quick Login Demo Accounts (Pre-Seeded)
            </span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <div className="grid grid-cols-1 gap-2">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.username}
                type="button"
                disabled={loading}
                onClick={() => handleLogin(acc.username, 'Password123!', acc.role, acc.crewId)}
                className="w-full p-2.5 text-left bg-void/70 hover:bg-white/5 border border-white/10 hover:border-earth/50 rounded-lg transition-colors flex items-center justify-between group"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-white group-hover:text-earth">
                      {acc.label}
                    </span>
                    <span className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-white/10 text-regolith/80">
                      {acc.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-regolith/60 mt-0.5">
                    {acc.description}
                  </p>
                </div>
                <span className="text-xs font-mono text-regolith/40 group-hover:text-earth">
                  →
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
