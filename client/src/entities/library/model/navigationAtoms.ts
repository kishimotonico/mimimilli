import { atom } from "jotai";
import { appRouteAtom } from "../../navigation/model/appRouteStore";

export const libraryRouteAtom = atom((get) => get(appRouteAtom).library);
