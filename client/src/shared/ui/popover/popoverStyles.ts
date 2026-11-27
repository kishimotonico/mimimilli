import { layerPanelClass } from "../layer/layerStyles";

export const popoverPanelClass = `${layerPanelClass} p-3`;

/** ポップオーバーの中に並べるボタン一覧の項目。メニュー項目と同じ高さ・ハイライトで、ホバーとフォーカスで強調する */
export const popoverListItemClass =
  "flex h-7 w-full cursor-default items-center gap-2 rounded-1 px-2 text-left font-jp text-body whitespace-nowrap text-ink-1 outline-none hover:bg-paper-2 hover:text-ink-0 focus-visible:bg-paper-2 focus-visible:text-ink-0";
