---
id: TASK-365
title: 再生中タブのレイアウト・視認性の不具合を修正する
status: Done
assignee: []
created_date: '2026-08-21 05:07'
updated_date: '2026-08-21 05:28'
labels: []
dependencies: []
ordinal: 365000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ドッグフーディングと実機検証（スクショ・実測済み）で見つかった再生中タブの表示問題をまとめて修正する。

修正内容（すべて確定仕様）:
1. 通常モードの幅バグ: .mle-nowplaying（client/src/styles/shell/player-a.css:614-621）にwidth指定が欠落し、flexのshrink-to-fitで1600px画面でも本文が実測733pxしか取れず、カバー・トラックリストが左に寄り右がスカスカになる。width:100%相当を指定して本文をシークバー（fixed・calc(100vw - 96px)）と同じ幅基準に揃える。検証時にwidth:100%仮当てで正常化することを確認済み
2. 通常モードのコントロール1行統合: .mle-nowplaying__controls（player-a.css:659-672）のflex-direction:columnによる「トランスポート行＋ABリピート行」の2行構成をやめ、1行に統合する。トランスポート（PlayerTransportControls）を中央、AB操作（ABRepeatBar: A/Bボタン・クリア・状態表示）を同じ行の右端に配置
3. 没入モードのカバー全画面感: 現状containで画面面積の27%しか占めない（縦長カバー×横長画面の構造問題。padding全撤去でも43%が上限）。containを基準にscale 1.3〜1.4程度へ拡大し、はみ出しは親のoverflow:hiddenで軽くクロップする方式に変更（.mle-nowplaying__immersive-cover, player-a.css:789-797）。あわせて環境光背景を強化: blurを弱め（60px→24px目安）、スクリムを薄く（0.42→0.2前後）。倍率・値は実機で微調整可
4. 没入モードのシークバー: 背景ピル（.mle-nowplaying__seek の background/backdrop-filter）を廃止し、シークバーと時刻表示だけにする。視認性対応として (a)進捗fillを bg-ink-0 からアクセント色（--acc）へ変更（NowPlayingScrub.tsx:98-112。ABハイライトbg-acc-softとの区別が付くよう濃度差を確認） (b)トラック地は暗背景で見える半透明白系へ (c)時刻テキストは白系＋軽いtext-shadow。通常モードの配色（ink-0進捗）は変更しない。時刻のはみ出し（現状padding 0 4pxで角丸カーブの外に出る）は器の廃止に伴いレイアウトを整理して解消する
5. 没入モードのタイトル重なり: .mle-nowplaying__immersive-title（player-a.css:832-847, bottom:96px）とシークバー（bottom:112px・高さ62px）が33px重なっている。タイトルのbottomをシーク実位置基準の計算に直して重なりを解消

注意:
- モード切替でシークバーが再マウント・寸法変化・位置変化しない設計（単一コンポーネント・同一スロット）は維持。getBoundingClientRect不変のテストが既にあるので壊さない
- 没入の無操作フェード・Esc規則・中央クリック再生は既存仕様のまま
- ダークテーマは存在しない（単一テーマ前提でよい）
- ブランチ task/365-now-playing-polish をmasterから切り、.worktrees/task-365 で作業。完了後masterへ--no-ffマージ
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 1600px画面で通常モードの本文（カバー・トラックリスト）が画面幅いっぱいに広がり、左寄り・右スカスカが解消している
- [x] #2 通常モードのトランスポートとAB操作が1行（中央＋右端）に統合されている
- [x] #3 没入モードでカバーが画面の大部分を覆い（拡大＋軽クロップ）、環境光背景が強化されている
- [x] #4 没入モードのシークバーが器なしで、進捗がアクセント色になり、暗いカバーでも進捗・時刻が視認できる
- [x] #5 時刻表示のはみ出しと、没入モードのタイトル・シークバーの重なりが解消している
- [x] #6 モード切替でシーク行が同一DOMノード・同一位置のままである既存テストが引き続き通る
- [x] #7 pnpm check && pnpm test と pnpm test:smoke が全緑
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
ドッグフーディング指摘5件を修正。通常モード: width欠落による左寄りバグ修正・コントロール1行統合（トランスポート中央＋AB右端）。没入モード: カバーscale(1.35)＋クロップで画面占有27%→49%・環境光強化、シークバー器なし化＋進捗アクセント色＋時刻の白系シャドウで暗背景の視認性確保、時刻はみ出しとタイトル重なり解消。レビュー指摘のsmokeトートロジー化も機構検証へ強化（陰性対照確認済み）。check/test/smoke(22)全緑、masterへ--no-ffマージ済み
<!-- SECTION:FINAL_SUMMARY:END -->
