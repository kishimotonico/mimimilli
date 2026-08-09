---
id: TASK-267
title: clientのエラー処理契約を一本化する（Promise再throw・best-effort失敗の基準）
status: To Do
assignee: []
created_date: '2026-08-08 21:19'
updated_date: '2026-08-09 00:28'
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
- [ ] #1 resume/last-played 保存失敗の扱いが意図の明文化付きで整理されていること
- [ ] #2 readResponseBody がパース失敗時に原因情報を失わないこと
- [ ] #3 clientのcheck・変更範囲のテストが通ること
- [ ] #4 scan/dlsite操作系のエラー所有権とPromise契約が一本化され、儀式的な空catchが残っていないこと
- [ ] #5 best-effortとして無視する失敗の一覧と扱いの基準が明文化されていること
<!-- AC:END -->
