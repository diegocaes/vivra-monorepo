import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Rect, Text as SvgText, Line, G } from 'react-native-svg';
import { Colors, Spacing, FontSize, FontWeight } from '../../constants/theme';
import { toAmount, formatCurrency } from '@vivra/shared';
import { Card } from '../ui/Card';

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

interface HistoryChartProps {
  /** Cada punto del historial: fecha y costo opcional. */
  items: { date: string | null | undefined; amount?: number | null }[];
  /** Qué representa cada punto: "visitas", "sesiones", "dosis"… */
  noun: string;
  /** Meses hacia atrás. 6 entra cómodo en pantalla de celular. */
  months?: number;
  /**
   * Los totales en plata por sección son Premium. Sin premium la gráfica
   * cuenta eventos —que ya es útil— y ofrece el desglose como upsell.
   */
  showMoney?: boolean;
}

/**
 * Barras por mes sobre un historial. Gemela de HistoryChart.astro en la web:
 * si cambias una, cambia la otra.
 */
export function HistoryChart({ items, noun, months = 6, showMoney = false }: HistoryChartProps) {
  const router = useRouter();

  const buckets = useMemo(() => {
    const now = new Date();
    const out: { key: string; label: string; count: number; total: number }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: MONTH_LABELS[d.getMonth()],
        count: 0,
        total: 0,
      });
    }
    const byKey = new Map(out.map(b => [b.key, b]));
    for (const it of items) {
      if (!it.date) continue;
      const b = byKey.get(it.date.slice(0, 7));
      if (!b) continue;
      b.count += 1;
      b.total += toAmount(it.amount);
    }
    return out;
  }, [items, months]);

  const hasCostData = buckets.some(b => b.total > 0);
  const hasMoney = showMoney && hasCostData;
  const periodCount = buckets.reduce((s, b) => s + b.count, 0);
  const periodTotal = buckets.reduce((s, b) => s + b.total, 0);
  const activeMonths = buckets.filter(b => b.count > 0).length;

  if (periodCount === 0) return null;

  const alturaDe = (b: typeof buckets[number]) => (hasMoney ? b.total : b.count);
  const maxVal = Math.max(...buckets.map(alturaDe), 1);

  const W = 320;
  const H = 168;
  // El top reserva espacio para la cifra sobre cada barra, que si no se corta.
  const PAD = { top: 28, bottom: 26, left: 8, right: 8 };
  const plotH = H - PAD.top - PAD.bottom;
  const barW = 32;
  const gap = (W - PAD.left - PAD.right - barW * months) / Math.max(1, months - 1);

  const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)));

  return (
    <Card>
      <View style={styles.header}>
        <Text style={styles.title}>Últimos {months} meses</Text>
        <Text style={styles.summary}>
          {hasMoney ? `$${formatCurrency(periodTotal)}` : `${periodCount} ${noun}`}
          {hasMoney && activeMonths > 0 && (
            <Text style={styles.avg}>  ~${fmt(periodTotal / activeMonths)}/mes</Text>
          )}
        </Text>
      </View>

      <Svg width={W} height={H}>
        <Line
          x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom}
          stroke={Colors.cardBorder} strokeWidth={1}
        />
        {buckets.map((b, i) => {
          const v = alturaDe(b);
          const h = v > 0 ? Math.max(3, (v / maxVal) * plotH) : 3;
          const x = PAD.left + i * (barW + gap);
          const y = H - PAD.bottom - h;
          return (
            <G key={b.key}>
              <Rect
                x={x} y={y} width={barW} height={h} rx={3}
                fill={v > 0 ? Colors.accent : Colors.cardBorder}
                opacity={v > 0 ? 0.85 : 1}
              />
              {v > 0 && (
                <SvgText
                  x={x + barW / 2} y={Math.max(12, y - 6)}
                  textAnchor="middle" fontSize={10} fontWeight="600" fill={Colors.muted}
                >
                  {hasMoney ? `$${fmt(b.total)}` : String(b.count)}
                </SvgText>
              )}
              <SvgText
                x={x + barW / 2} y={H - 8}
                textAnchor="middle" fontSize={10} fill={Colors.muted}
              >
                {b.label}
              </SvgText>
            </G>
          );
        })}
      </Svg>

      {!showMoney && hasCostData && (
        <TouchableOpacity
          style={styles.upsell}
          onPress={() => router.push('/paywall' as any)}
          activeOpacity={0.7}
        >
          <Ionicons name="lock-closed" size={12} color={Colors.accent} />
          <Text style={styles.upsellText}>Ver cuánto gastaste con Premium</Text>
        </TouchableOpacity>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  summary: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.ink },
  avg: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, color: Colors.muted },
  upsell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: Spacing.sm,
  },
  upsellText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, color: Colors.accent },
});
