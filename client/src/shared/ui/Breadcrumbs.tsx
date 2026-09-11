import { useLayoutEffect, useRef, useState } from "react";

interface BreadcrumbsProps {
  path: string[];
  onNavigate: (index: number) => void;
}

/** 中間階層を省略した表示に切り替えるべきか判定する。コンテナ幅は狭幅化・ペイン
 *  リサイズ（プレビュー幅ドラッグ等）で動的に変わるため、常設の
 *  非表示クローン（measureRef、全セグメントを折返し無しで並べた自然幅）と
 *  実表示コンテナの clientWidth を ResizeObserver で比較する。 */
function useNeedsCollapse(path: string[]) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [needsCollapse, setNeedsCollapse] = useState(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;
    const update = () => setNeedsCollapse(measure.scrollWidth > container.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    observer.observe(measure);
    return () => observer.disconnect();
    // path が変わるたびフル表示の自然幅も変わるため作り直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path.join("/")]);

  return { containerRef, measureRef, needsCollapse };
}

type CrumbItem = { kind: "segment"; index: number } | { kind: "ellipsis" };

export default function Breadcrumbs({ path, onNavigate }: BreadcrumbsProps) {
  const { containerRef, measureRef, needsCollapse } = useNeedsCollapse(path);
  // 先頭・直近（現在地の1つ上）・現在地の3つは省略しても意味が失われるので必ず残す。
  // 3セグメント以下なら中間が無く省略の余地が無い。
  const collapsed = needsCollapse && path.length > 3;
  const items: CrumbItem[] = collapsed
    ? [
        { kind: "segment", index: 0 },
        { kind: "ellipsis" },
        { kind: "segment", index: path.length - 2 },
        { kind: "segment", index: path.length - 1 },
      ]
    : path.map((_, index) => ({ kind: "segment", index }));

  return (
    <div className="mle-crumbs" ref={containerRef}>
      {items.map((item, i) => (
        <span key={i} style={{ display: "contents" }}>
          {i > 0 && <span className="mle-crumbs__sep">/</span>}
          {item.kind === "ellipsis" ? (
            <span className="mle-crumbs__ellipsis">…</span>
          ) : (
            <button
              className={`mle-crumbs__seg ${item.index === path.length - 1 ? "is-last" : ""}`}
              onClick={() => onNavigate(item.index)}
            >
              {path[item.index]}
            </button>
          )}
        </span>
      ))}
      {/* ラベルは data-label + ::before(content: attr()) で描画する（frame-b.css）。
          テキストノードとして持たせると getByText 等のテスト用クエリが実体側の
          ボタンとこのクローンの両方にヒットしてしまう。
          擬似要素の内容はDOMのテキストノードではないため二重ヒットしない。
          このクローンはspan要素かつaria-hidden="true"なので、getByRole系のクエリには
          そもそもヒットしない。role指定なしのgetByText系クエリを新たに使う場合だけ、
          aria-hidden要素もマッチしうる点に注意（現状の全テストはroleクエリのため無関係）。 */}
      <div className="mle-crumbs__measure" ref={measureRef} aria-hidden="true">
        {path.map((seg, i) => (
          <span key={i}>
            {i > 0 && <span className="mle-crumbs__sep" data-label="/" />}
            <span
              className={`mle-crumbs__seg ${i === path.length - 1 ? "is-last" : ""}`}
              data-label={seg}
            />
          </span>
        ))}
      </div>
    </div>
  );
}
