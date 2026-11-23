import { createElement, type ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { describe, expect, it } from "vitest";
import { deselectLibraryWorkAtom } from "../../src/entities/library/model/navigationActions";
import { appRouteAtom } from "../../src/entities/navigation/model/appRouteStore";
import { ApiRequestError } from "../../src/shared/api/http";
import { useLibrarySelectionCleanup } from "../../src/features/library/model/useLibrarySelectionCleanup";
import { clearPendingOps, pendingWrites, seedLibraryRoute, seedRoute } from "../helpers/route";

function openLayer(store: ReturnType<typeof createStore>) {
  seedRoute(store, (route) => ({ ...route, layer: { kind: "nowPlaying" } }));
}

describe("背景の選択解除と再生中の層", () => {
  it("選択の解除は補正なので、層を保ち履歴を置き換える", () => {
    const store = createStore();
    seedLibraryRoute(store, { selectedWorkId: "w1" });
    openLayer(store);
    clearPendingOps(store);

    store.set(deselectLibraryWorkAtom);

    expect(store.get(appRouteAtom).layer).not.toBeNull();
    expect(store.get(appRouteAtom).library.selectedWorkId).toBeNull();
    expect(pendingWrites(store)).toEqual(["replace"]);
  });

  function setup(layerOpen: boolean, props: { noResults: boolean; error?: unknown }) {
    const store = createStore();
    seedLibraryRoute(store, { selectedWorkId: "w1" });
    if (layerOpen) openLayer(store);
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(Provider, { store }, children);
    renderHook(
      () =>
        useLibrarySelectionCleanup({
          nav: { selectedWorkId: "w1" },
          isNoResultsDueToFilter: props.noResults,
          workDetailError: props.error ?? null,
        }),
      { wrapper },
    );
    return store;
  }

  const notFound = new ApiRequestError(404, "not_found", "ない");

  it("層が開いていても、0件・404の解除は層を保ったまま行う", () => {
    const store = setup(true, { noResults: true, error: notFound });
    expect(store.get(appRouteAtom).library.selectedWorkId).toBeNull();
    expect(store.get(appRouteAtom).layer).not.toBeNull();
  });

  it("層が無ければ選択だけ解除する", () => {
    const store = setup(false, { noResults: true });
    expect(store.get(appRouteAtom).library.selectedWorkId).toBeNull();
    expect(store.get(appRouteAtom).layer).toBeNull();
  });
});
