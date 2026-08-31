export interface SupabaseErrorLike {
  message: string;
  code?: string;
}

export interface NamedSupabaseResult {
  name: string;
  error: SupabaseErrorLike | null;
}

/**
 * Supabase queries usually resolve with `{ error }` instead of rejecting the
 * promise. Callers must inspect every result before interpreting missing data
 * as an empty history.
 */
export function firstSupabaseFailure(
  results: readonly NamedSupabaseResult[],
): NamedSupabaseResult | null {
  return results.find((result) => result.error !== null) ?? null;
}
