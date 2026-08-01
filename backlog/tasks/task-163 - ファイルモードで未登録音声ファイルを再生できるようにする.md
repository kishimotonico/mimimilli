---
id: TASK-163
title: ファイルモードで未登録音声ファイルを再生できるようにする
status: In Progress
assignee:
  - '@claude'
created_date: '2026-08-01 18:01'
updated_date: '2026-08-01 19:17'
labels: []
dependencies:
  - TASK-167
priority: high
ordinal: 173000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
出典: ファイルモード要件整理 2026-08-02（本会話でユーザー合意）。現状はworkIdが無いファイルは再生不可（FilePreview.tsx:97,118-121、App.tsx:104-105で即return）。ファイルモードの本来の役割（物理ファイラーとして未登録ファイルも扱える）に反するため、work非依存のファイル再生を追加する。

要件（ユーザー合意済み）:
- スキャンルート配下の音声ファイルをパス指定でストリーミングするserver APIを追加する（ルート外パスの拒否等の検証必須）
- プレイヤーにwork非依存の「ファイル再生」を追加する。登録済み作品配下のファイルでも、ファイルモードからの再生は常にファイル再生とし、現状の「所属作品を取得して即席トラック再生」する挙動は置き換える
- 表示は一律ジェネリック（音符アイコン等）とし、作品画像・フォルダ内画像は使わない。ファイル名と実測durationを表示する
- 同一フォルダ内の音声ファイルを表示順で連続再生する（サブフォルダには下りない）
- レジューム・再生履歴・最近再生への記録はしない（playlistId === nullの既存ガード useResumePersistence.ts:44 と整合させる）
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 未登録フォルダの音声ファイルをファイルモードからクリックして再生できる
- [ ] #2 再生終了で同一フォルダ内の次の音声ファイル（表示順）へ自動的に進む。サブフォルダには下りない
- [ ] #3 登録済み作品配下のファイルをファイルモードから再生してもプレイヤーに作品カバー画像が表示されず、ジェネリック表示になる
- [ ] #4 ファイルモードからの再生ではresumeがPOSTされず、再生履歴・最近再生にも記録されない
- [ ] #5 スキャンルート外のパスを指定した場合、ストリーミングAPIが拒否する
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. スキャンルート配下の音声をパス指定でストリーミングするAPIを追加（shared契約含む、ルート外拒否をテストで担保）
2. プレイヤーにwork非依存のファイル再生経路を追加。ファイルモードからの再生は常にファイル再生（App.tsxの即席トラック再生を置き換え）
3. 表示はジェネリック（音符アイコン・ファイル名・実測duration）、同一フォルダ内連続再生（サブフォルダに下りない）
4. resume/履歴/最近再生に記録しない（playlistId===nullガードと整合）
5. 実装はCursor(composer-2.5)へ委譲、pnpm check/test通過後にSonnet検証担当がagent-browserで実機確認
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
実装エージェント引き継ぎ用の調査済み事実（別セッション調査、2026-08-02）:
- 現状の再生不可ガード: client/src/features/files/ui/FilePreview.tsx:97,118-121（disabled＋注記）、client/src/app/App.tsx:104-105（handlePlayFileがworkId無しで即return）
- 現状の登録済みファイル再生: App.tsx:103-125がGET /works/:idで作品を取得し即席1トラックでplay()。これを置き換える対象
- プレイヤーはplay(work, tracks, ...)でwork必須（client/src/features/player/model/usePlayerActions.ts:36-42）。物理パス直接再生の経路は無い
- resume/履歴はplaylistId === nullで既に保存されない（client/src/features/player/model/useResumePersistence.ts:44のガード）→「軽量再生」はこの既存ガードと整合させられる
- duration実測はclient/src/features/player/model/trackTime.ts:8-31の仕組みが流用可
- fsブラウズAPI: server/src/routes/fs.ts、エントリのworkId/workRelPath付与はserver/src/adapters/real/fsBrowse.ts:36-49
- 環境メモ: 開発サーバーはdev:realで起動している場合がある（実DB。fixtureと挙動が違う点に注意）
<!-- SECTION:NOTES:END -->
