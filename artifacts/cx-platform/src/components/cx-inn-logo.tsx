import { useId } from "react";

interface CxInnLogoProps {
  /** Height of the SVG in pixels */
  size?: number;
  /** "icon" = symbol only, "full" = symbol + "Cx-Inn" text */
  variant?: "icon" | "full";
  className?: string;
}

/**
 * CX-Inn brand logo — faithful dark-theme SVG recreation.
 *
 * Geometry derived from pixel-perfect Python/Pillow render (draw_logo.py).
 * PNG reference: cx-inn-logo-preview.png
 *
 * ── SYMBOL (viewBox 0 0 96 74) ──────────────────────────────────────────────
 *
 * LEFT C  — standard C, opens RIGHT, center (38,40) r=26, gap ±30° = 300° arc
 *   Top end θ=330°: (38+26·cos330°, 40+26·sin330°) = (60.5, 27) → (61, 27)
 *   Bot end θ= 30°: (38+26·cos 30°, 40+26·sin 30°) = (60.5, 53) → (61, 53)
 *   SVG path: M 61 27 A 26 26 0 1 0 61 53   (large-arc=1, sweep=0 = CCW)
 *   Traces: upper-right → TOP → LEFT → BOTTOM → lower-right  ✓
 *
 * RIGHT ∂ — backwards-C, opens LEFT, center (65,40) r=18, gap ±30° = 300° arc
 *   Top end θ=210°: (65+18·cos210°, 40+18·sin210°) = (49.4, 31) → (49, 31)
 *   Bot end θ=150°: (65+18·cos150°, 40+18·sin150°) = (49.4, 49) → (49, 49)
 *   SVG path: M 49 31 A 18 18 0 1 1 49 49   (large-arc=1, sweep=1 = CW)
 *   Traces: upper-left → TOP → RIGHT → BOTTOM → lower-left  ✓
 *
 * CIRCLE INTERSECTION (d=27, r1=26, r2=18):
 *   a = (676−324+729)/54 = 20.0   h = √(676−400) = 16.6
 *   x_int = 38+20 = 58            y = 40 ± 16.6 → top≈23, bot≈57
 *
 * ARROW — teal gradient (cyan→mint), tail at (55,58) head tip at (82,10)
 *   Crosses both circle intersection points → authentic interlocked look  ✓
 * ───────────────────────────────────────────────────────────────────────────
 */
export function CxInnLogo({ size = 36, variant = "icon", className = "" }: CxInnLogoProps) {
  const uid = useId().replace(/:/g, "");
  const gradId = `cxinn-arrow-${uid}`;

  const W = variant === "full" ? 212 : 96;
  const H = 74;
  const aspect = W / H;

  // Arrow geometry — computed once, shared between shaft and head
  const AX0 = 55, AY0 = 59;   // tail (near bottom circle intersection)
  const AX1 = 82, AY1 = 10;   // head tip (upper-right)

  const dx = AX1 - AX0, dy = AY1 - AY0;
  const len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len;   // unit along shaft
  const px = -uy, py = ux;              // perpendicular unit

  const HEAD_LEN = 9;    // arrowhead length (SVG units)
  const HEAD_W   = 5;    // arrowhead half-width

  // Shaft stops before tip so head triangle starts cleanly
  const sx = AX1 - ux * HEAD_LEN;
  const sy = AY1 - uy * HEAD_LEN;

  // Arrowhead base corners
  const b0x = sx + px * HEAD_W;
  const b0y = sy + py * HEAD_W;
  const b1x = sx - px * HEAD_W;
  const b1y = sy - py * HEAD_W;

  const headPath = `M ${AX1} ${AY1} L ${b0x.toFixed(1)} ${b0y.toFixed(1)} L ${b1x.toFixed(1)} ${b1y.toFixed(1)} Z`;

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
        {/* Gradient direction: tail (bottom-left) → head (top-right) */}
        <linearGradient id={gradId} x1="55" y1="59" x2="82" y2="10" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#22D3EE" />
          <stop offset="100%" stopColor="#34D399" />
        </linearGradient>
      </defs>

      {/* ── Left large C — 300° CCW arc, opens RIGHT ────────────────────── */}
      <path
        d="M 61 27 A 26 26 0 1 0 61 53"
        stroke="rgba(255,255,255,0.92)"
        strokeWidth="8.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* ── Right backwards-C (∂) — 300° CW arc, opens LEFT ─────────────── */}
      <path
        d="M 49 31 A 18 18 0 1 1 49 49"
        stroke="rgba(255,255,255,0.80)"
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
      />

      {/* ── Arrow shaft — teal gradient ───────────────────────────────────── */}
      <line
        x1={AX0} y1={AY0}
        x2={sx.toFixed(1)} y2={sy.toFixed(1)}
        stroke={`url(#${gradId})`}
        strokeWidth="6"
        strokeLinecap="round"
      />

      {/* ── Arrow head — solid mint triangle ─────────────────────────────── */}
      <path d={headPath} fill="#34D399" />

      {/* ── Text (full variant only) ─────────────────────────────────────── */}
      {variant === "full" && (
        <>
          {/* "Cx" — bold */}
          <text
            x="100"
            y="51"
            fontFamily="'Segoe UI', system-ui, -apple-system, sans-serif"
            fontWeight="700"
            fontSize="34"
            fill="rgba(255,255,255,0.95)"
          >
            Cx
          </text>
          {/* "-Inn" — regular, same color but softer */}
          <text
            x="140"
            y="51"
            fontFamily="'Segoe UI', system-ui, -apple-system, sans-serif"
            fontWeight="400"
            fontSize="34"
            fill="rgba(255,255,255,0.78)"
          >
            -Inn
          </text>
        </>
      )}
    </svg>
  );
}
