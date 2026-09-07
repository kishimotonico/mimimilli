---
id: TASK-430
title: プレイヤー展開ポップアップとグリッド末尾の重なりの根本対応
status: To Do
assignee: []
created_date: '2026-08-01 16:46'
updated_date: '2026-09-07 20:52'
labels:
  - ui
  - layout
  - player
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
プレイヤー展開ポップアップとライブラリ末尾の操作領域が重なり、スマートフォルダーの条件編集やグリッド末尾を操作できない。固定marginの追加ではなく、docked bar・popup・previewを含む実占有領域からスクロール余白を算出する。

前提（統合済みの変更、重要）: TASK-428.9 が結果面のバナー（resultsBanner）を .mll-results の外（.mll-resultspane の通常フロー、チップ列と同じ場所）へ移す構造修正を実施済み。WorkGrid.tsx / WorkListPane.tsx から resultsBanner props は削除され、描画は LibraryView 側の1箇所に集約されている。frame-c.css のコメントも更新済み。受け入れ条件 #1「スマートフォルダーの条件編集と結果バナーがpopupまたはpreviewに覆われない」のうち、プレビューによる被りは既に解消されている可能性が高いので、着手前に現状を確認すること。

TASK-428.13 が features/player 配下へ data-player-control 属性を付与済み（詳細は TASK-428.16 の本文を参照）。属性を消したり付け替えたりしないこと。

TASK-428.24 が WorkGrid.tsx / WorkListPane.tsx に0件空状態の分岐を追加済み（追加props 3つはすべて optional・デフォルト値あり）。TASK-428.12 が一覧のキーボード操作を共通化する予定なので、着手時点の状態を確認すること。

TASK-428.18 が Files のプレビューにドラッグリサイズ（filesPreviewWidthAtom、localStorage永続化、320〜720pxクランプ）と狭幅時の全幅切替（container query、720px以下）を実装済み。Files 側のレイアウトは一覧カラムが flex:1 の主役、プレビューが確定幅を持つ側という主従になっている。ライブラリ側の余白算出を設計する際、Files 側と考え方を揃えるかどうかを判断すること。

対象所見: DRAFT-43（グリッド末尾との重なり）に加え、player-A-11（ポップアップ初期位置が作品詳細の右ペインを覆い、トラック表 01〜04 をほぼ全て隠す。実測 popup x=1088-1424 / y=330-876、右ペイン x=1021-1440。ビューポート高600pxでは上端がトップバーの通知・設定ボタンに掛かる）を同じ根本対応で解消する。監査の提案は has-docked-bar と同様に、popup 展開中は実寸（ResizeObserver で更新する CSS 変数）＋24px を結果面と右ペイン本文の padding-bottom に充てる、ドラッグで初期位置から動かされているときは余白を付けない、低い viewport では max-height でトップバー領域に入らないようクランプする、というもの。採否は設計判断に委ねるが、右ペインが覆われる問題は本タスクで解消すること。

前提の追加（TASK-428.16 統合済み）: features/player 配下が広く変更されている。PlaybackRatePicker.tsx を新設して速度ピルを PopupContent・PlayerTransportControls・NowPlayingImmersiveMiniControls で共用、PopupContent は速度メニューを開いている間だけ±10秒ボタンを隠す条件表示（onOpenChange 経由）を持つ、PlaybackErrorNotice に再試行・閉じるを追加、前後トラックの境界 disabled を4面で統一、TopBar のパルスを playerStatusAtom による playing 限定に変更。player-popup.css / player-dock.css も変更されている。ポップアップの寸法や配置に手を入れる際は、速度メニュー（.mle-ratepick__pop、上方向に展開）と±10秒ボタンの位置関係を壊さないこと。

受け入れ条件の分離（2026-09-07、オーナー決定）: 当初の AC#2 後半「800〜1000pxでは一覧最低幅または全幅overlayへ切り替わる」は TASK-438 へ分離した。狭幅での一覧・プレビューの切り替えはライブラリ2ペイン構成の設計要件であり、popup の重なり解消とは独立した関心事のため。本タスクは 1280・1440・1920px での余白の過不足のみを見る。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 スマートフォルダーの条件編集と結果バナーがpopupまたはpreviewに覆われない
- [ ] #2 popupのdrag後もviewport外やtopbar上に操作不能な状態で残らない
- [ ] #3 pnpm test:smokeに新規失敗がない
- [ ] #4 プレイヤーpopup展開時もグリッド・リスト末尾の作品と操作へスクロールして到達できる
- [ ] #5 作品詳細の右ペインのトラック表と操作が、プレイヤーpopup展開時も初期位置のままで操作できる
- [ ] #6 1280・1440・1920pxで余白が過不足ない
<!-- AC:END -->
