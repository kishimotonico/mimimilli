// root再設定・別タブでの再設定完了検知（drift）の突入時に、URLと同期している
// ナビゲーション系atom（appMode・Filesのパス・作品詳細ID）を既定へ戻す。Libraryモード
// 内部の状態（検索語・タグ・軸・選択作品）はresetLibraryNavigationAtomが別に持つ。
// URLへの反映はNavigationHistorySync（マウント中はatoms→URLの同期effectが動く）任せ。
// 未マウント時（reconfiguring突入時）はresetLibraryNavigationUrl()を別途呼ぶ必要がある。
import { atom } from "jotai";
import { appModeAtom } from "../../shared/model/appModeAtoms";
import {
  filesRelPathAtom,
  filesSelectedPathAtom,
} from "../../entities/file-system/model/navigationAtoms";
import { workDetailIdAtom } from "../../entities/work/model/navigationAtoms";

export const resetNavigationToDefaultAtom = atom(null, (_get, set) => {
  set(appModeAtom, "library");
  set(filesRelPathAtom, []);
  set(filesSelectedPathAtom, null);
  set(workDetailIdAtom, null);
});
