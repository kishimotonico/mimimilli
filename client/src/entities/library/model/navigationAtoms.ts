import { atom } from "jotai";
import { libraryPlaceOf } from "./libraryRouteTransitions";
import { appRouteAtom } from "../../navigation/model/appRouteStore";

export const libraryRouteAtom = atom((get) => get(appRouteAtom).library);

/** 今いる場所。await を挟む操作が、始めたときと同じ場所かを確かめるのに使う */
export const libraryPlaceAtom = atom((get) => libraryPlaceOf(get(appRouteAtom)));
