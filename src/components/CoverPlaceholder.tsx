interface CoverPlaceholderProps {
  id: string;
  title: string;
  size?: number;
  borderRadius?: number;
}

const RISO_COLORS = [
  { bg: "oklch(72% 0.165 25)", fg: "oklch(95% 0.018 85)" },  // coral
  { bg: "oklch(72% 0.110 235)", fg: "oklch(95% 0.018 85)" }, // sky
  { bg: "oklch(74% 0.115 145)", fg: "oklch(22% 0.018 70)" }, // leaf
  { bg: "oklch(78% 0.135 88)", fg: "oklch(22% 0.018 70)" },  // mustard
  { bg: "oklch(64% 0.140 320)", fg: "oklch(95% 0.018 85)" }, // plum
];

function hashId(id: string): number {
  return id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
}

export default function CoverPlaceholder({ id, title, size = 32, borderRadius = 4 }: CoverPlaceholderProps) {
  const h = hashId(id);
  const { bg, fg } = RISO_COLORS[h % RISO_COLORS.length];
  const char = title.replace(/[【】\s]/g, "").slice(0, 1) || "?";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      style={{ display: "block", borderRadius }}
      aria-hidden="true"
    >
      <rect width="32" height="32" fill={bg} />
      {/* geometric accent */}
      <circle cx="24" cy="8" r="10" fill={fg} fillOpacity="0.15" />
      <rect x="0" y="22" width="32" height="10" fill={fg} fillOpacity="0.08" />
      {/* character */}
      <text
        x="16"
        y="21"
        textAnchor="middle"
        fontFamily='"IBM Plex Sans JP", sans-serif'
        fontSize="14"
        fontWeight="600"
        fill={fg}
        fillOpacity="0.9"
      >
        {char}
      </text>
    </svg>
  );
}
