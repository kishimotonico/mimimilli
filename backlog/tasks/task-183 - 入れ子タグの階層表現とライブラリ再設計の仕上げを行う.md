---
id: TASK-183
title: 入れ子タグの階層表現とライブラリ再設計の仕上げを行う
status: To Do
assignee: []
created_date: '2026-08-03 14:46'
labels: []
dependencies:
  - TASK-182
priority: medium
ordinal: 193000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ADR-0012 / DRAFT-50 のフェーズ4。

1. 入れ子タグの階層表現
- スラッシュを複数含むタグ（例: シチュ/学園/図書室）を、値一覧とオーバーレイでインデント＋葉ラベルの階層として表現する
- チップは常にフルパスを表示する
- 中間ノード（例: シチュ/学園）自体がタグとして存在しない場合も見出しとして表示し、選択不可の見出しか、配下を全て含む選択かを実装で明示する（統括判断: 中間ノードは選択不可の見出しとする。配下を含む絞り込みは完全一致セマンティクス ADR-0005 §6 と衝突するため作らない）
- 深さは3階層を超えても破綻しないこと

2. 仕上げ
- 再設計で不要になったコード・CSS・localStorage キーの掃除（gridInspectorOpenAtom の残骸、.mle-col.is-content 系 CSS、libraryPresentation の未使用エクスポート等）
- ビジュアルテスト client/tests/visual/library.spec.ts を新レイアウトに合わせて更新し、値一覧（grid/list）とチップ複合絞り込みのケースを追加する
- docs/design-system.md にチップ列・値一覧行・オーバーレイの規約を追記する
- DRAFT-50 の完了に伴い、正典モックの削除は人間の判断に委ねる（自動では消さない）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 シチュ/学園/図書室 のような3階層タグが値一覧でインデント＋葉ラベルとして表示される
- [ ] #2 チップにはフルパスが表示される
- [ ] #3 タグとして存在しない中間ノードが選択不可の見出しとして表示され、クリックしても絞り込みが変化しない
- [ ] #4 4階層以上のタグでもレイアウトが破綻しない
- [ ] #5 ContentColumn 由来の未使用 CSS クラスと未使用 atom・エクスポートがリポジトリに残っていない
- [ ] #6 ビジュアルテストに値一覧 grid・値一覧 list・チップ複合絞り込みのケースが追加され、全スナップショットが更新されて通る
- [ ] #7 docs/design-system.md にチップ列・値一覧行・オーバーレイの規約が記載されている
- [ ] #8 pnpm check と pnpm test が通る
<!-- AC:END -->
