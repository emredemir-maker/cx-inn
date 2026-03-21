import { useId } from "react";

interface CxInnLogoProps {
  /** Height of the SVG in pixels */
  size?: number;
  /** "icon" = symbol only, "full" = symbol + "Cx-Inn" text */
  variant?: "icon" | "full";
  className?: string;
}

/**
 * CX-Inn brand logo — dark-theme faithful recreation.
 *
 * Symbol geometry (viewBox 0 0 88 62):
 *
 *   LEFT C  — large, opens RIGHT, center (30,31) radius 25
 *             M 30 6 A 25 25 0 1 0 30 56
 *             x range: 5 → 55  (left edge → gap opening)
 *
 *   RIGHT ∂ — smaller, opens LEFT, center (58,31) radius 19
 *             M 58 12 A 19 19 0 1 1 58 50
 *             x range: 39 → 77  (gap opening ← right edge)
 *
 *   OVERLAP zone: x 39–55  → shapes interlock like ∞
 *
 *   ARROW  — diagonal from (40,52) → (71,10), head at tip
 *             teal gradient #22D3EE → #34D399
 *
 * Full variant adds "Cx-Inn" text; viewBox widens to 0 0 210 62.
 */
export function CxInnLogo({ size = 36, variant = "icon", className = "" }: CxInnLogoProps) {
  const uid = useId().replace(/:/g, "");
  const gradId = `cxinn-arrow-${uid}`;

  const W = variant === "full" ? 210 : 88;
  const H = 62;
  const aspect = W / H;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={size * aspect}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Cx-Inn"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="1" x2="1" y2="0" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#22D3EE" />
          <stop offset="100%" stopColor="#34D399" />
        </linearGradient>
      </defs>

      {/* ── Left large C — opens RIGHT ────────────────────────────────
           Center (30,31) radius 25.
           Arc from top (30,6) counterclockwise to bottom (30,56):
           large-arc=1, sweep=0 → traces the left/bottom arc = C shape  */}
      <path
        d="M 30 6 A 25 25 0 1 0 30 56"
        stroke="rgba(255,255,255,0.92)"
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
      />

      {/* ── Right backwards-C (∂) — opens LEFT ───────────────────────
           Center (58,31) radius 19.
           Arc from top (58,12) clockwise to bottom (58,50):
           large-arc=1, sweep=1 → traces the right arc = ∂ shape      */}
      <path
        d="M 58 12 A 19 19 0 1 1 58 50"
        stroke="rgba(255,255,255,0.78)"
        strokeWidth="6.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* ── Teal arrow shaft — rises from junction to upper-right ────  */}
      <line
        x1="40" y1="52"
        x2="68" y2="13"
        stroke={`url(#${gradId})`}
        strokeWidth="5.5"
        strokeLinecap="round"
      />

      {/* ── Arrow head (triangle at tip) ──────────────────────────────  */}
      <path d="M 71 10 L 60 15 L 66 23 Z" fill="#22D3EE" />

      {/* ── Text (full variant only) ──────────────────────────────────  */}
      {variant === "full" && (
        <>
          <text
            x="96"
            y="43"
            fontFamily="Plus Jakarta Sans, system-ui, sans-serif"
            fontWeight="800"
            fontSize="33"
            fill="rgba(255,255,255,0.95)"
          >
            Cx
          </text>
          <text
            x="135"
            y="43"
            fontFamily="Plus Jakarta Sans, system-ui, sans-serif"
            fontWeight="500"
            fontSize="33"
            fill="rgba(255,255,255,0.70)"
          >
            -Inn
          </text>
        </>
      )}
    </svg>
  );
}
