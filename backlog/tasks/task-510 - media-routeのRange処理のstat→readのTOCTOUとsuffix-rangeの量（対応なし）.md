---
id: TASK-510
title: media routeのRange処理のstat→readのTOCTOUとsuffix rangeの量（対応なし）
status: Done
assignee: []
created_date: '2026-10-18 13:37'
updated_date: '2026-10-18 13:37'
labels:
  - security
  - server
dependencies: []
priority: low
ordinal: 568000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Codexのセカンドオピニオンで、routes/media.ts のRange配信にstat（Content-Length決定）とstream開始の間のTOCTOUがあり、配信中にファイルが置き換わると長さ不整合や別内容を読む可能性があると指摘された。suffix range（bytes=-N）はファイルサイズまでに自然に制限され、開放端はchunkSizeBytesで上限化されており、明白な任意読み取りやDoSはない。
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
対応なし。影響は利用者自身のローカル操作（配信中に自分でファイルを置き換える）の範囲にとどまり、stat→readの整合を取る対策（fd固定でのfstat・読み出し等）の複雑さに見合わない。suffix rangeはファイルサイズ、開放端はchunkSizeBytesで上限化済みで、任意読み取り・DoSは成立しない（Claude Security 2026-10-16のCodexセカンドオピニオン、fix-instructions.mdの「対応しないもの」で決定）。
<!-- SECTION:FINAL_SUMMARY:END -->
