---
id: TASK-360
title: 再生中タブを実装する
status: Done
assignee: []
created_date: '2026-08-20 17:02'
updated_date: '2026-08-20 17:30'
labels: []
dependencies: []
ordinal: 360000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
左ナビの「再生中」プレースホルダー(client/src/app/ui/LeftNav.tsx のSURFACES、現在disabled)を有効化し、再生機能を集約した全画面級サーフェスを新設する。

実装方針:
- AppMode(client/src/shared/model/appMode.ts, 現在 library|files)に再生中サーフェスを追加し、URL・ブラウザ履歴に反映(useNavigationHistory.ts / navigationUrl.ts)
- メイン構成: カバー画像(大)+作品/トラックタイトル+シークバー+全トランスポート(±10秒/前後トラック/再生停止/ループ/L⇄R入替/音量)+ABリピート
- ABリピート: A/Bボタンで現在位置に設定する操作は維持。設定後はシークバー上にA/Bハンドルが出てドラッグで微調整可能。ハンドルは丸ではなく角括弧［］スタイルの視覚表現にし、A-B区間は色付きハイライトでループ中と一目でわかるようにする
- トラックリスト(現在の作品のプレイリスト)は折りたたみで搭載。展開でクリック切替
- 未再生時は空状態画面(「再生中の作品はありません」等)。タブは常にクリック可能。再生中バッジは既存挙動を維持
- 既存の<dialog>全画面プレイヤーは削除せずそのまま残す(存廃は後日ドッグフーディングで判断)
- シークバーは既存のuseSeekDrag.tsパターン、AB区間描画はFullScreenScrub.tsxのpct計算パターンを参考に
- 高頻度atom(playerCurrentTimeAtom等)はleafコンポーネントのみ購読の設計を維持。docs/HANDOFF.md参照
- デザインはdocs/design-system.mdに従う
- 統合ブランチ feat/player-ux 配下の作業ブランチで実施
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 左ナビの「再生中」がクリック可能になり、再生中タブへ遷移してURL・履歴に反映される
- [x] #2 再生中はカバー大・タイトル・シークバー・全トランスポート(±10秒/前後トラック/再生停止/ループ/L⇄R/音量)が表示され動作する
- [x] #3 ABリピートをA/Bボタンで設定でき、シークバー上の角括弧スタイルのハンドルをドラッグで微調整できる。A-B区間はハイライト表示される
- [x] #4 トラックリストが折りたたみで表示され、展開してクリックでトラック切替できる
- [x] #5 未再生時は空状態が表示され、タブは常にクリック可能
- [x] #6 既存の<dialog>全画面プレイヤー・バー・ポップアップの動作が維持される
- [x] #7 pnpm test:smoke が通る
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
再生中タブを新設。AppModeにnowPlayingを追加しURL(/now-playing)・履歴に統合、左ナビの「再生中」を有効化。画面はカバー大・シークバー・全トランスポート・ABリピート（角括弧ハンドルでドラッグ微調整可）・折りたたみトラックリスト・空状態で構成。全画面プレイヤーのトランスポート/AB UIをPlayerTransportControls/ABRepeatBarへ共通化。レビュー指摘のAddressBar/TopBarの2値前提も解消。check/test(824)/smoke(17)全緑、実機確認済み。feat/player-uxへff取り込み済み
<!-- SECTION:FINAL_SUMMARY:END -->
