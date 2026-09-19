---
id: TASK-447.15
title: トースト通知を要求キューに一本化し、エラーを最優先で表示する
status: Done
assignee: []
created_date: '2026-09-11 05:35'
updated_date: '2026-09-11 06:29'
labels:
  - ui
  - ux
  - triage
dependencies: []
parent_task_id: TASK-447
priority: high
ordinal: 483000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
設計レビュー第2回（tmp/uiux-triage-2026-09-11/followup-2.md の A、ユーザー決定「今やる」）。GlobalToast.tsx は toastRequestsAtom＋useToast() の要求キューと、13個の個別 atom の if 連鎖が併存し、variant=error の要求が action 扱いで別の action に負けて未表示のまま消える（design-system.md の規約違反）。全通知を要求キューに寄せ、優先度を error > action > notice > background の4段にする。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 すべてのトースト通知が toastRequestsAtom（useToast().show）経由で出され、表示専用の個別 atom が削除されている。エラー状態として他でも参照される atom は残り、表示だけ useToast に寄っている
- [x] #2 優先度が error > action > notice > background の4段で、variant=error の要求は発行元の priority に関わらず最優先で表示され、別の action 要求が来ても未表示のまま破棄されない
- [x] #3 GlobalToast は要求の集合から1件を選んで Toast に渡すだけになり、onOpenScan 等の画面遷移は各要求の onAction に閉じている
- [x] #4 同じ文面の再通知で寿命タイマーがリセットされ、古い要求の onDismiss が新しい要求を消さない
- [x] #5 useTopmostOpenModalDialog の body 全体への MutationObserver が廃止され、開いているモーダル dialog のスタックを useDialogModal 側の状態で管理している
- [x] #6 docs/design-system.md の単一ホストの優先順位の記述が4段の新契約に置き換わり、globalErrorToast.test 等が新契約で書き直されている（期待値を弱めない）
- [x] #7 変更範囲のテストが通り、既存テストの期待値を辻褄合わせで削除・緩和していない（仕様変更で書き換えた期待値はタスクメモに前後を列挙）
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装完了（コミットは統括に依頼せず自分でコミット、task/447.15上）。

## atom judgement table
| atom | 判定 | 理由 |
|---|---|---|
| scanErrorAtom | 残す（状態） | SetupScreen.tsxがインライン表示に読む。表示だけScanRuntimeからuseToastへ |
| scanResultToastAtom | 残す（一度きり信号） | App.tsxがJotai read API/features model importを禁止されている（.oxlintrc.json）ため、ScanRuntime→App間の橋渡しにapp/ui/ScanResultToastBridge.tsxを新設し、そこで消費してuseToastへ変換 |
| errorToastAtom | 削除 | 他は全てsetterのみ（読み手はGlobalToastだけ）。7箇所の呼び出し元をuseToast().error()へ直接置換 |
| dlsiteBulkErrorAtom/dlsiteBulkResultAtom/dlsiteBulkCancelledResultAtom/dlsiteBulkApplyResultAtom | 削除 | 読み手はGlobalToastのみ。DlsiteBulkRuntime/DlsiteBulkApplyRuntimeが直接useToast().show()を呼ぶ。dismiss()アクション（表示クリア専用だった）もDlsiteBulkActions/useDlsiteBulkApplyActionsから削除 |
| dlsiteApplyToastAtom | 削除 | 読み手はGlobalToastのみ。DlsiteEditor.tsxが直接useToast |
| rootFolderChangedToastAtom | 削除 | App.tsx自身がsetter（handleOpenScanModalも同スコープ）なので直接useToast |
| playerSkipToastAtom | 削除 | usePlayer.ts内でusePlayerActions().setTrackIndexを直接呼べるため、onRetrySkippedTrackのApp経由props不要に |
| workDeleteSuccessAtom/copyPathSuccessAtom | 削除 | 表示専用、各setter元（WorkDetail.tsx/FilesAddressBarMenu.tsx）が直接useToast |

未削除の空ファイル（rm系コマンド禁止のため）: client/src/shared/model/errorToastAtom.ts、client/src/entities/dlsite/model/dlsiteApplyToastAtom.ts、client/src/entities/settings/model/rootFolderChangeAtoms.ts、client/src/features/files/model/atoms.ts（copyPathSuccessAtomのみ）。統括側でgit rm願います。

## 優先度の実装方式
「選択時にvariant=errorを先に抽出する」方式を採用（design-system.mdの記述と一致）。ToastPriorityは"action"|"notice"|"background"の3値のまま、variant="error"の要求はGlobalToastのpickToastRequestが発行元priorityを無視して最優先で拾う。useToast().error(message)ヘルパーを追加（priority指定不要）。

## Toast.tsx寿命タイマー
仕様通りref+dependency方式（要求ごとの一意キー=useToastのid+発行カウンタをrequestKeyとして依存配列に含め、onDismissはrefで最新を保持）。Reactのkeyによるremount方式は既存のToast.test.tsx「退出中に新しいトーストが割り込んでも...」テストの前提（ToastContentが単一スロット・同一キー"" を共有する設計）を壊すため採用しなかった。

## useTopmostOpenModalDialog
openModalDialogsAtom（HTMLDialogElement[]）を新設、useDialogModalのshowModal()直後にpush・cleanupでpopする形でスタック管理。MutationObserver・querySelectorAll("dialog:modal")は完全廃止。

## テスト前後
- client/tests/unit/globalErrorToast.test.tsx: 全面書き直し。旧15件（各atomの個別表示テスト）→新6件（GlobalToastの選択ロジックのみ、useToastハーネス経由）。旧テストが検証していた「エラー最優先」「破棄と再表示なし」「onAction配線」は新契約でも同等以上に固定。feature別の表示内容（DLsite適用ダイアログの開き方等）はDlsiteEditor.test.tsx等、該当featureのテストへ移設
- client/tests/unit/Toast.test.tsx: +1件（同じ文面でもrequestKeyが変われば寿命タイマーを取り直す＝旧要求のonDismissが新要求を消さないことの固定）
- client/tests/unit/useTopmostOpenModalDialog.test.ts: 新規3件（MutationObserver→スタック方式の開閉順・ネスト・クローズ後の復帰）
- client/tests/unit/DlsiteEditor.test.tsx, WorkDetail.test.tsx, runtimeEventSource.test.tsx, DlsiteBulkApplyDialog.test.tsx: store.get(削除atom)への直接参照をtoastRequestsAtom読み取り（またはGlobalToast併設+画面表示）へ書き換え。アサート内容自体は変えていない（表示文言・variantは同一）

## check/test/smoke
pnpm check: 通過（lint/boundaries/fmt/tsc全部）。pnpm --filter client vitest run: 148ファイル1076件全通過。test:smoke未実施（後述）。

## 実機確認
dev:fixture:new-work、agent-browser session 447.15、viewport 1440x900。
- ファイルモード「絶対パスをコピー」→successトースト表示を確認（shots-intake/447.15-copy-toast.jpg）
- スキャンモーダルを開いた状態で候補除外→actionトーストがモーダル内に正しくポータルされクリック可能（inert化されていない）ことを確認（shots-intake/447.15-modal-toast.jpg）。useDialogModalスタック方式でのポータル切り替えが機能している証拠
- コンソールエラーなし

## 未実施・判断に迷った点
- pnpm test:smoke は未実行（時間の都合）。統括側で実行をお願いしたい
- スキャン完了トースト自体の実機スクショはタイミングを逃した（5秒で自動消滅）が、unit test（ScanResultToastBridge経由の分岐）とApp.tsx側のロジックで担保
- App.tsxがJotai read API禁止という制約に着手後に気づき、当初GlobalToastPropsを完全に削除してApp.tsx側でuseAtomValueするコードを書いたが、pnpm checkのlintで検出→ScanResultToastBridgeコンポーネントに切り出して解決（教訓: App.tsxの.oxlintrc.json制約は着手前に確認すべきだった）

pnpm test:smoke: 25件全通過（library/dlsiteBulkApply/nowPlaying系）。特に「:modal存在下ではEscで最前面のdialogだけが閉じ、没入モードは維持される」がuseDialogModalスタック方式のネストモーダル判定を実際に通している。上記メモの「未実施」は解消

差し戻し対応: useToast に dismissOnUnmount（既定 true）を追加し、発行元が同じ操作で即アンマウントされる結果通知（全画面作品詳細からの登録解除成功）だけ false。onAction は自動では閉じず、閉じる場合は呼び出し側が dismiss する契約（要対応を見る・このトラックを再試行を復元）。globalErrorToast.test から移設先の無かった3件を usePlayer.test / rootFolderChangedToast.test / ScanRuntime.test に追加。
<!-- SECTION:NOTES:END -->
