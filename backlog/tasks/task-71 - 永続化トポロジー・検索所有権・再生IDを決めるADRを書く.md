---
id: TASK-71
title: 永続化トポロジー・検索所有権・再生IDを決めるADRを書く
status: To Do
assignee: []
created_date: '2026-07-19 04:07'
labels: []
dependencies:
  - TASK-70
ordinal: 68000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
DRAFT-27（DB分離）とDRAFT-25（検索SQL化）とresume v2（DRAFT-26のDB依存部分）は、bookmarked/lastPlayedAtの置き場と検索・ソート・ページングの所有権で絡み合うため、1つのADRで合同決定する（優先順位レビュー2026-07-19の指摘）。スパイク（配布制約）の結果を前提に書くこと。

決めること:
- 全テーブル・全列の「再構築可能（catalog）/永続（user）/派生キャッシュ」分類
- catalog/user DBの物理構成と接続方式（ATTACH JOIN / 投影同期 / 合成 / 単一DBでcatalogテーブルのみ再構築、のいずれか）
- bookmark・lastPlayed・resumeを含む検索・ソート・ページングの実装方式（DRAFT-25のSQL移行との整合）
- Work/Playlist/Trackの識別子: playlistId/trackIdの採番規則と.meta.json書き換え移行の方針（バックアップ+再実行可能な移行。既存metaの一括書き換えは最重要のユーザーデータ変更として扱う）
- resume v2契約は {playlistId, trackId, offsetSec} + ID解決失敗=無効、まで。CAS/revision系の競合制御はデバイス間同期(DRAFT-22)着手時まで保留と明記（オーバーエンジニアリング回避の判断）
- catalog再構築時にuser状態を消さない方針（missing中も保持、UUID再出現で再接続。重複UUID時の帰属も）
- バックアップはWAL考慮のSQLiteスナップショット方式とし、復元検証まで要求

ADR番号は作成直前に docs/adr/ を確認（並行セッションの衝突注意）。ドラフトDRAFT-25/26/27の該当記述はADR確定後にこのADR参照へ寄せる。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 上記の決定事項を網羅したADRが docs/adr/ に追加されている
- [ ] #2 保留した判断（CAS競合制御等）が保留理由つきで記録されている
- [ ] #3 DRAFT-25/26/27から参照される決定の重複記述が整理されている
<!-- AC:END -->
