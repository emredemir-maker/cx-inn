import { useId } from "react";

interface CxInnLogoProps {
  /** Height of the SVG in pixels */
  size?: number;
  /** "icon" = symbol only, "full" = symbol + text */
  variant?: "icon" | "full";
  className?: string;
}

/**
 * CX-Inn brand logo — faithful dark-theme adaptation of the original.
 *
 * Original logo analysis:
 *  - Left large C  : opens RIGHT, dark navy — adapted to white on dark bg
 *  - Right smaller ∂: opens LEFT (backwards C), same navy — adapted to white
 *  - Together they form an infinity-like interlocking symbol
 *  - Teal diagonal arrow rising from the intersection of the two shapes
 *  - "Cx-Inn" text: single unified color
 *
 * ViewBox: icon 80×62, full 196×62
 * Left C  : center (36, 31), radius 23 — opens right  → M 36 8 A 23 23 0 1 0 36 54
 * Right ∂ : center (56, 31), radius 16 — opens left   → M 56 15 A 16 16 0 1 1 56 47
 * Arrow   : shaft (42, 48) → (64, 13), head at (64, 13)
 */
export function CxInnLogo({ size = 36, variant = "icon", className = "" }: CxInnLogoProps) {
  const uid = useId().replace(/:/g, "");
  const gradId = `arrow-${uid}`;

  const W = variant === "full" ? 196 : 80;
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

      {/* ── Left large C — opens RIGHT (standard C shape) ── */}
      {/* Center (36, 31), radius 23: arc from top (36,8) CCW to bottom (36,54) */}
      <path
        d="M 36 8 A 23 23 0 1 0 36 54"
        stroke="rgba(255,255,255,0.92)"
        strokeWidth="7.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* ── Right smaller backwards-C — opens LEFT (∂ shape) ── */}
      {/* Center (56, 31), radius 16: arc from top (56,15) CW to bottom (56,47) */}
      <path
        d="M 56 15 A 16 16 0 1 1 56 47"
        stroke="rgba(255,255,255,0.80)"
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />

      {/* ── Teal arrow shaft — rises diagonally from intersection area ── */}
      <line
        x1="42"
        y1="48"
        x2="64"
        y2="13"
        stroke={`url(#${gradId})`}
        strokeWidth="5.5"
        strokeLinecap="round"
      />

      {/* ── Arrow head (triangle at tip) ── */}
      <path d="M 64 13 L 53 17 L 59 25 Z" fill="#22D3EE" />

      {/* ── Text (full variant only) ── */}
      {variant === "full" && (
        <>
          <text
            x="88"
            y="43"
            fontFamily="Plus Jakarta Sans, system-ui, sans-serif"
            fontWeight="800"
            fontSize="32"
            fill="rgba(255,255,255,0.95)"
          >
            Cx
          </text>
          <text
            x="125"
            y="43"
            fontFamily="Plus Jakarta Sans, system-ui, sans-serif"
            fontWeight="600"
            fontSize="32"
            fill="rgba(255,255,255,0.70)"
          >
            -Inn
          </text>
        </>
      )}
    </svg>
  );
}
