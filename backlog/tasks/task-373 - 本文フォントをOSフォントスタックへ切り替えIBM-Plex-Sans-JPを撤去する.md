---
id: TASK-373
title: 本文フォントをOSフォントスタックへ切り替えIBM Plex Sans JPを撤去する
status: To Do
assignee: []
created_date: '2026-08-21 12:49'
labels: []
dependencies: []
ordinal: 373000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
リモート環境の初回ロードで、woff2が55リクエスト・約600KB発生している主因はIBM Plex Sans JPの漢字サブセット群（distに369本）。本文書体をOSフォントスタックに切り替えてこの長い尻尾を消す。ブランド用Geist・数値用JetBrains Monoは軽量（ラテンサブセットのみ）なので維持し、デザインの個性は保つ。

設計:
- client/src/styles/fonts.css から @fontsource/ibm-plex-sans-jp のimportを削除し、依存からも外す
- client/src/styles/tokens.css の --font-jp をOSフォントスタックへ変更（例: "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Yu Gothic Medium", "Yu Gothic", Meiryo, system-ui, sans-serif。Windows実機がメインなのでYu Gothic系の並び順を吟味）
- Geist / JetBrains Mono のimportとトークンは変更しない
- docs/design-system.md のタイポグラフィ節を新構成に書き換える
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 @fontsource/ibm-plex-sans-jp が依存・import・distから消え、distのwoff2本数が大幅に減っている（Geist/JetBrains Mono分のみ）
- [ ] #2 --font-jp がOSフォントスタックになり、本文が日本語ゴシック体で崩れなく表示される（preview環境スクリーンショットで確認）
- [ ] #3 Geist・JetBrains Monoの用途（ブランド表記・数値表示）は従来通り維持されている
- [ ] #4 pnpm test:smoke が通り、docs/design-system.md が新構成に更新されている
<!-- AC:END -->
