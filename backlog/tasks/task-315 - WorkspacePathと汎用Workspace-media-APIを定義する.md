---
id: TASK-315
title: WorkspacePathと汎用Workspace media APIを定義する
status: To Do
assignee: []
created_date: '2026-08-12 11:31'
labels: []
dependencies: []
priority: medium
ordinal: 325000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
レビュー実施順4。現状、未登録ファイルの配信は音声だけ（server/src/routes/media.ts）で、画像は登録済み作品の相対パスが分かる場合のみ、PDF・text・videoは未対応。sharedにWorkspacePath（root相対・separator正規化済みのbranded type）とMediaKind/PreviewCapabilityの契約を定義し、WorkspaceResourceRefを受ける汎用media APIへ統一する。serverがroot内の安全な絶対パスへ解決し、MIME・Range・サイズ上限・preview可否を判定する。clientは絶対パスを保持しない。種別ごとの転送方法の違いはserver adapterに閉じる。未登録音声のresume・再生履歴は保存しない（2026-08-12決定、レビュー未決事項の既定案どおり）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 sharedにWorkspacePath・MediaKind・PreviewCapabilityの契約が定義されている
- [ ] #2 WorkspaceResourceRefを受ける単一のmedia APIがroot内の絶対パスへ解決し、パストラバーサル・root外参照を拒否する
- [ ] #3 音声・画像・PDF・text・videoのMIME判定・Range配信・サイズ上限がserver側で判定される
- [ ] #4 既存の未登録音声配信経路が新APIへ統合され、旧経路が削除されている
- [ ] #5 パストラバーサル拒否・Range・種別判定のテストがある
<!-- AC:END -->
