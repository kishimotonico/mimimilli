import React from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlignLeft,
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Cog,
  Copy,
  Download,
  Ellipsis,
  EllipsisVertical,
  ExternalLink,
  File,
  FileText,
  FileType,
  Filter,
  Folder,
  FolderOpen,
  Grid3x3,
  Heart,
  Home,
  Image,
  Info,
  LayoutGrid,
  Link2,
  List,
  Locate,
  Maximize,
  Minimize,
  Music,
  Pencil,
  PanelLeft,
  Plus,
  RefreshCw,
  Search,
  SearchX,
  Star,
  Trash2,
  User,
  Video,
  Volume2,
  X,
} from "lucide-react";

export interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

interface SvgProps extends IconProps {
  d: string | string[];
  fill?: string;
  viewBox?: string;
  /** グリフを viewBox 座標系で動かす（例: "translate(0 -2)"）。視覚重心の補正など。 */
  transform?: string;
}

// 小サイズでも実効線幅が 1px 未満にならないよう viewBox 上の stroke を補正する
function strokeWidthForSize(size: number): number {
  return Math.max(1.5, 24 / size);
}

function Svg({ d, size = 16, fill, viewBox = "0 0 24 24", transform, className, style }: SvgProps) {
  const paths = Array.isArray(d) ? d.map((path, i) => <path key={i} d={path} />) : <path d={d} />;
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill={fill ?? "none"}
      stroke={fill ? "none" : "currentColor"}
      strokeWidth={strokeWidthForSize(size)}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={style}
    >
      {transform ? <g transform={transform}>{paths}</g> : paths}
    </svg>
  );
}

export type IconFC = React.FC<IconProps>;

function lucideIcon(Icon: LucideIcon): IconFC {
  return ({ size = 16, className, style }) => (
    <Icon
      size={size}
      className={className}
      style={style}
      aria-hidden="true"
      strokeWidth={strokeWidthForSize(size)}
    />
  );
}

function lucideIconFilled(Icon: LucideIcon): IconFC {
  return ({ size = 16, className, style }) => (
    <Icon
      size={size}
      className={className}
      style={style}
      aria-hidden="true"
      strokeWidth={1.5}
      fill="currentColor"
      stroke="currentColor"
    />
  );
}

export const I = {
  search: lucideIcon(Search),
  play: (p) => <Svg {...p} fill="currentColor" d="M7 4.5v15l12-7.5z" />,
  pause: (p) => <Svg {...p} fill="currentColor" d="M6.5 4h3.5v16H6.5zM14 4h3.5v16H14z" />,
  prev: (p) => <Svg {...p} fill="currentColor" d="M6 4h2v16H6zM20 4L9 12l11 8z" />,
  next: (p) => <Svg {...p} fill="currentColor" d="M16 4h2v16h-2zM4 4l11 8 -11 8z" />,
  loopOne: (p) => (
    <Svg
      {...p}
      d={[
        "M4 10V8a2 2 0 0 1 2 -2h12",
        "M20 14v2a2 2 0 0 1 -2 2H6",
        "M17 4l3 3 -3 3",
        "M7 14l-3 3 3 3",
        "M11 11l1 -1v5",
      ]}
    />
  ),
  volume: lucideIcon(Volume2),
  fs: lucideIcon(Maximize),
  ext: lucideIcon(ExternalLink),
  link: lucideIcon(Link2),
  linkOff: (p) => (
    <Svg
      {...p}
      style={{ strokeDasharray: "2.4 2.6", ...p.style }}
      d={[
        "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1",
        "M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
      ]}
    />
  ),
  home: lucideIcon(Home),
  folder: lucideIcon(Folder),
  folderO: lucideIcon(FolderOpen),
  panel: lucideIcon(PanelLeft),
  shuffle: (p) => (
    <Svg {...p} d="M4 7h3l10 10h3M4 17h3l3-3M14 10l3-3h3M18 4l2 3-2 3M18 14l2 3-2 3" />
  ),
  clock: (p) => <Svg {...p} d={["M4 12a8 8 0 1 0 16 0a8 8 0 1 0 -16 0", "M12 8v4l3 2"]} />,
  house: (p) => <Svg {...p} d={["M4 20V9l8-5 8 5v11", "M9 20v-6h6v6"]} />,
  steps: (p) => <Svg {...p} d="M4 6h16M4 12h10M4 18h6" />,
  tag: (p) => (
    <Svg {...p} d={["M3 12V4h8l10 10-8 8z", "M6.2 7.5a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0"]} />
  ),
  calendar: (p) => (
    <Svg
      {...p}
      d={[
        "M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z",
        "M4 10h16M9 3v4M15 3v4",
      ]}
    />
  ),
  series: (p) => (
    <Svg
      {...p}
      d={["M5 4h8a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z", "M8 20h11V8"]}
    />
  ),
  funnel: (p) => <Svg {...p} d="M4 5h16l-6 8v6l-4 2v-8z" />,
  file: lucideIcon(File),
  image: lucideIcon(Image),
  audio: lucideIcon(Music),
  video: lucideIcon(Video),
  text: lucideIcon(FileText),
  textLines: lucideIcon(AlignLeft),
  pdf: lucideIcon(FileType),
  chev: lucideIcon(ChevronRight),
  chevD: lucideIcon(ChevronDown),
  chevL: lucideIcon(ChevronLeft),
  arrowL: lucideIcon(ArrowLeft),
  arrowR: lucideIcon(ArrowRight),
  more: lucideIcon(Ellipsis),
  moreV: lucideIcon(EllipsisVertical),
  download: lucideIcon(Download),
  star: lucideIcon(Star),
  starF: lucideIconFilled(Star),
  cog: lucideIcon(Cog),
  copy: lucideIcon(Copy),
  refresh: lucideIcon(RefreshCw),
  edit: lucideIcon(Pencil),
  add: lucideIcon(Plus),
  list: lucideIcon(List),
  grid: lucideIcon(LayoutGrid),
  gridS: lucideIcon(Grid3x3),
  ratio11: ({ size = 16, className, style }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidthForSize(size)}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={style}
    >
      <path d="M4 7.5 L6 9 L6 17" />
      <path d="M3.5 17 H7.5" />
      <circle cx="12" cy="9.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="14.5" r="1.1" fill="currentColor" stroke="none" />
      <path d="M17 7.5 L19 9 L19 17" />
      <path d="M16.5 17 H20.5" />
    </svg>
  ),
  gridJustified: (p) => (
    <Svg {...p} fill="currentColor" d={["M3 5h6v6H3z", "M11 5h10v6H11z", "M3 13h18v6H3z"]} />
  ),
  sort: lucideIcon(ArrowDownUp),
  filter: lucideIcon(Filter),
  check: lucideIcon(Check),
  checkC: lucideIcon(CircleCheck),
  searchX: lucideIcon(SearchX),
  x: lucideIcon(X),
  // TriangleAlertは視覚重心が下寄りなのでグリフを viewBox 上で2単位上げる。
  err: (p) => (
    <Svg
      {...p}
      transform="translate(0 -2)"
      d={[
        "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",
        "M12 9v4",
        "M12 17h.01",
      ]}
    />
  ),
  info: lucideIcon(Info),
  heart: lucideIcon(Heart),
  user: lucideIcon(User),
  bookmark: lucideIcon(Bookmark),
  trash: lucideIcon(Trash2),
  minimize: lucideIcon(Minimize),
  locate: lucideIcon(Locate),
  swapLR: (p) => <Svg {...p} d={["M4 8h13", "M14 4l3 4 -3 4", "M20 16H7", "M10 12l-3 4 3 4"]} />,
} as const satisfies Record<string, IconFC>;

export type IconName = keyof typeof I;
