const IS_PROD = process.env.NODE_ENV === "production";

/**
 * Returns a safe error string for API responses.
 * In production, internal error details are hidden to prevent information leakage.
 * In development, the full error string is returned for easier debugging.
 */
export function sanitizeError(err: unknown): string {
  if (IS_PROD) return "Bir hata oluştu";
  return String(err);
}
