# デザインシステム規約

レイアウト・機能仕様の正は実装（`client/src/`）。本書は実装からは読み取れない設計意図・規約だけを記す。出典の詳細モックは Git 履歴の `docs/design_handoff_mimimilli_library/`（2026-07-03 削除）にある。

## カラートークンの意味づけ

トークン定義の正は `client/src/styles/tokens.css`（oklch）。用途は以下の通り。

- `--paper-0〜4`: 背景・面。0=ページ床、1=カード等の浮いた面、2=hover、3=pressed/行の縞、4=selected
- `--line` / `--line-soft` / `--line-strong`: 罫線。強調度の3段階
- `--ink-0〜4`: 文字色。0=本文、1=セカンダリ、2=キャプション、3=プレースホルダー、4=ごく薄い
- `--acc` 系: アクセント（既定は柿色）。soft=淡色背景、line=枠線、ink=アクセント上の文字
- riso 系（`--r-coral` / `-sky` / `-leaf` / `-mustard` / `-plum` / `-stone` / `-ink` / `-ivory`）: カバーアートやマルチchミキサーの色分け用。リソグラフ風の彩度
- タグカテゴリ色（`--cv-color` / `--circle-color` / `--series-color` / `--cat-color`）: 構造化タグ（`cv/` `サークル/` `シリーズ/` `カテゴリ/`）を視覚的に区別する専用色。フラットタグには使わない
- `--shadow-cover`: カバーアート専用の影（内側ハイライト付き）。通常の面には `--shadow-1/2/pop` を使う

## テーマとアクセント

ダーク/ライトは `.ml-dark` クラスの付け外しだけで全体が追従する設計（個別コンポーネントでの明暗分岐は不要）。アクセント色も `.ml-acc-coral` / `.ml-acc-grass` / `.ml-acc-cobalt` の差し替えクラスだけで全体に伝播する。

モックのみに存在した `.ml-acc-graph` は実装未移植。必要になった場合は Git 履歴の削除前ディレクトリを参照する。

## タイポグラフィ

- `IBM Plex Sans JP`: 本文の既定書体
- `Geist`（sans）: ブランド表記・操作系コントロールなど非本文
- `JetBrains Mono`: 時刻・件数・メタ情報などの数値表示

## クラス命名

- `mle-`: Explorer / 共通シェル系（フレーム・カラム・アドレスバー・行など File/Library 共通の骨格）
- `mll-`: Library モード固有（軸レール・作品行・リッチ詳細・スマートルールなど）
- 状態は `is-` プレフィックス: 選択 = `.is-on`（paper-4 背景）、選択+フォーカス = `.is-on.is-focused`（黒地白文字に反転）。行・軸系コンポーネントを追加するときはこのパターンを踏襲する

`shell.css` は全規則がカスケードレイヤー内にある。UA要素のリセット（`button` / `input` / `a` / `ul` / `ol` 等）は `@layer base`、`mle-`/`mll-` のコンポーネント規則は `@layer components` に置く。Tailwind v4 のレイヤー順（`theme, base, components, utilities`）により、`@layer utilities`（Tailwindユーティリティ）が `components` より強く効くため、tsx側で `mle-`/`mll-` クラスと Tailwind ユーティリティを併用すると、ユーティリティ側で局所的に上書きできる。レイヤー外に素のセレクタを書くと、レイヤーの規則（unlayered が常に layered に勝つ）で utilities を問答無用で潰してしまうため、セレクタを足すときは必ずどちらかのレイヤー内に置く（詳細は [HANDOFF.md](HANDOFF.md) の「CSS レイヤー」参照）。

## Overlay / z-index の現在の階層

実装調査済みの値（正は実装）。

| 要素                            | z-index           |
| ------------------------------- | ----------------- |
| グリッドの作品インスペクタ      | 20                |
| プレイヤー（バー/ポップアップ） | 32                |
| 設定モーダル                    | top layer（下記） |
| 全画面プレイヤー                | top layer（下記） |
| スキャン新規作品ポップアップ    | top layer（下記） |
| スマートフォルダーエディタ      | top layer（下記） |
| 作品編集・DLsite適用プレビュー  | top layer（下記） |

設定モーダル・全画面プレイヤー・スキャン新規作品ポップアップ・スマートフォルダーエディタ・作品編集・DLsite適用プレビューは
ネイティブ `<dialog>` + `showModal()` で実装しており、z-index ではなくブラウザの
top layer によって最前面に重なる（TASK-29）。開閉ライフサイクル・Escapeキャンセル・
backdropクリックの共通処理は `client/src/shared/ui/useDialogModal.ts` に集約している。
フォーカストラップと「多重モーダル時は最前面のEscだけが効く」挙動は top layer の
ブラウザ標準実装に任せる。backdropクリックで閉じるかどうかはモーダルごとに異なり
（設定モーダル・スキャン結果ポップアップは編集中でも問答無用で閉じる、スマートフォルダー
エディタは保存中は閉じない）、`useDialogModal` の `handleBackdropClick` に渡す
コールバックで差分を吸収する。

## Motion / cursor

- 構造的なモーション（要素の出入り・スライド等）は `motion/react` を使う
- hover は短い transition のみで十分。派手な演出は避ける
- 操作不能な要素は `cursor: not-allowed` にする
- 長時間ループするアニメーション（パルス等）は reduced motion 対応を原則とする

## モバイルレイアウト

方針の正は [ADR-0006](adr/0006-mobile-ui-strategy.md)。要点のみ:

- ブレークポイントは 768px の単一分岐（`tokens.css` のトークンが正）。768px以下は `AppShell` でなく `MobileShell`（ボトムタブ＋ミニプレイヤー）に切り替える
- デスクトップ側コンポーネントに `md:` ユーティリティを散らして畳まない。操作系が異なるものはモバイル用ビューを別コンポーネントとして持つ
- スマホには管理系UI（タグ編集・スマートフォルダー編集・スキャン・設定）を持ち込まない。書き込みは「お気に入り」「あとで整理」タグのトグルのみ

## 将来UIの参考資料

スマートフォルダー条件エディタの新規作成フロー、複数chミキサーの詳細意匠、左ナビのラベル付き案、統計/メモ/詳細トラック表を含む拡張作品詳細のモックは、いずれもフェーズ1未実装の将来UI案として Git 履歴の削除前ディレクトリ（`docs/design_handoff_mimimilli_library/`、2026-07-03 削除時点のコミット）から復元できる。着手時に参照する。
