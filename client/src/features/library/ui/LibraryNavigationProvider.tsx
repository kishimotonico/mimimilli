import { createElement, type ReactNode } from "react";
import { LibraryNavigationContext } from "../model/libraryNavigationContext";
import { LibraryTransitionContext } from "../model/libraryTransitionContext";
import { useLibraryView } from "../model/useLibraryNavigation";

export function LibraryNavigationProvider({ children }: { children: ReactNode }) {
  const { navigation, startTransition } = useLibraryView();
  return createElement(
    LibraryTransitionContext.Provider,
    { value: startTransition },
    createElement(LibraryNavigationContext.Provider, { value: navigation }, children),
  );
}
