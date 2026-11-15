export function PageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse font-mono" role="status" aria-label="Loading page content">
      <div className="border-b border-white/10 pb-5 space-y-2">
        <div className="h-3 w-32 bg-white/10 rounded" />
        <div className="h-8 w-72 bg-white/15 rounded" />
        <div className="h-4 w-96 max-w-full bg-white/5 rounded" />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="h-64 rounded-xl border border-white/10 bg-void-2/60 p-5 space-y-4">
          <div className="h-4 w-40 bg-white/10 rounded" />
          <div className="h-44 w-full bg-white/5 rounded" />
        </div>
        <div className="h-64 rounded-xl border border-white/10 bg-void-2/60 p-5 space-y-4">
          <div className="h-4 w-40 bg-white/10 rounded" />
          <div className="h-44 w-full bg-white/5 rounded" />
        </div>
        <div className="h-64 rounded-xl border border-white/10 bg-void-2/60 p-5 space-y-4 md:col-span-2 lg:col-span-1">
          <div className="h-4 w-40 bg-white/10 rounded" />
          <div className="h-44 w-full bg-white/5 rounded" />
        </div>
      </div>
    </div>
  );
}

export function ChartSkeleton({height = 'h-64'}: {height?: string}) {
  return (
    <div
      className={`${height} w-full rounded-lg border border-white/10 bg-void/50 p-4 flex flex-col justify-between animate-pulse`}
      role="status"
      aria-label="Loading telemetry chart"
    >
      <div className="flex justify-between items-center">
        <div className="h-3 w-28 bg-white/10 rounded" />
        <div className="h-3 w-16 bg-white/10 rounded" />
      </div>
      <div className="flex items-end gap-2 h-36 px-4">
        {[40, 65, 55, 80, 45, 90, 70, 85, 60, 75, 95, 65].map((pct, idx) => (
          <div
            key={idx}
            className="flex-1 bg-white/10 rounded-t transition-all"
            style={{height: `${pct}%`}}
          />
        ))}
      </div>
      <div className="flex justify-between items-center pt-2 border-t border-white/5">
        <div className="h-2 w-12 bg-white/5 rounded" />
        <div className="h-2 w-12 bg-white/5 rounded" />
        <div className="h-2 w-12 bg-white/5 rounded" />
      </div>
    </div>
  );
}
