---
id: DRAFT-69
title: タグクリック遷移の残り経路（情報ダイアログ・一覧へのタグ表示）
status: Draft
assignee: []
created_date: '2026-08-18 23:13'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
DRAFT-45 の本文を現状に合わせて書き直したもの（2026-08-19の棚卸し）。「全域展開」というタイトルだったが、主要経路はすでに配線済みで残っているのは周辺だけ。

## 位置づけ

UX総点検 doc-4（2026-07-31）の「詳細パネルに関連作品導線」案をユーザー判断で置き換えたもの。販売サイト的な「関連作品」レコメンドはこのアプリの性質（所有ライブラリの整理・再生）に合わず不要。代わりにタグを作品間ナビゲーションの背骨として位置づけ、同じCV/サークル/ジャンルの他作品はタグクリックでタグ軸に辿り着ける形を正とする。

## 配線済み（2026-08-19 再確認）

- リストモードの詳細パネル（PreviewPane → WorkDetail）: タグチップクリックで `/library/tag?tags=...` へ遷移する（`LibraryView.tsx:163` の `handleTagClick` → `onTagClick`）
- グリッドモードのインスペクタ（WorkGridInspector → WorkDetail）: 同様に配線済み
- `entities/work/ui/Tag.tsx` を使っているのは WorkTagEditor のみで、詳細パネルのタグチップはここに集約されている
- ADR-0013 で作品詳細のタグクリックは完全置換と規定済み

## 残っている経路

- 作品の情報ダイアログ（`WorkInfoDialog.tsx:86`）: タグが `work.tags.join(", ")` の静止テキストで、クリック不可
- リスト行・グリッドタイル（WorkGrid / ContentColumn）: タイトルのみでタグを表示していない

## 対象外

- 作品編集ダイアログ（WorkEditDialog、expanded=true）: 編集モードなので意図的に遷移させていない。削除ボタンのみで正
- DLsite連携編集（DlsiteEditor）: 取り込み候補タグのチェックボックス。ナビゲーション用途ではない

## 決めること

WorkInfoDialog のタグを遷移対象にするだけなら小タスクで足りる。リスト行・グリッドタイルへのタグ表示は情報密度とレイアウトへの影響が大きいので、やるかどうかを先に決める。
<!-- SECTION:DESCRIPTION:END -->
