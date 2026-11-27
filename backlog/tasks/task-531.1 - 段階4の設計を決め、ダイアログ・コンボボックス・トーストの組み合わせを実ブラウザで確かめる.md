---
id: TASK-531.1
title: 段階4の設計を決め、ダイアログ・コンボボックス・トーストの組み合わせを実ブラウザで確かめる
status: To Do
assignee: []
created_date: '2026-11-27 13:58'
updated_date: '2026-11-27 13:58'
labels:
  - ui
dependencies:
  - TASK-530
parent_task_id: TASK-531
priority: high
ordinal: 655000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0043 と doc-10 は、ダイアログ・コンボボックス・トーストの組み合わせのうち未確認のものを「置き換えタスクで確かめる」としている。TASK-529.2 の doc-11 と同じく、実装の前に設計書（backlog の doc）を合意する。
範囲: 設計書の作成と、下の確認項目の実測（本番と同じ `@ark-ui/react` のバージョン、フィクスチャのシナリオ。実データ DB は使わない）。試作はハーネスで行い、捨てる。
対象外: 本番コードの置き換え。
設計で決めること（既定。異論が無ければ設計書にそのまま書く）: 重なりの階層の値（案: ダイアログ 60、トースト 70。メニュー・ポップオーバー 50 は据え置き。ライブラリは z-index を決めない）、退出中のダイアログの扱い（`LAYER_CONTENT_SELECTOR` と同じく開いている・退出中を問わず層として扱い、退出中は `inert`）、Lightbox も Ark Dialog にする、コンボボックスのリストの退出は `layerScale`、`createPortal` の削除、ダイアログ表示中のトーストの位置（AC2 の結果で決める）、ADR-0043 は追記ではなく書き換える。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 設計書が doc として残り、各確認項目の結果（回数と数字）と `@ark-ui/react` のバージョンが書かれている
- [ ] #2 確認: Ark Dialog（modal）の表示中に、body 直下のトースト（操作ボタン・閉じる）がクリックできるか。できない場合に採る手当て（`persistentElements`、dialog 内ポータル、`modal={false}`）が実測で決まっている。また現行の `popover="manual"` のトーストが Ark Dialog の上に見えるか
- [ ] #3 確認: 入れ子ダイアログ（作品編集 > 確認 など）の重なり・二重の暗さ、Esc の一段、backdrop クリックで最前面だけが閉じること、閉じた後の戻し先。モーダルの `preventScroll` でレイアウトがずれないか（スクロールバー幅）
- [ ] #4 確認: Ark Combobox の3形態（Ark Dialog の中、ポップオーバーの中、インライン）で、リスト開の Esc・リスト閉の Esc（`onCancel` を呼べる）・IME 変換中の Esc と Enter（CDP 合成、keyCode 229 を含む）・外側クリックとスクロールで閉じる・Esc 後のフォーカスが入力欄にあり再オープンしない。ネイティブ dialog の中の Ark Combobox を `onCancel` で補う形で、Esc の一段が壊れないか（成り立たなければ S4.2 と S4.3 を1つにまとめると設計書に書く）
- [ ] #5 確認: `finalFocusEl` を関数で渡し、開いた元が消えていても指定の戻し先へ戻って BODY を経由しない（各10回）。ダイアログの退出アニメーション中のフォーカス復帰・inert・背後のショートカットの扱いが決まっている。メニュー項目からダイアログを開くとき（退出と初期フォーカスが重なる）の競合
- [ ] #6 確認: `useGlobalShortcuts`・一覧の Esc・再生中の層の Esc が、ダイアログ表示中（body フォーカスと退出中を含む）に背後へ漏れないための判定の形
- [ ] #7 末尾の「決めること」の回答が設計書に記録されている
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
S4.1 完了時に、下の子タスク案の「S4.1 で決めた〜」を具体の挙動へ書き直して起票する。S4.2〜S4.5 は今は起票しない。親は TASK-531（S4）。

## 構成と方針

- 順番: TASK-529 を master へマージ → TASK-530（Ark 5.40.1、2026-11-30 以降）→ S4 → DRAFT-53。S4 の統合ブランチは TASK-529 のマージ後の master から切る。ブランチ名は `feat/task-<S4の番号>-ark-dialog-combobox`
- 子の並び: S4.1（設計・確認のゲート）→ S4.2（コンボボックス）→ S4.3（ダイアログ）→ S4.4（段階2の例外の削除）と S4.5（トースト）。S4.4 と S4.5 は S4.3 のあとで並行できる
- ダイアログは「共通部品の置き換え」と「例外の削除」の2つの子に分ける（レビュー should-1 を採用）。
  - 全ダイアログは `Modal`＋`useDialogModal`（Lightbox だけ直接）の窓口を通るので、共通部品を替えた時点で全部が一度に切り替わる。ネイティブの親の上に Ark の子を z-index で出せず、`showModal()` 中は外が inert になるので、ダイアログを個別に段階移行はできない。S4.3 はこの一括置き換え
  - S4.4 の対象（`layerContainer` の dialog 分岐、`MotionPopover` の `HTMLDialogElement` 判定、native dialog のテストハーネス）は S4.3 のあとは到達しない分岐になるだけで、動作に影響しない。そのため S4.3 の時点で壊れた状態にはならない。`useDialogModal` の backdrop ガード・Tab 例外は `useDialogModal` ごと S4.3 で消える
  - 重なりの階層（ダイアログ・トーストの値）は S4.3 で導入するので、階層表は S4.3 の AC に入れる。S4.4 は残った native dialog 前提の記述の削除だけ
- コンボボックスを先、ダイアログを後にする前提（`onCancel` を自前の `onKeyDown` で呼べば、ネイティブ dialog の中の Ark Combobox が Esc を止める不具合は実用上出ない）は S4.1 の AC4 で確かめる。成り立たなければ S4.2 と S4.3 を1つの子にまとめる
- ダイアログには退出アニメーションを付ける（ユーザー決定）。メニュー・ポップオーバーと同じ `usePresenceLifetime`＋motion 方式。閉じた直後に動く Ark の復帰と退出アニメーションの関係は S4.1 の設計で決める
- 「決めること」のうち人の判断が残るものは AC に入れず末尾にまとめた。S4.1 で回答を設計書に記録し、依存する AC は S4.1 の完了時に具体の挙動へ書き直す（S4.2〜S4.5 の説明に明記）
- 後方互換・フォールバック・移行処理は入れない。呼び出し側は旧 API を残さず書き換える
- 各子は、自分が変えた範囲の `docs/design-system.md` と ADR-0043 の記述を同じ子で実装に合わせる。最終レビューで出た指摘は、TASK-529.3・529.4 と同じくその時に起票する（子にしない）
## S4.2 TagCombobox

タイトル: TagCombobox を Ark の Combobox で作り直し、IME と Esc の規約を保つ

優先度: High。依存: S4.1、TASK-529.4（`TagAddPopover` の構成）

説明:
ダイアログの置き換えの前に、自作の Esc 処理（`stopPropagation` 前提）を Ark の層に載せる（ADR-0043）。
範囲: `shared/ui/TagCombobox.tsx` とテスト、呼び出し3ファイル（`TagAddPopover`、`RegisterWorkDialog` ほか。529.4 統合後の構成）。候補生成の純関数 `getTagComboboxOptions` は残す。呼び出し元の無い `TagComboboxHandle.commitPendingInput` は削除する。リストの退出は `layerScale`。タグのポップオーバーが持つ Esc の例外（`onEscapeKeyDown: preventDefault`）は、Ark の層に任せられるなら削除する。
対象外: ダイアログの置き換え、`useInlineEditKeyDown` の IME（TASK-494）。
注記: AC5 の backdrop の挙動は、S4.1 で決める全層共通の規則に従う。S4.1 の完了時に具体の挙動へ書き直す。

受け入れ条件:
1. `TagCombobox` が Ark の Combobox になり、自前の Esc・`pointerdown`・`scroll` のリスナーが無い。呼び出し側の API は props の整理を除き変わらない
2. 候補の規約が現行と同じ: 部分一致・除外・上限8・新規作成の候補・先頭ハイライト・矢印の循環・Enter とクリックの確定・確定後に入力が空になる
3. IME 変換中の Esc と Enter で、リストも入力も `onCancel` も動かない。判定は `isComposingKey`（keyCode 229 を含む）。CDP 合成で確認する
4. Esc の段: リスト開→リストだけ閉じる、リスト閉→`onCancel`（無ければ上位の層）。ネイティブ dialog の中、ポップオーバーの中、右ペインのインラインで各10回、1回の Esc で1段
5. 外側クリック・スクロール・フォーカスが外へ出るときにリストが閉じ、リスト内の操作では閉じない。リストを開いたまま backdrop を押したときの挙動が、S4.1 で決めた全層共通の規則に従う。Esc 後のフォーカスは入力欄で、再オープンしない
6. 作品編集ダイアログ > タグ追加 > 候補の Esc の段（529.4 の smoke）が新しい実装で通る
7. `pnpm check && pnpm test` と `pnpm test:smoke` が通る

## S4.3 ダイアログの置き換え

タイトル: 全ダイアログを Ark の Dialog へ置き換え、判定とフォーカスを書き換える

優先度: High。依存: S4.1、S4.2

説明:
ネイティブ dialog の top layer が、inert を避けるポータル・Tab 循環の補完・cancel の伝播止め・backdrop 判定を要求している。Ark の層に寄せて Esc とフォーカスを1系統にする。TASK-528（開いた元が消えたときのフォーカス）はここで解消し、満たしたら閉じる。ダイアログには退出アニメーションを付ける。
範囲:
- 共通層（`shared/ui/dialog/` など。名前は設計で決める）: `usePresenceLifetime`＋motion の退出、`finalFocusEl` で渡す戻し先（`resolveFocusReturnTarget` を再利用し、消えた場合の代わりを持つ）、`initialFocusEl`、`role="alertdialog"`（確認）、保存中・編集中に閉じない条件
- 呼び出し: `Modal`・`ModalHeader`・`ModalFooter`、`ConfirmDialog`、`UnsavedChangesPrompt`、`Lightbox`、設定・スキャン・検索の保存・編集・作品編集・DLsite 適用・作品の情報・作品として登録（`createPortal` は削除）
- 書き換え: `useGlobalShortcuts`・`useWorkResultsDismiss`・`NowPlayingLayer` の判定（`:modal` のモックを含むテストと smoke）、`useDialogModal` と `focusable.ts` の削除、`player-dock.css` のコメント
- 階層: ダイアログ・トーストの値を `docs/design-system.md` の階層表に入れる。ダイアログ表示中でも現行のトーストが最前面で操作できる状態を保つ（トーストの置き換えは S4.5）
対象外: トーストの置き換え、`layerContainer` の dialog 分岐・`MotionPopover` の判定・native dialog ハーネスの削除（S4.4）、セレクト。
注記: AC3・AC4 の backdrop と確認ダイアログの挙動は S4.1 で決める。S4.1 の完了時に具体の挙動へ書き直す。

受け入れ条件:
1. `Modal`・`ConfirmDialog`・`Lightbox` と全呼び出しが Ark の Dialog になり、`rg "showModal|<dialog|openModalDialogsAtom|useTopmostOpenModalDialog" client/src` が0件。`useDialogModal.ts` と `focusable.ts` が無い
2. Esc・×・キャンセルが同じ `onClose` に集まり、保存中・編集中の条件（SmartFolderDialog・RegisterWorkDialog・WorkEditDialog の dirty・SettingsModal のフォルダー編集）が現行どおり。入れ子（作品編集 > 未保存／確認／DLsite、スキャン > 確認、設定 > 確認）で Esc が最前面だけを閉じる。各10回
3. backdrop クリックの挙動が、S4.1 で決めた規則どおり（層を開いたままの backdrop は全層共通、確認ダイアログは決めたとおり）
4. ダイアログの中のメニュー・ポップオーバー・コンボボックスが Esc で一段ずつ閉じる
5. 開閉に退出アニメーションが付き（メニュー・ポップオーバーと同じ方式）、退出中は `inert`。初期フォーカスが現行どおり（確認はキャンセル、作品編集はタイトル、検索の保存は名前など）。閉じたときは、開いた元が消えていても指定の戻し先へ戻り BODY を経由しない（メニュー項目から開いた各ダイアログで各10回）。TASK-528 の AC#1〜#3 を満たす
6. ダイアログ表示中（body フォーカス、退出中を含む）に、再生の Space・矢印、一覧の Esc の選択解除、再生中の層の Esc が背後へ漏れない。ダイアログ表示中でも既存のトーストが最前面で操作できる。階層表と Esc の記述が実装と一致している
7. `pnpm check && pnpm test` と `pnpm test:smoke` が通る。ダイアログ前提の unit と smoke のロケータを直し、削除・緩和したテスト期待値とその行き先を報告に書く

追加で測ること（AC に入れず報告に書く）: 検索の保存の「複製」保存で、`close` 後の復帰とフォルダー遷移の再描画の間に約67ms BODY を経由する件（TASK-528 の実装メモ）。原因は画面遷移側なので、残るなら原因と、起票するか対応なしかの根拠を報告する。

## S4.4 段階2の例外の削除

タイトル: ネイティブ dialog のために入れた段階2の例外とテストハーネスを削除する

優先度: Medium。依存: S4.3

説明:
S4.3 のあと、native dialog のために TASK-529 で入れた分岐は到達しなくなる。削除して、ADR-0043 の「それまでの間」の例外の記述も現在の状態に直す。
範囲: `layer/layerDom.ts` の `layerContainer` の dialog 分岐（ポップオーバーの content 内への分岐は残す）と `OPEN_LAYER_SELECTOR` のうち dialog 専用の部分、`MotionPopover` の `HTMLDialogElement` 判定、`layerEvents.ts`・`layerPositioning` のコメントのうち native dialog に触れるもの、`tests/unit/motionPopover.test.tsx` の native dialog ハーネス、`tests/smoke/harness/popover-menu.tsx` と `popoverMenu.smoke.spec.ts` の dialog 前提、`design-system.md` の top layer 前提の記述。
対象外: 実装の追加。

受け入れ条件:
1. `rg "HTMLDialogElement|closest\(\"dialog" client/src` と `rg "HTMLDialogElement.prototype" client/tests` に、ネイティブ dialog 向けの例外が残らない
2. 削除した例外が担っていた保証（ポップオーバー・メニューの外側クリック、フォーカスが dialog に落ちる場合の扱い）を、Ark Dialog 前提のテストが担っている。削除・緩和した期待値とその行き先を報告に書く
3. `docs/design-system.md` と ADR-0043 から、native dialog の例外の記述が消えている
4. `pnpm check && pnpm test` と `pnpm test:smoke` が通る

## S4.5 トースト

タイトル: トーストをダイアログの上で操作できる形にし、top layer への付け替えを無くす

優先度: Medium。依存: S4.3

説明:
ダイアログが top layer を使わなくなると、dialog 内ポータルの付け替えは要らなくなる。トーストがダイアログの上で見えて操作できる状態にする。方式は S4.1 の結果で決める（Ark の Toast に載せるか、自作の単一ホストを残して重なりと操作可否だけ直すか）。Ark に載せない場合は ADR-0043 の「載せ替える」からの逸脱になるので、理由を ADR に書き、ユーザーの承認を得る。
範囲: `Toast.tsx`、`GlobalToast.tsx`、`useToast.ts`、`toastRequestsAtom`、関連テスト、`showPopover` をモックするテスト（DlsiteEditor、DlsiteJobRuntime、ScanRuntime、usePlayer、`tests/unit/setup.ts`）。優先順位・破棄・寿命・hover と focus の一時停止・`requestKey`・`dismissOnUnmount` の規則は保つ。
対象外: `useToast` の呼び出し側19ファイル（API を変えない限り触らない）、文言・種別・見た目の変更。
注記: AC3 の位置は S4.1 で決める。S4.1 の完了時に具体の挙動へ書き直す。

受け入れ条件:
1. dialog 内ポータルの付け替え（`useTopmostOpenModalDialog` 相当）が無く、`rg "<Toast\b" client/src` が `GlobalToast.tsx` だけを指す
2. ダイアログ表示中に、トーストが最前面で、操作ボタンと閉じるが押せる（実ブラウザで確認）
3. ダイアログ表示中のトーストの位置が S4.1 で決めたとおり。再生バーの上に出る位置（`aboveDock`）と出入りの動き（reduced-motion でも opacity を止めない）が現行どおり
4. 表示の規則が現行どおり: 単一スロット、error > action > notice、選ばれなかった要求は即時破棄して `onDismiss`、error は自動消滅しない、通常5秒・action 付き10秒、hover と focus で一時停止して残り時間から再開、同じ文面の再通知は別タイマー
5. `Toast.test`・`useToast.test`・`globalErrorToast.test` が同じ保証を持ち、`showPopover` のスパイ・モックが全テストから消えている。ADR-0043 と design-system.md の Toast の記述が実装と一致している
6. `pnpm check && pnpm test` と `pnpm test:smoke` が通る

## 決めること（人の判断。ACには入れない。S4.1 の AC7 で回答を記録）

1. 層を開いたまま backdrop を押したときの規則（全層で1つ）。対象はメニュー・ポップオーバー・コンボボックス・セレクト。事実: 段階2はネイティブ dialog のガードで「層だけ閉じる」にした（529.4 で 5/5）。一方ポップオーバー外側クリックは「内側の層ごと閉じる」と529.2 で決めた。Ark の Dialog にすると既定は dialog ごと閉じる側に変わりうる（推測）。ダイアログの中のコンボボックスは、観測では backdrop で同時に閉じた。選択肢は「層だけ閉じる」「dialog ごと閉じる」。この規則は S4.2・S4.3 の AC と、段階2が ADR に書いた動作に効く
2. 確認ダイアログ（`alertdialog`）を backdrop で閉じるか。現状は閉じる。Ark の `alertdialog` の既定は閉じない（`closeOnInteractOutside: modal && !alertDialog`）
3. トーストを Ark の Toast に載せない場合の ADR-0043 からの逸脱の承認（S4.1 の結果が出てから）。私見: `GlobalToast` の優先順位と破棄の規則は Ark の queue 型と合わず、載せても `pickToastRequest` を前段に残して1件だけ流す形になり、得るものが薄い（推測）
4. 実機（Windows の IME）での確認をユーザーが行うか。対象はダイアログ内のコンボボックスで、キー記録アーティファクトを使う。CDP 合成では実機の挙動（key=Process 229）と食い違うことがある

## 衝突と待ち

- 着手の前提: TASK-529 の master マージ、TASK-530（2026-11-30 以降）。それまでに進められるのは「決めること」への回答だけ
- S4.2 と S4.3 は `WorkEditDialogTagEscape.test.tsx`・`RegisterWorkDialog.test.tsx`・`WorkEditDialog.test.tsx` を共有する。並行にしない
- S4.3 の前に、`WorkEditDialog.tsx` を触る TASK-492（編集状態をフックへ）と TASK-445（WorkEditDialog.test の不安定）の状態を確認する
- 段階4の後の単発タスク（タブ・セレクト）は `ScanModal.tsx`・`ScanSidebar.tsx`・`SmartFolderDialog.tsx` を触る。S4 が済んでから着手する
- TASK-444 は S4 の依存にしない（other-task-updates.md）
<!-- SECTION:PLAN:END -->
