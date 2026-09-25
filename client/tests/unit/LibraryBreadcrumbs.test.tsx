import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import LibraryBreadcrumbs from "../../src/features/library/ui/LibraryBreadcrumbs";
import { LibraryTransitionContext } from "../../src/features/library/model/libraryTransitionContext";
import { activeAxisAtom } from "../../src/entities/library/model/navigationAtoms";
import { seedLibraryRoute } from "../helpers/route";

describe("LibraryBreadcrumbs", () => {
  it("パンくずのクリックはLibraryNavigationProviderが持つ単一のstartTransitionを経由する（TASK-381）", () => {
    // パンくずだけの独立した遷移を持つと、他コンポーネントの遷移中表示
    // （WorkListPaneのis-pending暗転）にこの操作が反映されなくなる。
    const store = createStore();
    seedLibraryRoute(store, { activeAxis: "cv" });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const startTransition = vi.fn((action: () => void) => action());

    render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(
          JotaiProvider,
          { store },
          createElement(
            LibraryTransitionContext.Provider,
            { value: startTransition },
            createElement(LibraryBreadcrumbs),
          ),
        ),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "ライブラリ" }));

    expect(startTransition).toHaveBeenCalledTimes(1);
    expect(store.get(activeAxisAtom)).toBe("all");
  });
});
