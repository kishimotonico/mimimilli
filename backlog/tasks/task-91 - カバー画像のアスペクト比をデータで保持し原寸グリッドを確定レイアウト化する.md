---
id: TASK-91
title: カバー画像のアスペクト比をデータで保持し原寸グリッドを確定レイアウト化する
status: To Do
assignee: []
created_date: '2026-07-24 14:13'
updated_date: '2026-07-24 15:27'
labels: []
dependencies: []
priority: high
ordinal: 89000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
原寸（ジャスティファイド）グリッドは現在、カバー画像を <img onLoad> で読み込んでから naturalWidth/Height を計測し coverRatios→aspectRatio に反映する設計（CoverImg.tsx / WorkGrid.tsx / justifiedLayout.ts）。この設計は本質的に弱い: (1) 初期は全タイル aspectRatio?? 1=正方形で描画されロード後に本来比へジャンプ（レイアウトシフト）、(2) 一瞬で読み込みが終わる画像で React onLoad が取りこぼすレース（TASK-90後の実機調査で新規セッション11枚中0枚更新を確認）、(3) '?? 1' フォールバックが問題を隠蔽（AGENTS.mdの過度なフォールバック禁止に反する）。本命の解は、アスペクト比をデータ（サーバー提供）で持ち、クライアントは待たずに確定レイアウトを組むこと。サーバーは既にカバー処理で Sharp を使用（thumbnailCache.ts）しており sharp().metadata() で寸法取得は低コスト。shared の一覧DTO（work.ts の WorkListItem / WorkSummary）に寸法フィールドが無いため、そこを起点に server(スキャン/カバー処理)・shared契約・client(原寸レイアウト)を通しで見直す。onLoad依存は撤廃し、レース・レイアウトシフト・正方形フォールバックのバグクラスごと消す。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 カバー画像の実寸（またはアスペクト比）がサーバーで取得・永続化され、一覧APIのDTOに含まれる（Zod契約を更新）
- [ ] #2 クライアントの原寸グリッドが、画像ロードを待たずにサーバー提供の比率で確定レイアウトを組む（初期描画時点でレイアウトシフトが起きない）
- [ ] #3 CoverImg の onLoad ベースの寸法計測と WorkGrid の coverRatios/handleCoverLoad 依存が撤廃され、aspectRatio?? 1 のフォールバックが解消されている
- [ ] #4 既存スキャン済み作品に対する寸法のバックフィル（移行）方針が定義され、寸法欠損時の扱いが過度なフォールバックにならない形で明示されている
- [ ] #5 1:1タイルモードは影響を受けず従来通り動作する。pnpm check・pnpm test が通り、原寸グリッドのビジュアル回帰が確認されている
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Codex設計相談(2026-07-24)＋ADR-0008整合確認を反映した確定版。

## 永続化 (a)
catalog.sqlite の works に cover_width / cover_height を nullable 列で追加。「両方正の整数 or 両方NULL」制約。寸法は画像から再生成できる派生層としてADR-0008(catalog=再構築可能, L25/27)に整合。.meta.json には持たない（正本二重化・ID移行TASK-80/86への波及・meta read負荷増を避ける）。EXIF orientation 適用後の表示寸法を保存する（Sharp生metadataと表示向きの一致に注意）。

## 契約 (b)
shared/src/work.ts は aspectRatio 1値ではなく幅・高さの2値を一組で持つ。optional/既定値1は使わず必須nullable。
  cover: { image: string; dimensions: { width: number; height: number } } | null
（既存の coverImage を cover に統合する案。統合可否は実装時に周辺影響を見て判断）。比率換算は client のレイアウト境界で行う。toWorkListItem で明示投影し付与漏れを検出。

## バックフィル (c)
catalog 再構築時（スキーマ世代更新の初回フルスキャン）に全カバーを Sharp 計測して埋める。通常の増分スキャンでは「カバーfingerprint変化時」＋「寸法NULL時」のみ再計測。注意: 既存fingerprint一致の早期スキップ(TASK-86)がNULL行を素通りしないよう、寸法欠損は別経路で拾う。

## 寸法欠損・計測失敗 (d)
3状態を区別: (1)カバー無し=寸法NULL=正常・正方形プレースホルダ / (2)計測成功=実比率配置 / (3)計測失敗=画像ありだが寸法NULL=カバー資産異常。(3)は作品全体の status:error に混ぜず cover_probe_error 等の別診断状態＋スキャン結果/ログで可視化、次回スキャンで再試行。client は計測失敗画像を黙って1:1表示せず正方形プレースホルダで不整合を隠さない。justifiedLayout の異常比率クランプは防御として残すが通常データの補完には使わない。

## 分割 (e)
TASK-91 を1本の縦断タスクとして維持し、内部2段階: [1] catalog schema+Sharp計測+scanner+一覧投影+shared契約 → [2] client がサーバー寸法を使用、onLoadDimensions/coverRatios/handleCoverLoad/RAF更新を撤廃。受け入れ条件は1つに統合。旧onLoad経路は client 移行後に削除（互換併存させない）。肥大化したら配下に依存付き2タスクへ分割（server/shared先行）。

## 見落としやすいリスク
EXIF回転後の表示寸法一致 / GIF等マルチページ画像の寸法解釈 / カバー差し替え時の寸法・サムネキャッシュ・一覧キャッシュ同時無効化 / ページ追加時の末尾justified行の再編成は本対応後も残る / CoverImg のエラー状態がwork IDのみ紐付けで同一IDのURL変更時に残留しないか。
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
設計確定(2026-07-24, ユーザー決定+Codexレビュー反映)。

## 契約(b)
API DTOは cover: { image: string; dimensions: { width:number; height:number } } | null に統合。dimensions は必須(optional/nullable禁止)、cover自体は必須nullable。.meta.json は coverImage のまま据え置き、正本に派生値を入れない。切る後方互換は client/server 間の旧DTOのみ(ユーザーの既存.meta.jsonは非対象)。編集画面が元の設定値を要る場合、公開表示用 cover と編集用設定値を分ける。単位pxを型名/コメントで明示。

## 計測失敗(d, ユーザー決定=明示的な未知)
cover:null は「表示可能なカバーが無い」を意味(未設定とは別だが同一null投影。情報/編集画面で『なし』誤表示しない配慮)。0/1で埋めない。失敗は ScanResult に coverErrors 件数として載せる(既存 errors とは別)。DLsite適用時の計測失敗はそのAPI操作を失敗として返す。計測失敗画像はUIで正方形プレースホルダ、次回スキャンで再試行。cover===null の1:1はフォールバックでなくプレースホルダ仕様として明示。

## EXIF/画像向き
サムネ生成(thumbnailCache.ts)にSharp自動回転を明示し、保存する cover_width/height を回転後の表示寸法に一致させる。配信WebPのピクセル方向・幅指定なし原画像返却・保存寸法を同一規則に。orientation 5-8のテスト画像で寸法一致テスト。GIF等マルチページは先頭ページの表示寸法(合成高さを誤保存しない)。

## 再計測トリガ/スキップ
カバー専用fingerprintは無い。fingerprint不一致で再登録する作品はカバーも毎回再計測(Sharp metadataは軽い)。ScanWorkStateにカバー有無・寸法充足を持たせ、skip許可は『メタ無カバー&DB無カバー』or『メタ有カバー&DB両正寸法』のみ。prepareMetaEntriesの早期skipより前に欠損を判定する。

## カバー書き換え全経路(寸法と同一更新単位)
scanner / dlsiteApply / runDlsiteBulk / WorkRepo.patchWork / fixture / catalog再構築 / 自動生成作品の初回登録。計測はDBトランザクション外で先に実行し、成功した{image,dimensions}を1回のDB更新に渡す。計測失敗時に既存カバーを残すか利用不能にするかを明示。

## DB
works に cover_width/cover_height nullable列 + CHECK制約(両NULL、または両方 typeof=integer かつ >0)。catalog schema version更新・生成migration・空DBの実スキーマ検証も作業範囲。

## client移行範囲(WorkGridより広い)
行表示/プレビュー/プレイヤー/MediaSession artwork/DLsite編集/fixture/各種テスト。hasCover={!!coverImage} 判定、情報画面の有無、DLsite一括の既カバー判定を cover 基準へ。CoverImg の errored リセット条件に cover.image(世代)を含め、同一IDのカバー差替後も復帰できるように。

## 投影箇所(toWorkListItemだけでは不足)
WorkSummary/WorkListItem/Work/toWorkListItem/rowToSummary/rowToWork/listSummaries/queryWorks の直接SELECT投影/fixture一覧投影/APIキー固定テスト。real SQL経路との契約同値テスト必須。
<!-- SECTION:NOTES:END -->
