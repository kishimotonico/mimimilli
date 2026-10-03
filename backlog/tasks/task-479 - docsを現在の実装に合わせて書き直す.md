---
id: TASK-479
title: docsを現在の実装に合わせて書き直す
status: To Do
assignee: []
created_date: '2026-10-02 11:40'
updated_date: '2026-10-02 11:50'
labels:
  - docs
dependencies: []
priority: medium
ordinal: 537000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
2026-10-02の点検で見つかった実装とのずれ・経緯の積み上げ: HANDOFF.md:69 smokeが直列前提と書かれているが実装はfullyParallel:true/workers=SMOKE_WORKERS(4)。HANDOFF.md:78のAPI表に存在しないPUT /settingsがあり、/root-reconfiguration・POST /smart-folders/preview・PUT /tag-prefixes/orderが無い。HANDOFFのプレイヤー節の参照パス違い。design-system.md:19 の .ml-acc-coral/grass/cobalt は実在しない（--accのみ）。design-system.mdのToast節にTASK-ID・過去の顛末が残る。requirements-v4.md:391 のスキャンSSE再接続リプレイ記述がADR-0030と矛盾（scanは接続時にstateを1件送るだけ）。ADR-0008は自動再採番（ADR-0017で廃止）とcatalog再作成（ADR-0023と矛盾）・存在しない移行処理を現状として書いている。ADR-0006のお気に入り=タグと実装のbookmarkedのずれ。docs/README.mdの「削除済み」節が経緯の台帳で、:12はadr/README.mdに無いADR一覧を案内している。根READMEのCIでsmoke対象外の記述、シナリオ一覧のscan-review欠落、dlsite.mdの関数名違い。詳細は点検レポートで確認済みの事項。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 HANDOFF.mdのsmoke並列・API表・プレイヤー節の参照が実装と一致する
- [ ] #2 design-system.mdに実在しないクラスや経緯（TASK-ID・過去の不具合の顛末）が無い
- [ ] #3 requirements-v4.mdのスキャンSSE再接続の記述がADR-0030と一致する
- [ ] #4 ADR-0008・ADR-0006が後発ADRや実装との関係を正しく示している
- [ ] #5 docs/README.mdに削除済み文書の台帳が無く、ADR一覧の案内先が実在する
- [ ] #6 根README・シナリオ一覧・dlsite.mdの記述が実装と一致する
- [ ] #7 ADRに現状節・追記節が無く、一部を後続ADRに改訂されたADR（0005・0012など）から改訂側ADRへ辿れる
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-02構造点検（doc-6・doc-7）より: (1) requirements-v4の画面・スキャン・タグ遷移の大きな食い違い（5.2/7.1/7.2/7.7/3.5/8.1/7.6）はTASK-497で扱う。このタスクのAC#3はスキャンSSE再接続の記述だけ。(2) dlsite.mdは関数名だけでなく、存在しないdlsiteProgress.tsへの参照、runDlsiteBulkの所在、GET /dlsite/bulkの「なければ204」（実装は常に200でsnapshotを返す）、/dlsite/eventsの再送の記述（ADR-0030と食い違う）も直す（doc-7 spec-3）。(3) ADR-0001・0002の「現状」節、ADR-0005の「追記」節はadr/README.mdの運用ルール違反。現行の事実へ書き換え、追記節は削除する。0012は後続ADR（0013・0016・0026・0031）への参照が無い（doc-7 spec-5）。(4) ADR-0008は旧単一DBの移行順序・resume v1・レガシーメタの手動移行の節を整理する。CASの矛盾という指摘は検証で取り下げた（doc-7 spec-4）。(5) AC#5の範囲で、凍結アーカイブのdocs/issues/も削除する（Status: todoのまま凍結された文書や、現存しないBACKLOG.mdへの参照を含む）（doc-7 spec-8）。(6) ARCHITECTURE.mdのcore構成物の列挙は不完全なので、列挙をやめてディレクトリを正とする（doc-7 spec-7）。
<!-- SECTION:NOTES:END -->
