import * as React from "react";

/**
 * Inline UI icons (Lucide-style, 2–2.5px stroke) + the brand "peak" bullet.
 * The design uses no emoji and no icon package — these are the only glyphs needed.
 */

export function LockIcon({ size = 10, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="9" rx="1.5" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

export function WarningTriangleIcon({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 3 L22 20 L2 20 Z" />
      <line x1="12" y1="10" x2="12" y2="14" />
      <line x1="12" y1="17" x2="12" y2="17.01" />
    </svg>
  );
}

/**
 * Peak Bullet — the brand's 60° triangle list marker (a solid CSS triangle).
 * `tone` sets the fill; used in the sidebar nav and resource lists.
 */
export function PeakBullet({
  tone = "gold",
  size = 9,
  className = "",
}: {
  tone?: "gold" | "teal" | "muted" | string;
  size?: number;
  className?: string;
}) {
  const fill =
    tone === "gold"
      ? "#FBAD18"
      : tone === "teal"
        ? "#6CCAD0"
        : tone === "muted"
          ? "rgba(240,238,236,0.3)"
          : tone; // allow raw color
  const half = size * 0.56;
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        width: 0,
        height: 0,
        borderLeft: `${half}px solid transparent`,
        borderRight: `${half}px solid transparent`,
        borderBottom: `${size}px solid ${fill}`,
        flex: "none",
        display: "inline-block",
      }}
    />
  );
}

/** Play triangle used on recording thumbnails. */
export function PlayTriangle() {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 0,
        height: 0,
        borderTop: "10px solid transparent",
        borderBottom: "10px solid transparent",
        borderLeft: "16px solid #FBAD18",
        marginLeft: 4,
      }}
    />
  );
}
