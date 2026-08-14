---
id: TASK-334
title: DLsite投影の期限切れキャッシュの扱いを仕様としてADR-0017に明記する
status: Done
assignee: []
created_date: '2026-08-14 08:21'
updated_date: '2026-08-14 09:59'
labels: []
dependencies: []
priority: medium
ordinal: 344000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Codexレビュー2026-08-14（マージe9c16fbの事後レビュー）の指摘。失敗キャッシュのTTLが切れてもmeta/mediaが不変ならcanSkipIncrementalで戻り、DLsite投影の再合成（scanRegister.ts:133周辺）へ到達しないため、catalogに期限切れのnot_found/errorが残り続ける。ADR-0017の投影規則（catalogのwork_dlsite.state_jsonはcacheとmimimilli.jsonから再合成する）からの乖離。ただし「最後の試行が失敗した」事実自体は変わらないため表示上の実害は限定的で、スキップ作品への軽量な再投影を入れるか、期限切れ後も失敗表示を維持する仕様としてADRに明記するかの設計判断を含む。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 ADR-0017のDLsite statusの節に、catalog投影は最後の取得結果を保持し、TTLは再取得の可否のみを制御する（期限切れで表示は変えない）旨が明記されている
- [x] #2 増分スキップ経路への再投影処理は追加しない方針が同節に明記されている
<!-- AC:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-08-14 08:25
---
検討2026-08-14で決着: 一括取得の対象選定（dlsiteBulk.ts:50）は失敗状態（not_found/error）の作品を含み、取得後にrefreshWorkProjectionで再合成されるため、期限切れの失敗投影は次回fetchで自己修復する。TTLはfetchの再試行可否を制御する概念であり表示の概念ではなく、「最後の試行が失敗した」表示は期限切れ後も事実として正しい。スキップ経路への再投影追加は表示を不正確（取得待ち）にするために複雑さを増やすため採用しない。本タスクはこの仕様のADR明記のみとする。
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
失敗キャッシュのTTLが切れてもmeta/mediaが不変ならcanSkipIncrementalで戻るため、catalogに期限切れのnot_found/errorが残るという指摘への対応。検討の結果コードは変更せず、仕様としてADR-0017へ明記した。一括取得の対象選定は失敗状態の作品を含み、取得後にrefreshWorkProjectionで再合成されるため期限切れの失敗投影は次回fetchで自己修復する。TTLはfetchの再試行可否を制御する概念であり表示の概念ではなく、「最後の試行が失敗した」表示は期限切れ後も事実として正しい。増分スキップ経路への再投影追加は表示をかえって不正確（取得待ち）にするうえ再合成の経路を増やすため採用しない。以上をADR-0017のDLsite statusの節へ追記した。
<!-- SECTION:FINAL_SUMMARY:END -->
