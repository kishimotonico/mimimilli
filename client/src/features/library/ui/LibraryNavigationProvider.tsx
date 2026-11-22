import { createElement, type ReactNode } from "react";
import { LibraryNavigationContext } from "../model/libraryNavigationContext";
import { useLibraryView } from "../model/useLibraryNavigation";

export function LibraryNavigationProvider({ children }: { children: ReactNode }) {
  return createElement(LibraryNavigationContext.Provider, { value: useLibraryView() }, children);
}
