---
id: TASK-361
title: 作品詳細の全画面表示と再生中タブとの相互導線を追加する
status: Done
assignee: []
created_date: '2026-08-20 17:02'
updated_date: '2026-08-20 17:55'
labels: []
dependencies:
  - TASK-360
ordinal: 361000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
作品詳細右ペイン(client/src/features/library/ui/PreviewPane.tsx → WorkDetail.tsx)はスライドインのまま維持しつつ、「全画面へ展開」ボタンで詳細専用の全幅画面へ遷移できるようにする。あわせて再生中タブ(TASK-360)との双方向導線を追加する。

実装方針:
- 右ペインに「全画面へ展開」ボタンを追加。全幅の作品詳細画面へ遷移し、URL・ブラウザ履歴に反映(useNavigationHistory.ts / navigationUrl.ts)
- 全画面詳細では既存の編集機能一式(WorkEditDialog / WorkTagEditor / DlsiteEditor / WorkMetadataActions 等)を広い画面向けに再配置・改善する
- 相互導線: 再生中タブに「この作品の詳細」ボタン、再生中の作品の詳細画面に「再生画面へ」ボタンを置き双方向で行き来できるようにする
- 右ペインの既存動作(スライドイン・閉じる・URL同期)は維持
- デザインはdocs/design-system.mdに従う
- 統合ブランチ feat/player-ux 配下の作業ブランチで実施。TASK-360の完了後に着手する
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 右ペインに「全画面へ展開」ボタンがあり、全幅の作品詳細画面へ遷移してURL・履歴に反映される
- [x] #2 全画面詳細で既存の編集機能一式(タグ編集・DLsite情報等)が利用できる
- [x] #3 再生中タブに「この作品の詳細」ボタンがあり、その作品の全画面詳細へ遷移する
- [x] #4 再生中の作品の詳細画面に「再生画面へ」ボタンがあり、再生中タブへ遷移する
- [x] #5 右ペインのスライドイン・閉じる等の既存動作が維持される
- [x] #6 pnpm test:smoke が通る
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
作品詳細の全画面表示を追加。appMode workDetail(URL /work/:id)を新設し、右ペインのWorkDetailをlayout propで再利用（編集機能は完全共有）。右ペインに「全画面へ展開」、再生中の作品の詳細に「再生画面へ」、再生中タブの詳細ボタンを全画面詳細へ差し替えて双方向導線を実現。選択状態を保持したまま戻るで右ペイン復帰。404はlibraryへ自動遷移。unit2件・smoke1件追加、check/test(1497)/smoke(18)全緑、実機確認済み。feat/player-uxへff取り込み済み
<!-- SECTION:FINAL_SUMMARY:END -->
