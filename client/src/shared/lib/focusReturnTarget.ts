/**
 * フォーカスを戻す先。メニューの中身（退出して消える）にフォーカスがあったときは、
 * そのメニューのトリガーを返す（メニューの中身には aria-labelledby でトリガーの id が付く）。
 */
export function resolveFocusReturnTarget(active: EventTarget | Element | null): HTMLElement | null {
  if (!(active instanceof HTMLElement)) return null;
  if (active.getAttribute("role") !== "menu") return active;
  const triggerId = active.getAttribute("aria-labelledby");
  return (triggerId && document.getElementById(triggerId)) || null;
}

/** フォーカスがどこにも無い（body）。消えた行・トリガーからのフォーカスの移し替えの前提 */
export function isFocusLost(): boolean {
  const active = document.activeElement;
  return !active || active === document.body;
}
