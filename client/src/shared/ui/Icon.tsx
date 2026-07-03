import React from "react";

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

function Svg({ d, size = 16, fill, strokeWidth = 1.5, viewBox = "0 0 24 24", className, style }: SvgProps) {
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
      {Array.isArray(d)
        ? d.map((path, i) => <path key={i} d={path} />)
        : <path d={d} />}
    </svg>
  );
}

export type IconFC = React.FC<IconProps>;

export const I: Record<string, IconFC> = {
  search:   (p) => <Svg {...p} d={["M11 19a8 8 0 1 1 0 -16 8 8 0 0 1 0 16Z", "M21 21l-4.3-4.3"]} />,
  play:     (p) => <Svg {...p} fill="currentColor" d="M7 4.5v15l12-7.5z" />,
  pause:    (p) => <Svg {...p} fill="currentColor" d="M6.5 4h3.5v16H6.5zM14 4h3.5v16H14z" />,
  prev:     (p) => <Svg {...p} fill="currentColor" d="M6 4h2v16H6zM20 4L9 12l11 8z" />,
  next:     (p) => <Svg {...p} fill="currentColor" d="M16 4h2v16h-2zM4 4l11 8 -11 8z" />,
  shuffle:  (p) => <Svg {...p} d={["M3 6h2.5a3 3 0 0 1 2.5 1.4l8 11.2a3 3 0 0 0 2.5 1.4H21", "M16 18l3 3 3 -3", "M3 18h2.5a3 3 0 0 0 2.5 -1.4l1 -1.4", "M21 6h-2.5a3 3 0 0 0 -2.5 1.4l-1 1.4", "M16 6l3 -3 3 3"]} />,
  loopOne:  (p) => <Svg {...p} d={["M4 10V8a2 2 0 0 1 2 -2h12", "M20 14v2a2 2 0 0 1 -2 2H6", "M17 4l3 3 -3 3", "M7 14l-3 3 3 3", "M11 11l1 -1v5"]} />,
  volume:   (p) => <Svg {...p} d={["M11 4L6 8H3v8h3l5 4z", "M15 9.5a3 3 0 0 1 0 5", "M18 6.5a7 7 0 0 1 0 11"]} />,
  queue:    (p) => <Svg {...p} d={["M3 6h13M3 12h10M3 18h7", "M19 14v6M16 17h6"]} />,
  fs:       (p) => <Svg {...p} d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  ext:      (p) => <Svg {...p} d={["M14 4h6v6", "M20 4l-8 8", "M19 13v5a2 2 0 0 1 -2 2H6a2 2 0 0 1 -2 -2V7a2 2 0 0 1 2 -2h5"]} />,
  folder:   (p) => <Svg {...p} d="M3 7v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2 -2V9a2 2 0 0 0 -2 -2h-7l-2 -2H5a2 2 0 0 0 -2 2z" />,
  folderO:  (p) => <Svg {...p} d={["M3 7v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2 -2v-7", "M21 9V8a1 1 0 0 0 -1 -1h-7l-2 -2H5a2 2 0 0 0 -2 2v3"]} />,
  file:     (p) => <Svg {...p} d={["M14 3H6a2 2 0 0 0 -2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2V9z", "M14 3v6h6"]} />,
  image:    (p) => <Svg {...p} d={["M3 5h18v14H3z", "M3 16l5 -5 4 4 3 -3 6 6", "M8 11a1.5 1.5 0 1 1 0 -3 1.5 1.5 0 0 1 0 3z"]} />,
  audio:    (p) => <Svg {...p} d={["M9 17V6l11 -3v11", "M9 17a3 3 0 1 1 -3 -3", "M20 14a3 3 0 1 1 -3 -3"]} />,
  video:    (p) => <Svg {...p} d={["M3 6h12a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1H3z", "M16 10l5 -3v10l-5 -3z"]} />,
  text:     (p) => <Svg {...p} d={["M5 4h11l3 3v13a1 1 0 0 1 -1 1H5z", "M8 11h7M8 14h7M8 17h5"]} />,
  pdf:      (p) => <Svg {...p} d={["M5 4h10l4 4v12a1 1 0 0 1 -1 1H5z", "M14 4v4h4", "M8 13v4M8 13h1.2a1 1 0 1 1 0 2H8"]} />,
  chev:     (p) => <Svg {...p} d="M9 6l6 6 -6 6" />,
  chevD:    (p) => <Svg {...p} d="M6 9l6 6 6 -6" />,
  arrowL:   (p) => <Svg {...p} d="M14 5l-7 7 7 7" />,
  arrowR:   (p) => <Svg {...p} d="M10 5l7 7 -7 7" />,
  more:     (p) => <Svg {...p} fill="currentColor" d="M5 11a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0 -2.4zM12 11a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0 -2.4zM19 11a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0 -2.4z" />,
  download: (p) => <Svg {...p} d={["M12 4v12", "M7 11l5 5 5 -5", "M5 20h14"]} />,
  pin:      (p) => <Svg {...p} d={["M9 4h6l-1 6 4 4H6l4 -4z", "M12 14v6"]} />,
  star:     (p) => <Svg {...p} d="M12 3l2.7 5.7 6.3 .9 -4.5 4.4 1.1 6.2 -5.6 -3 -5.6 3 1.1 -6.2 -4.5 -4.4 6.3 -.9z" />,
  starF:    (p) => <Svg {...p} fill="currentColor" d="M12 3l2.7 5.7 6.3 .9 -4.5 4.4 1.1 6.2 -5.6 -3 -5.6 3 1.1 -6.2 -4.5 -4.4 6.3 -.9z" />,
  cog:      (p) => <Svg {...p} d={["M12 15a3 3 0 1 0 0 -6 3 3 0 0 0 0 6Z", "M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1 .1a2 2 0 1 1 -2.8 2.8l-.1 -.1a1.7 1.7 0 0 0 -1.8 -.3 1.7 1.7 0 0 0 -1 1.5V21a2 2 0 1 1 -4 0v-.1a1.7 1.7 0 0 0 -1 -1.5 1.7 1.7 0 0 0 -1.8 .3l-.1 .1a2 2 0 1 1 -2.8 -2.8l.1 -.1a1.7 1.7 0 0 0 .3 -1.8 1.7 1.7 0 0 0 -1.5 -1H3a2 2 0 1 1 0 -4h.1a1.7 1.7 0 0 0 1.5 -1 1.7 1.7 0 0 0 -.3 -1.8l-.1 -.1a2 2 0 1 1 2.8 -2.8l.1 .1a1.7 1.7 0 0 0 1.8 .3H9a1.7 1.7 0 0 0 1 -1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8 -.3l.1 -.1a2 2 0 1 1 2.8 2.8l-.1 .1a1.7 1.7 0 0 0 -.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0 -1.5 1Z"]} />,
  refresh:  (p) => <Svg {...p} d={["M21 12a9 9 0 0 1 -15 6.7L3 16", "M3 12a9 9 0 0 1 15 -6.7L21 8", "M21 4v4h-4", "M3 20v-4h4"]} />,
  add:      (p) => <Svg {...p} d={["M12 5v14", "M5 12h14"]} />,
  list:     (p) => <Svg {...p} d={["M8 6h13M8 12h13M8 18h13", "M3 6h.01M3 12h.01M3 18h.01"]} />,
  grid:     (p) => <Svg {...p} d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />,
  gridS:    (p) => <Svg {...p} d="M3 3h5v5H3zM10 3h5v5h-5zM17 3h5v5h-5zM3 10h5v5H3zM10 10h5v5h-5zM17 10h5v5h-5zM3 17h5v5H3zM10 17h5v5h-5zM17 17h5v5h-5z" />,
  sort:     (p) => <Svg {...p} d={["M8 4v16M4 8l4 -4 4 4", "M16 20V4M20 16l-4 4 -4 -4"]} />,
  filter:   (p) => <Svg {...p} d="M4 4h16l-6 8v6l-4 2v-8z" />,
  check:    (p) => <Svg {...p} d="M5 12l4 4 10 -10" />,
  x:        (p) => <Svg {...p} d="M6 6l12 12M18 6L6 18" />,
  err:      (p) => <Svg {...p} d={["M12 4l10 17H2z", "M12 10v5", "M12 18v0"]} />,
  heart:    (p) => <Svg {...p} d="M12 20s-7 -4.3 -7 -10a4 4 0 0 1 7 -2.7A4 4 0 0 1 19 10c0 5.7 -7 10 -7 10z" />,
  bell:     (p) => <Svg {...p} d={["M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3 -2 3 -9", "M10 21a2 2 0 0 0 4 0"]} />,
  user:     (p) => <Svg {...p} d={["M4 21a8 8 0 0 1 16 0", "M12 12a4 4 0 1 0 0 -8 4 4 0 0 0 0 8z"]} />,
  link:     (p) => <Svg {...p} d={["M10 14a4 4 0 0 0 5.6 0L19 10.6a4 4 0 0 0 -5.6 -5.6l-.7 .7", "M14 10a4 4 0 0 0 -5.6 0L5 13.4a4 4 0 0 0 5.6 5.6l.7 -.7"]} />,
  bookmark: (p) => <Svg {...p} d="M6 4h12v17l-6 -4 -6 4z" />,
  back:     (p) => <Svg {...p} d={["M19 12H5", "M11 6l-6 6 6 6"]} />,
  caret:    (p) => <Svg {...p} fill="currentColor" d="M7 10l5 5 5 -5z" />,
  minimize: (p) => <Svg {...p} d={["M9 4v5H4", "M15 4v5h5", "M4 15h5v5", "M20 15h-5v5"]} />,
  locate:   (p) => <Svg {...p} d={["M12 20a8 8 0 1 1 0 -16 8 8 0 0 1 0 16Z", "M12 2v2", "M12 20v2", "M2 12h2", "M20 12h2"]} />,
};
