import { useEffect, useState } from "react";
import CoverPlaceholder from "./CoverPlaceholder";
import { getCoverImageUrl } from "../api";

interface CoverImgProps {
  id: string;
  title: string;
  hasCover: boolean;
  size: number;
  radius?: number;
}

export default function CoverImg({ id, title, hasCover, size, radius = 4 }: CoverImgProps) {
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    setErrored(false);
  }, [id]);

  if (hasCover && !errored) {
    return (
      <img
        src={getCoverImageUrl(id)}
        alt=""
        width={size}
        height={size}
        style={{ display: "block", width: "100%", height: "100%", objectFit: "cover", borderRadius: radius }}
        onError={() => setErrored(true)}
      />
    );
  }
  return <CoverPlaceholder id={id} title={title} size={size} borderRadius={radius} />;
}
