---
id: TASK-517
title: ライブラリのスマートフォルダーを単純にする（TASK-516 レビューの整理）
status: Done
assignee: []
created_date: '2026-11-23 12:47'
updated_date: '2026-11-23 21:30'
labels:
  - library
  - refactor
dependencies: []
documentation:
  - docs/adr/0040-smart-folder-condition-tree.md
  - docs/adr/0041-library-sidebar-shell-navigation.md
priority: high
ordinal: 623000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-516（ADR-0040〜0042）のレビュー（2026-11-23、設計: Fable、ナビゲーション・server・テスト・規約: Opus/Sonnet）で、1人利用のアプリには要らない仕組みと、仕様で拾いすぎた周辺の複雑さが見つかった。中核（条件の木、adapter の口3つ、buildEffectiveCondition、resolveLibraryView、純粋な遷移関数）は変えずに、周辺を単純にし、見つかったバグと語彙のずれを直す。

ユーザーの決定（2026-11-23）:
- 既定のスマートフォルダーの権限は2段にする。特別なのは「すべて」だけで、ほかは自作と同じに扱う
- 値一覧でもチップと検索語を効かせる。操作感はまず実装して確かめ、気になったら戻す
- 0件の「エラー」は隠さず常に出す（「すべて」に擬似タグで内包する案は DRAFT として別に残す）
- 画面には総称「スマートフォルダー」を出さない。トースト・エラー文言も行の名前と動詞で書く

統合ブランチ feat/library-simplify に子タスクを番号順に積む。ある程度進んだ時点で、課題と方針を Fable のサブエージェントに見てもらう。レビューの全文はこのタスクの実装メモに要点を残す。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 子タスクがすべて完了している
- [x] #2 pnpm test:smoke を含めて pnpm check・pnpm test が通る
- [x] #3 ADR-0040・0041・0008・0031、docs/requirements-v4.md、docs/design-system.md、docs/ARCHITECTURE.md、docs/HANDOFF.md が実装に合っている
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-11-23 起票（統括）:
- 進め方: 517.1（ADR）→ 517.2・517.3（API・データ）→ 517.4 → 517.5 → 517.6（517.5 と同じ遷移関数を触るので後）→ 517.7。
- Fable の中間レビュー: 517.4 まで積んだ時点で、残りの課題と方針（517.5・517.6 の設計を含む）を Fable のサブエージェントに見てもらう。ユーザーの依頼。
- レビューの出どころ（2026-11-23、TASK-516 の master マージ後）: 設計 Fable（important 10・nit 8）、ナビゲーション Opus（important 3・nit 5）、server Sonnet（nit 3・疑い1）、テスト Sonnet（期待値の緩和なし、穴2）、規約 Opus（important 2・nit 7）。採ったものは子タスクに振り分け済み。
- 採らないもの: 「『すべて』と同じ」並びの継承（意図した機能）、画面から作れない述語（hasPrefix・duration・played.withinDays）の削除（条件を組む画面で使う）、hasPrefix の空 prefix（書き込みで弾かれる）。
- エラーを「すべて」へ内包する案は DRAFT-85。

2026-11-23 Fable のレビュー（ADR とタスク分け）を受けて組み替えた。517.2 を「更新と作成の口」と 517.8（件数と値一覧の口）に、517.6 を「層と履歴同期」と 517.9（保存後の入り直しと補正）に分けた。順序は 517.1 → 517.3 → 517.2 → 517.8 → 517.4 → 517.5 →（ユーザーの操作感の確認）→ 517.6 → 517.9 → 517.7。規約レビューの ClassificationAdapter の分割とテストの独立した期待値は 517.8 に入れた。517.5・517.6・517.9 の実装担当への注意点は Fable のレビュー（統括の scratchpad の review-517-plan.md の4節）を委譲の指示書に写す。

2026-11-23 Fable の中間レビュー（517.4 まで）: API とデータの形は狙いどおり単純になった。important は空になったテスト1件。指摘と、調査担当のテスト重複・ADR 突き合わせの報告を 517.10 にまとめ、517.5 の前に入れる。517.9 の AC5 を編集フックの関数1本に寄せる形に書き換えた。実装担当への注意点の更新版とオーナーの操作感の確認手順は review-517-mid.md の4・5節。

2026-11-24 統括: 子タスク 517.1〜517.13 完了。Fable の中間・最終レビュー、Codex（mimi2）のレビューと再確認2回を通過。TASK-518 を master に入れたあと統合ブランチを rebase し、pnpm check・pnpm test・フル smoke 2回を通して master へ --no-ff マージ（7901635a）。master のあとに回すものは TASK-521（文言の表記）と TASK-522（smoke の重複）。DRAFT-84・85 はブロックなし。
<!-- SECTION:NOTES:END -->
