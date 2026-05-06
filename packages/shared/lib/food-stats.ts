/**
 * Food statistics — averages and totals across all logged food bags for a pet.
 *
 * Philosophy: the user already knows when food runs out. The app should be a
 * cost ledger and trazabilidad tool, not an alarm. These stats power the
 * "Alimentación" tab and the home dashboard food card.
 */

/** Minimal subset of the Food row we need for stats. Compatible with both
 *  the mobile `Food` type and what the web SSR queries select. */
export interface FoodLike {
  brand?: string | null;
  food_type?: string | null;
  type?: string | null;
  daily_grams?: number | null;
  bag_size?: number | null;
  bag_unit?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  price?: number | null;
  created_at?: string | null;
}

export interface FoodStats {
  /** Average $/day across bags that have both a price and a (real or projected) duration. null if no data. */
  avgPricePerDay: number | null;
  /** Average days a bag lasts. Prefers real durations (end_date set) and falls back to projected (bag_size/daily_grams). null if no data. */
  avgDaysPerBag: number | null;
  /** Average daily ration in grams across logged bags. null if no data. */
  avgDailyGrams: number | null;
  /** Sum of all bag prices ever logged. */
  totalSpent: number;
  /** How many food bags the user has logged. */
  totalBags: number;
  /** Brand + type of the most recent bag. null if no foods. */
  latestFood: { brand: string; type: string | null } | null;
}

function bagToGrams(size: number, unit: string | null | undefined): number {
  const u = unit ?? 'kg';
  if (u === 'kg') return size * 1000;
  if (u === 'lb') return size * 453.592;
  return size; // assume grams
}

function daysBetween(startISO: string, endISO: string): number {
  const start = new Date(startISO.length > 10 ? startISO : startISO + 'T00:00:00');
  const end = new Date(endISO.length > 10 ? endISO : endISO + 'T00:00:00');
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000));
}

/** Compute aggregate stats from a list of food bags. Foods are expected
 *  to be ordered most-recent first (matches our `created_at DESC` queries),
 *  but the function is robust to any order. */
export function computeFoodStats(foods: FoodLike[]): FoodStats {
  if (!foods || foods.length === 0) {
    return {
      avgPricePerDay: null,
      avgDaysPerBag: null,
      avgDailyGrams: null,
      totalSpent: 0,
      totalBags: 0,
      latestFood: null,
    };
  }

  // Sort by created_at desc to determine "latest" robustly.
  const sorted = [...foods].sort((a, b) => {
    const ad = a.created_at ?? '';
    const bd = b.created_at ?? '';
    return bd.localeCompare(ad);
  });

  const latest = sorted[0];
  const latestFood = latest?.brand
    ? { brand: latest.brand, type: latest.food_type ?? latest.type ?? null }
    : null;

  let totalSpent = 0;
  const dailyGramsList: number[] = [];
  const durationDaysList: number[] = [];
  const pricePerDayList: number[] = [];

  for (const f of sorted) {
    if (typeof f.price === 'number' && f.price > 0) {
      totalSpent += f.price;
    }
    if (typeof f.daily_grams === 'number' && f.daily_grams > 0) {
      dailyGramsList.push(f.daily_grams);
    }

    // Compute duration: prefer real (end_date), fall back to projected.
    let durationDays: number | null = null;
    if (f.start_date && f.end_date) {
      durationDays = daysBetween(f.start_date, f.end_date);
    } else if (f.bag_size && f.daily_grams && f.daily_grams > 0) {
      const grams = bagToGrams(f.bag_size, f.bag_unit);
      durationDays = Math.floor(grams / f.daily_grams);
    }

    if (durationDays !== null && durationDays > 0) {
      durationDaysList.push(durationDays);
      if (typeof f.price === 'number' && f.price > 0) {
        pricePerDayList.push(f.price / durationDays);
      }
    }
  }

  const avg = (xs: number[]): number | null =>
    xs.length === 0 ? null : xs.reduce((s, x) => s + x, 0) / xs.length;

  return {
    avgPricePerDay: avg(pricePerDayList),
    avgDaysPerBag: avg(durationDaysList) !== null ? Math.round(avg(durationDaysList)!) : null,
    avgDailyGrams: avg(dailyGramsList) !== null ? Math.round(avg(dailyGramsList)!) : null,
    totalSpent,
    totalBags: sorted.length,
    latestFood,
  };
}
