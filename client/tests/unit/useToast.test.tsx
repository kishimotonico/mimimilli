import { createElement, useEffect } from "react";
import { render } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { describe, expect, it } from "vitest";
import { useToast } from "../../src/shared/ui/useToast";
import { toastRequestsAtom } from "../../src/shared/model/toastRequestsAtom";

function Requester({ dismissOnUnmount }: { dismissOnUnmount?: boolean }) {
  const toast = useToast();
  useEffect(() => {
    toast.show({
      message: "テスト通知",
      variant: "success",
      priority: "notice",
      dismissOnUnmount,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- マウント時に1回だけ発行する
  }, []);
  return null;
}

function renderRequester(store: ReturnType<typeof createStore>, dismissOnUnmount?: boolean) {
  return render(
    createElement(JotaiProvider, { store }, createElement(Requester, { dismissOnUnmount })),
  );
}

describe("useToastのアンマウント時の寿命契約", () => {
  it("既定（dismissOnUnmount未指定）では発行元のアンマウントで要求が取り下げられる", () => {
    const store = createStore();
    const { unmount } = renderRequester(store);

    expect(store.get(toastRequestsAtom).size).toBe(1);
    unmount();
    expect(store.get(toastRequestsAtom).size).toBe(0);
  });

  it("dismissOnUnmount:falseなら発行元がアンマウントしても要求は残る（結果通知が画面遷移をまたぐ）", () => {
    const store = createStore();
    const { unmount } = renderRequester(store, false);

    expect(store.get(toastRequestsAtom).size).toBe(1);
    unmount();
    expect(store.get(toastRequestsAtom).size).toBe(1);
  });
});
