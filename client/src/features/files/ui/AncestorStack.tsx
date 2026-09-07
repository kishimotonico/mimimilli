// 折り畳み帯（背表紙の束）。root〜現在地の親までを左から順に背表紙として並べる
// （TASK-429）。各背表紙は独立したボタンで、選ぶとその階層へ直接移動する。表示上限
// （3枚程度）を超える中間の祖先は1枚の省略スロットへ畳み、クリックで一覧メニューを開く。
// 出入りは背表紙1枚ごとに独立した AnimatePresence 境界を持つ（ADR-0014）。

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { useMotionVariants } from "../../../shared/ui/useMotionVariants";
import { usePopoverDismissal } from "../../../shared/ui/usePopoverDismissal";
import { buildAncestorSpineSlots } from "../model/ancestorSpine";
import StackEdge from "./StackEdge";

const MAX_SLOTS = 3;

interface SegmentSpineProps {
  name: string;
  showEdges: boolean;
  pulseKey: number | undefined;
  onClick: () => void;
}

/** 通常の背表紙（実在の祖先1階層）。 */
function SegmentSpine({ name, showEdges, pulseKey, onClick }: SegmentSpineProps) {
  const { colstackWidth } = useMotionVariants();
  const isPresent = useIsPresent();
  const v = colstackWidth();
  return (
    <motion.button
      type="button"
      className="mle-colstack"
      aria-label={`${name}へ移動`}
      onClick={onClick}
      inert={!isPresent}
      {...v}
    >
      <StackEdge label={name} showEdges={showEdges} pulseKey={pulseKey} />
    </motion.button>
  );
}

interface EllipsisSpineProps {
  collapsed: { index: number; name: string }[];
  onNavigate: (index: number) => void;
}

/** 表示上限を超えた中間祖先を畳んだ背表紙。クリックで一覧メニューを開く。
 *
 *  メニューは幅アニメーション・overflow:hiddenを持つ .mle-colstack の外
 *  （.mle-colstack-anchor）に置く。理由: メニュー幅（160px）は.mle-colstackの幅
 *  （46px）を超えて描画される必要があるが、.mle-colstack自身はwidthアニメーション
 *  のためoverflow:hiddenを持つ。メニューが幅アニメーション対象と同じ要素の子だと、
 *  「その要素より大きい絶対配置の子」を持つ限りoverflow:hiddenの影響（クリップ・
 *  スクロール対象化）から逃れられないため、幅アニメーションする要素とメニューの
 *  配置基準を兄弟として分離する（ADR-0014）。
 *
 *  この分離をしていなかった実装では、開いた直後の初期フォーカス（下記
 *  `{preventScroll:true}`を外した状態）がブラウザ標準のscroll-into-view
 *  （フォーカスした要素を含む祖先スクロールコンテナを自動スクロールする挙動）を
 *  誘発し、.mle-colstack自身が（overflow:hiddenであっても）スクロール対象になって
 *  scrollLeftが0→109pxへ動く不具合を実測で確認した。CSS上の`left:51px`は
 *  変わらないため`getComputedStyle().left`は正しい値を返す一方、実際の描画位置は
 *  `left - scrollLeft`（51-109=-58px）だけ左にずれていた。 */
function EllipsisSpine({ collapsed, onNavigate }: EllipsisSpineProps) {
  const { colstackWidth } = useMotionVariants();
  const isPresent = useIsPresent();
  const v = colstackWidth();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);

  const { close } = usePopoverDismissal({
    isOpen: open,
    onClose: () => setOpen(false),
    anchorRef,
  });

  useEffect(() => {
    if (!open) return;
    // メニューを開いた直後の初期フォーカスは、メニュー自身の表示位置を動かして
    // はならない。既定の.focus()は祖先スクロールコンテナを自動スクロールして
    // 対象を可視化しようとするため、それ自体を止める。
    const items = anchorRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
    items?.[0]?.focus({ preventScroll: true });
  }, [open]);

  // 開いたまま階層移動してこの背表紙自体が退出アニメへ入ると、.mle-colstack-anchor
  // は子（.mle-colstack、幅アニメーション対象）の幅に追従する素朴なブロック要素なので、
  // メニューが縮む背表紙に追従して横に動きながら消えてしまう（実機で再現・確認済み）。
  // useIsPresentがfalseになった時点（退出が決まった瞬間）でメニューを閉じ、
  // ずれた状態が見える前に消す。
  useEffect(() => {
    if (!isPresent) setOpen(false);
  }, [isPresent]);

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'),
    );
    if (items.length === 0) return;
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
    const delta = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex = (currentIndex + delta + items.length) % items.length;
    items[nextIndex]?.focus();
  };

  return (
    <div className="mle-colstack-anchor" ref={anchorRef}>
      <motion.div className="mle-colstack" inert={!isPresent} {...v}>
        <button
          ref={triggerRef}
          type="button"
          className="mle-colstack__trigger"
          aria-label="畳まれた祖先を表示"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <StackEdge label="…" showEdges={false} isEllipsis />
        </button>
      </motion.div>
      {open && (
        <div
          className="mle-colstack__menu"
          role="menu"
          aria-label="畳まれた祖先"
          tabIndex={-1}
          onKeyDown={handleMenuKeyDown}
        >
          {collapsed.map((item) => (
            <button
              key={item.index}
              type="button"
              role="menuitem"
              className="mle-colstack__menuitem"
              onClick={() => {
                close();
                onNavigate(item.index);
              }}
            >
              {item.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface AncestorStackProps {
  /** root〜現在地の親までのセグメント名（現在地自身は含まない） */
  segments: string[];
  /** addressPath上の実インデックスで該当階層へ移動する */
  onNavigate: (index: number) => void;
}

export default function AncestorStack({ segments, onNavigate }: AncestorStackProps) {
  const slots = buildAncestorSpineSlots(segments);
  const groupRef = useRef<HTMLDivElement>(null);

  const handleArrowNav = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    // 実際にフォーカス可能な要素だけを対象にする。省略スロットは外側の .mle-colstack
    // がdiv（幅アニメーション用）で、クリック対象の button は .mle-colstack__trigger 側。
    const buttons = Array.from(
      groupRef.current?.querySelectorAll<HTMLButtonElement>(
        "button.mle-colstack, .mle-colstack__trigger",
      ) ?? [],
    );
    if (buttons.length === 0) return;
    const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (currentIndex === -1) return;
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = currentIndex + delta;
    if (nextIndex < 0 || nextIndex >= buttons.length) return;
    event.preventDefault();
    buttons[nextIndex]?.focus();
  };

  if (slots.length === 0) return null;

  return (
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- 背表紙ボタン列をまとめた矢印キー移動の委譲コンテナ（個々の子要素がフォーカス可能な実要素を持つ）
    <div className="mle-colstack-group" ref={groupRef} onKeyDown={handleArrowNav}>
      {Array.from({ length: MAX_SLOTS }, (_, slotIndex) => {
        const slot = slots[slotIndex];
        return (
          <AnimatePresence key={`spine-slot-${slotIndex}`} initial={false}>
            {slot?.kind === "segment" && (
              <SegmentSpine
                key="segment"
                name={slot.name}
                showEdges={slotIndex === 0}
                pulseKey={slot.isNearest ? slot.index : undefined}
                onClick={() => onNavigate(slot.index)}
              />
            )}
            {slot?.kind === "ellipsis" && (
              <EllipsisSpine key="ellipsis" collapsed={slot.collapsed} onNavigate={onNavigate} />
            )}
          </AnimatePresence>
        );
      })}
    </div>
  );
}
