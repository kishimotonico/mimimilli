---
id: TASK-506
title: APIへのリクエストの出所をHost・Origin・Sec-Fetch-Site・Content-Typeで検証し、DNSリバインディングとCSRFを塞ぐ
status: Done
assignee:
  - '@sonnet'
created_date: '2026-10-18 13:36'
updated_date: '2026-11-07 10:55'
labels:
  - security
  - server
dependencies: []
priority: high
ordinal: 564000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Claude Securityスキャン（2026-10-16、master 4c9aabb1）のF1〜F8・F11。APIは認証なしで127.0.0.1へのbindだけが防御で、Host・Origin・Sec-Fetch-Siteを見ず、readJsonBodyがContent-Typeを見ないため、任意のWebページからCSRFで状態を変更でき、DNSリバインディングで応答も読める。createAppの/apiより前（静的配信も含むapp全体）にmiddlewareを1つ置き、jsonBodyでメディア型を検証する。許可するHostは localhost・127.0.0.1・[::1]・*.localhost（RFC 6761でloopback固定）で、環境別の許可リスト注入はしない。方針の正は CLAUDE-SECURITY-20261016-133939/fix-instructions.md の A。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 静的配信を含む全リクエストで、HostをURLとして解析したhostnameが localhost・127.0.0.1・[::1]・.localhost で終わる名前のいずれでもなければ（Host欠落を含む）403になる。ポートは見ず、X-Forwarded-Hostは使わない
- [x] #2 GET/HEAD/OPTIONS以外で、Originがあってhostnameが同じloopback規則を満たさない場合とOrigin: nullの場合は403。Sec-Fetch-Site: cross-siteも403。ヘッダー間の結果が矛盾すれば救済せず拒否し、OriginもSec-Fetch-Siteもなければ通す
- [x] #3 readJsonBody・readOptionalJsonBodyは、実際に読んだ本文が空でないのにメディア型がapplication/json（charset等のパラメータ付き可）でなければ415になる。本文が空のreadOptionalJsonBodyと本文を読まないrouteは従来どおり通る
- [x] #4 CORSヘッダーを出さず、OPTIONSのpreflightを承認しない（Access-Control-Allow-*が付かない）
- [x] #5 拒否ケース（外部Host、悪意あるOrigin、Origin: null、cross-site、text/plainのJSON、本文なしの外部POST）と通過ケース（portless・worktree名のHost、localhost、127.0.0.1、ヘッダーなし）を defineContract でfixture・real両adapterに同じ期待値で通すHTTPテストがある
- [x] #6 clientの本文付きmutationが全数application/jsonを送っていることを確認し、結果をNotesに残している
- [x] #7 Bun直アクセス、Vite経由、portlessの通常名とworktree名、preview:fixture、smokeの全経路で正規のUI操作（閲覧・編集・DLsite適用・ルート再構成）が成功し、pnpm test:smokeが通る
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
client全数確認(実装担当): client/src の raw fetch は shared/api/http.ts:34 の fetchApi と features/files/ui/FilePreviewMedia.tsx:252 fetch(src)(GET)のみ。本文付き POST/PUT/PATCH/DELETE は postParsed/postVoid/putParsed/patchParsed/deleteParsed/deleteVoid 経由で、本文がある場合は Content-Type: application/json を送る(patchParsedは常時)。DELETEは本文なし。EventSource(sseTransport/dlsiteBulkStore/scanJobStore)はGETのみ。例外なし、client変更なし。

AC#1の「Host欠落」は403。Honoのapp.requestはHostヘッダーを付けないため、app.requestを使うテストは tests/helpers/testApp.ts でHost: localhostを補う。AC#7: Sonnet検証でdev（task-506.mimi.localhost、Vite proxy経由）・Bun直・preview:fixture:new-workの各経路で閲覧・編集・DLsite取得/適用・ルート再構成が成功し403/415は0件、攻撃系はすべて403/415、smoke 31 passed。portless通常名はworktreeからは割り当てられないため、Bun直へ Host: mimi.localhost:1355 を送って200を確認した。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
全リクエストでHostをloopback名に限定し、状態変更リクエストはOrigin・Sec-Fetch-Siteで同一マシン由来に限定、JSON本文はContent-Typeを検証してDNSリバインディングとCSRFを塞いだ。Host欠落は403。テストはHost補完ヘルパー経由で、欠落ケースはapp.fetchで検証。pnpm check && pnpm test と smoke で確認。
<!-- SECTION:FINAL_SUMMARY:END -->
