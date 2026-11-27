/**
 * ポータルした層の中のイベントは、React の木をたどって祖先のハンドラへ届く。
 * 層の側では止めない（stopPropagation はネイティブの伝播まで止め、window・document の
 * リスナー（⌘K、Ctrl+B、外側クリックの判定）に届かなくなる）。層の祖先でハンドラを持つ側が、
 * target が自分の DOM の外にあるイベントをこの関数で弾く。
 * ポータル先を DOM の中に含む要素（native dialog、ポップオーバーの content など）で使うと、層から来たイベントも内側と判定される。
 */
export function isFromPortaledLayer(event: {
  target: EventTarget;
  currentTarget: EventTarget;
}): boolean {
  const { target, currentTarget } = event;
  return !(
    target instanceof Node &&
    currentTarget instanceof Node &&
    currentTarget.contains(target)
  );
}
