/** ドラッグ開始をmouseの主ボタン（左クリック）だけに限定する判定。
 *  タッチ/ペンは button===0 で発火するためそのまま通る。右・中央クリックは
 *  ネイティブのコンテキストメニュー・オートスクロール等の標準動作を妨げないよう無視する。 */
export function isPrimaryPointerButton(event: { button: number }): boolean {
  return event.button === 0;
}
