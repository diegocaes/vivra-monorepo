export interface RequiredOperationResult {
  error: unknown | null;
}

export interface RequiredOperation {
  name: string;
  run: () => PromiseLike<RequiredOperationResult>;
}

export interface FailedOperation {
  name: string;
  error: unknown;
}

/**
 * Supabase operations resolve with `{ error }` on database failures. This
 * runner treats both resolved errors and rejected promises as failures so the
 * caller cannot continue to the irreversible Auth deletion by accident.
 */
export async function runRequiredOperations(
  operations: readonly RequiredOperation[],
): Promise<FailedOperation[]> {
  for (const { name, run } of operations) {
    try {
      const result = await run();
      if (result.error) return [{ name, error: result.error }];
    } catch (error) {
      return [{ name, error }];
    }
  }

  return [];
}
