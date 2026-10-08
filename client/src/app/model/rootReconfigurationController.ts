// root再設定（ADR-0029）に伴うclientのリセットを一箇所に集約する。
// 突入・離脱・drift検知で何をリセットするかはこのファイルの列挙が正。Reactのコミット前後に
// 意味がある処理（通常UIのobserverが外れてからのremove、ready復帰後のreset）は、
// 薄いEffectコンポーネントがUIの境界（reconfiguringUiMounted・readyUiMounted）を伝えて実行させる。
import type { QueryClient } from "@tanstack/react-query";
import type { Settings } from "@mimimilli/shared";
import { SETTINGS_QUERY_KEYS } from "../../entities/settings/queryKeys";
import { WORK_QUERY_KEYS } from "../../entities/work/queryKeys";
import { SMART_FOLDER_QUERY_KEYS } from "../../entities/smart-folder/queryKeys";
import { TAG_QUERY_KEYS } from "../../entities/tag/queryKeys";
import { FILE_SYSTEM_QUERY_KEYS } from "../../entities/file-system/queryKeys";
import { refreshScanCandidates } from "../../entities/scan/scanCandidatesCache";
import { scanLastResultQueryOptions } from "../../entities/scan/queryOptions";

// entities/scan/queryKeys.ts の全キー（last/candidates/candidateExclusions/diagnostics）は
// すべて["scan", ...]配下なので、ルートの["scan"]だけで丸ごと対象にできる
// （個別に列挙すると新規キー追加時に破棄漏れが起きる）。
const SCAN_QUERY_KEYS_ROOT = ["scan"] as const;

function affectedQueryKeys(): readonly (readonly unknown[])[] {
  return [
    WORK_QUERY_KEYS.all(),
    WORK_QUERY_KEYS.allDetails(),
    WORK_QUERY_KEYS.allFacets(),
    WORK_QUERY_KEYS.dlsiteNotifications(),
    SMART_FOLDER_QUERY_KEYS.all(),
    SMART_FOLDER_QUERY_KEYS.allWorks(),
    TAG_QUERY_KEYS.all(),
    TAG_QUERY_KEYS.prefixes(),
    SCAN_QUERY_KEYS_ROOT,
    FILE_SYSTEM_QUERY_KEYS.all(),
  ];
}

export function markReconfigurationAffectedQueriesStale(queryClient: QueryClient): void {
  for (const queryKey of affectedQueryKeys()) {
    void queryClient.invalidateQueries({ queryKey, refetchType: "none" });
  }
}

/** observerがいない側（reconfiguring画面）専用。生きたobserverがある間にremoveすると
 *  即座に再フェッチしてロック中APIへ409を飛ばす。 */
export function removeReconfigurationAffectedQueries(queryClient: QueryClient): void {
  for (const queryKey of affectedQueryKeys()) {
    queryClient.removeQueries({ queryKey });
  }
}

/** observerがいる側（ready復帰後）専用。removeだとその時点で走っているfetchごと破棄して
 *  observerが再開せずpendingのまま残るため、activeな分は自動で再取得されるresetを使う。 */
export function resetReconfigurationAffectedQueries(queryClient: QueryClient): void {
  for (const queryKey of affectedQueryKeys()) {
    void queryClient.resetQueries({ queryKey });
  }
}

export interface RootReconfigurationControllerDeps {
  queryClient: QueryClient;
  stopPlayback: () => void;
  closeActiveModal: () => void;
  closeDlsiteApplyDialog: () => void;
  scanJob: { reset: () => void };
  dlsiteBulk: { reset: () => void; attach: () => Promise<void> };
  navigateToDefaultRoute: () => void;
  clearScanCandidateHiddenPaths: () => void;
}

export interface RootReconfigurationController {
  /** 突入側の非破壊なリセット。自分で開始した経路・他所の開始を検知した経路で共有する
   *  （冪等）。作品系クエリの破棄は通常UIのobserverが外れてからなのでここではstale化のみ */
  enter: () => void;
  /** startupStateの観測。reconfiguringへ切り替わった瞬間にだけenterする */
  observeStartupState: (isReconfiguring: boolean) => void;
  /** readyの間のsettings観測。rootFolder・completedAtが前回観測から変わっていたら
   *  （初回観測・再設定後の最初の観測は基準の記録だけ）突入する */
  observeSettings: (settings: Settings | undefined) => void;
  /** 突入の回数。readyが維持されたまま突入した場合（drift・runningが描画されない高速完了）に、
   *  navigateがコミットされた後のreadyUiMountedで離脱側の後処理を行うための購読口 */
  subscribeEntries: (listener: () => void) => () => void;
  getEntryCount: () => number;
  /** reconfiguring画面のコミット後に呼ぶ。通常UIのobserverは消えているので作品系クエリを破棄できる */
  reconfiguringUiMounted: () => void;
  /** 通常UIのコミット後に呼ぶ。突入済みでロックが解除されていれば離脱側の後処理を1回だけ行う
   *  （ロック中なら保留し、解除後の呼び出しで行う） */
  readyUiMounted: () => void;
}

interface SettingsBaseline {
  rootFolder: string | null;
  completedAt: string | null;
}

export function createRootReconfigurationController(
  deps: RootReconfigurationControllerDeps,
): RootReconfigurationController {
  const { queryClient, dlsiteBulk } = deps;

  const entryResets: readonly (() => void)[] = [
    deps.stopPlayback,
    deps.closeActiveModal,
    deps.closeDlsiteApplyDialog,
    deps.scanJob.reset,
    dlsiteBulk.reset,
    deps.navigateToDefaultRoute,
    deps.clearScanCandidateHiddenPaths,
    () => markReconfigurationAffectedQueriesStale(queryClient),
  ];

  const entryListeners = new Set<() => void>();
  let entryCount = 0;
  let leavePending = false;
  let wasReconfiguring = false;
  let settingsBaseline: SettingsBaseline | null = null;

  const enter = (): void => {
    for (const reset of entryResets) reset();
    leavePending = true;
    settingsBaseline = null;
    entryCount += 1;
    for (const listener of entryListeners) listener();
  };

  const leave = (): void => {
    if (!leavePending) return;
    // ロック中（settingsキャッシュがidleでない）は、通常UIが残っていても離脱させない
    const settings = queryClient.getQueryData<Settings>(SETTINGS_QUERY_KEYS.all());
    if (settings?.rootReconfiguration.status !== "idle") return;
    leavePending = false;
    resetReconfigurationAffectedQueries(queryClient);
    void refreshScanCandidates(queryClient).catch(() => {});
    void queryClient
      .fetchQuery(scanLastResultQueryOptions)
      .then((last) => {
        if (last && last.result.insertedWorkIds.length > 0) void dlsiteBulk.attach();
      })
      .catch(() => {});
  };

  return {
    enter,
    observeStartupState(isReconfiguring) {
      if (isReconfiguring && !wasReconfiguring) enter();
      wasReconfiguring = isReconfiguring;
    },
    observeSettings(settings) {
      if (!settings || settings.rootReconfiguration.status !== "idle") return;
      const current: SettingsBaseline = {
        rootFolder: settings.rootFolder,
        completedAt: settings.rootReconfiguration.completedAt,
      };
      const baseline = settingsBaseline;
      settingsBaseline = current;
      if (
        baseline === null ||
        (baseline.rootFolder === current.rootFolder && baseline.completedAt === current.completedAt)
      ) {
        return;
      }
      enter();
      settingsBaseline = current;
    },
    subscribeEntries(listener) {
      entryListeners.add(listener);
      return () => entryListeners.delete(listener);
    },
    getEntryCount: () => entryCount,
    reconfiguringUiMounted() {
      removeReconfigurationAffectedQueries(queryClient);
    },
    readyUiMounted: leave,
  };
}
