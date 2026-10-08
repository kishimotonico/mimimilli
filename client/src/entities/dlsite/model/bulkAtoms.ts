// DLsite 一括取得まわりの Jotai atoms。ジョブの状態は dlsiteBulkStore が持つ。

import { atom } from "jotai";

export const dlsiteBulkApplyOpenAtom = atom(false);

export const dlsiteBulkApplyBusyAtom = atom(false);
