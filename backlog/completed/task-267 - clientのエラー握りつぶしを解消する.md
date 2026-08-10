---
id: TASK-267
title: clientのエラー処理契約を一本化する（Promise再throw・best-effort失敗の基準）
status: Done
assignee: []
created_date: '2026-08-08 21:19'
updated_date: '2026-08-09 01:21'
labels: []
dependencies: []
priority: medium
ordinal: 277000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リファクタ一斉調査の指摘をCodexレビューで是正した再定義。
当初の「scan start/cancel等の失敗がUIに出ない」という前提は誤り: useScanJob（:215-240）・DlsiteBulkRuntime は失敗を setError で保存してから再throwし、error atom 経由で GlobalToast に表示される。ScanModal・TopBar の .catch(() => {}) は「表示済みエラーの再throwされたrejectを止めるためだけの儀式」になっている。
やること:
- scan/dlsite操作系のエラー所有権とPromise契約を一本化する（フック側で保存するなら再throwをやめる、または呼び出し側で扱う契約にする）。無意味な空catchを不要にする
- shared/api/http.ts:37-38 readResponseBody が res.json() 失敗を null に潰し非JSONエラー応答の原因が消える → パース失敗時に原因情報を保持する
- resume/last-played 保存失敗（useResumePersistence.ts:25 / useAudioEngineLifecycle.ts:210,227）のサイレント可否を明文化する
- audioEngine のAudioContext操作（audioEngine.ts:146,153,280）を含め、best-effortとして無視する失敗の一覧と扱いの基準（debugログ / 完全無視）を定める
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 resume/last-played 保存失敗の扱いが意図の明文化付きで整理されていること
- [x] #2 readResponseBody がパース失敗時に原因情報を失わないこと
- [x] #3 clientのcheck・変更範囲のテストが通ること
- [x] #4 scan/dlsite操作系のエラー所有権とPromise契約が一本化され、儀式的な空catchが残っていないこと
- [x] #5 best-effortとして無視する失敗の一覧と扱いの基準が明文化されていること
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
エラー所有権は runtime 側へ寄せ、start/cancel は ScanActionResult（{ok:true,job} / {ok:false,error}）を返す契約に統一。ADR-0015 と docs/client-error-handling.md に記録した。初回セットアップだけは例外で、App.handleSetupComplete が戻り値の error を見て状態遷移を止める（setup-required 中は GlobalToast が描画されないため、error atom 経由では失敗理由が届かない）。この点はレビュー指摘による2回の差し戻しで是正し、SetupScreen に留まること・汎用文言ではなくサーバー由来の実メッセージが出ることをテスト2件で固定した。DLsite側の start/cancel は Promise<void> のままで型を揃えていないが、失敗理由を見て後続を止める呼び出しが存在しないため現状維持とした。検証: pnpm check 成功、client 103ファイル/781テスト全パス。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
scan の start/cancel を ScanActionResult 契約へ統一し、error atom へ保存してから再throwする二重構造と儀式的な空catchを解消。readResponseBody を res.text() ベースにしてJSON解析失敗時も本文を保持。エラー所有権・Promise契約・best-effort失敗の基準を ADR-0015 と docs/client-error-handling.md へ記録。pnpm check と client 781 テストで検証。
<!-- SECTION:FINAL_SUMMARY:END -->
