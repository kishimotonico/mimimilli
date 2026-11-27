/** フォーカスがどこにも無い（body）。消えた行・トリガーからのフォーカスの移し替えの前提 */
export function isFocusLost(): boolean {
  const active = document.activeElement;
  return !active || active === document.body;
}
