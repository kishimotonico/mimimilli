---
id: TASK-113
title: DLsite一括取得のSSE購読を堅牢化する（接続エラー・POST競合・不正イベント）
status: To Do
assignee: []
created_date: '2026-07-27 01:57'
labels:
  - client
  - dlsite
  - bug
dependencies: []
priority: medium
ordinal: 121000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
コンポーネント設計レビュー（2026-07-27）で発見。コード上は確定、実機での再現確認は未実施。

useDlsiteBulk.ts に3つの問題がある。

1. 接続エラーを無視する（useDlsiteBulk.ts:66-68）
   source.addEventListener("error", (event) => { if (event instanceof MessageEvent) handle(event); }) となっており、EventSource のネイティブな接続エラーは Event でくるため何も起きない。active が true のまま残り「DLsite取得中...」が消えなくなる。
   ただし EventSource は一時的な切断を自動再接続するため、error を即失敗扱いにするだけでは退行する。再接続中と確定失敗を区別する必要がある（jobIdでの status 照会など）。

2. POST と SSE 接続が競合する（useDlsiteBulk.ts:72-）
   start() が POST 完了前に setActive(true) するため、SSE 接続がジョブ開始 POST より先にサーバーへ到達しうる。POST 成功後に接続を開始すべき。

3. 不正なイベントを無言で捨てる（useDlsiteBulk.ts:30-）
   JSON 解析失敗・schema 不一致を return で捨てているため、terminal イベント（complete / cancelled / error）が壊れていると永久に active のまま残る。

いずれも AGENTS.md の「エラーを正しくハンドリングし問題を隠蔽しない」に関わる。

参考: scan 側の useScanJob.ts は generation / ownership 管理と getScanJob での再照会を持っており、同種の課題に対する既存の解き方になっている。設計を揃えるかは実装時に判断する。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 SSE の接続が確定的に失敗したとき active が解除され、エラーが利用者に伝わる
- [ ] #2 一時的な切断では自動再接続され、進捗表示が継続する
- [ ] #3 SSE 接続はジョブ開始 POST の成功後に開始される
- [ ] #4 不正なイベント（JSON不正・schema不一致）を受け取った場合に無言で無視されず、状態が固着しない
<!-- AC:END -->
