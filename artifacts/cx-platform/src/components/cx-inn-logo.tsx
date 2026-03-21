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

  // Icon canvas: 76 × 62  (4px left breathing room added so the C stroke never clips)
  // Full canvas: 184 × 62 (icon + text, same 4px shift applied)
  const W = variant === "full" ? 184 : 76;
  const H = 62;
  const aspect = W / H;

  // All path coordinates are shifted +4 on x to match the extra left margin.
  // Original leftmost stroke edge was at x≈8.25 (center 12, strokeWidth 7.5).
  // With +4 shift it becomes x≈12.25, well clear of the viewport left edge.
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

      {/* ── Left large "C" — white for dark backgrounds ── */}
      <path
        d="M 42 7 A 26 26 0 1 0 42 53"
        stroke="rgba(255,255,255,0.92)"
        strokeWidth="7.5"
        strokeLinecap="round"
      />

      {/* ── Right smaller loop — bright blue ── */}
      <path
        d="M 46 17 A 15 15 0 1 1 46 43"
        stroke="#60A5FA"
        strokeWidth="6.5"
        strokeLinecap="round"
      />

      {/* ── Teal arrow shaft ── */}
      <line
        x1="33"
        y1="48"
        x2="64"
        y2="14"
        stroke={`url(#${gradId})`}
        strokeWidth="6"
        strokeLinecap="round"
      />

      {/* ── Arrow head ── */}
      <path d="M 64 14 L 53 17 L 60 25 Z" fill="#22D3EE" />

      {/* ── Text (full variant only) ── */}
      {variant === "full" && (
        <>
          <text
            x="82"
            y="43"
            fontFamily="Plus Jakarta Sans, system-ui, sans-serif"
            fontWeight="700"
            fontSize="32"
            fill="white"
          >
            Cx
          </text>
          <text
            x="119"
            y="43"
            fontFamily="Plus Jakarta Sans, system-ui, sans-serif"
            fontWeight="700"
            fontSize="32"
            fill="#60A5FA"
          >
            -Inn
          </text>
        </>
      )}
    </svg>
  );
}
