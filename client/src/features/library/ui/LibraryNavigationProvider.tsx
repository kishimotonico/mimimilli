import type { ReactNode } from "react";
import { LibraryNavigationContext } from "../model/libraryNavigationContext";
import { useLibraryView } from "../model/useLibraryNavigation";

export function LibraryNavigationProvider({ children }: { children: ReactNode }) {
  const navigation = useLibraryView();
  return (
    <LibraryNavigationContext.Provider value={navigation}>
      {children}
    </LibraryNavigationContext.Provider>
  );
}
