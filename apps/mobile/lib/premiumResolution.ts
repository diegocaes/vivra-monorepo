/** A failed provider is unknown, never evidence that the customer is free. */
export async function resolvePremiumAccess(sources: Array<() => Promise<boolean>>): Promise<boolean | null> {
  let failed = false;
  for (const source of sources) {
    try {
      if (await source()) return true;
    } catch {
      failed = true;
    }
  }
  return failed ? null : false;
}
