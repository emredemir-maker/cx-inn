/**
 * Shared application-level constants.
 * Import from here instead of hardcoding magic values across files.
 */

/** The default tenant seeded at startup for single-tenant / legacy operation. */
export const DEFAULT_TENANT_ID = "00000000-0000-4000-8000-000000000001";

/** Maximum field lengths for external API inputs (v1 / webhook). */
export const MAX_FIELD_LENGTHS = {
  name: 255,
  email: 254,
  company: 255,
  event: 255,
  subject: 500,
  content: 20_000,
} as const;

/** Regex for a valid hex color (#rrggbb). */
export const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/** Regex for a broadly valid e-mail address. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
