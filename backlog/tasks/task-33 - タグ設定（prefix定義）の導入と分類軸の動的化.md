---
id: TASK-33
title: タグ設定（prefix定義）の導入と分類軸の動的化
status: To Do
assignee: []
created_date: '2026-07-10 16:07'
updated_date: '2026-07-10 19:37'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
タグの特別扱い（軸表示・保護・ラベル・色）をユーザー編集可能な「prefix定義」設定に一元化し、分類軸のハードコードenumを廃止する。ADR-0005（docs/adr/0005-tags-as-sole-attribute.md）の実現。サブタスクに分割済み。

## 決定済み事項（2026-07-11）
- 保存場所: DB（SQLite）。スマートフォルダーと同じ置き場で一貫させる
- 未登録prefix: 明示登録制。軸に出るのは登録済みprefixのみ。設定UIがデータ中の未登録prefixを候補としてサジェストする
- 軸ID: enumを廃止し、prefix文字列そのものを軸IDにする。予約ID（all/recent/added/fav/unplayed/missing/tag/year、smart-*）はprefix登録時に拒否する
- year（追加日）はタグ由来でない組み込み軸として維持し、ドリル絞り込みをaddedAt照合に修正する（現行はタグ照合で常に0件になる不整合）
- 正規化: prefixは保存時に小文字へ、値はtrim。絞り込みは完全一致へ変更
- 保護: protectedなprefixに属するタグの削除時は確認ダイアログ。編集不能は廃止
- 初期seed: cv（CV・軸ON・保護）、サークル（軸ON・保護）、シリーズ・カテゴリ（軸ON）、genre（ジャンル・軸OFF）。seed済みフラグをapp_settingsに置き、ユーザーが全削除しても再seedしない

## 関連
- docs/adr/0005-tags-as-sole-attribute.md
- DRAFT-9（削除タグの復活防止）、DRAFT-10（タグ単位の選択適用）、DRAFT-12（genre/流入の受け皿として本タスクが先行）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 サブタスク（契約・コア / サーバー / クライアント）がすべて完了している
- [ ] #2 pnpm check と pnpm test が通る
<!-- AC:END -->
