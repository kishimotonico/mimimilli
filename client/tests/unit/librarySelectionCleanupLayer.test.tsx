import { createElement, type ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { describe, expect, it, vi } from "vitest";
import { selectLibraryWorkAtom } from "../../src/entities/library/model/navigationActions";
import { appRouteAtom } from "../../src/entities/navigation/model/appRouteStore";
import { ApiRequestError } from "../../src/shared/api/http";
import { useLibrarySelectionCleanup } from "../../src/features/library/model/useLibrarySelectionCleanup";
import { seedLibraryRoute, seedRoute } from "../helpers/route";

function openLayer(store: ReturnType<typeof createStore>) {
  seedRoute(store, (route) => ({ ...route, layer: { kind: "nowPlaying", openedBy: "app" } }));
}

describe("背景の選択解除と再生中の層", () => {
  it("選択の解除は appRouteAction を通るので、層が開いていると層を落とす（背景から呼んではいけない根拠）", () => {
    const store = createStore();
    seedLibraryRoute(store, { selectedWorkId: "w1" });
    openLayer(store);

    store.set(selectLibraryWorkAtom, null);

    expect(store.get(appRouteAtom).layer).toBeNull();
  });

  function setup(layerOpen: boolean, props: { noResults: boolean; error?: unknown }) {
    const store = createStore();
    seedLibraryRoute(store, { selectedWorkId: "w1" });
    if (layerOpen) openLayer(store);
    const selectWork = vi.fn((_id: string | null) => {});
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(Provider, { store }, children);
    const hook = renderHook(
      () =>
        useLibrarySelectionCleanup({
          nav: { selectedWorkId: "w1", selectWork },
          isNoResultsDueToFilter: props.noResults,
          workDetailError: props.error ?? null,
        }),
      { wrapper },
    );
    return { store, selectWork, hook };
  }

  const notFound = new ApiRequestError(404, "not_found", "ない");

  it("層が開いている間は、0件でも404でも選択を解除しない", () => {
    const { selectWork } = setup(true, { noResults: true, error: notFound });
    expect(selectWork).not.toHaveBeenCalled();
  });

  it("層が閉じたあとに、0件・404の解除を行う", () => {
    const { store, selectWork } = setup(true, { noResults: true, error: notFound });
    act(() => {
      seedRoute(store, (route) => ({ ...route, layer: null }));
    });
    expect(selectWork).toHaveBeenCalledWith(null);
  });

  it("層が無ければ今までどおり解除する", () => {
    const { selectWork } = setup(false, { noResults: true });
    expect(selectWork).toHaveBeenCalledWith(null);
  });
});
