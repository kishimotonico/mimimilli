---
id: DRAFT-65
title: Windows向けzip配布（Bunランタイム）
status: Draft
assignee: []
created_date: '2026-08-18 23:11'
labels:
  - future
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
DRAFT-1「配布: Bun compile単一exe」を書き直したもの（2026-08-19の棚卸し）。旧ドラフトは本文3行のプレースホルダーで、前提が ADR-0007 の決定と食い違っていた（参照先の `ARCHITECTURE.md` もリポジトリルートから `docs/ARCHITECTURE.md` へ移動済み）。

## 前提: 単一exeではなくzip

ADR-0007（承認 2026-07-19）で決着済み。**exe化そのものはできる**（WSLから `bun-windows-x64` をtargetにしたPE32+生成は成功）。諦めたのは配布物が1ファイルで済む形のほう。

理由は sharp。Windows x64のnative addonとDLLを取得しても、それらが単一exeへ内蔵されたことを確認できなかった。したがって:

- sharpのWindows x64 addon + DLL と、clientの静的成果物は、exeの隣に読み取り専用の「アプリ資産」として並べる
- 配布単位はディレクトリ or zip
- 配布buildではsharpを外部依存にする。native addonが動かない状態をサムネイルなしで隠すfallbackは設けない

## やること

- 配布build（Bun compileでのWindows exe生成＋アプリ資産の同梱）を組む
- Windows実機で本命exeの起動・DB再オープンを確認する（ADR-0007の帰結に「未実施」と明記されている残件。当時の手順は Git履歴 `cad3c6f` の `scripts/spike/bun-distribution/WINDOWS-SMOKE.md`）
- Windows実機でsharpの外部ロードと画像変換を確認する。失敗する場合は明示的な起動・処理エラーにする。安定しなければ画像変換のみNode.js sidecarへ分離する
- データルートが `%LOCALAPPDATA%\mimimilli` に解決され、zipの更新・移動・削除でユーザーデータが消えないことを確認する

## 将来構想との関係

ADR-0001 決定5 と ADR-0018 に「ネイティブ化（トレイ常駐・ウィンドウ化）が必要になれば Tauri v2 の sidecar や Electron で TSサーバーをそのまま同梱できる」という将来構想がある。**それとこのドラフトのzip配布は別段階**。まずzip配布を成立させ、シェルへの同梱はDRAFT-2（トレイ常駐）を含めて別途判断する。

なおADR-0007に出てくる「sidecar」は sharp が外部ロードできなかった場合の画像変換専用Node.jsプロセスを指しており、上の構想とは別物（ADR-0017 に語の混線への注記あり）。

## 着手条件

配布は機能が充実してからという方針（2026-08-03決定）。それまで着手しない。
<!-- SECTION:DESCRIPTION:END -->
