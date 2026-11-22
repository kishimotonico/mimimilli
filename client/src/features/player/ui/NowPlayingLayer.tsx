// 再生中の層。今の画面に重なり、下の画面は残る（ADR-0041）。開閉は AppRoute.layer が正で、
// 再生していないのに開いていれば閉じるときと同じ規則で外す。
// 中身（通常・没入）は NowPlayingView が持つ。

import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useRef } from "react";
import { playerIsActiveAtom } from "../../../entities/player/model/atoms";
import { closeLayerAtom, layerAtom } from "../../../entities/navigation/model/appRouteStore";
import IconButton from "../../../shared/ui/IconButton";
import { I } from "../../../shared/ui/Icon";
import { nowPlayingViewModeAtom } from "../model/playerPresentationAtoms";
import type { TagClickHandler } from "./NowPlayingTags";
import NowPlayingView from "./NowPlayingView";

interface NowPlayingLayerProps {
  onOpenWork: (workId: string) => void;
  onTagClick: TagClickHandler;
}

function handleEscape(event: KeyboardEvent, close: () => void) {
  if (event.key !== "Escape" || event.defaultPrevented || event.isComposing || event.repeat) return;
  if (document.querySelector(":modal")) return;
  event.preventDefault();
  close();
}

export default function NowPlayingLayer({ onOpenWork, onTagClick }: NowPlayingLayerProps) {
  const layerOpen = useAtomValue(layerAtom) !== null;
  const isActive = useAtomValue(playerIsActiveAtom);
  const close = useSetAtom(closeLayerAtom);
  const immersive = useAtomValue(nowPlayingViewModeAtom) === "immersive";
  const visible = layerOpen && isActive;
  const closeRequestedRef = useRef(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!layerOpen) {
      closeRequestedRef.current = false;
      return;
    }
    if (isActive || closeRequestedRef.current) return;
    closeRequestedRef.current = true;
    close();
  }, [layerOpen, isActive, close]);

  useEffect(() => {
    if (!visible) return;
    // 開いているポップオーバー（document で受ける）に先を譲るため、window で受ける
    const onKeyDown = (event: KeyboardEvent) => handleEscape(event, close);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visible, close]);

  // 開いたら層へフォーカスを移し、閉じたら開く前の要素へ戻す。開く前の要素は層が開いた最初の1回だけ
  // 取る。開いた要素（バーの ⤢ など）は層が開いている間は描画されないので、無い・消えていれば
  // 同じ入口のボタンへ戻す
  const wasVisibleRef = useRef(false);
  useEffect(() => {
    if (visible) {
      if (!wasVisibleRef.current) {
        wasVisibleRef.current = true;
        const active = document.activeElement;
        openerRef.current =
          active instanceof HTMLElement && active !== document.body && !active.closest(".mle-layer")
            ? active
            : null;
      }
      closeButtonRef.current?.focus({ preventScroll: true });
      return;
    }
    if (!wasVisibleRef.current) return;
    wasVisibleRef.current = false;
    const opener = openerRef.current;
    const timer = setTimeout(() => {
      const target = opener?.isConnected
        ? opener
        : document.querySelector<HTMLElement>("[data-np-open]");
      target?.focus({ preventScroll: true });
    }, 0);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <section className="mle-layer" aria-label="再生中">
      <NowPlayingView onOpenWork={onOpenWork} onTagClick={onTagClick} />
      {!immersive && (
        <IconButton
          size="md"
          icon={I.minimize}
          label="再生中を閉じる"
          title="閉じる (Esc)"
          onClick={() => close()}
          ref={closeButtonRef}
          className="mle-layer__close"
        />
      )}
    </section>
  );
}
