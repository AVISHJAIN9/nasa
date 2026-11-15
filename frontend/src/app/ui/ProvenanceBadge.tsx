export function ProvenanceBadge({provenance}: {provenance: 'SIMULATED' | 'REAL'}) {
  const isReal = provenance === 'REAL';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px] font-medium tracking-wider uppercase ${
        isReal ? 'bg-earth/20 text-earth border border-earth/30' : 'bg-white/5 text-regolith/60 border border-white/10'
      }`}
    >
      <span className={`size-1 rounded-full ${isReal ? 'bg-earth animate-pulse' : 'bg-regolith/40'}`} />
      {provenance}
    </span>
  );
}
