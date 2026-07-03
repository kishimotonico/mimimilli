# URL 同期とナビゲーション履歴

Status: done

## 目的

- ライブラリ・ファイルの現在地を人が読める URL に同期する
- リロード、ブラウザの戻る/進む、AddressBar の戻る/進むを同じ履歴で動かす
- 既存の Jotai atom と `App.tsx` の mode を状態の正本として維持する

## 設計

React Router は導入せず、URL の parse/serialize を行う純粋な codec と、History API を扱う React hook を分離する。既存 UI は画面ルート単位ではなく Jotai の細かな状態を共有しており、ルーターへ正本を移すと Query key と各 feature の操作 API を広く組み直す必要があるためである。

履歴方針:

- push: モード、軸、ドリル、タグ、ファイルディレクトリの変更
- replace: 作品・ファイル選択、ソート
- popstate: URL を parse して mode と atom へ一括反映する
- `/` は初期表示を変えず `/library/all` へ replace する

AddressBar の履歴端判定には History API が cursor を公開しないため、各 `history.state` にアプリ内 index を付与し、到達済み最大 index を `sessionStorage` に保存する。

## 作業項目

- [x] URL codec と単体テスト
- [x] history 同期 hook
- [x] library/files の push/replace intent 配線
- [x] AddressBar の戻る/進むとライブラリパンくず配線
- [x] `pnpm check` / `pnpm test` / agent-browser 検証
- [ ] Playwright visual（sandbox が Vite の listen と Chromium 起動を拒否するため未完了）

## URL 仕様

- ライブラリ: `/library/<axis>`
- ファセット drill: `/library/<axis>/<value>`
- タグ: `?tags=<tag>` を複数指定
- 作品選択: `?work=<work-id>`
- sort: 既定値以外を `?sort=<sort-id>`
- ファイル: `/files/<root-relative-segments>`
- ファイル選択: root 相対パスを `?sel=<relative-path>`

すべての pathname segment と query は URL 標準の percent encoding を使う。`/` は `/library/all` へ replace する。

## 検証結果

- `pnpm check`: 成功
- `pnpm test`: 成功（server 11 tests、client 52 tests）
- agent-browser: `/` の canonicalize、library drill、タグ複数、作品選択、sort、files 日本語パス、ファイル選択、reload、AddressBar 戻る/進む、パンくず、不正軸の warn と fallback を確認
- Playwright: `pnpm exec playwright test` は webServer の listen が `EPERM`。既存サーバー向け一時 config でも Chromium が sandbox host の `Operation not permitted` で起動できず、テスト本体と画像比較には未到達
- visual snapshot ファイル: 変更なし
