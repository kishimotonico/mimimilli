interface BreadcrumbsProps {
  path: string[];
  onNavigate: (index: number) => void;
}

export default function Breadcrumbs({ path, onNavigate }: BreadcrumbsProps) {
  return (
    <div className="mle-crumbs">
      {path.map((seg, i) => (
        <span key={i} style={{ display: "contents" }}>
          {i > 0 && <span className="mle-crumbs__sep">/</span>}
          <button
            className={`mle-crumbs__seg ${i === path.length - 1 ? "is-last" : ""}`}
            onClick={() => onNavigate(i)}
          >
            {seg}
          </button>
        </span>
      ))}
    </div>
  );
}
