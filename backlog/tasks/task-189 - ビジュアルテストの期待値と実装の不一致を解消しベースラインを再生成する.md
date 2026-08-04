---
id: TASK-189
title: ビジュアルテストの期待値と実装の不一致を解消しベースラインを再生成する
status: To Do
assignee: []
created_date: '2026-08-04 13:42'
updated_date: '2026-08-04 13:42'
labels: []
dependencies:
  - TASK-183
  - TASK-188
priority: medium
ordinal: 199000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ビジュアルテストの起点調査（2026-08-04）で判明した、再設計とは無関係の既存障害をまとめて解消する。ライブラリ再設計のリグレッション（TASK-188）とは別件。

## 1. テストの期待値が実装と食い違っている（再設計前から失敗）

- work detail panel - resume playback: テストは「続きから 3:21」という名前のボタンを探すが、WorkPlayButton.tsx の aria-label は「続きから再生」で、時刻は title 属性にしかない。そういう名前のボタンは存在しない設計
- work detail panel - tag editing: テストはタグ削除の×ボタンが常設されている前提だが、WorkTagEditor.tsx は「誤操作防止のため既定非表示、編集モード時のみ表示」という仕様（コード内コメントに明記）

どちらも実装側が正しく、テストの想定が古い。実装の仕様を確認したうえでテストを実装に合わせる。仕様自体を見直すべきと判断した場合はその旨を報告すること。

なお再設計前はクリック手前で strict mode 違反（AxisLanding と DiscoveryDashboard が同名タイトルを二重描画）により失敗しており、この不一致は隠れていた。再設計で AxisLanding が消えて初めて表面化した。

## 2. スナップショットのベースラインが古い

- library shell: 8779fb5 時点で既に比率0.30（画像の30%）の差。カバー色が丸ごと違う。TASK-179/180 で一度更新されたが、TASK-181 以降の値一覧の絞り込み検索ボックス追加などで再びずれている
- work detail panel - missing file: 8779fb5 から一度も更新されず一貫して失敗

ライブラリ再設計が全タスク完了した時点でレイアウトが確定するので、そのあとに全スナップショットを再生成する。

## 3. 再発防止

ベースラインが長期間ずれたまま放置されると、ビジュアルテストが常に赤い状態になって新しいリグレッションを検知できなくなる。実際、今回 TASK-188 のクラッシュは scan result dialog の失敗として現れていたが、他が赤いために埋もれていた。CI や運用でこれを防ぐ方針も検討して記録すること（TASK-108 のフォント依存解消と関連）。

依存: TASK-183（再設計の仕上げ）と TASK-188（クラッシュ修正）の完了後に着手する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 resume playback のテストが WorkPlayButton の実際のアクセシブル名に合わせて修正され、通る
- [ ] #2 tag editing のテストが WorkTagEditor の編集モード仕様に合わせて修正され、通る
- [ ] #3 全スナップショットが現在のUIで再生成され、pnpm test:visual が6件すべて通る
- [ ] #4 ベースラインのずれを放置しないための運用方針が docs に記録されている
<!-- AC:END -->
