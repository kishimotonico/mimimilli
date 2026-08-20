import { atom } from "jotai";

// 全画面作品詳細（/work/:id）で表示中の作品ID。URLの work-detail 経路と
// useNavigationHistory で同期する（entities/library の selectedWorkIdAtom とは独立）。
export const workDetailIdAtom = atom<string | null>(null);
