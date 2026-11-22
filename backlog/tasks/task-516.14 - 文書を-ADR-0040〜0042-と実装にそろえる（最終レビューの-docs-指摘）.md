---
id: TASK-516.14
title: 文書を ADR-0040〜0042 と実装にそろえる（最終レビューの docs 指摘）
status: Done
assignee: []
created_date: '2026-11-22 15:26'
updated_date: '2026-11-22 17:47'
labels:
  - library
  - docs
dependencies: []
parent_task_id: TASK-516
priority: high
ordinal: 615000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-516 の最終レビューの must-fix M1〜M3・M5 と docs の should-fix。TASK-516.12・516.13 の後に、最終の実装に合わせて行う。ユーザー決定（2026-11-23）: 上書きの「元に戻す」は残し、ADR-0041 の「保存を取り消す操作は置かない」を直す。ダイアログの件数の見込みは次の段階に回す。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 requirements-v4.md のタグクリック（§7）・prefix 定義の役割（§4.5）・並び順の「将来」・「ビュー切替」・値一覧の件数の意味が ADR-0040・0041 と実装に合っている
- [x] #2 ADR-0028 の無効化の表が実装のキー（groupValues・smartFolders ほか）と規則に合い、スマートフォルダー自身の変更の行がある。ADR-0008 の関数名が実在する
- [x] #3 ADR-0041 の保存の取り消しの記述がユーザー決定どおりで、ADR-0040 の移行の節に更新後に既定の11本が入ることが書かれている
- [x] #4 ADR-0005・0006・0012・0013・0016・0026・0031 に、ADR-0040〜0042 で改訂されたことが書かれている
- [x] #5 design-system.md の px 直書きの規約とモックに合わせた値の例外、古い部品名、「スマートルール」、値一覧の件数の説明が実装に合い、dlsite.md の軸表示の記述が無い
- [x] #6 ARCHITECTURE.md・HANDOFF.md に layer・seed・履歴エントリーの状態・resolveLibraryView の説明と、関連文書に ADR-0040〜0042 がある
<!-- AC:END -->













## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## 文書（TASK-516.14。516.12・516.13 の後）

- M1 requirements-v4.md:362 のタグクリックが旧仕様のまま（:322 と ADR-0041 に合わせる）。
- M2 requirements-v4.md:205 の prefix 定義に「サイドバーのグループ分けへの表示」が残っている。:347 の「将来: 最近再生した順、ランダム順」は実装済み。:300 の「ビュー切替」は「表示形式」にする。
- M3 ADR-0028:118 ほか（:119・123・132-134・149）の ["axisFacets"] を ["groupValues"] にする。:79 の reset の規則は、今は「条件が bookmarked に依存するものは reset」。:117 の「通常一覧」も古い。スマートフォルダー自身の変更の行を足す。ADR-0008:80 の buildGroupFacets は buildGroupValues にする。
- M5 ユーザーの決定: 上書きの「元に戻す」は残す。ADR-0041:65 の「保存を取り消す操作は置かない」を「上書きだけはトーストから元に戻せる。新しく保存したものは削除で戻す」に書き換える。ADR-0040「移行」に、更新後に既定の11本が起動時に入ることを1行足す。
- S4 ADR-0005・0006・0012・0013・0016・0026・0031 に、ADR-0040〜0042 で改訂されたことを書く（各 ADR の関連行。adr/README.md の運用に従う）。
- design-system.md: px 直書き禁止（:32-34。「この7段」と表の6種も食い違っている）と、モックに合わせた 10.5px・11.5px が食い違っている。モックに忠実にするのがユーザーの決定なので、規約の側に例外を書く。:78 の「スマートルール」、:96 の「チップの値ドロップダウン(.mll-qoverlay)」（今はパンくずの値）、:106 の「スマートフォルダーエディタ」（今は SmartFolderDialog）、:224 のキャンセルの outline と :311 の「モーダルのキャンセルは quiet」の食い違い、:87 の「削除は使わない」を作品の話に限定すること、:251・:339 の値一覧の件数の説明。外部 artifact を「見た目の正」としている記述（:175・:218）は参照扱いにする（正は実装）。
- ADR-0041 に、保存・上書き・削除のあとの行き先と push/replace を1段落で書く。
  - 新規保存: 作ったものを開く（push）
  - 上書き: 同じスマートフォルダーを絞り込みなしで開き直す
  - 削除: 開いているものなら replace で「すべて」へ
  - 正は TASK-516.12 の実装
- design-system.md の px の例外は、規約の側に書く（モックに合わせた値）。キャンセルは quiet にそろえる（統括の判断。TASK-516.13 で実装）。
- dlsite.md:35 の「軸表示」。ARCHITECTURE.md・HANDOFF.md に、layer・seed・履歴エントリーの状態・resolveLibraryView の説明を足し、関連文書に ADR-0040〜0042 を加える。client-error-handling.md:29 の「最終再生」表示も確かめる。
- 516.12 の範囲外の気づき: ADR-0028 の bookmark の行（125行目付近）を「グループの値も無効化する」に直す（516.12 でお気に入りの後に groupValues を無効化するようにした）。
- 行番号は統合ブランチ a82e3c91 時点。今の feat/library-folders で位置を確かめてから直す。
<!-- SECTION:NOTES:END -->
