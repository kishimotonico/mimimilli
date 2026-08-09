import { createContext } from "react";
import type { LibraryViewActions, LibraryViewState } from "./useLibraryNavigation";

export const LibraryNavigationContext = createContext<
  (LibraryViewState & LibraryViewActions) | null
>(null);
