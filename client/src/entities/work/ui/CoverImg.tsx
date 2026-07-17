import { useEffect, useState } from "react";
import CoverPlaceholder from "./CoverPlaceholder";
import { getCoverImageUrl } from "../api";

interface CoverImgProps {
  id: string;
  title: string;
  hasCover: boolean;
  size?: number;
  radius?: number;
  fit?: "fixed" | "fill";
  requestWidth?: number;
  loading?: "eager" | "lazy";
  /** 画像読み込み完了時に実寸（naturalWidth/naturalHeight）を通知する。
   *  原寸ジャスティファイドグリッドのアスペクト比計測（TASK-45）に使用 */
  onLoadDimensions?: (naturalWidth: number, naturalHeight: number) => void;
}

export default function CoverImg({
  id,
  title,
  hasCover,
  size = 32,
  radius = 4,
  fit = "fixed",
  requestWidth,
  loading = "eager",
  onLoadDimensions,
}: CoverImgProps) {
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    setErrored(false);
  }, [id]);

  const fixedSize = fit === "fixed" ? size : undefined;

  if (hasCover && !errored) {
    return (
      <img
        src={getCoverImageUrl(id, requestWidth)}
        alt=""
        loading={loading}
        width={fixedSize}
        height={fixedSize}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          borderRadius: radius,
        }}
        onLoad={(event) => {
          const img = event.currentTarget;
          onLoadDimensions?.(img.naturalWidth, img.naturalHeight);
        }}
        onError={() => setErrored(true)}
      />
    );
  }
  return <CoverPlaceholder id={id} title={title} size={fixedSize} borderRadius={radius} />;
}
