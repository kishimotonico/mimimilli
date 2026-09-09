---
id: TASK-431
title: 'tsxに残るtext-[Npx]直書きを意味別トークンへ移行する'
status: Done
assignee: []
created_date: '2026-09-07 13:45'
updated_date: '2026-09-09 16:50'
labels:
  - ui
  - design-system
  - tokens
dependencies: []
priority: medium
ordinal: 452000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-428.20で意味別タイポグラフィトークン（text-body / text-secondary / text-caption / text-control / text-label / text-mono）を新設し、shell/*.cssと共有UIプリミティブ・主要フローのtsx約50箇所を移行した。各featureディレクトリに散在する残り約140箇所のarbitrary値（text-[Npx]）は、1箇所ずつ意味的な役割の判断が必要なため未移行のまま残っている。トークンと直書きの混在を解消する。

半端な値は6段トークンへ丸める（TASK-428.20と同じ方針。オーナー了承済み）。丸めによって見た目が変わる箇所は許容するが、+2px級の変化が起きる箇所は報告に列挙する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 featureディレクトリのtsxに残る text-[Npx] 直書きが意味別トークンへ移行されている
- [x] #2 移行後にリポジトリ全体で text-[Npx] のarbitrary値が残っていないことをgrepで確認できる（13px以上の見出し級で意図的に据え置く箇所があれば、その一覧と理由をdocs/design-system.mdに明記する）
- [x] #3 丸めによって2px以上サイズが変わる箇所を一覧化し、実機確認の結果を実装メモに記録する
- [x] #4 pnpm test:smokeに新規失敗がない
<!-- AC:END -->



## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## TASK-431 実装メモ（AC#3）

37ファイル・131箇所のtext-[Npx]を6段トークンへ移行した。判断方針は「値を丸める」のではなく「用途に最も近いトークンを選び、結果として何px動くかは問わない」。

### AC#3: 2px以上サイズが変わった箇所

**該当なし。** 全131箇所を1件ずつ用途判定した結果、どの箇所も選定したトークンと元のpx値の差は最大1pxだった（例: 9px→text-caption(10px)、12px→text-secondary系は使わず基本text-body(12px)のまま）。

「12px直書きだが意味的にはキャプション」に相当するような、text-caption(10px)へ2px以上寄せるべき箇所は見当たらなかった。12px直書きは全て作品タイトル・エラーメッセージ本文・メニュー項目など「本文相当」の内容で、既存のtext-body(12px)にそのまま対応した。TASK-428.20で共有UIプリミティブ側は先に移行済みのため、feature側の残りは概ね素直な用途だった。

### 実機確認

タイトなレイアウト（バッジ・ピル・小型ボタン）でサイズ変更の影響が出やすい箇所を実機で確認した（agent-browser、`431.mimi.localhost:1355`、fixtureシナリオ）。
- 通知バッジ（`NotificationBell`/`TopBar`、h-15px円形バッジ内の件数、9px→text-caption）: 崩れなし
- スキャンモーダルのサイドバータブ件数バッジ（`ScanSidebar`、10px→text-caption）: 崩れなし
- スマートフォルダー編集の`SMART`バッジ（9px→text-label）・各種フィールドラベル: 崩れなし
- 設定モーダルのタグ設定（`TagPrefixSettings`、行ラベル・「軸」「保護」チェックボックスラベル・「追加」ボタン）: 崩れなし
- スキャンの要対応タブ（テーブル・チップ）: 崩れなし

`pnpm test:smoke`の「主要画面でヨコ方向スクロールが発生しない」を含む25件が全て通過し、目視確認と合わせてレイアウト崩れは確認されなかった。

### 据え置いた13px以上（26箇所）

`docs/design-system.md`の「文字サイズトークン」節に一覧と理由を追記した（モーダル見出し14px、確認ダイアログ見出し13.5px、起動時エラー画面/セットアップ画面の見出し・アバター文字、トラックリスト見出し等13px、再生画面のトラックタイトル24px）。
<!-- SECTION:NOTES:END -->
