# デザインシステム規約

レイアウト・機能仕様の正は実装（`client/src/`）。本書は実装からは読み取れない設計意図・規約だけを記す。出典の詳細モックは Git 履歴の `docs/design_handoff_mimimilli_library/`（2026-07-03 削除）にある。

## カラートークンの意味づけ

トークン定義の正は `client/src/styles/tokens.css`（oklch）。用途は以下の通り。

- `--paper-0〜4`: 背景・面。0=ページ床、1=カード等の浮いた面、2=hover、3=pressed/行の縞、4=selected
- `--line` / `--line-soft` / `--line-strong`: 罫線。強調度の3段階
- `--ink-0〜4`: 文字色。0=本文、1=セカンダリ、2=キャプション、3=プレースホルダー、4=ごく薄い
- `--acc` 系: アクセント（既定は柿色）。soft=淡色背景、line=枠線、ink=アクセント上の文字
- riso 系（`--r-coral` / `-leaf` / `-mustard` / `-plum`）: カバーアートやマルチchミキサーの色分け用。リソグラフ風の彩度
- タグカテゴリ色（`--cv-color` / `--circle-color` / `--series-color` / `--cat-color`）: 構造化タグ（`cv/` `サークル/` `シリーズ/` `カテゴリ/`）を視覚的に区別する専用色。フラットタグには使わない
- `--shadow-cover`: カバーアート専用の影（内側ハイライト付き）。通常の面には `--shadow-1/2/pop` を使う

## テーマとアクセント

ダークテーマは未実装（`.ml-dark` のトークン先行定義も撤去済み）。将来対応する場合はトークンから設計し直す。アクセント色は `.ml-acc-coral` / `.ml-acc-grass` / `.ml-acc-cobalt` の差し替えクラスだけで全体に伝播する。

モックのみに存在した `.ml-acc-graph` は実装未移植。必要になった場合は Git 履歴の削除前ディレクトリを参照する。

## タイポグラフィ

- `IBM Plex Sans JP`: 本文の既定書体
- `Geist`（sans）: ブランド表記・操作系コントロールなど非本文
- `JetBrains Mono`: 時刻・件数・メタ情報などの数値表示

## クラス命名

- `mle-`: Explorer / 共通シェル系（フレーム・カラム・アドレスバー・行など File/Library 共通の骨格）
- `mll-`: Library モード固有（軸レール・作品行・リッチ詳細・スマートルールなど）
- 状態は `is-` プレフィックス: 選択 = `.is-on`（paper-4 背景）、選択+フォーカス = `.is-on.is-focused`（黒地白文字に反転）。行・軸系コンポーネントを追加するときはこのパターンを踏襲する

`shell.css` は全規則がカスケードレイヤー内にある。UA要素のリセット（`button` / `input` / `a` / `ul` / `ol` 等）は `@layer base`、`mle-`/`mll-` のコンポーネント規則は `@layer components` に置く。Tailwind v4 のレイヤー順（`theme, base, components, utilities`）により、`@layer utilities`（Tailwindユーティリティ）が `components` より強く効くため、tsx側で `mle-`/`mll-` クラスと Tailwind ユーティリティを併用すると、ユーティリティ側で局所的に上書きできる。レイヤー外に素のセレクタを書くと、レイヤーの規則（unlayered が常に layered に勝つ）で utilities を問答無用で潰してしまうため、セレクタを足すときは必ずどちらかのレイヤー内に置く。

## Overlay / z-index の現在の階層

実装調査済みの値（正は実装）。

| 要素                            | z-index           |
| ------------------------------- | ----------------- |
| 並び替えメニューのポップアップ  | 30                |
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
ブラウザ標準実装に任せる。Escape・×ボタン・backdropクリックの閉じ方は progressive
dismissal に統一しており、3経路とも `useDialogModal` の `onClose` 1本に集約する。
編集中は内側の編集だけをキャンセルしてモーダルは開いたまま、非編集時は閉じる。
保存中に閉じない等の条件は各モーダルが `onClose` 内で判断する。

## Motion / cursor

- 構造的なモーション（要素の出入り・スライド等）は CSS トランジション + `usePresence` / `Presence`（`client/src/shared/ui/`）で実装する。既知の有限状態は `Presence` を並置し、動的リストの退出は省略して入場のみ CSS アニメーションとする
- hover は短い transition のみで十分。派手な演出は避ける
- 操作不能な要素は `cursor: not-allowed` にする
- 長時間ループするアニメーション（パルス等）は reduced motion 対応を原則とする

## テキスト選択

UI 全体は `shell.css` の `@layer base` で `body { user-select: none }` を既定とする（初回セットアップ画面・`document.body` へポータルするダイアログも含む）。`input` / `textarea` / `select` は同レイヤーで `user-select: text` を明示し、入力・IME・フィールド内選択を維持する。

コピー需要のあるテキスト（物理パス、RJコード、エラーメッセージ、CLI 例文、ルートフォルダーパス、作品情報ダイアログ本文など）は `.mll-selectable` を付与するか、既存のパス・警告・エラー用クラス（`.mle-prv__warn-path` / `.mle-fprev__path` 等、`shell.css` の `@layer components`）で `user-select: text` に戻す。一覧・グリッド・ファイル行のラベルは操作と競合するため選択可能に戻さない。

## アイコン

アイコンは `client/src/shared/ui/Icon.tsx` の `I` レジストリに集約する。呼び出し側は必ず `I.xxx` 経由で参照し、`lucide-react` を直接importしない。ライブラリ選定の経緯は [ADR-0009](adr/0009-icon-library-lucide.md)。

- 一般的な意匠で足りるアイコンは `lucide-react` から取得して `I` に登録する。製品固有の意匠（`ratio11`・`gridJustified`・`loopOne`・`swapLR`・プレイヤー系の塗り表現など、一般カタログに対応がないもの）は自作を維持し、同じ `I` に追加する
- stroke幅（1.5）・`currentColor`・`aria-hidden="true"` はアダプタ層（`Icon.tsx`）で固定する。呼び出し側やベンダー固有propsをこれらの値に触れさせない
- サイズは `IconButton` のサイズ契約（`sm`/`md`/`lg` = 箱26/30/38px、アイコン14/16/20px）に従う。呼び出し側で独自の数値を散らさない
- SVGは装飾（`aria-hidden`）とし、意味は `IconButton` 側の `aria-label` が担う。名前を持たないアイコン単体での使用を避ける

## モバイルレイアウト

方針の正は [ADR-0006](adr/0006-mobile-ui-strategy.md)。要点のみ:

- ブレークポイントは 768px の単一分岐（`tokens.css` のトークンが正）。768px以下は `AppShell` でなく `MobileShell`（ボトムタブ＋ミニプレイヤー）に切り替える設計（[ADR-0006](adr/0006-mobile-ui-strategy.md) 承認済み、`MobileShell` 自体は未実装）
- デスクトップ側コンポーネントに `md:` ユーティリティを散らして畳まない。操作系が異なるものはモバイル用ビューを別コンポーネントとして持つ
- スマホには管理系UI（タグ編集・スマートフォルダー編集・スキャン・設定）を持ち込まない。書き込みは「お気に入り」「あとで整理」タグのトグルのみ

## 将来UIの参考資料

スマートフォルダー条件エディタの新規作成フロー、複数chミキサーの詳細意匠、左ナビのラベル付き案、統計/メモ/詳細トラック表を含む拡張作品詳細のモックは、いずれもフェーズ1未実装の将来UI案として Git 履歴の削除前ディレクトリ（`docs/design_handoff_mimimilli_library/`、2026-07-03 削除時点のコミット）から復元できる。着手時に参照する。
