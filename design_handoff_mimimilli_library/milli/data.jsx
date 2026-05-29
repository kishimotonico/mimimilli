// mimimilli — mock data + risograph-style cover artwork
/* eslint-disable */

// ── Twelve fictional ambient/healing audio works ─────────────────
// Each work has 2 riso "ink" colors (light & punchy) on a cream paper.
const WORKS = [
  {
    id: "w-yorulib-1", title: "夜の図書館 vol.1", subtitle: "深夜の読書時間",
    cover: "library", inks: ["sky", "mustard"], paper: "ivory",
    addedAt: "2025-11-12", addedLabel: "3 日前",
    duration: "2:48:14", durationS: 10094, trackCount: 12, fileCount: 47,
    tags: [
      { k: "cv", v: "月白あかね" },
      { k: "シリーズ", v: "夜の図書館" },
      { k: "サークル", v: "夜想曲" },
      { k: "カテゴリ", v: "環境音" },
      { f: "バイノーラル" },
      { f: "ページめくり" },
      { f: "暖炉" },
    ],
    urls: [
      { label: "販売ページ", host: "dlsite.example" },
      { label: "公式サイト", host: "yorulib.example" },
      { label: "サークルX", host: "x.com/yasokyoku" },
    ],
  },
  {
    id: "w-amaoto-natsu", title: "雨音シリーズ — 真夏の縁側", subtitle: "蝉時雨と土の匂い",
    cover: "rain", inks: ["leaf", "ink"], paper: "ivory",
    addedAt: "2025-11-09", addedLabel: "6 日前",
    duration: "3:12:00", durationS: 11520, trackCount: 8, fileCount: 23,
    tags: [
      { k: "シリーズ", v: "雨音シリーズ" }, { k: "サークル", v: "夜想曲" },
      { k: "カテゴリ", v: "環境音" }, { f: "雨音" }, { f: "蝉" },
      { f: "ロケーション収録" }, { f: "ヒーリング" },
    ],
    urls: [
      { label: "販売ページ", host: "dlsite.example" },
      { label: "サークルX", host: "x.com/yasokyoku" },
    ],
  },
  {
    id: "w-tsukiyo-ocha", title: "月夜のお茶会", subtitle: "茉莉花茶と硝子の音",
    cover: "moon", inks: ["plum", "mustard"], paper: "ivory",
    addedAt: "2025-11-02", addedLabel: "2 週間前",
    duration: "1:42:30", durationS: 6150, trackCount: 9, fileCount: 18,
    tags: [
      { k: "cv", v: "星川しずく" }, { k: "サークル", v: "茶寮アンナ" },
      { k: "カテゴリ", v: "ASMR" }, { f: "耳かき" }, { f: "バイノーラル" }, { f: "囁き" },
    ],
    urls: [{ label: "販売ページ", host: "dlsite.example" }],
  },
  {
    id: "w-fuyu-yamagoya", title: "冬の山小屋ASMR", subtitle: "雪と薪と珈琲",
    cover: "cabin", inks: ["coral", "ink"], paper: "ivory",
    addedAt: "2025-10-22", addedLabel: "先月",
    duration: "4:05:48", durationS: 14748, trackCount: 14, fileCount: 62,
    tags: [
      { k: "cv", v: "月白あかね" }, { k: "サークル", v: "雪枝舎" },
      { k: "カテゴリ", v: "環境音" }, { f: "焚き火" }, { f: "雪" },
      { f: "バイノーラル" }, { f: "長時間" },
    ],
    urls: [
      { label: "販売ページ", host: "fanza.example" },
      { label: "公式サイト", host: "yukiedasha.example" },
    ],
  },
  {
    id: "w-koshoten", title: "古書店の午後", subtitle: "雨と紙とコーヒーの匂い",
    cover: "shelf", inks: ["mustard", "ink"], paper: "ivory",
    addedAt: "2025-10-18", addedLabel: "先月",
    duration: "2:20:00", durationS: 8400, trackCount: 7, fileCount: 29,
    tags: [
      { k: "シリーズ", v: "下町の午後" }, { k: "カテゴリ", v: "環境音" },
      { f: "ページめくり" }, { f: "雨音" }, { f: "BGM" },
    ],
    urls: [{ label: "販売ページ", host: "dlsite.example" }],
  },
  {
    id: "w-shinkai", title: "深海のささやき", subtitle: "海の底からの便り",
    cover: "sonar", inks: ["sky", "ink"], paper: "ivory",
    addedAt: "2025-10-04", addedLabel: "先月",
    duration: "1:58:20", durationS: 7100, trackCount: 10, fileCount: 22,
    tags: [
      { k: "cv", v: "深沢みなも" }, { k: "カテゴリ", v: "ASMR" },
      { f: "バイノーラル" }, { f: "水音" }, { f: "囁き" }, { f: "R-15" },
    ],
    urls: [
      { label: "販売ページ", host: "dlsite.example" },
      { label: "サークル", host: "minamo.example" },
    ],
  },
  {
    id: "w-makistove", title: "雪降る夜の薪ストーブ", subtitle: "山小屋日誌 番外篇",
    cover: "stove", inks: ["coral", "mustard"], paper: "ivory",
    addedAt: "2025-09-28", addedLabel: "先月",
    duration: "6:10:00", durationS: 22200, trackCount: 4, fileCount: 11,
    tags: [
      { k: "シリーズ", v: "山小屋日誌" }, { k: "サークル", v: "雪枝舎" },
      { k: "カテゴリ", v: "環境音" }, { f: "焚き火" }, { f: "長時間" }, { f: "睡眠用" },
    ],
    urls: [{ label: "販売ページ", host: "dlsite.example" }],
  },
  {
    id: "w-asagiri", title: "朝霧の森", subtitle: "鳥と苔と湿った土",
    cover: "fog", inks: ["leaf", "mustard"], paper: "ivory",
    addedAt: "2025-09-12", addedLabel: "2 ヶ月前",
    duration: "1:30:00", durationS: 5400, trackCount: 6, fileCount: 15,
    tags: [
      { k: "シリーズ", v: "黎明録" }, { k: "カテゴリ", v: "環境音" },
      { f: "鳥" }, { f: "風" }, { f: "目覚まし用" },
    ],
    urls: [{ label: "販売ページ", host: "dlsite.example" }],
  },
  {
    id: "w-todai", title: "灯台守の日記", subtitle: "霧笛と潮騒の一年",
    cover: "lighthouse", inks: ["sky", "coral"], paper: "ivory",
    addedAt: "2025-08-30", addedLabel: "3 ヶ月前",
    duration: "3:48:12", durationS: 13692, trackCount: 22, fileCount: 71,
    tags: [
      { k: "cv", v: "瀬戸あおい" }, { k: "サークル", v: "風待ち灯舎" },
      { k: "シリーズ", v: "海の手紙" }, { k: "カテゴリ", v: "ASMR" },
      { f: "朗読" }, { f: "潮騒" }, { f: "バイノーラル" },
    ],
    urls: [
      { label: "販売ページ", host: "dlsite.example" },
      { label: "公式サイト", host: "kazemachi.example" },
    ],
  },
  {
    id: "w-tokei", title: "アンティーク時計店", subtitle: "三十三の時計が時を刻む",
    cover: "clock", inks: ["mustard", "plum"], paper: "ivory",
    addedAt: "2025-08-12", addedLabel: "3 ヶ月前",
    duration: "2:00:00", durationS: 7200, trackCount: 5, fileCount: 14,
    tags: [
      { k: "サークル", v: "螺鈿堂" }, { k: "カテゴリ", v: "環境音" },
      { f: "時計" }, { f: "睡眠用" }, { f: "ループ可" },
    ],
    urls: [{ label: "販売ページ", host: "dlsite.example" }],
  },
  {
    id: "w-harusame", title: "春雨と桜の散歩道", subtitle: "土と花の匂い",
    cover: "petal", inks: ["coral", "leaf"], paper: "ivory",
    addedAt: "2025-07-26", addedLabel: "4 ヶ月前",
    duration: "1:12:30", durationS: 4350, trackCount: 6, fileCount: 19,
    tags: [
      { k: "cv", v: "星川しずく" }, { k: "シリーズ", v: "季節の散歩" },
      { k: "サークル", v: "春日舎" }, { k: "カテゴリ", v: "ASMR" },
      { f: "雨音" }, { f: "歩く音" },
    ],
    urls: [{ label: "販売ページ", host: "dlsite.example" }],
  },
  {
    id: "w-yakou", title: "夜行列車の窓辺", subtitle: "北へ向かう一夜",
    cover: "train", inks: ["plum", "mustard"], paper: "ivory",
    addedAt: "2025-06-30", addedLabel: "5 ヶ月前",
    duration: "2:30:00", durationS: 9000, trackCount: 8, fileCount: 24,
    tags: [
      { k: "サークル", v: "夜行詩社" }, { k: "カテゴリ", v: "環境音" },
      { f: "電車" }, { f: "睡眠用" }, { f: "長時間" },
    ],
    urls: [{ label: "販売ページ", host: "dlsite.example" }],
    error: true, errorMsg: "音声ファイル 2 件が欠損",
  },
];

// ── Riso ink swatches → CSS-var colors (resolved at runtime via SVG attr) ──
const INK = {
  coral:   "#E26A52",
  sky:     "#4F8DC4",
  leaf:    "#7DAE6E",
  mustard: "#D9A14A",
  plum:    "#9A5E8F",
  stone:   "#9E988B",
  ink:     "#2A2E3C",
};
const PAPER = {
  ivory: "#F4EFE6",
  warm:  "#EFEAE0",
  cool:  "#EDEEEA",
};

// ── Risograph cover frame ───────────────────────────────────────
// 100×100 viewBox, paper bg + 1-2 ink layers + grain + small wordmark.
function CoverFrame({ id, kind, inks, paper = "ivory", title = "" }) {
  const c1 = INK[inks?.[0]] || INK.ink;
  const c2 = INK[inks?.[1]] || INK.stone;
  const bg = PAPER[paper] || PAPER.ivory;
  const inner = COVER_ART[kind]?.(c1, c2, bg);
  // Short JP wordmark in bottom-left (first 6 chars only — small).
  const short = (title || "").slice(0, 8);

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id={`g-${id}`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="1.8" numOctaves="2" seed={id?.length || 4}/>
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.10 0"/>
          <feComposite in2="SourceGraphic" operator="in"/>
        </filter>
        <filter id={`r-${id}`}>
          <feGaussianBlur stdDeviation="0.18"/>
        </filter>
      </defs>
      <rect width="100" height="100" fill={bg}/>
      <g opacity="0.92" filter={`url(#r-${id})`}>{inner}</g>
      {/* paper grain overlay */}
      <rect width="100" height="100" filter={`url(#g-${id})`} opacity="0.5"/>
      {/* small wordmark — bottom-left, faint */}
      <text x="6" y="94" fontFamily="'IBM Plex Sans JP', sans-serif" fontSize="3.6" fontWeight="500" fill={c1} opacity="0.55" letterSpacing="0.2">{short}</text>
      {/* mimimilli watermark — top-right corner, tiny */}
      <text x="94" y="8" fontFamily="'Geist', sans-serif" fontSize="2.6" fontWeight="600" fill={c2} opacity="0.5" textAnchor="end" letterSpacing="0.4">mimimilli</text>
      {/* hairline border */}
      <rect x="0.4" y="0.4" width="99.2" height="99.2" fill="none" stroke={c2} strokeOpacity="0.18" strokeWidth="0.4"/>
    </svg>
  );
}

const COVER_ART = {
  // 夜の図書館 — bookshelf silhouettes + lamp glow (light version)
  library: (c1, c2) => (
    <g>
      {/* warm halo (ink1) */}
      <circle cx="62" cy="58" r="28" fill={c2} opacity="0.32"/>
      <circle cx="62" cy="58" r="14" fill={c2} opacity="0.55"/>
      {/* shelf row */}
      {Array.from({ length: 17 }).map((_, i) => {
        const x = 2 + i * 5.4;
        const h = 22 + ((i * 7) % 14);
        return <rect key={i} x={x} y={68 - h} width="4.4" height={h} fill={c1} opacity={0.55 + ((i % 3) * 0.13)}/>;
      })}
      <rect x="0" y="68" width="100" height="1.6" fill={c1} opacity="0.85"/>
      <rect x="38" y="62" width="22" height="6" fill={c2} opacity="0.85"/>
      <rect x="38" y="64" width="22" height="1.2" fill={c1} opacity="0.4"/>
    </g>
  ),

  // 雨音 — vertical rain lines + eaves
  rain: (c1, c2) => (
    <g>
      {Array.from({ length: 70 }).map((_, i) => {
        const x = (i * 1.47) % 100;
        const y = (i * 3.3) % 100;
        return <line key={i} x1={x} y1={y} x2={x - 1.2} y2={y + 7} stroke={c1} strokeWidth="0.5" opacity={0.4 + ((i % 5) * 0.1)}/>;
      })}
      <polygon points="0,58 100,58 100,52 0,42" fill={c2} opacity="0.85"/>
      <rect x="0" y="58" width="100" height="2" fill={c2}/>
      <ellipse cx="24" cy="92" rx="8" ry="0.8" fill={c1} opacity="0.6"/>
      <ellipse cx="62" cy="95" rx="11" ry="1" fill={c1} opacity="0.55"/>
      <ellipse cx="84" cy="88" rx="5" ry="0.7" fill={c1} opacity="0.5"/>
    </g>
  ),

  // 月夜のお茶会 — full moon + teacup
  moon: (c1, c2) => (
    <g>
      <circle cx="64" cy="32" r="20" fill={c1} opacity="0.22"/>
      <circle cx="64" cy="32" r="13" fill={c1} opacity="0.92"/>
      <circle cx="60" cy="28" r="2.4" fill={c2} opacity="0.4"/>
      <circle cx="68" cy="34" r="1.6" fill={c2} opacity="0.5"/>
      {[[18, 20], [32, 32], [86, 16], [12, 62]].map(([x, y], i) => (
        <g key={i}>
          <line x1={x-1.6} y1={y} x2={x+1.6} y2={y} stroke={c2} strokeWidth="0.4" opacity="0.7"/>
          <line x1={x} y1={y-1.6} x2={x} y2={y+1.6} stroke={c2} strokeWidth="0.4" opacity="0.7"/>
        </g>
      ))}
      {/* table */}
      <rect x="0" y="74" width="100" height="26" fill={c2} opacity="0.36"/>
      <rect x="0" y="74" width="100" height="0.8" fill={c2} opacity="0.8"/>
      {/* teacup */}
      <path d="M30 80 Q30 72 38 72 L50 72 Q58 72 58 80 L56 86 Q56 90 52 90 L36 90 Q32 90 32 86 Z" fill={c1} opacity="0.85"/>
      <ellipse cx="44" cy="73" rx="14" ry="2" fill={c2} opacity="0.4"/>
      {/* steam */}
      <path d="M40 68 Q38 64 40 60 Q42 56 40 52" stroke={c1} strokeWidth="0.7" fill="none" opacity="0.55"/>
      <path d="M46 68 Q48 62 46 58" stroke={c1} strokeWidth="0.7" fill="none" opacity="0.45"/>
    </g>
  ),

  // 冬の山小屋 — cabin + snow + mountains
  cabin: (c1, c2) => (
    <g>
      {/* snow particles */}
      {Array.from({ length: 60 }).map((_, i) => {
        const x = (i * 7.13) % 100;
        const y = ((i * 3.71) % 80);
        const r = 0.4 + ((i % 4) * 0.15);
        return <circle key={i} cx={x} cy={y} r={r} fill={c2} opacity={0.5}/>;
      })}
      <polygon points="0,72 25,42 48,68 72,46 100,72 100,100 0,100" fill={c2} opacity="0.45"/>
      <polygon points="40,62 60,62 60,76 40,76" fill={c1} opacity="0.9"/>
      <polygon points="36,62 64,62 50,50" fill={c1} opacity="0.9"/>
      <rect x="44" y="66" width="5" height="6" fill={c2} opacity="0.85"/>
      <rect x="52" y="66" width="5" height="6" fill={c2} opacity="0.85"/>
      <path d="M56 50 Q58 44 56 38 Q54 32 58 26" stroke={c1} strokeWidth="0.7" fill="none" opacity="0.5"/>
      <rect x="0" y="74" width="100" height="26" fill={c2} opacity="0.2"/>
    </g>
  ),

  // 古書店 — shelf grid pattern
  shelf: (c1, c2) => (
    <g>
      {Array.from({ length: 5 }).map((_, row) => (
        <g key={row} transform={`translate(0, ${10 + row * 17})`}>
          {Array.from({ length: 16 }).map((_, c) => {
            const x = 2 + c * 6.1;
            const h = 10 + ((c * 7 + row * 3) % 4);
            return <rect key={c} x={x} y={16 - h} width="5.4" height={h} fill={c1} opacity={0.4 + ((c + row) % 3) * 0.18}/>;
          })}
          <rect x="0" y="15" width="100" height="0.6" fill={c2} opacity="0.8"/>
        </g>
      ))}
    </g>
  ),

  // 深海 — concentric sonar circles
  sonar: (c1, c2) => (
    <g>
      <circle cx="50" cy="56" r="44" fill="none" stroke={c1} strokeWidth="0.5" opacity="0.22"/>
      <circle cx="50" cy="56" r="34" fill="none" stroke={c1} strokeWidth="0.6" opacity="0.32"/>
      <circle cx="50" cy="56" r="24" fill="none" stroke={c1} strokeWidth="0.7" opacity="0.45"/>
      <circle cx="50" cy="56" r="14" fill="none" stroke={c1} strokeWidth="0.8" opacity="0.6"/>
      <circle cx="50" cy="56" r="6" fill={c1} opacity="0.8"/>
      <circle cx="50" cy="56" r="2.4" fill={c2}/>
      {[[20, 70], [80, 30], [14, 38], [76, 78], [30, 22]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={1.2 + (i % 2) * 0.6} fill={c2} opacity={0.55}/>
      ))}
      <path d="M0 84 Q25 80 50 84 T100 84" stroke={c2} strokeWidth="0.5" fill="none" opacity="0.5"/>
      <path d="M0 90 Q25 86 50 90 T100 90" stroke={c2} strokeWidth="0.4" fill="none" opacity="0.4"/>
    </g>
  ),

  // 薪ストーブ — stove + glow + snow
  stove: (c1, c2) => (
    <g>
      <circle cx="50" cy="56" r="36" fill={c1} opacity="0.15"/>
      <circle cx="50" cy="56" r="20" fill={c1} opacity="0.28"/>
      <rect x="38" y="44" width="24" height="32" rx="2" fill={c2} opacity="0.9"/>
      <rect x="42" y="50" width="16" height="14" rx="1" fill={c1}/>
      <rect x="46" y="32" width="8" height="14" fill={c2} opacity="0.9"/>
      <rect x="40" y="76" width="2" height="4" fill={c2}/>
      <rect x="58" y="76" width="2" height="4" fill={c2}/>
      {Array.from({ length: 30 }).map((_, i) => {
        const x = (i * 11.13) % 100;
        const y = ((i * 4.71) % 40);
        return <circle key={i} cx={x} cy={y} r="0.6" fill={c2} opacity="0.45"/>;
      })}
    </g>
  ),

  // 朝霧の森 — trees in fog layers
  fog: (c1, c2) => (
    <g>
      {Array.from({ length: 8 }).map((_, i) => (
        <polygon key={i} points={`${i * 14 - 4},66 ${i * 14 + 3},34 ${i * 14 + 10},66`} fill={c1} opacity="0.32"/>
      ))}
      <rect x="0" y="60" width="100" height="14" fill={c2} opacity="0.18"/>
      {Array.from({ length: 7 }).map((_, i) => (
        <polygon key={i} points={`${i * 16 + 2},80 ${i * 16 + 11},42 ${i * 16 + 20},80`} fill={c1} opacity="0.58"/>
      ))}
      <rect x="0" y="76" width="100" height="14" fill={c2} opacity="0.22"/>
      {Array.from({ length: 6 }).map((_, i) => (
        <polygon key={i} points={`${i * 20 - 4},96 ${i * 20 + 6},52 ${i * 20 + 18},96`} fill={c1} opacity="0.88"/>
      ))}
      <rect x="0" y="92" width="100" height="8" fill={c1} opacity="0.92"/>
      <circle cx="78" cy="22" r="8" fill={c2} opacity="0.7"/>
    </g>
  ),

  // 灯台守 — lighthouse + beam
  lighthouse: (c1, c2) => (
    <g>
      <rect x="0" y="64" width="100" height="36" fill={c1} opacity="0.32"/>
      <polygon points="60,46 100,18 100,42 62,52" fill={c2} opacity="0.4"/>
      <polygon points="60,46 100,40 100,56 62,54" fill={c2} opacity="0.22"/>
      <polygon points="56,70 64,70 66,42 54,42" fill={c1} opacity="0.9"/>
      <rect x="54" y="40" width="12" height="3" fill={c2}/>
      <polygon points="54,40 66,40 60,32" fill={c1} opacity="0.9"/>
      <circle cx="60" cy="42" r="2" fill={c2}/>
      {Array.from({ length: 4 }).map((_, i) => (
        <path key={i} d={`M0 ${80 + i * 4} Q25 ${78 + i * 4} 50 ${80 + i * 4} T100 ${80 + i * 4}`} stroke={c2} strokeWidth="0.4" fill="none" opacity={0.5 - i * 0.1}/>
      ))}
    </g>
  ),

  // 時計店 — clock face rings + hand
  clock: (c1, c2) => (
    <g>
      <circle cx="50" cy="50" r="32" fill="none" stroke={c1} strokeWidth="0.8" opacity="0.5"/>
      <circle cx="50" cy="50" r="26" fill="none" stroke={c1} strokeWidth="0.5" opacity="0.5"/>
      <circle cx="50" cy="50" r="20" fill="none" stroke={c1} strokeWidth="0.4" opacity="0.5"/>
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i * Math.PI * 2) / 12 - Math.PI / 2;
        const x1 = 50 + Math.cos(a) * 28;
        const y1 = 50 + Math.sin(a) * 28;
        const x2 = 50 + Math.cos(a) * 32;
        const y2 = 50 + Math.sin(a) * 32;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={c2} strokeWidth={i % 3 === 0 ? 1.2 : 0.6} opacity="0.8"/>;
      })}
      <line x1="50" y1="50" x2="50" y2="30" stroke={c1} strokeWidth="1.6" strokeLinecap="round"/>
      <line x1="50" y1="50" x2="64" y2="52" stroke={c1} strokeWidth="1.6" strokeLinecap="round"/>
      <circle cx="50" cy="50" r="2" fill={c1}/>
    </g>
  ),

  // 春雨と桜 — petals + light rain
  petal: (c1, c2) => (
    <g>
      {Array.from({ length: 30 }).map((_, i) => {
        const x = (i * 4.13) % 100;
        const y = (i * 7) % 100;
        return <line key={i} x1={x} y1={y} x2={x - 0.6} y2={y + 4} stroke={c2} strokeWidth="0.3" opacity="0.5"/>;
      })}
      {[[18, 36, 12], [62, 22, -20], [42, 56, 8], [78, 64, 30], [10, 78, -40], [56, 80, 14], [86, 40, 4], [28, 62, -10], [70, 86, 22], [38, 14, -30]].map(([x, y, r], i) => (
        <g key={i} transform={`translate(${x}, ${y}) rotate(${r})`}>
          <path d="M0 0 Q-3.4 -3.4 0 -6.8 Q3.4 -3.4 0 0" fill={c1} opacity={0.85}/>
        </g>
      ))}
      <rect x="0" y="88" width="100" height="12" fill={c2} opacity="0.35"/>
    </g>
  ),

  // 夜行列車 — window with light streaks
  train: (c1, c2) => (
    <g>
      <rect x="8" y="20" width="84" height="60" rx="2" fill={c1} opacity="0.9"/>
      <rect x="11" y="23" width="78" height="54" rx="1" fill={c2} opacity="0.6"/>
      {Array.from({ length: 6 }).map((_, i) => (
        <line key={i} x1="14" y1={28 + i * 9} x2="86" y2={28 + i * 9} stroke={c2} strokeWidth="0.6" opacity={0.4 + (i % 3) * 0.2}/>
      ))}
      {Array.from({ length: 14 }).map((_, i) => (
        <line key={`d-${i}`} x1={14 + i * 5} y1={30 + (i * 7) % 40} x2={14 + i * 5 + 14} y2={30 + (i * 7) % 40} stroke={c1} strokeWidth="0.6" opacity={0.85}/>
      ))}
      <ellipse cx="32" cy="50" rx="6" ry="9" fill={c1} opacity="0.12"/>
      <line x1="50" y1="20" x2="50" y2="80" stroke={c1} strokeWidth="1.6" opacity="0.85"/>
    </g>
  ),
};

window.ML_WORKS = WORKS;
window.ML_CoverFrame = CoverFrame;
window.ML_INK = INK;
window.ML_PAPER = PAPER;

// ── Tracks for one work ────────────────────────────────────────
window.ML_TRACKS_YORULIB = [
  { i: 1, name: "0時の閉館前", dur: "12:42" },
  { i: 2, name: "雨の階段を上がる", dur: "8:30" },
  { i: 3, name: "ページを開く音", dur: "14:18" },
  { i: 4, name: "西の閲覧室にて", dur: "22:00" },
  { i: 5, name: "栞をはさむ", dur: "6:48", playing: true },
  { i: 6, name: "ランプの油を足す", dur: "9:12" },
  { i: 7, name: "古い辞書を引く", dur: "11:30" },
  { i: 8, name: "雨脚が強くなる", dur: "18:40" },
  { i: 9, name: "蔵書印を押す", dur: "7:20" },
  { i: 10, name: "椅子の軋み", dur: "10:00" },
  { i: 11, name: "閉館の鐘", dur: "5:14" },
  { i: 12, name: "東の窓を閉じる", dur: "22:00" },
];

// ── Folder tree for the same work ──────────────────────────────
window.ML_FOLDER_YORULIB = [
  { type: "folder", name: "夜の図書館 vol.1", indent: 0, open: true, sz: "" },
  { type: "audio", name: "01_0時の閉館前.flac", indent: 1, sz: "92.4 MB", dur: "12:42", linked: true },
  { type: "audio", name: "02_雨の階段を上がる.flac", indent: 1, sz: "61.0 MB", dur: "8:30", linked: true },
  { type: "audio", name: "03_ページを開く音.flac", indent: 1, sz: "104.2 MB", dur: "14:18", linked: true },
  { type: "audio", name: "04_西の閲覧室にて.flac", indent: 1, sz: "160.0 MB", dur: "22:00", linked: true },
  { type: "audio", name: "05_栞をはさむ.flac", indent: 1, sz: "48.9 MB", dur: "6:48", linked: true, playing: true },
  { type: "folder", name: "イラスト", indent: 1, open: true, sz: "" },
  { type: "image", name: "main_cover.png", indent: 2, sz: "4.2 MB" },
  { type: "image", name: "interior_1.png", indent: 2, sz: "3.8 MB" },
  { type: "image", name: "interior_2.png", indent: 2, sz: "3.6 MB", current: true },
  { type: "image", name: "character_akane.png", indent: 2, sz: "5.1 MB" },
  { type: "image", name: "sketch_lamp.jpg", indent: 2, sz: "1.2 MB" },
  { type: "folder", name: "特典", indent: 1, open: true, sz: "" },
  { type: "pdf", name: "booklet.pdf", indent: 2, sz: "12.4 MB" },
  { type: "text", name: "script.txt", indent: 2, sz: "24 KB" },
  { type: "video", name: "trailer.mp4", indent: 2, sz: "82.0 MB", dur: "1:48" },
  { type: "audio", name: "おまけ_朝の図書館.flac", indent: 2, sz: "33.2 MB", dur: "4:36", linked: false },
  { type: "folder", name: "Hi-Resバリアント", indent: 1, sz: "" },
  { type: "text", name: "readme.txt", indent: 1, sz: "6 KB" },
];

// Helper — get works grouped by year-month for editorial/index views.
window.ML_WORKS_BY_MONTH = (() => {
  const byMonth = {};
  WORKS.forEach(w => {
    const month = w.addedAt.slice(0, 7);
    (byMonth[month] = byMonth[month] || []).push(w);
  });
  return byMonth;
})();
