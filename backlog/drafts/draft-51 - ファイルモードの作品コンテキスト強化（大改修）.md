---
id: DRAFT-51
title: ファイルモードの作品コンテキスト強化（大改修）
status: Draft
assignee: []
created_date: '2026-08-10 19:00'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ドッグフーディングのフィードバック（2026-08-11）。ファイルモードのライブラリ連携が薄い。現状: (1) 登録済みフォルダーへの操作は登録/登録解除のみで、作品の編集やライブラリ詳細への遷移動線が無い（client/src/features/files/ui/FilePreview.tsx:128-151）。(2) 作品フォルダーの中に入るとworkIdはサーバーから取得できている（FilesView.tsx:108、entry.workId）のに、バッジ表示のみでクリック不可（FileRow.tsx:26-28, 60-63）。やりたいこと: 作品フォルダー配下ではその作品の情報を表示するUIにして、そこから再生・ライブラリ詳細への遷移・メタデータ編集ができる動線を設ける。再生ボタンに加えて作品編集機能もファイル側に置く。PlayerDockのonShowPlayingWork（App.tsx:220）と同様の遷移機構をFilesViewへ配線する形が候補。ファイルモードは物理FSファイラーという位置づけ（作品起点にしない）は維持する。要件を他機能と合わせて詰めてからタスク分割する。
<!-- SECTION:DESCRIPTION:END -->
