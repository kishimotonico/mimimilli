import React from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  Bell,
  Bookmark,
  Check,
  ChevronDown,
  ChevronRight,
  Cog,
  Download,
  Ellipsis,
  ExternalLink,
  File,
  FileText,
  FileType,
  Filter,
  Folder,
  FolderOpen,
  Grid3x3,
  Heart,
  Image,
  Info,
  LayoutGrid,
  List,
  Locate,
  Maximize,
  Minimize,
  Music,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Star,
  TriangleAlert,
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
  strokeWidth?: number;
  viewBox?: string;
}

function Svg({
  d,
  size = 16,
  fill,
  strokeWidth = 1.5,
  viewBox = "0 0 24 24",
  className,
  style,
}: SvgProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill={fill ?? "none"}
      stroke={fill ? "none" : "currentColor"}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={style}
    >
      {Array.isArray(d) ? d.map((path, i) => <path key={i} d={path} />) : <path d={d} />}
    </svg>
  );
}

export type IconFC = React.FC<IconProps>;

function lucideIcon(Icon: LucideIcon): IconFC {
  return ({ size = 16, className, style }) => (
    <Icon size={size} className={className} style={style} aria-hidden="true" strokeWidth={1.5} />
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
  folder: lucideIcon(Folder),
  folderO: lucideIcon(FolderOpen),
  file: lucideIcon(File),
  image: lucideIcon(Image),
  audio: lucideIcon(Music),
  video: lucideIcon(Video),
  text: lucideIcon(FileText),
  pdf: lucideIcon(FileType),
  chev: lucideIcon(ChevronRight),
  chevD: lucideIcon(ChevronDown),
  arrowL: lucideIcon(ArrowLeft),
  arrowR: lucideIcon(ArrowRight),
  more: lucideIcon(Ellipsis),
  download: lucideIcon(Download),
  star: lucideIcon(Star),
  starF: lucideIconFilled(Star),
  cog: lucideIcon(Cog),
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
      strokeWidth={1.5}
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
  x: lucideIcon(X),
  err: lucideIcon(TriangleAlert),
  info: lucideIcon(Info),
  heart: lucideIcon(Heart),
  bell: lucideIcon(Bell),
  user: lucideIcon(User),
  bookmark: lucideIcon(Bookmark),
  minimize: lucideIcon(Minimize),
  locate: lucideIcon(Locate),
  swapLR: (p) => <Svg {...p} d={["M4 8h13", "M14 4l3 4 -3 4", "M20 16H7", "M10 12l-3 4 3 4"]} />,
} as const satisfies Record<string, IconFC>;

export type IconName = keyof typeof I;
