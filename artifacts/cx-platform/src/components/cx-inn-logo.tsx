import { useId } from "react";

interface CxInnLogoProps {
  /** Height of the SVG in pixels */
  size?: number;
  /** "icon" = symbol only, "full" = symbol + "Cx-Inn" text */
  variant?: "icon" | "full";
  className?: string;
}

/**
 * CX-Inn brand logo — precise dark-theme recreation.
 *
 * ── SYMBOL GEOMETRY (viewBox 0 0 86 66) ────────────────────────────────────
 *
 * Each C shape covers ~300° of arc (gap of only 60°, NOT a semicircle).
 * Endpoints are placed ±30° away from the gap-center axis.
 *
 * LEFT C  — opens RIGHT, center (30, 35), radius 27
 *   Gap center: 3-o'clock (0°).  ±30° endpoints:
 *     Top end θ=330° → (30+27·cos330°, 35+27·sin330°) = (53, 22)
 *     Bot end θ= 30° → (30+27·cos 30°, 35+27·sin 30°) = (53, 49)
 *   Path: M 53 22 A 27 27 0 1 0 53 49   (CCW, large-arc)
 *   Arc traces: upper-right → TOP → LEFT → BOTTOM → lower-right  ✓
 *
 * RIGHT ∂ — opens LEFT,  center (59, 35), radius 18
 *   Gap center: 9-o'clock (180°).  ±30° endpoints:
 *     Top end θ=210° → (59+18·cos210°, 35+18·sin210°) = (43, 26)
 *     Bot end θ=150° → (59+18·cos150°, 35+18·sin150°) = (43, 44)
 *   Path: M 43 26 A 18 18 0 1 1 43 44   (CW, large-arc)
 *   Arc traces: upper-left → TOP → RIGHT → BOTTOM → lower-left  ✓
 *
 * OVERLAP: circles intersect (dist-between-centers=29 < sum-of-radii=45)
 *   x overlap zone: 41–57  → deep interlocking ∞ appearance  ✓
 *
 * ARROW — diagonal from lower junction (46, 57) to upper-right (70, 14)
 *   Teal gradient, head triangle at tip.
 * ───────────────────────────────────────────────────────────────────────────
 */
export function CxInnLogo({ size = 36, variant = "icon", className = "" }: CxInnLogoProps) {
  const uid = useId().replace(/:/g, "");
  const gradId = `cxinn-arrow-${uid}`;

  const W = variant === "full" ? 202 : 86;
  const H = 66;
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

      {/* ── Left large C — 300° arc, opens RIGHT ──────────────────────────── */}
      <path
        d="M 53 22 A 27 27 0 1 0 53 49"
        stroke="rgba(255,255,255,0.92)"
        strokeWidth="9"
        strokeLinecap="round"
        fill="none"
      />

      {/* ── Right backwards-C (∂) — 300° arc, opens LEFT ─────────────────── */}
      <path
        d="M 43 26 A 18 18 0 1 1 43 44"
        stroke="rgba(255,255,255,0.80)"
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
      />

      {/* ── Teal arrow — rises from junction to upper-right ───────────────── */}
      <line
        x1="46" y1="57"
        x2="69" y2="14"
        stroke={`url(#${gradId})`}
        strokeWidth="6.5"
        strokeLinecap="round"
      />

      {/* ── Arrow head (triangle at tip, pointing upper-right) ────────────── */}
      <path d="M 72 11 L 61 17 L 67 25 Z" fill="#22D3EE" />

      {/* ── Text (full variant only) ──────────────────────────────────────── */}
      {variant === "full" && (
        <>
          <text
            x="94"
            y="44"
            fontFamily="Plus Jakarta Sans, system-ui, sans-serif"
            fontWeight="800"
            fontSize="33"
            fill="rgba(255,255,255,0.95)"
          >
            Cx
          </text>
          <text
            x="133"
            y="44"
            fontFamily="Plus Jakarta Sans, system-ui, sans-serif"
            fontWeight="500"
            fontSize="33"
            fill="rgba(255,255,255,0.72)"
          >
            -Inn
          </text>
        </>
      )}
    </svg>
  );
}
