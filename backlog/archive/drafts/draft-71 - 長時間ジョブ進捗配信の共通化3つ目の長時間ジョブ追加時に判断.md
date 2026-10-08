---
id: DRAFT-71
title: 長時間ジョブ+進捗配信の共通化(3つ目の長時間ジョブ追加時に判断)
status: Draft
assignee: []
created_date: '2026-08-21 14:51'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
アーキテクチャ監査(2026-08-21)の指摘の保留分。scanJobManager(ジョブID・seq付き履歴・Last-Event-ID再接続・reset・heartbeat)とdlsiteJobManager(ID無し単一currentJob・直近1件replayのみ)は同一関心事の独立2実装で、共有抽象がない。application-architecture-review-2026-08-12.md:278は共通task modelへ寄せる方針としつつ「localhost単一利用の段階ではtask ID+snapshot polling程度で足りる」とも明記しており、Codexレビュー(2026-08-21)もDLsite側をscan水準のSSEへ引き上げるのは過剰と判定。3つ目の長時間ジョブ(一括タグ変更・一括エクスポート等)を作るとき、またはLAN公開段階で、どの水準(polling統一/scan水準SSE統一)に寄せるかを決めて実施する。それまでは統合しない。
<!-- SECTION:DESCRIPTION:END -->
