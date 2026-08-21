---
id: TASK-373
title: 本文フォントをOSフォントスタックへ切り替えIBM Plex Sans JPを撤去する
status: To Do
assignee: []
created_date: '2026-08-21 12:49'
updated_date: '2026-08-21 12:58'
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
- [x] #1 @fontsource/ibm-plex-sans-jp が依存・import・distから消え、distのwoff2本数が大幅に減っている（Geist/JetBrains Mono分のみ）
- [ ] #2 --font-jp がOSフォントスタックになり、本文が日本語ゴシック体で崩れなく表示される（preview環境スクリーンショットで確認）
- [x] #3 Geist・JetBrains Monoの用途（ブランド表記・数値表示）は従来通り維持されている
- [x] #4 pnpm test:smoke が通り、docs/design-system.md が新構成に更新されている
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
fonts.cssからibm-plex import3行削除、pnpm remove @fontsource/ibm-plex-sans-jpでclient/package.json・lockfileから依存除去。pnpm --filter @mimimilli/client build後、client/dist/assets/*.woff2=38本（変更前407本）、*ibm-plex*=0本。残りはgeist 20本+jetbrains-mono 18本のみ。

fonts.cssのGeist(400/500/600/700)・JetBrains Mono(400/500/600) importとtokens.cssの--font-sans/--font-monoは未変更。distにgeist 20本・jetbrains-mono 18本のwoff2が残存。font-sans/font-monoクラス利用箇所（Button・ScanSidebar数値・SmartFolderEditorModal等）はコード変更なし。

docs/design-system.mdタイポグラフィ節をOSゴシック/Geist/JetBrains Mono構成に更新。pnpm test:smoke 23/23 passed。pnpm check（tsc・oxlint・fmt:check・layer boundaries）通過。

【ウェイト運用】--font-jp上のfont-weight 500/600: shell CSS（library-d/e, files-b/c, preview-a, player-dock/popup, now-playing-immersive等）とNowPlayingView(font-semibold)、Tag.tsx(font-medium)、SetupScreen(inline 500/600)で使用。Windows主環境のYu Gothic UIはRegular(400)とBold(700)のみ。CSS Font Matching Algorithmにより500/600は専用faceが無いためfont-synthesis: weight（UA既定）でRegularから合成太字、または700へスナップ。500と600は視覚差が小さくなりやすい（IBM Plex Sans JP時代のような独立Medium/Semibold faceは無い）。font-sans(Geist)側のfont-medium/semiboldは@fontsourceの500/600 faceが引き続き供給されるため影響なし。

追記: --font-jpにNoto Sans CJK JP/Noto Sans JPをLinux開発環境向けフォールバックとして追加（tokens.css・design-system.md同期）。pnpm test:smoke 23/23 passed（Noto追加後再実行）。
<!-- SECTION:NOTES:END -->
