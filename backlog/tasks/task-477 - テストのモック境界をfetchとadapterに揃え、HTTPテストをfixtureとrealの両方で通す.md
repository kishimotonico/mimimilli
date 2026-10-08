---
id: TASK-477
title: テストのモック境界をfetchとadapterに揃え、HTTPテストをfixtureとrealの両方で通す
status: Done
assignee:
  - '@mimi2'
created_date: '2026-10-02 11:40'
updated_date: '2026-10-08 07:33'
labels:
  - test
  - client
  - server
dependencies: []
priority: medium
ordinal: 535000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
2026-10-02の点検で、契約を検証できないテストが見つかった。client: entities/*/api をvi.mockで丸ごと差し替えるテスト（DlsiteEditor, WorkEditDialog, usePlayer等）はレスポンスがsharedのZodスキーマを通る保証が無い。propsの通過やrender回数だけを見る配線テスト（appBodyDockedBarWiring, appRootSubscriptions, playerDock*, workPatchMutationScope等）は実装詳細に結合している。getBy*にtoBeTruthy()、length > 0 だけの期待値も残る。setup.tsの global.fetch = vi.fn() は未モック呼び出しを黙ってundefinedにする。server: route/HTTPテスト（app, smartFolderPagination, worksPagination, smartFolderPreviewRoute, tagPrefixes, scanCandidatesRoute）がfixtureのみ。dlsiteProgress.test.ts:10 はDataAdapterを as unknown as の空スタブにしている。
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 clientのAPIモックがfetch境界で行われ、レスポンスがsharedのスキーマ検証を通るビルダーで作られている
- [x] #2 未モックのfetch呼び出しがテストを失敗させる
- [x] #3 serverの主要route/HTTPテストがfixtureとrealの両adapterで同じ期待値を通る
- [x] #4 実装詳細にのみ結合した配線テストと恒真的な期待値が、振る舞いを検証する形に置き換わるか削除されている
- [x] #5 期待値を緩めた変更が無いことをテスト差分で確認できる
- [x] #6 pnpm check && pnpm test が通り、所要時間が大きく増えない
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-04 Codex(Astra)レビュー（tmp/structural-audit-2026-10-02/review-astra.md）を反映: AC#3の「主要route」は着手時に対象routeとケースを列挙して決める。fixtureの意図的な簡略化（DRAFT-56の未決事項）まで全面的に真似させない。AC#6の所要時間は着手前に基準を測り、許容幅を決めておく。

2026-10-08 server担当(task/477-server): AC#3完了。tests/helpers/contractHarness.ts(defineContract)で同一ライブラリをfixture/realの両adapterに用意し、app・worksPagination・smartFolderPagination・smartFolderPreviewRoute・tagPrefixes(HTTP部)・scanCandidatesRouteを両adapterで通す。dlsiteProgress/dlsiteEventsRouteの空スタブ(as unknown as)はtests/helpers/adapterStub.ts(withRunDlsiteBulk=fixture adapter+1メソッド差し替え)へ置換。AC#4/#5/#6のserver分は実施済み(全体のチェックはclient側完了後)。server test 952→1025件、所要は基準18.4/28.1/24.6sに対し15.8s。

2026-10-08 server担当 AC#5: 削除・改題された18件の行き先（欠落なし）。契約テストは fixture / real 両方で実行。

| 旧題名 | 行き先 | 保証 |
|---|---|---|
| axes は tags/tagOp を adapter へ渡す。擬似タグも含む | app.test.ts「axes は tags/tagOp で作品を絞り込んで集計する」「…組み込み軸の擬似タグも絞り込みに含める」 | 引数の受け渡しではなく集計結果で検証 |
| axes はクエリ省略時、空フィルタを adapter へ渡す | app.test.ts「axes は tagOp 省略時 AND で絞り込む」「axes/cv は count 降順で返す」 | 省略時 AND の既定を結果で区別（AND=0件/OR=2件） |
| GET /api/tag-prefixes は seed 済みの初期定義を返す | tagPrefixes.test.ts「GET /api/tag-prefixes は初期定義を order 昇順で返す」 | 改題 |
| GET /api/tag-prefixes/candidates は未登録 prefix を返す | tagPrefixes.test.ts「…candidates は作品に現れる未登録 prefix を件数降順で返す」 | 件数・並び・登録後に消えることまで強化 |
| GET /api/works は ids 未指定なら絞り込まない | app.test.ts「GET /api/works は登録済みの全作品を {items, total} で返す」 | stub の undefined 検査を、全作品が返る結果検証に置換 |
| GET /api/works は {items, total} を返す | 同上 | 改題。作品ID集合まで検証 |
| GET /api/works は正しい @year/2024 擬似タグを受理する | app.test.ts「…正しい @year/YYYY 擬似タグで追加年に絞り込む」 | 受理だけでなく当年=全件・1999年=0件 |
| GET /api/works/:id の JSON に sourceRevision は無い | app.test.ts「…JSON に sourceRevision は無く、/source が返す」 | 改題 |
| PATCH は mimimilli.json 競合を 409 source_changed で返す | app.test.ts「PATCH …は古い sourceRevision を 409 source_changed で返す」 | stub の例外送出を実際の古いrevisionでの409に置換 |
| PATCH: 正規化後に空になるタグは 400 | tagPrefixes.test.ts「PATCH …: 正規化後に空になるタグは400で拒否し、保存しない」 | 改題（保存されないことを追加） |
| rules が空配列でも受け付ける | smartFolderPreviewRoute.test.ts「rulesが空配列なら全作品が対象になる」 | 受理に加え全件数を検証 |
| スキャン後の新規作品も先頭ページ外なら次ページで取得できる | worksPagination.test.ts 末尾の境界ケース（ちょうど200件／201件、2ページ目の件数）と「デフォルト limit を超えた分は次ページで取得できる」 | 実データで境界を検証 |
| ルールを adapter へそのまま渡し、件数を total として返す | smartFolderPreviewRoute.test.ts「ルールに一致する作品数を total として返す」 | 配線検査（引数の受け渡し）を削除。WHERE/AND/OR の評価結果の件数で代替 |
| 作品検索 q が HTTP クエリから…evalSmartFolder まで渡る | smartFolderPagination.test.ts「作品検索qがHTTPクエリから評価まで渡る」 | 改題。stub を実評価に置換 |
| 候補API は取得・一括登録・stale拒否を提供し、登録ごとに DLsite 取得を enqueue | scanCandidatesRoute.test.ts「候補一覧は…」「候補を登録すると作品一覧に加わり…」「候補の除外は…」（契約）、「候補登録は登録された作品ごとにDLsite取得をenqueueする」（stub）、「候補にないパスを含む登録・除外は409で拒否し…」（real） | 5要素を分割。取得・登録・除外は実挙動、stale拒否は real の実409、enqueue は stub で維持 |
| 候補登録 API は rjCode 省略と空文字を区別して adapter へ渡す | scanCandidatesRoute.test.ts「候補登録のrjCodeは省略ならフォルダー名からの推定値、空文字なら明示的なしとして保持される」（real）、「…rjCodeは正規化して作品のDLsite連携に反映される」 | 配線検査を、登録後の作品の dlsite.rjCode での検証に置換 |
| 候補登録 API は不正な形式の RJ コードを 4xx で拒否し、adapter へ渡さない | scanCandidatesRoute.test.ts「…不正な形式のRJコードを400で拒否し、何も登録しない」 | 「渡さない」を、作品数・候補一覧が不変で検証 |
| 候補登録 API は全失敗を成功なしの結果として返し、stale は 409 で書込み前に拒否 | scanCandidatesRoute.test.ts「候補登録APIは全失敗を成功なしの結果として201で返す」（stub）＋ real の409テスト（書込みゼロ確認） | 前半は改題、後半は real の実409で代替 |

client担当(task/477-client): AC#2 setup.tsのglobal.fetchを未モック呼び出しで拒否+afterEachで失敗にした(AC#2はclient側のみで完結)。AC#5 削除アサーション一覧と置換対応を完了報告に記載。AC#1(builders/mockApiを追加し vi.mock・spyOn による entities/features api の差し替えを全廃。手組みfetchスタブ13ファイルが残る)、AC#4(appBodyDockedBarWiring.test.tsxの削除待ち)、AC#6(server側の所要時間は別担当)は未チェック。

2026-10-08 client担当 AC#5: 削除・改題されたテストの行き先（欠落なし）。client 全体で fetch 境界のモック化とスキーマ検証済みビルダー化を実施（client/tests/helpers/api.ts・builders.ts・appShellApi.ts）。

| 旧題名（ファイル） | 行き先 | 保証 |
|---|---|---|
| AppBody: dockedBarActiveがLibraryView配下まで届く配線 / 再生中でない…falseが届く・bar表示中…trueが末端まで届く（appBodyDockedBarWiring.test.tsx、削除） | appBodyDockedBar.test.tsx「再生バーが表示されているとき、作品一覧の末尾余白が増える」 | 子コンポーネントのモックと data 属性の検証を、実 AppBody・LibraryView・WorkListPane の仮想化ラッパー高さの差（+8px）に置換。配線を壊すと落ちることを確認済み |
| PlayerDock popup: 退出開始と同時に outside press/keydown/scroll リスナーが解除される（playerDockPopupListeners.test.tsx） | 同ファイル「表示中はEscapeで再生速度メニューが閉じる」「バーへ戻る退出中は、Escapeや外側クリックに再生速度メニューが反応しない」 | addEventListener 呼び出し回数の検証を、退出中に Escape・外側クリックでメニューが閉じないという観測可能な挙動に置換（isOpen && isPresent を外すと落ちる）。表示中に閉じる陽性対照つき |
| bar→popup切替後、入場アニメ完了でswitching状態が解除される（playerDock.test.tsx） | 同ファイル「bar→popup切替で、退出アニメ完了後にpopupだけが残る」 | 内部フラグ data-ui-switching の有無を削除。切替後に残る UI を検証 |
| popup→bar切替後もswitching状態が解除される（同上） | 同ファイル「popup→bar切替で、退出アニメ完了後にbarだけが残る」 | 同上 |
| 高速連続切替でも…switching解除（onExitComplete相当）が発火しない（同上） | 同ファイル「切替アニメの途中で折り返しても、最終的に折り返し先の1つだけが残る」 | MutationObserver による削除回数 (toBe(1)) の検証を削除。実装詳細（AnimatePresence の onExitComplete 回数）であり、利用者に見える結果（最終的に1つだけ残る）を代わりに保証 |
| 差分ありの対象を全選択した状態で開き、選択したworkIdだけをapplyDlsiteMissingへ渡す（DlsiteBulkApplyDialog.test.tsx） | 同ファイル「…選択したworkIdだけを適用リクエストに送る」 | 改題。関数呼び出しの検証を POST /api/dlsite/apply-missing のボディ検証に置換 |
| チェックを外した作品はapplyDlsiteMissingの引数から除かれる（同上） | 同ファイル「チェックを外した作品は適用リクエストから除かれる」 | 改題。同上 |
| キャンセルでは applyDlsiteMissing を呼ばない（同上） | 同ファイル「キャンセルでは適用リクエストを送らない」 | 改題。リクエスト数 0 を検証 |
| 新規作品があればdlsiteBulk.attach相当（getDlsiteBulkStatus）を呼ぶ（appReconfiguringScreen.test.tsx） | 同ファイル「新規作品があればDLsite一括取得の状態を取得してattachする」 | 改題。GET /api/dlsite/bulk のリクエスト有無を検証 |
| 新規作品が無ければgetDlsiteBulkStatusを呼ばない（同上） | 同ファイル「新規作品が無ければDLsite一括取得の状態を取得しない」 | 改題。同上 |
| パス送信で startRootReconfiguration を呼び、成功後は settings を再取得する（setupScreen.test.tsx） | 同ファイル「パス送信でroot再設定を開始し、成功後は settings を再取得する」 | 改題。POST /api/root-reconfiguration のボディと GET /api/settings の再取得を検証 |

アサーション単位の置換（題名は変更なし）:

- getBy*/findBy* に付いた toBeTruthy() 91 件 → toBeInTheDocument()（getBy は見つからなければ投げるため元は恒真。検証内容は同じ以上）
- DOM 要素・querySelector 結果の toBeTruthy() 約 20 件 → toBeInTheDocument()
- AxisValueList.test.tsx の存在しないクラス `.mll-vrow__add` の toBeNull 2 件 → role と名前（AND追加）で縛る形。AxisValueQuickList.test.tsx の `.mll-qlist__add` も同形に揃え、追加ボタンがある行で getByRole が通ることで陽性対照にした
- smartFolderInvalidation.test.ts の toBeFalsy() 2 件 → toBe(false)
- モック関数の呼び出し検証（toHaveBeenCalled / CalledWith / CalledTimes / not.toHaveBeenCalled。usePlayer・resumePersistence・rootReconfigurationControllerFlow・scanModal・TagPrefixSettings・FilePreviewPlayback・FilterChipBand・smartFolderEditorModal・useSmartFolderRuleMatchCountQuery ほか）→ fetch リクエストの回数・メソッド・パス・ボディの検証（同じ対象を同じ強さで検証）
- 保留: appRootSubscriptions.test.tsx（AppShell の再描画回数）は陽性対照つきの性能回帰ガードのため残した。workPatchMutationScope.test.tsx は実 UI と fetch でミューテーション状態の分離を見る振る舞いテストのため残した

AC#1 client: vi.mock / spyOn による entities・features の api モジュール差し替えは 0 件。手組みだった fetch スタブはすべて builders（shared スキーマの parse）経由に寄せた。SSE のイベントも buildScanJobEvent・dlsiteBulkProgressEventSchema.parse を通して送出（意図的に不正な payload を送る 1 件のみ dispatchRawDlsite）。未モック fetch は setup.ts で全件失敗。残る手組みは http.test・api.test・apiError*・formatUserError・apiErrorSubscription の HTTP 層テストのみ（任意スキーマ・不正ボディの扱いを検証する目的）。
AC#4 client: appBodyDockedBarWiring 削除済み・上表のとおり置換。AC#6 client: pnpm check と pnpm test が pass、client 所要時間は着手前 43.8/34.1/26.3 秒（負荷でばらつき、最速 26.3）に対し変更後 25.2/25.6/25.1 秒。

表の題名の表記の補足: 「ルールに一致する作品数を total として返す」の実際の題名は smartFolderPreviewRoute.test.ts の「ルールに一致する作品数をtotalとして返す」、「古い sourceRevision を 409」は app.test.ts の「古いsourceRevisionを409」（空白の有無のみの違い）。TASK-464 で derivePort.test.ts の4件（cwd からのポート導出・forbidden port 回避）は対象の関数ごと廃止したため削除し、空きポート確保と supervise は smoke の起動自体で検証する。
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
client は API モックを fetch 境界の mockApi とスキーマを parse する builders に揃え、未モックの fetch でテストを失敗させ、配線テストと恒真的な期待値を振る舞いの検証に置き換えた。server は defineContract で主要6 route を fixture と real の両 adapter に同じ期待値で通し、空スタブをやめた。削除テストの行き先は Notes の表。 個別レビュー＋横断レビュー、master への仮マージで pnpm check・test（server 1031 / client 1335）・smoke 31 全通過。054e2e09 で master へマージ。
<!-- SECTION:FINAL_SUMMARY:END -->
