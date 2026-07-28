---
id: TASK-109.6
title: 購読退行テストが本物のAppを対象にしていない問題を修正する
status: Done
assignee: []
created_date: '2026-07-28 13:03'
updated_date: '2026-07-28 13:56'
labels: []
dependencies: []
parent_task_id: TASK-109
priority: medium
ordinal: 129000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-109.3 / 109.4 で追加した購読退行テスト（appNotificationSubscriptions.test.tsx / appPlayerSubscriptions.test.tsx）は、実際の App ではなく購読を持たないよう手書きした AppLikeRoot を描画している。そのため将来 App 本体に購読が再導入されてもテストは通ってしまい、防ぎたい退行を検出できない。

Codex のレビューで指摘された（appNotificationSubscriptions.test.tsx:92-93）。確認したところ appPlayerSubscriptions.test.tsx も同じ形で、同根の問題が2コミットに入っている。

「わざと旧実装に戻して失敗を見る」確認は手書きルートに対しては効くが、本物の App が購読を復活させた場合は素通りする。

方針:
- 本物の App を描画して購読の有無を検証する形にする。App は多数の Provider とクエリを必要とするため、モックの整備が必要になる見込み
- 本物の App の描画が現実的でない場合は、App の購読有無を直接検証できる別の方法を検討する（ただし import の有無を見るような壊れやすい静的チェックは避ける）
- どちらの場合も、わざと App に購読を戻して実際に失敗することを確認する
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 購読退行テストが本物の App（またはそれと等価な購読実体）を対象にしている
- [x] #2 App に購読を戻すと実際にテストが失敗することを確認済み
- [x] #3 109.3 と 109.4 の両方のテストが対象になっている
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Codex のセカンドオピニオンに基づく設計:

1. 実物の App を描画し、AppShell をモックして観測境界にする。モックは呼び出し回数を記録して null を返す
   - App が再描画されれば slot 要素を作り直すため、モック AppShell が必ず呼ばれる
   - 子だけの再描画では AppShell は呼ばれない
   - AppShell が null を返すことで PlayerRuntime（Audio）・NavigationHistorySync（history/sessionStorage）・LibraryView（多数のクエリ）がマウントされず、重いモックが不要になる
2. App 自身が呼ぶものだけ境界でスタブする
   - useScanJob: 安定した idle 状態
   - useDlsiteBulk: 安定した inactive 状態
   - settings / scan last / library total は QueryClient のキャッシュへ事前投入し staleTime: Infinity・retry: false
   - Provider は QueryClientProvider / Jotai テスト用 store / PlayerRuntimeProvider
3. 状態更新は購読関係だけを見る。player は playerCoreAtom を直接更新、通知は QueryClient のキャッシュを直接更新する
4. 回数は固定値で検証せず、初期化完了後の基準値から増えないことを確認する。陽性側も「増える」で十分
5. 既存の AppLikeRoot ベースのテストは削除する（実物の App との結び付きを保証しないため継続的価値がない）
6. わざと App に購読を戻して実際に失敗することを確認する

スコープ外（必要なら別タスク）: player の action API と state API をモジュール分割し、App から state API を import しないよう ESLint で縛る案
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
AppShell を vi.mock で差し替えて呼び出し回数を数える観測境界にし、実物の App を描画する形にした。AppShell が null を返すことで PlayerRuntime（Audio）・NavigationHistorySync（history/sessionStorage）・LibraryView などがマウントされず、重いモックが不要になっている。

App 自身が呼ぶものだけ境界でスタブ: useScanJob（idle）、useDlsiteBulk（inactive）、settings / scan last / library total / notification summary は QueryClient のキャッシュへ事前投入し staleTime: Infinity・retry: false。

旧 appPlayerSubscriptions.test.tsx（5件）と appNotificationSubscriptions.test.tsx（3件）は削除。手書きの AppLikeRoot ベースで実物の App との結び付きがなく、退行を検出できないため。

検出力の確認:
- App.tsx に usePlayerState() と useDlsiteNotificationSummary() を一時的に戻し、戻り値を hidden の span に渡して実行 → 負の対照4件すべてが expected 2 to be 1 等で失敗
- 陽性対照は store.set を App に渡していない別ストアに差し替えて破壊 → expected 1 to be greater than 1 で陽性対照だけが失敗（負の対照は通ったままで、空振りが起きる状況を再現）

陽性対照を足した理由: 負の対照だけだと、Provider 構成が変わって store や queryClient が App の使うものと別物になった場合に、state 更新が空振りしてテストが通ってしまう。App が実際に購読している appModeAtom を更新して再レンダリングされることを見ることで、ストア配線・モックの計数・購読検知の経路全体が生きていることを保証する。

責務の分担: App の非購読は appRootSubscriptions.test.tsx、leaf の正しい購読は notificationBell.test.ts と usePlayer.test.ts。

検証: pnpm check 通過、pnpm test 通過（server 340 / client 319）。client/src は無変更
<!-- SECTION:NOTES:END -->
