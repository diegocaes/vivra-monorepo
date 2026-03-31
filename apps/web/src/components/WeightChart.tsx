import type { WeightRecord } from '../types/supabase';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Props {
  records: WeightRecord[];
}

function formatShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export default function WeightChart({ records }: Props) {
  if (records.length < 2) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-gray-400">Registra al menos 2 pesos para ver la gráfica</p>
      </div>
    );
  }

  const WIDTH = 560;
  const HEIGHT = 200;
  const PAD = { top: 20, right: 16, bottom: 32, left: 44 };
  const chartW = WIDTH - PAD.left - PAD.right;
  const chartH = HEIGHT - PAD.top - PAD.bottom;

  const weights = records.map((r) => r.weight_kg);
  const minW = Math.floor(Math.min(...weights) * 2 - 1) / 2;
  const maxW = Math.ceil(Math.max(...weights) * 2 + 1) / 2;
  const range = maxW - minW || 1;

  const points = records.map((r, i) => ({
    x: PAD.left + (records.length === 1 ? chartW / 2 : (i / (records.length - 1)) * chartW),
    y: PAD.top + chartH - ((r.weight_kg - minW) / range) * chartH,
    record: r,
  }));

  // Smooth curve path using cardinal spline
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(PAD.top + chartH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(PAD.top + chartH).toFixed(1)} Z`;

  // Y-axis ticks
  const yTickCount = 4;
  const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => minW + (range / yTickCount) * i);

  // X-axis labels: show evenly spaced dates
  const xLabelCount = Math.min(records.length, 5);
  const xLabelIndices = Array.from({ length: xLabelCount }, (_, i) =>
    Math.round((i / (xLabelCount - 1)) * (records.length - 1))
  ).filter((v, i, a) => a.indexOf(v) === i);

  // Delta
  const latest = records[records.length - 1].weight_kg;
  const previous = records[records.length - 2].weight_kg;
  const diff = latest - previous;

  // Accent color: #F97316 (matches --color-accent)
  const ACCENT = '#F97316';
  const GRID = '#EAECF0';

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
          Evolución del peso
        </h3>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-gray-800">{latest}</span>
          <span className="text-sm text-gray-400">kg</span>
          <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
            diff > 0 ? 'bg-amber-50 text-amber-600' : diff < 0 ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-400'
          }`}>
            {diff > 0 ? <TrendingUp size={12} /> : diff < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
            {diff > 0 ? '+' : ''}{diff.toFixed(1)}
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        {yTicks.map((val, i) => {
          const y = PAD.top + chartH - ((val - minW) / range) * chartH;
          return (
            <g key={i}>
              <line x1={PAD.left} y1={y} x2={WIDTH - PAD.right} y2={y}
                stroke={GRID} strokeWidth="1" />
              <text x={PAD.left - 8} y={y + 4} textAnchor="end"
                fill="#9ca3af" fontSize="10">{val.toFixed(1)}</text>
            </g>
          );
        })}

        {/* Gradient fill */}
        <defs>
          <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity="0.12" />
            <stop offset="100%" stopColor={ACCENT} stopOpacity="0.01" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#wGrad)" />

        {/* Line */}
        <path d={linePath} fill="none" stroke={ACCENT} strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round" />

        {/* Data points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="5" fill="white" stroke={ACCENT} strokeWidth="2.5" />
            <title>{`${p.record.weight_kg} kg — ${formatShort(p.record.date)}`}</title>
          </g>
        ))}

        {/* X-axis date labels */}
        {xLabelIndices.map((idx) => (
          <text key={idx} x={points[idx].x} y={HEIGHT - 6} textAnchor="middle"
            fill="#9ca3af" fontSize="10">
            {formatShort(records[idx].date)}
          </text>
        ))}
      </svg>
    </div>
  );
}
