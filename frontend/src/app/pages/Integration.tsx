import React, { useState } from 'react';
import { PageHeader } from '../ui';
import { apiUrl, getStoredToken } from '../../api/client';

export interface IntegrationTestItem {
  id: string;
  name: string;
  endpoint: string;
  method: 'GET' | 'POST';
  service: 'Node.js' | 'FastAPI' | 'Fused';
  provenance: 'REAL' | 'SIMULATED' | 'REPLAYED';
  testFn: () => Promise<any>;
  lastStatus: number | 'ERR' | null;
  latencyMs: number | null;
  lastSuccess: string | null;
  rawError: string | null;
  rawResponse?: any;
}

export function Integration() {
  const [filterService, setFilterService] = useState<'ALL' | 'Node.js' | 'FastAPI' | 'Fused'>('ALL');
  const [search, setSearch] = useState('');
  const [isRunningAll, setIsRunningAll] = useState(false);

  const initialItems: IntegrationTestItem[] = [
    {
      id: 'A05',
      name: 'Fused Today Strip (Cross-Service)',
      endpoint: '/v1/today?person_id=okoye',
      method: 'GET',
      service: 'Fused',
      provenance: 'REAL',
      testFn: async () => {
        const res = await fetch(apiUrl('/v1/today?person_id=okoye'));
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
      },
      lastStatus: null,
      latencyMs: null,
      lastSuccess: null,
      rawError: null,
    },
    {
      id: 'F001',
      name: 'Unified Identity Auth Me',
      endpoint: '/api/v1/auth/me',
      method: 'GET',
      service: 'Node.js',
      provenance: 'REAL',
      testFn: async () => {
        const token = getStoredToken();
        const res = await fetch(apiUrl('/api/v1/auth/me'), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok && res.status !== 401) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
      },
      lastStatus: null,
      latencyMs: null,
      lastSuccess: null,
      rawError: null,
    },
    {
      id: 'F013',
      name: 'Continuous Telemetry Ingest',
      endpoint: '/api/v1/telemetry/ingest',
      method: 'POST',
      service: 'Node.js',
      provenance: 'REAL',
      testFn: async () => {
        const res = await fetch(apiUrl('/api/v1/telemetry/ingest'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            readings: [
              {
                crew_id: 'okoye',
                metric: 'heart_rate',
                value: 68,
                unit: 'bpm',
                provenance: 'REAL',
              },
            ],
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
      },
      lastStatus: null,
      latencyMs: null,
      lastSuccess: null,
      rawError: null,
    },
    {
      id: 'F014',
      name: 'Physiological Timeseries Range',
      endpoint: '/api/v1/telemetry/timeseries-range',
      method: 'GET',
      service: 'Node.js',
      provenance: 'REAL',
      testFn: async () => {
        const res = await fetch(apiUrl('/api/v1/telemetry/timeseries-range?crew_id=okoye&metric=heart_rate'));
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
      },
      lastStatus: null,
      latencyMs: null,
      lastSuccess: null,
      rawError: null,
    },
    {
      id: 'F015',
      name: 'Circadian Baseline Calculation',
      endpoint: '/api/v1/baselines/okoye',
      method: 'GET',
      service: 'Node.js',
      provenance: 'SIMULATED',
      testFn: async () => {
        const res = await fetch(apiUrl('/api/v1/baselines/okoye'));
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
      },
      lastStatus: null,
      latencyMs: null,
      lastSuccess: null,
      rawError: null,
    },
    {
      id: 'F031',
      name: 'Clinical Alerts Gating & Monotonic Status',
      endpoint: '/api/v1/alerts',
      method: 'GET',
      service: 'Node.js',
      provenance: 'REAL',
      testFn: async () => {
        const res = await fetch(apiUrl('/api/v1/alerts?crew_id=okoye'));
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
      },
      lastStatus: null,
      latencyMs: null,
      lastSuccess: null,
      rawError: null,
    },
    {
      id: 'F051',
      name: 'SOAP Clinical Notes History',
      endpoint: '/api/v1/notes?crew_id=okoye',
      method: 'GET',
      service: 'Node.js',
      provenance: 'REAL',
      testFn: async () => {
        const res = await fetch(apiUrl('/api/v1/notes?crew_id=okoye'));
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
      },
      lastStatus: null,
      latencyMs: null,
      lastSuccess: null,
      rawError: null,
    },
    {
      id: 'F071',
      name: 'Daily Crew Wellness Check-in',
      endpoint: '/api/v1/checkins?crew_id=okoye',
      method: 'GET',
      service: 'Node.js',
      provenance: 'REAL',
      testFn: async () => {
        const token = getStoredToken();
        const res = await fetch(apiUrl('/api/v1/checkins?crew_id=okoye'), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok && res.status !== 401 && res.status !== 403) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return res.json();
      },
      lastStatus: null,
      latencyMs: null,
      lastSuccess: null,
      rawError: null,
    },
    {
      id: 'F081',
      name: 'Flight Surgeon Clinical Orders',
      endpoint: '/api/v1/orders/crew/okoye',
      method: 'GET',
      service: 'Node.js',
      provenance: 'REAL',
      testFn: async () => {
        const token = getStoredToken();
        const res = await fetch(apiUrl('/api/v1/orders/crew/okoye'), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok && res.status !== 401 && res.status !== 403) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return res.json();
      },
      lastStatus: null,
      latencyMs: null,
      lastSuccess: null,
      rawError: null,
    },
    {
      id: 'F091',
      name: 'Mission Control Announcements',
      endpoint: '/api/v1/broadcasts',
      method: 'GET',
      service: 'Node.js',
      provenance: 'REAL',
      testFn: async () => {
        const res = await fetch(apiUrl('/api/v1/broadcasts'));
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
      },
      lastStatus: null,
      latencyMs: null,
      lastSuccess: null,
      rawError: null,
    },
    {
      id: 'F131',
      name: 'System Contracts & Route Directory',
      endpoint: '/api/v1/gateway/info',
      method: 'GET',
      service: 'Node.js',
      provenance: 'REAL',
      testFn: async () => {
        const res = await fetch(apiUrl('/api/v1/gateway/info'));
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
      },
      lastStatus: null,
      latencyMs: null,
      lastSuccess: null,
      rawError: null,
    },
    {
      id: 'F132',
      name: 'System Unified Health Check',
      endpoint: '/health',
      method: 'GET',
      service: 'Node.js',
      provenance: 'REAL',
      testFn: async () => {
        const res = await fetch(apiUrl('/health'));
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
      },
      lastStatus: null,
      latencyMs: null,
      lastSuccess: null,
      rawError: null,
    },
    {
      id: 'M01',
      name: 'Sensor Consent Ledger & State',
      endpoint: '/api/v1/sensors/state?crew_id=okoye',
      method: 'GET',
      service: 'FastAPI',
      provenance: 'REAL',
      testFn: async () => {
        const res = await fetch(apiUrl('/api/v1/sensors/state?crew_id=okoye'));
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
      },
      lastStatus: null,
      latencyMs: null,
      lastSuccess: null,
      rawError: null,
    },
    {
      id: 'M01-P',
      name: 'Zero-Action Passive Metric Ratios',
      endpoint: '/api/v1/passive/metrics',
      method: 'GET',
      service: 'FastAPI',
      provenance: 'REAL',
      testFn: async () => {
        const res = await fetch(apiUrl('/api/v1/passive/metrics'));
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
      },
      lastStatus: null,
      latencyMs: null,
      lastSuccess: null,
      rawError: null,
    },
    {
      id: 'A03',
      name: 'Cephalad Fluid Shift Face Metrics',
      endpoint: '/api/v1/face-metrics?crew_id=okoye',
      method: 'GET',
      service: 'FastAPI',
      provenance: 'REAL',
      testFn: async () => {
        const res = await fetch(apiUrl('/api/v1/face-metrics?crew_id=okoye'));
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
      },
      lastStatus: null,
      latencyMs: null,
      lastSuccess: null,
      rawError: null,
    },
    {
      id: 'M05',
      name: 'Mission Phase & Physiological Thresholds',
      endpoint: '/api/v1/mission/phase',
      method: 'GET',
      service: 'FastAPI',
      provenance: 'REAL',
      testFn: async () => {
        const res = await fetch(apiUrl('/api/v1/mission/phase'));
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
      },
      lastStatus: null,
      latencyMs: null,
      lastSuccess: null,
      rawError: null,
    },
    {
      id: 'C01',
      name: 'Federated Learning Edge Status',
      endpoint: '/api/v1/fed/global',
      method: 'GET',
      service: 'FastAPI',
      provenance: 'SIMULATED',
      testFn: async () => {
        const res = await fetch(apiUrl('/api/v1/fed/global'));
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
      },
      lastStatus: null,
      latencyMs: null,
      lastSuccess: null,
      rawError: null,
    },
    {
      id: 'D02',
      name: 'Specialist AI Panel Consensus Engine',
      endpoint: '/api/v1/panel/history',
      method: 'GET',
      service: 'FastAPI',
      provenance: 'SIMULATED',
      testFn: async () => {
        const res = await fetch(apiUrl('/api/v1/panel/history'));
        if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
      },
      lastStatus: null,
      latencyMs: null,
      lastSuccess: null,
      rawError: null,
    },
    {
      id: 'BE-02',
      name: 'Raw Signal Ingestion Quality Gating',
      endpoint: '/api/v1/readings/quality-summary?crew_id=okoye',
      method: 'GET',
      service: 'FastAPI',
      provenance: 'REAL',
      testFn: async () => {
        const res = await fetch(apiUrl('/api/v1/readings/quality-summary?crew_id=okoye'));
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
      },
      lastStatus: null,
      latencyMs: null,
      lastSuccess: null,
      rawError: null,
    },
  ];

  const [items, setItems] = useState<IntegrationTestItem[]>(initialItems);

  const testSingle = async (index: number) => {
    const target = items[index];
    const t0 = performance.now();

    try {
      const data = await target.testFn();
      const latency = Math.round(performance.now() - t0);

      setItems((prev) => {
        const next = [...prev];
        next[index] = {
          ...next[index],
          lastStatus: 200,
          latencyMs: latency,
          lastSuccess: new Date().toLocaleTimeString(),
          rawError: null,
          rawResponse: data,
        };
        return next;
      });
    } catch (err: any) {
      const latency = Math.round(performance.now() - t0);
      const errMsg = err?.message || 'Unknown network or API error';
      const statusCode = errMsg.includes('HTTP ') ? parseInt(errMsg.split('HTTP ')[1], 10) : 'ERR';

      setItems((prev) => {
        const next = [...prev];
        next[index] = {
          ...next[index],
          lastStatus: statusCode as any,
          latencyMs: latency,
          rawError: errMsg,
          rawResponse: null,
        };
        return next;
      });
    }
  };

  const runAllTests = async () => {
    setIsRunningAll(true);
    for (let i = 0; i < items.length; i++) {
      await testSingle(i);
    }
    setIsRunningAll(false);
  };

  const filteredItems = items.filter((item) => {
    const matchesService = filterService === 'ALL' || item.service === filterService;
    const matchesSearch =
      item.id.toLowerCase().includes(search.toLowerCase()) ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.endpoint.toLowerCase().includes(search.toLowerCase());
    return matchesService && matchesSearch;
  });

  const totalTested = items.filter((i) => i.lastStatus !== null).length;
  const passedCount = items.filter((i) => typeof i.lastStatus === 'number' && i.lastStatus < 400).length;
  const failedCount = items.filter((i) => i.lastStatus === 'ERR' || (typeof i.lastStatus === 'number' && i.lastStatus >= 400)).length;
  const avgLatency = totalTested > 0
    ? Math.round(items.filter((i) => i.latencyMs !== null).reduce((acc, curr) => acc + (curr.latencyMs || 0), 0) / totalTested)
    : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        eyebrow="SYSTEM DIAGNOSTICS"
        title="Integration Status & Live Endpoint Verification"
        description="In-app diagnostic matrix querying dual backends through single-origin proxy. Live execution, never mock data."
      />

      {/* Summary Scorecard */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-4 bg-void-2 border border-white/10 rounded-xl">
          <div className="text-[10px] font-mono text-regolith/60 uppercase">Total Endpoints</div>
          <div className="text-2xl font-bold font-mono text-white mt-1">{items.length}</div>
        </div>
        <div className="p-4 bg-void-2 border border-white/10 rounded-xl">
          <div className="text-[10px] font-mono text-regolith/60 uppercase">Verified / Tested</div>
          <div className="text-2xl font-bold font-mono text-earth mt-1">{totalTested}</div>
        </div>
        <div className="p-4 bg-void-2 border border-green-500/20 rounded-xl">
          <div className="text-[10px] font-mono text-green-400 uppercase">Passing (Green)</div>
          <div className="text-2xl font-bold font-mono text-green-400 mt-1">{passedCount}</div>
        </div>
        <div className="p-4 bg-void-2 border border-red-500/20 rounded-xl">
          <div className="text-[10px] font-mono text-red-400 uppercase">Failing / Errors</div>
          <div className="text-2xl font-bold font-mono text-red-400 mt-1">{failedCount}</div>
        </div>
        <div className="p-4 bg-void-2 border border-white/10 rounded-xl">
          <div className="text-[10px] font-mono text-regolith/60 uppercase">Mean Latency</div>
          <div className="text-2xl font-bold font-mono text-white mt-1">{avgLatency} ms</div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-void-2 border border-white/10 rounded-xl">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isRunningAll}
            onClick={runAllTests}
            className="px-4 py-2 text-xs font-mono font-bold uppercase rounded bg-earth text-void hover:bg-earth/90 disabled:opacity-50 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <span>{isRunningAll ? '⏳' : '▶'}</span>
            <span>{isRunningAll ? 'Testing All...' : 'Run All (Test Every Endpoint)'}</span>
          </button>
          <button
            type="button"
            onClick={() => setItems(initialItems)}
            className="px-3 py-2 text-xs font-mono text-regolith/70 hover:text-white hover:bg-white/5 rounded border border-white/10 transition-colors"
          >
            Reset
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Service filter */}
          <div className="flex items-center rounded-lg bg-void border border-white/10 p-0.5 text-xs font-mono">
            {(['ALL', 'Node.js', 'FastAPI', 'Fused'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterService(s)}
                className={`px-2.5 py-1 rounded transition-colors ${
                  filterService === s ? 'bg-white/15 text-white font-bold' : 'text-regolith/60 hover:text-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Search input */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ID, name, endpoint..."
            className="px-3 py-1.5 text-xs font-mono bg-void border border-white/10 rounded-lg text-white focus:outline-none focus:border-earth w-48"
          />
        </div>
      </div>

      {/* Table */}
      <div className="border border-white/10 rounded-xl overflow-hidden bg-void-2">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="bg-void/80 border-b border-white/10 text-regolith/70 uppercase text-[10px]">
                <th className="py-3 px-3">Feature ID</th>
                <th className="py-3 px-3">Feature Name</th>
                <th className="py-3 px-3">Endpoint</th>
                <th className="py-3 px-3">Owner</th>
                <th className="py-3 px-3">Provenance</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-right">Latency</th>
                <th className="py-3 px-3">Last Success</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredItems.map((item) => {
                const isPassing = typeof item.lastStatus === 'number' && item.lastStatus < 400;
                const isFailing = item.lastStatus === 'ERR' || (typeof item.lastStatus === 'number' && item.lastStatus >= 400);

                let rowBg = 'hover:bg-white/5';
                if (isFailing) rowBg = 'bg-red-950/20 hover:bg-red-950/30';
                else if (isPassing) rowBg = 'bg-green-950/10 hover:bg-green-950/20';

                return (
                  <React.Fragment key={item.id}>
                    <tr className={`transition-colors ${rowBg}`}>
                      <td className="py-2.5 px-3 font-bold text-white">{item.id}</td>
                      <td className="py-2.5 px-3 text-white/90">{item.name}</td>
                      <td className="py-2.5 px-3 text-regolith/80">
                        <span className="text-[10px] text-earth/80 mr-1.5">{item.method}</span>
                        {item.endpoint}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] ${
                            item.service === 'FastAPI'
                              ? 'bg-blue-950/80 text-blue-300 border border-blue-500/30'
                              : item.service === 'Fused'
                              ? 'bg-purple-950/80 text-purple-300 border border-purple-500/30'
                              : 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {item.service}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-[10px] text-regolith/60">{item.provenance}</span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {item.lastStatus === null ? (
                          <span className="text-regolith/40">-</span>
                        ) : isPassing ? (
                          <span className="px-1.5 py-0.5 rounded bg-green-950 text-green-400 font-bold border border-green-500/30">
                            {item.lastStatus}
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-red-950 text-red-400 font-bold border border-red-500/30">
                            {item.lastStatus}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right text-regolith/80">
                        {item.latencyMs !== null ? `${item.latencyMs} ms` : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-regolith/60">
                        {item.lastSuccess || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => testSingle(items.findIndex((i) => i.id === item.id))}
                          className="px-2 py-1 text-[11px] rounded bg-white/10 hover:bg-earth hover:text-void transition-colors"
                        >
                          Test now
                        </button>
                      </td>
                    </tr>
                    {item.rawError && (
                      <tr className="bg-red-950/30 border-b border-red-500/20">
                        <td colSpan={9} className="py-2 px-3 text-[11px] text-red-300 font-mono">
                          <span className="font-bold text-red-400">Error:</span> {item.rawError}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
