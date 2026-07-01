/**
 * Normalizes caught values into an `Error` instance.
 *
 * Caught values are typed as `unknown`, so non-`Error` values are wrapped in a
 * new `Error` using their string representation.
 */
export function getCaughtError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
