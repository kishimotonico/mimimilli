---
id: TASK-101
title: DLsiteリクエストのUser-Agentを環境変数で設定可能にする
status: Done
assignee: []
created_date: '2026-07-26 05:14'
updated_date: '2026-07-26 08:21'
labels: []
dependencies: []
documentation:
  - docs/dlsite.md
ordinal: 102000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
現状のUser-Agentは server/src/adapters/real/dlsite.ts:10 にハードコードされた "Mozilla/5.0 (Windows NT 10.0; Win64; x64) mimimilli/0.1" で固定されている。DLsite側の扱いが変わったときや、利用者が自分の連絡先を含むUAを名乗りたいときに、再ビルドなしで差し替えられるようにする。

既定値は現状の文字列を維持する（挙動の変更なし）。他のDLsite設定と同様に server/src/adapters/real/dlsiteConfig.ts で環境変数から読み、dlsiteScheduler / fetchDlsiteHtml / fetchDlsiteCover のすべての経路に同じ値が渡ること。

robots.txtの尊重は今回のスコープ外（現時点では過剰と判断）。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 MIMIMILLI_DLSITE_USER_AGENT でUser-Agentを上書きできる
- [ ] #2 環境変数が未設定なら従来のUA文字列が使われる
- [ ] #3 作品ページHTML取得とカバー画像取得の両方に同じUAが適用される
- [ ] #4 UAの解決ロジックがdlsiteConfigに集約され、dlsite.tsに文字列がハードコードされていない
- [ ] #5 docs/dlsite.mdの環境変数一覧に追記されている
- [ ] #6 環境変数の有無でUAが切り替わることを確認するテストがある
<!-- AC:END -->
