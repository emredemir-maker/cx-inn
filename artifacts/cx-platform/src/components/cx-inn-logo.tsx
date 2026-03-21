import { useId } from "react";

interface CxInnLogoProps {
  /** Height of the SVG in pixels */
  size?: number;
  /** "icon" = symbol only (for sidebar), "full" = symbol + text (for login) */
  variant?: "icon" | "full";
  className?: string;
}

/**
 * CX-Inn brand logo.
 *
 * Shapes:
 *  - Large "C" (opens right) in primary blue  — left element
 *  - Smaller backwards "C" (opens left) in lighter blue — right loop
 *  - Teal diagonal arrow rising from the intersection
 *
 * Colors follow the app's dark-theme palette:
 *  - Primary blue  : #3B82F6
 *  - Lighter blue  : #60A5FA
 *  - Arrow gradient: #22D3EE → #34D399 (cyan → emerald)
 */
export function CxInnLogo({ size = 36, variant = "icon", className = "" }: CxInnLogoProps) {
  const uid = useId().replace(/:/g, "");
  const gradId = `arrow-${uid}`;

  // Icon canvas: 72 × 62
  // Full canvas: 172 × 62 (icon + text)
  const W = variant === "full" ? 178 : 72;
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
      aria-label="Cx-Inn"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="1" x2="1" y2="0" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#22D3EE" />
          <stop offset="100%" stopColor="#34D399" />
        </linearGradient>
      </defs>

      {/* ── Left large "C" (center ≈ 22,31 · r ≈ 26) opens to the right ── */}
      <path
        d="M 38 7 A 26 26 0 1 0 38 53"
        stroke="#3B82F6"
        strokeWidth="7"
        strokeLinecap="round"
      />

      {/* ── Right smaller loop (center ≈ 52,31 · r ≈ 15) opens to the left ── */}
      <path
        d="M 42 17 A 15 15 0 1 1 42 43"
        stroke="#60A5FA"
        strokeWidth="6"
        strokeLinecap="round"
      />

      {/* ── Teal arrow shaft ── */}
      <line
        x1="29"
        y1="48"
        x2="60"
        y2="14"
        stroke={`url(#${gradId})`}
        strokeWidth="5.5"
        strokeLinecap="round"
      />

      {/* ── Arrow head ── */}
      <path d="M 60 14 L 49 17 L 56 25 Z" fill="#22D3EE" />

      {/* ── Text (full variant only) ── */}
      {variant === "full" && (
        <>
          <text
            x="78"
            y="43"
            fontFamily="Plus Jakarta Sans, system-ui, sans-serif"
            fontWeight="700"
            fontSize="32"
            fill="white"
          >
            Cx
          </text>
          <text
            x="115"
            y="43"
            fontFamily="Plus Jakarta Sans, system-ui, sans-serif"
            fontWeight="700"
            fontSize="32"
            fill="#3B82F6"
          >
            -Inn
          </text>
        </>
      )}
    </svg>
  );
}
