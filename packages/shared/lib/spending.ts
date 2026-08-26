/**
 * Gastos — una sola forma de sumar plata en toda la app.
 *
 * Por qué existe este archivo: el mismo total se calculaba en tres sitios con
 * tres reglas distintas —`computeFoodStats` exigía `typeof price === 'number'
 * && price > 0`, el perfil web hacía `s + (price ?? 0)` y el resumen móvil
 * `Number(price) || 0`. Con datos limpios daban lo mismo, pero cualquier fila
 * con precio 0, negativo o llegando como texto los separaba, y el usuario veía
 * dos totales distintos para el mismo gasto sin forma de saber cuál creer.
 *
 * Regla única: se cuenta lo que sea un número finito y positivo. Un precio
 * negativo es un dato malo, no una devolución: los formularios ya validan
 * `min: 0`, así que no hay caso legítimo que perdamos al ignorarlo.
 */

/** Convierte cualquier valor a un monto sumable. Todo lo demás vale 0. */
export function toAmount(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Suma una columna de montos sobre las filas que devuelve Supabase.
 * Genérico en la fila para aceptar tanto los tipos generados (VetVisit,
 * Food…) como los objetos sueltos de un `select('cost')`.
 */
export function sumAmounts<T extends object>(
  rows: readonly T[] | null | undefined,
  column: string,
): number {
  let total = 0;
  for (const row of rows ?? []) total += toAmount((row as Record<string, unknown>)[column]);
  // Los flotantes acumulados dejan restos tipo 424.80000000000007. Redondear
  // aquí evita que dos sumas del mismo dinero en distinto orden difieran.
  return Math.round(total * 100) / 100;
}

/** Las categorías del resumen de gastos, con la tabla y columna de cada una. */
export const SPENDING_SOURCES = [
  { key: 'alimento',    label: 'Alimento',    table: 'foods',                 column: 'price' },
  { key: 'vet',         label: 'Veterinario', table: 'vet_visits',            column: 'cost' },
  { key: 'grooming',    label: 'Grooming',    table: 'groomings',             column: 'cost' },
  { key: 'vuelos',      label: 'Vuelos',      table: 'flights',               column: 'ticket_price' },
  { key: 'snacks',      label: 'Snacks',      table: 'treats',                column: 'price' },
  { key: 'preventivos', label: 'Preventivos', table: 'preventive_treatments', column: 'cost' },
] as const;

export type SpendingKey = typeof SPENDING_SOURCES[number]['key'];
