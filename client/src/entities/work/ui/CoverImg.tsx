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
        onError={() => setErrored(true)}
      />
    );
  }
  return <CoverPlaceholder id={id} title={title} size={fixedSize} borderRadius={radius} />;
}
