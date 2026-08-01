---
id: DRAFT-45
title: タグクリック遷移の全域展開（タグを作品間ナビゲーションの背骨にする）
status: Draft
assignee: []
created_date: '2026-08-01 16:54'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
出典: UX総点検 doc-4（2026-07-31）の「詳細パネルに関連作品導線」案をユーザー判断で置き換え。販売サイト的な「関連作品」レコメンドはこのアプリの性質（所有ライブラリの整理・再生）に合わず不要。代わりに、タグを作品間ナビゲーションの背骨として位置づけ、同じCV/サークル/ジャンルの他作品はタグクリックでタグ軸に辿り着ける形を正とする方向。

現状の配線確認（agent-browser + rg裏取り、2026-08-02時点）:
- entities/work/ui/Tag.tsx を実際に使っているのはWorkTagEditorのみで、詳細パネルのタグチップはここに集約されている
- リストモードの詳細パネル（PreviewPane→WorkDetail）: タグチップクリックで /library/tag?tags=... へ遷移する。配線済み（onTagClick=handleTagClick、Tag.tsxがボタンとしてレンダリング）
- グリッドモードのインスペクタ（WorkGridInspector→WorkDetail）: 同様に配線済みで、クリックでタグ軸へ遷移する
- 作品編集ダイアログ（WorkEditDialog、expanded=true）: タグチップはクリック不可（削除ボタンのみ）。編集モードなので意図的に遷移させていない
- 作品の情報ダイアログ（WorkInfoDialog）: タグはカンマ区切りの静止テキストとして表示されるのみで、クリック不可
- DLsite連携編集（DlsiteEditor）: 取り込み候補タグをチェックボックスで表示。ナビゲーション用途ではないため対象外
- リスト行・グリッドタイル自体（WorkGrid/ContentColumnの一覧表示）: タイトルのみでタグは表示されない

検討ポイント: 作品の情報ダイアログのタグも遷移対象にすべきか、リスト行やグリッドタイルにタグを表示する余地はあるか、といった適用範囲の判断が必要。着手前に要件を決めるタスクを切ること。
<!-- SECTION:DESCRIPTION:END -->
