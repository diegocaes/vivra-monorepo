/** Only use for reads: replaying a write can duplicate data or side effects. */
export async function retryRead<T extends { error: unknown; status: number }>(
  query: () => PromiseLike<T>,
): Promise<T> {
  const result = await query();
  if (!result.error || ![0, 408, 502, 503, 504].includes(result.status)) return result;
  // Brief backoff, then recreate the query; never replay the successful reads
  // alongside this one or turn a persistent failure into an empty result.
  await new Promise(resolve => setTimeout(resolve, 400));
  return query();
}
