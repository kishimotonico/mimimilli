import { useEffect, useState } from "react";
import type { Cover } from "@mimimilli/shared";
import CoverPlaceholder from "./CoverPlaceholder";
import { getCoverImageUrl } from "../api";

interface CoverImgProps {
  id: string;
  title: string;
  /** 表示可能なカバー。null は正方形プレースホルダで表す */
  cover: Cover;
  size?: number;
  radius?: number;
  fit?: "fixed" | "fill";
  requestWidth?: number;
  loading?: "eager" | "lazy";
}

export default function CoverImg({
  id,
  title,
  cover,
  size = 32,
  radius = 4,
  fit = "fixed",
  requestWidth,
  loading = "eager",
}: CoverImgProps) {
  const [errored, setErrored] = useState(false);

  // 作品IDだけでなくカバー画像（世代）が変わったらエラー状態を解除し、
  // 同一作品のカバー差し替え後も表示を復帰させる。
  useEffect(() => {
    setErrored(false);
  }, [id, cover?.image]);

  const fixedSize = fit === "fixed" ? size : undefined;

  if (cover && !errored) {
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
        onError={() => setErrored(true)}
      />
    );
  }
  return <CoverPlaceholder id={id} title={title} size={fixedSize} borderRadius={radius} />;
}
