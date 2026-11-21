import { useLayoutEffect, useRef, type RefObject } from "react";

/** 最新の値を指す ref。メモ化したハンドラーが、依存に入れずに最新の値を読むために使う。 */
export function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
