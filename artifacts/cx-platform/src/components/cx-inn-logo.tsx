import { useId } from "react";

interface CxInnLogoProps {
  size?: number;
  variant?: "icon" | "full";
  className?: string;
}

/**
 * CX-Inn brand logo — faithful dark-theme SVG.
 *
 * Geometry derived from pixel-perfect Python/Pillow render (draw_logo.py).
 *
 * ── SYMBOL (viewBox 0 0 102 80) ─────────────────────────────────────────────
 *
 * LEFT C  center(42,43) r=30  gap ±30° on right  300° CCW arc
 *   top end θ=330° → (68,28)   bot end θ=30° → (68,58)
 *   path: M 68 28 A 30 30 0 1 0 68 58
 *
 * RIGHT ∂  center(73,43) r=18  gap ±30° on left  300° CW arc split:
 *   navy top  210°→30°  (180° CW): M 57 34 A 18 18 0 0 1 89 52
 *   teal bot   30°→150° (120° CW): M 89 52 A 18 18 0 0 1 57 52
 *
 * ARROW tail=(57,52)  tip=(94,9)  same teal gradient as ∂ bottom
 * ────────────────────────────────────────────────────────────────────────────
 */
export function CxInnLogo({ size = 36, variant = "icon", className = "" }: CxInnLogoProps) {
  const uid = useId().replace(/:/g, "");
  const gTeal = `t-${uid}`;   // teal gradient id

  const W = variant === "full" ? 208 : 102;
  const H = 80;

  // Arrow geometry
  const ATX = 57, ATY = 52;   // tail = end of teal arc
  const AHX = 94, AHY = 9;    // head tip

  const dx = AHX - ATX, dy = AHY - ATY;
  const len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len;
  const px = -uy,  py = ux;

  const HEAD_L = 17, HEAD_W = 10;
  const sex = AHX - ux * HEAD_L;   // shaft end x
  const sey = AHY - uy * HEAD_L;   // shaft end y

  const b0x = +(sex + px * HEAD_W).toFixed(1);
  const b0y = +(sey + py * HEAD_W).toFixed(1);
  const b1x = +(sex - px * HEAD_W).toFixed(1);
  const b1y = +(sey - py * HEAD_W).toFixed(1);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={size * (W / H)}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Cx-Inn"
    >
      <defs>
        {/*
          Single gradient along the arrow direction (tail → tip).
          Applied to both the teal arc bottom of ∂ AND the arrow shaft,
          so the color flows continuously from dark-cyan to mint-green.
        */}
        <linearGradient
          id={gTeal}
          x1={ATX} y1={ATY} x2={AHX} y2={AHY}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%"   stopColor="#22D3EE" />
          <stop offset="100%" stopColor="#34D399" />
        </linearGradient>
      </defs>

      {/* ── Left large C — 300° CCW arc, opens RIGHT ────────────────────── */}
      <path
        d="M 68 28 A 30 30 0 1 0 68 58"
        stroke="rgba(255,255,255,0.93)"
        strokeWidth="9.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* ── Right ∂ navy top — 180° CW arc (upper + right side) ──────────── */}
      <path
        d="M 57 34 A 18 18 0 0 1 89 52"
        stroke="rgba(255,255,255,0.82)"
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
      />

      {/* ── Right ∂ teal bottom — 120° CW arc (blends into arrow) ────────── */}
      <path
        d="M 89 52 A 18 18 0 0 1 57 52"
        stroke={`url(#${gTeal})`}
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
      />

      {/* ── Arrow shaft ───────────────────────────────────────────────────── */}
      <line
        x1={ATX} y1={ATY}
        x2={sex.toFixed(1)} y2={sey.toFixed(1)}
        stroke={`url(#${gTeal})`}
        strokeWidth="6"
        strokeLinecap="round"
      />

      {/* ── Arrow head ────────────────────────────────────────────────────── */}
      <path
        d={`M ${AHX} ${AHY} L ${b0x} ${b0y} L ${b1x} ${b1y} Z`}
        fill="#34D399"
      />

      {/* ── Text (full variant) ───────────────────────────────────────────── */}
      {variant === "full" && (
        <>
          <text
            x="106" y="53"
            fontFamily="'Segoe UI', system-ui, -apple-system, sans-serif"
            fontWeight="700"
            fontSize="36"
            fill="rgba(255,255,255,0.95)"
          >
            Cx
          </text>
          <text
            x="148" y="53"
            fontFamily="'Segoe UI', system-ui, -apple-system, sans-serif"
            fontWeight="400"
            fontSize="36"
            fill="rgba(255,255,255,0.80)"
          >
            -Inn
          </text>
        </>
      )}
    </svg>
  );
}
