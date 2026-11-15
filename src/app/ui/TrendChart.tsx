import {ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine} from 'recharts';

export interface TrendChartProps {
  title: string;
  unit: string;
  data: Array<{time: number; value: number}>;
  baseline: number;
  nominalBand?: [number, number];
  range: '1m' | '5m';
  onRangeChange: (r: '1m' | '5m') => void;
  color?: string;
}

export function TrendChart({
  title,
  unit,
  data,
  baseline,
  range,
  onRangeChange,
  color = '#6fb6ff',
}: TrendChartProps) {
  // Filter data by range (1m = 60s, 5m = 300s)
  const windowSec = range === '1m' ? 60 : 300;
  const filteredData = data.slice(-windowSec).map((d) => ({
    ...d,
    formattedTime: new Date(d.time).toLocaleTimeString([], {minute: '2-digit', second: '2-digit'}),
  }));

  const values = filteredData.map((d) => d.value);
  const minVal = values.length ? Math.min(...values, baseline) : baseline - 5;
  const maxVal = values.length ? Math.max(...values, baseline) : baseline + 5;
  const padding = (maxVal - minVal) * 0.2 || 2;
  const yDomain = [Math.floor(minVal - padding), Math.ceil(maxVal + padding)];

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="font-display text-[0.875rem] uppercase tracking-wider text-white">{title}</h4>
          <span className="font-mono text-label text-regolith/50">Baseline: {baseline} {unit}</span>
        </div>
        <div className="flex rounded bg-white/5 p-0.5 ring-1 ring-white/10 font-mono text-[11px]">
          <button
            type="button"
            onClick={() => onRangeChange('1m')}
            className={`rounded px-2.5 py-1 uppercase transition-colors ${
              range === '1m' ? 'bg-white/15 text-white font-medium' : 'text-regolith/60 hover:text-white'
            }`}
          >
            1m
          </button>
          <button
            type="button"
            onClick={() => onRangeChange('5m')}
            className={`rounded px-2.5 py-1 uppercase transition-colors ${
              range === '5m' ? 'bg-white/15 text-white font-medium' : 'text-regolith/60 hover:text-white'
            }`}
          >
            5m
          </button>
        </div>
      </div>

      <div className="flex-1 w-full min-h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={filteredData} margin={{top: 10, right: 10, left: -20, bottom: 0}}>
            <defs>
              <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                <stop offset="95%" stopColor={color} stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="formattedTime"
              stroke="#8b909b"
              fontSize={10}
              tickLine={false}
              axisLine={{stroke: 'rgba(255,255,255,0.08)'}}
              minTickGap={25}
            />
            <YAxis
              domain={yDomain}
              stroke="#8b909b"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => String(v)}
            />
            <Tooltip
              content={({active, payload}) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="rounded bg-void-2 border border-white/15 px-2.5 py-1.5 shadow-xl font-mono text-xs">
                      <p className="text-white font-bold">{payload[0].value} {unit}</p>
                      <p className="text-regolith/50">{payload[0].payload.formattedTime}</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <ReferenceLine
              y={baseline}
              stroke="#8b909b"
              strokeDasharray="3 3"
              strokeOpacity={0.6}
              label={{value: `Base ${baseline}`, fill: '#8b909b', fontSize: 9, position: 'right'}}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#trendGradient)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
