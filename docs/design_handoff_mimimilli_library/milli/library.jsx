// mimimilli — Library detail panels + scenes
//   LibWorkDetail (rich preview with stats / related / track play counts)
//   AxisLanding (preview when an axis is highlighted but no concrete work)
//   SmartFolderPreview (rule UI + result hits)
//   Scenes: Home, Circle, Tag (multi), Smart, Detail, CrossMode
/* eslint-disable */
/* global ML_WORKS, ML_CoverFrame, ML_Tag, ML_I, ML_TRACKS_YORULIB,
          LIB_AppBar, LIB_Address, LIB_Sidebar, LIB_AxisColumn, LIB_WorkRow,
          LIB_EntryRow, LIB_Mixer, LIB_CHS_1, LIB_CHS_2, LIB_CHS_3,
          LIB_FIcon, LIB_AXES_DATA */

const I_LL = ML_I;
const W_LL = (id) => ML_WORKS.find(w => w.id === id);

// ── Library-rich work preview ──
function LibWorkDetail({ work, playCount = 14, lastPlayed = "昨日 23:12", totalListened = "8:42:00", rating = 4 }) {
  const related = [
    W_LL("w-amaoto-natsu"),
    W_LL("w-fuyu-yamagoya"),
    W_LL("w-todai"),
    W_LL("w-koshoten"),
  ];
  return (
    <div className="mle-prv">
      <div className="mle-prv__hd">
        <span className="label">作品 · ライブラリ</span>
        <span className="pill">登録済 · {work.fileCount}ファイル</span>
        <span style={{flex: 1}}/>
        <button className="mll-fab"><I_LL.folder size={11}/> 物理ファイル</button>
        <button className="mll-fab"><I_LL.more size={13}/></button>
      </div>
      <div className="mle-prv__body">

        {/* Hero */}
        <div className="mle-prv__hero">
          <div className="mle-prv__cover">
            <ML_CoverFrame id={`d-${work.id}`} kind={work.cover} inks={work.inks} paper={work.paper} title={work.title}/>
          </div>
          <div className="mle-prv__meta">
            <div className="mle-prv__kicker">
              <span className="reg">登録済</span>
              <span>· {work.addedAt} 追加</span>
              <span>· 最終再生 {lastPlayed}</span>
            </div>
            <h2 className="mle-prv__title">{work.title}</h2>
            <div className="mle-prv__sub">{work.subtitle}</div>
            <div className="mle-prv__row">
              <span><b>{work.trackCount}</b> tracks</span>
              <span className="dot">·</span>
              <span>合計 <b>{work.duration}</b></span>
              <span className="dot">·</span>
              <div className="mll-rating">
                {[1,2,3,4,5].map(n => (
                  <button key={n} className={n <= rating ? "is-on" : ""}><I_LL.starF size={12}/></button>
                ))}
              </div>
            </div>
            <div className="mle-prv__tags">
              {work.tags.slice(0, 6).map((t, i) => <ML_Tag key={i} tag={t}/>)}
            </div>
            <div className="mle-prv__actions">
              <button className="ml-btn-primary"><I_LL.play size={12}/> 最初から再生</button>
              <button className="ml-btn-ghost"><I_LL.add size={12}/> Ch に追加</button>
              <button className="ml-btn-ghost"><I_LL.queue size={12}/> キュー</button>
              <button className="ml-btn-ghost"><I_LL.heart size={12}/></button>
              <button className="ml-btn-ghost"><I_LL.more size={13}/></button>
            </div>
          </div>
        </div>

        {/* Listening stats */}
        <div className="mll-stats">
          <div className="item">
            <span className="k">再生回数</span>
            <span className="v">{playCount}<span className="sub">回</span></span>
          </div>
          <div className="item">
            <span className="k">累計時間</span>
            <span className="v">{totalListened}</span>
          </div>
          <div className="item">
            <span className="k">最終再生</span>
            <span className="v" style={{fontSize: 12}}>{lastPlayed}</span>
          </div>
          <div className="item">
            <span className="k">完聴率</span>
            <span className="v">68<span className="sub">%</span></span>
          </div>
        </div>

        {/* Personal notes — sticky */}
        <div className="mll-notes">
          <div className="mll-notes__hd">
            <I_LL.text size={10} className="pen"/>
            <span>メモ</span>
          </div>
          雨脚が落ち着いた閲覧室で、ひとり読書を続けるあなたへ。Tr05「栞をはさむ」が一番好み。
          Tr08 は雷鳴が強めなので就寝用には注意。
        </div>

        {/* Track list with play counts */}
        <div className="mll-sect">
          <span className="mll-sect__title">トラック</span>
          <span className="mll-sect__count">{work.trackCount} 件</span>
          <span className="mll-sect__rule"/>
          <button className="mll-sect__more">並び替え</button>
        </div>
        <div>
          <div className="mll-rtrk is-head">
            <span className="num">#</span>
            <span className="name">タイトル</span>
            <span className="dur">長さ</span>
            <span className="pc">再生</span>
            <span className="last">最終</span>
            <span className="act"/>
          </div>
          {ML_TRACKS_YORULIB.slice(0, 8).map((t) => {
            const pc = [3, 1, 0, 2, 14, 1, 0, 6][t.i - 1] || 0;
            const last = ["3日前", "1週間前", "—", "5日前", "昨日", "2週間前", "—", "先週"][t.i - 1] || "—";
            return (
              <div key={t.i} className={`mll-rtrk ${t.playing ? "is-now" : ""}`}>
                <span className="num">
                  {t.playing ? <span className="barwave"><span/><span/><span/></span> : String(t.i).padStart(2, "0")}
                </span>
                <span className="name">{t.name}</span>
                <span className="dur">{t.dur}</span>
                <span className={`pc ${pc === 0 ? "zero" : ""}`}>{pc}</span>
                <span className="last">{last}</span>
                <span className="act">
                  <button className="ml-iconbtn" title="再生"><I_LL.play size={11}/></button>
                  <button className="ml-iconbtn" title="Ch追加"><I_LL.add size={11}/></button>
                </span>
              </div>
            );
          })}
        </div>

        {/* Related works */}
        <div className="mll-sect">
          <span className="mll-sect__title">関連</span>
          <span className="mll-sect__count">同サークル · 同タグ</span>
          <span className="mll-sect__rule"/>
        </div>
        <div className="mll-related">
          {related.map((r, i) => {
            const pcs = [12, 3, 7, 9];
            return (
              <div key={i} className="mll-related__card">
                <div className="mll-related__cover">
                  <ML_CoverFrame id={`rl-${r.id}-${i}`} kind={r.cover} inks={r.inks} paper={r.paper} title={r.title}/>
                  <span className="mll-related__playct">{pcs[i]}回</span>
                </div>
                <span className="mll-related__title">{r.title}</span>
                <span className="mll-related__meta">
                  <span>{r.tags.find(t => t.k === "サークル")?.v || r.tags.find(t => t.k === "シリーズ")?.v || "—"}</span>
                  <span className="dot">·</span>
                  <span>{r.duration}</span>
                </span>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}

// ── Axis landing preview — shown when an axis is the focused col
//    but no specific entry/work is picked yet. Summarises the slice. ──
function AxisLanding({ axisName, count, sortKey = "追加日", topWorks }) {
  return (
    <div className="mle-prv">
      <div className="mle-prv__hd">
        <span className="label">{axisName}</span>
        <span className="pill">{count} 件</span>
        <span style={{flex: 1}}/>
        <button className="mll-fab"><I_LL.sort size={11}/> {sortKey}</button>
        <button className="mll-fab"><I_LL.filter size={11}/> 絞り込み</button>
      </div>
      <div className="mle-prv__body">

        <div style={{display: "flex", flexDirection: "column", gap: 6, marginBottom: 18}}>
          <div style={{fontFamily: "var(--font-sans)", fontSize: 11, letterSpacing: "0.08em", color: "var(--ink-3)", textTransform: "uppercase", fontWeight: 600}}>
            このスライス
          </div>
          <h2 style={{margin: 0, fontFamily: "var(--font-jp)", fontSize: 26, fontWeight: 600, color: "var(--ink-0)", letterSpacing: "-0.005em"}}>
            {axisName} <span style={{color: "var(--ink-2)", fontWeight: 500, fontFamily: "var(--font-mono)", fontSize: 16, marginLeft: 8}}>({count})</span>
          </h2>
          <div style={{fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.6, maxWidth: 480}}>
            登録済みの全347作品から、この軸で抽出した一覧です。カラムビューでドリルダウンするか、右下のメニューから一括操作（Ch にまとめて追加、CSVエクスポート、スマートフォルダーに保存）が行えます。
          </div>
          <div style={{display: "flex", gap: 6, paddingTop: 6}}>
            <button className="ml-btn-primary"><I_LL.add size={12}/> スマートフォルダーに保存</button>
            <button className="ml-btn-ghost"><I_LL.queue size={12}/> 全件をキューに</button>
            <button className="ml-btn-ghost"><I_LL.download size={12}/> エクスポート</button>
          </div>
        </div>

        <div className="mll-sect">
          <span className="mll-sect__title">上位 — 再生回数順</span>
          <span className="mll-sect__count">8 件</span>
          <span className="mll-sect__rule"/>
        </div>
        <div className="mll-related" style={{gridTemplateColumns: "repeat(4, 1fr)", gap: 12}}>
          {topWorks.map((w, i) => (
            <div key={i} className="mll-related__card">
              <div className="mll-related__cover">
                <ML_CoverFrame id={`tl-${w.id}-${i}`} kind={w.cover} inks={w.inks} paper={w.paper} title={w.title}/>
                <span className="mll-related__playct">{[24, 18, 14, 12, 9, 8, 6, 4][i] || 1}回</span>
              </div>
              <span className="mll-related__title">{w.title}</span>
              <span className="mll-related__meta">
                <span>{w.tags.find(t => t.k === "サークル")?.v || w.tags.find(t => t.k === "シリーズ")?.v || "—"}</span>
                <span className="dot">·</span>
                <span>{w.duration}</span>
              </span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

// ── Smart folder builder ──
function SmartFolderPreview({ name = "就寝用ロング", hits = 9 }) {
  const matched = [W_LL("w-makistove"), W_LL("w-tokei"), W_LL("w-fuyu-yamagoya"), W_LL("w-todai")];
  return (
    <div className="mle-prv">
      <div className="mle-prv__hd">
        <span className="label">スマートフォルダー</span>
        <span className="pill">SAVED · 編集可能</span>
        <span style={{flex: 1}}/>
        <button className="mll-fab is-primary"><I_LL.play size={11}/> 全件再生</button>
      </div>
      <div className="mle-prv__body">

        <div className="mll-smart">
          <div className="mll-smart__hd">
            <span className="pill">SMART</span>
            <span className="name">{name}</span>
            <button className="mll-fab"><I_LL.refresh size={11}/> 再評価</button>
            <button className="mll-fab"><I_LL.bookmark size={11}/></button>
          </div>

          <div style={{fontFamily: "var(--font-sans)", fontSize: 10.5, letterSpacing: "0.08em", color: "var(--ink-3)", textTransform: "uppercase", fontWeight: 600}}>
            条件 — すべてを満たす作品
          </div>

          <div className="mll-smart__rules">
            <div className="mll-smart__rule">
              <span className="conj first">WHERE</span>
              <span className="field"><I_LL.audio size={10}/> 長さ</span>
              <span className="op">≥</span>
              <span className="val"><span className="mono">3:00:00</span></span>
              <button className="x"><I_LL.x size={10}/></button>
            </div>
            <div className="mll-smart__rule">
              <span className="conj">AND</span>
              <span className="field"><I_LL.filter size={10}/> カテゴリ</span>
              <span className="op">=</span>
              <span className="val">環境音 <span className="mono" style={{color: "var(--ink-3)"}}>OR</span> ASMR</span>
              <button className="x"><I_LL.x size={10}/></button>
            </div>
            <div className="mll-smart__rule">
              <span className="conj">AND</span>
              <span className="field"><I_LL.filter size={10}/> タグ</span>
              <span className="op">∋</span>
              <span className="val">睡眠用 <span className="mono" style={{color: "var(--ink-3)"}}>OR</span> 長時間 <span className="mono" style={{color: "var(--ink-3)"}}>OR</span> 焚き火</span>
              <button className="x"><I_LL.x size={10}/></button>
            </div>
            <div className="mll-smart__rule">
              <span className="conj">AND NOT</span>
              <span className="field"><I_LL.filter size={10}/> タグ</span>
              <span className="op">∋</span>
              <span className="val">R-15</span>
              <button className="x"><I_LL.x size={10}/></button>
            </div>
          </div>

          <button className="mll-smart__add">
            <I_LL.add size={11}/> 条件を追加
          </button>

          <div className="mll-smart__ft">
            <span className="hits"><b>{hits}</b> 件マッチ · 累計 41:18:30</span>
            <span style={{color: "var(--ink-4)"}}>·</span>
            <span className="sort">並び: 再生回数 ↓</span>
            <span className="right">
              <button className="ml-btn-ghost" style={{height: 26, padding: "0 8px", fontSize: 11}}>名前変更</button>
              <button className="ml-btn-ghost" style={{height: 26, padding: "0 8px", fontSize: 11, color: "var(--r-coral)"}}>削除</button>
            </span>
          </div>
        </div>

        <div className="mll-sect">
          <span className="mll-sect__title">マッチした作品</span>
          <span className="mll-sect__count">{hits} 件</span>
          <span className="mll-sect__rule"/>
        </div>

        <div className="mll-related">
          {matched.map((w, i) => (
            <div key={i} className="mll-related__card">
              <div className="mll-related__cover">
                <ML_CoverFrame id={`sm-${w.id}-${i}`} kind={w.cover} inks={w.inks} paper={w.paper} title={w.title}/>
                <span className="mll-related__playct">{[8, 5, 12, 3][i]}回</span>
              </div>
              <span className="mll-related__title">{w.title}</span>
              <span className="mll-related__meta">
                <span>{w.duration}</span>
                <span className="dot">·</span>
                <span>{w.tags.find(t => t.k === "サークル")?.v || "—"}</span>
              </span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

// ── Tag intersection column (multi-select tags w/ AND semantics) ──
function TagIntersectionColumn({ selectedTags = ["雨音", "長時間"], tags, hits }) {
  return (
    <div className="mle-col">
      <div className="mle-col__hd">
        <span>タグ</span>
        <span className="count">{tags.length} 件 / 62</span>
      </div>

      {/* Selected tags band */}
      <div className="mll-tagband">
        <span className="mll-tagband__lbl">条件</span>
        {selectedTags.map((t, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="mll-tagband__and">AND</span>}
            <span className="mll-tagband__chip">
              {t}
              <button className="x"><I_LL.x size={9}/></button>
            </span>
          </React.Fragment>
        ))}
        <span className="mll-tagband__count">{hits} 件ヒット</span>
      </div>

      <div className="mle-col__list">
        {tags.map((t, i) => (
          <div key={i} className={`mll-tagrow ${t.checked ? "is-checked" : ""} ${t.focused ? "is-on" : ""}`}>
            <span className="check">{t.checked && <I_LL.add size={9} style={{transform: "rotate(45deg)"}}/>}</span>
            <span className="nm">
              <span className="sw" style={{background: t.color || "var(--ink-3)"}}/>
              {t.name}
            </span>
            <span className="count">{t.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Scenes — 3-pane model (axis rail · content column · preview)
// Facet drill stacks INTO the content column (no extra column).
// ────────────────────────────────────────────────────────────────

// Frame: mixer height adapts to channel count
function LibFrame({ mode = "library", path, children, mixer = LIB_CH_SINGLE, sidebarView = null, peek, primaryTrack }) {
  const mixClass = mixer.length === 0 ? "is-mixer-empty" : mixer.length === 1 ? "is-mixer-single" : "";
  const pt = primaryTrack || (mixer[0] && mixer[0].track) || "";
  return (
    <div className="mle-app">
      <div className={"mle-frame is-lib " + mixClass}>
        <LIB_AppBar mode={mode} playingCount={mixer.length} primaryTrack={pt}/>
        <LIB_Address path={path}/>
        <LIB_Sidebar mode={mode} view={sidebarView}/>
        <div className="mle-body" style={{position: "relative"}}>
          {children}
          {peek}
        </div>
        <LIB_Mixer channels={mixer}/>
      </div>
    </div>
  );
}

// ── Scene A: Library Home (axis = すべての作品) — 3 panes ──
function LibraryHome() {
  const works = ML_WORKS.slice(0, 11);
  return (
    <LibFrame mode="library" path={["ライブラリ", "すべての作品"]} mixer={LIB_CH_SINGLE}>
      <div className="mle-cols">
        <LIB_AxisColumn activeId="all" focusedId="all"/>
        <div className="mle-col is-content">
          <div className="mle-col__hd">
            <span>すべての作品</span>
            <span className="count">347</span>
          </div>
          <div className="mle-col__list">
            {works.map((w, i) => (
              <LIB_WorkRow
                key={w.id}
                work={w}
                current={i === 0}
                focused={i === 0}
                playing={w.id === "w-yorulib-1"}
                fav={[0, 3, 6].includes(i)}
              />
            ))}
          </div>
        </div>
        <LibWorkDetail work={W_LL("w-yorulib-1")}/>
      </div>
    </LibFrame>
  );
}

// ── Scene B: by サークル — DRILL STACKING (parent collapses into header) ──
function LibraryByCircle() {
  const yasokyokuWorks = ML_WORKS.filter(w => w.tags.some(t => t.k === "サークル" && t.v === "夜想曲"));
  return (
    <LibFrame mode="library" path={["ライブラリ", "サークル", "夜想曲"]} mixer={LIB_CH_SINGLE}>
      <div className="mle-cols">
        <LIB_AxisColumn activeId="circle" focusedId={null}/>
        <div className="mle-col is-content">
          <div className="mle-col__hd">
            <span>サークル</span>
            <span className="count">32</span>
          </div>
          <LIB_DrillHeader
            crumbs={[{ axis: "サークル", value: "夜想曲", count: "3 作品", icon: <ML_I.folder size={12}/> }]}
            sub={{ label: "この サークル の作品", count: "3" }}
          />
          <div className="mle-col__list">
            {yasokyokuWorks.map((w, i) => (
              <LIB_WorkRow
                key={w.id}
                work={w}
                current={i === 0}
                focused={i === 0}
                playing={w.id === "w-yorulib-1"}
              />
            ))}
          </div>
        </div>
        <LibWorkDetail work={W_LL("w-yorulib-1")}/>
      </div>
    </LibFrame>
  );
}

// ── Scene C: by タグ (multi-select intersection) — results in preview ──
function LibraryByTag() {
  const tags = [
    { name: "雨音",     count: "8",  checked: true,  color: "var(--r-sky)" },
    { name: "長時間",   count: "12", checked: true,  color: "var(--r-coral)" },
    { name: "焚き火",   count: "4",  color: "var(--r-coral)" },
    { name: "ページめくり", count: "3", color: "var(--r-mustard)" },
    { name: "バイノーラル", count: "11", color: "var(--r-plum)" },
    { name: "睡眠用",   count: "9",  color: "var(--r-sky)" },
    { name: "蝉",       count: "2",  color: "var(--r-leaf)" },
    { name: "風",       count: "5",  color: "var(--r-leaf)" },
    { name: "BGM",      count: "14", color: "var(--ink-2)" },
    { name: "朗読",     count: "6",  color: "var(--r-plum)" },
    { name: "ループ可", count: "4",  color: "var(--r-mustard)" },
  ];
  const matched = ML_WORKS.slice(0, 3).concat(ML_WORKS.slice(0, 1));
  return (
    <LibFrame mode="library" path={["ライブラリ", "タグ", "雨音 × 長時間"]} mixer={LIB_CH_SINGLE}>
      <div className="mle-cols">
        <LIB_AxisColumn activeId="tag" focusedId={null}/>
        <TagIntersectionColumn selectedTags={["雨音", "長時間"]} tags={tags} hits={3}/>
        <AxisLanding
          axisName="雨音 × 長時間"
          count={3}
          sortKey="再生回数"
          topWorks={matched}
        />
      </div>
    </LibFrame>
  );
}

// ── Scene D: Smart folder — col0 selects folder, col1 = its matched works ──
function LibrarySmart() {
  // works matched by the "就寝用ロング" rules
  const matchIds = ["w-makistove", "w-tokei", "w-fuyu-yamagoya", "w-todai", "w-amaoto-natsu"];
  const matched = matchIds.map(W_LL).filter(Boolean);
  while (matched.length < 7) matched.push(ML_WORKS[matched.length]);
  return (
    <LibFrame mode="library" path={["ライブラリ", "スマートフォルダー", "就寝用ロング"]} mixer={LIB_CH_SINGLE}>
      <div className="mle-cols">
        <LIB_AxisColumn activeId="smart-sleep" focusedId={null}/>
        <div className="mle-col is-content">
          <div className="mle-col__hd">
            <span>スマートフォルダー</span>
            <span className="count">5</span>
          </div>
          <LIB_DrillHeader
            crumbs={[{ axis: "スマート", value: "就寝用ロング", count: "9 件", icon: <I_LL.gridS size={11}/> }]}
            sub={{ label: "マッチした作品", count: "9" }}
          />
          <div className="mle-col__list">
            {matched.slice(0, 7).map((w, i) => (
              <LIB_WorkRow
                key={w.id + i}
                work={w}
                current={i === 0}
                focused={i === 0}
                fav={[0, 2].includes(i)}
              />
            ))}
          </div>
        </div>
        <SmartFolderPreview name="就寝用ロング" hits={9}/>
      </div>
    </LibFrame>
  );
}

// ── Scene E: Work detail (rich) — drill from 最近再生 ──
function LibraryDetail() {
  const works = ML_WORKS.slice(0, 9);
  return (
    <LibFrame mode="library" path={["ライブラリ", "最近再生", "夜の図書館 vol.1"]} mixer={LIB_CH_SINGLE}>
      <div className="mle-cols">
        <LIB_AxisColumn activeId="recent" focusedId={null}/>
        <div className="mle-col is-content">
          <div className="mle-col__hd">
            <span>最近再生</span>
            <span className="count">18</span>
          </div>
          <div className="mle-col__list">
            {works.map((w, i) => (
              <LIB_WorkRow
                key={w.id}
                work={w}
                current={i === 0}
                focused={i === 0}
                playing={i === 0}
                fav={[0, 2, 5].includes(i)}
              />
            ))}
          </div>
        </div>
        <LibWorkDetail work={W_LL("w-yorulib-1")}/>
      </div>
    </LibFrame>
  );
}

// ── Scene M: Mixer states — empty / single (default) / triple ──
function MixerStates() {
  const wrap = (label, sub, node) => (
    <div style={{display: "flex", flexDirection: "column", gap: 8, marginBottom: 26}}>
      <div style={{display: "flex", alignItems: "baseline", gap: 10}}>
        <span style={{fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600, color: "var(--ink-0)", letterSpacing: "0.02em"}}>{label}</span>
        <span style={{fontFamily: "var(--font-jp)", fontSize: 11.5, color: "var(--ink-2)"}}>{sub}</span>
      </div>
      <div style={{border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden", background: "var(--paper-1)", boxShadow: "var(--shadow-1)"}}>
        {node}
      </div>
    </div>
  );
  return (
    <div className="mle-app" style={{height: "auto", background: "transparent", boxShadow: "none", border: "none"}}>
      <div style={{padding: "30px 40px"}}>
        {wrap("0 — 停止中", "再生していないときは細いヒントバー。56px。", <LIB_Mixer channels={[]}/>)}
        {wrap("1 — 基本 (デフォルト)", "1ファイル再生。落ち着いた単独トランスポート。78px。「重ねて再生」で複数へ。", <LIB_Mixer channels={LIB_CH_SINGLE}/>)}
        {wrap("3 — 重ね再生 (最大)", "環境音などを重ねたいときだけミキサーに展開。S=ソロ / M=ミュート / 個別ループ。96px。", <LIB_Mixer channels={LIB_CHS_3}/>)}
      </div>
    </div>
  );
}

// ── Scene S: File mode — DEEP HIERARCHY with spine collapse ──
function FileDeepSpine() {
  return (
    <div className="mle-app">
      <div className="mle-frame is-lib is-mixer-single">
        <LIB_AppBar mode="files" playingCount={1} primaryTrack="栞をはさむ"/>
        <LIB_Address path={["/Volumes", "Audio", "asmr", "2024", "12月", "RJ01234567"]}/>
        <LIB_Sidebar mode="files"/>
        <div className="mle-body" style={{position: "relative"}}>
          <div className="mle-cols">
            {/* ancestors are stacked off-screen left — go back via breadcrumb */}
            <LIB_StackEdge count={4}/>

            {/* last two levels stay full width */}
            <div className="mle-col is-wide">
              <div className="mle-col__hd">
                <span>12月</span>
                <span className="count">23</span>
              </div>
              <div className="mle-col__list">
                {[
                  { n: "RJ01234567", k: "folder", m: "12 件", on: true, foc: false, wb: "RJ" },
                  { n: "RJ01198453", k: "folder", m: "9 件", wb: "RJ" },
                  { n: "Christmas2024_未編集", k: "folder", m: "23 件" },
                  { n: "_mastering", k: "folder", m: "4 件" },
                  { n: "cover_candidates", k: "folder", m: "8 件" },
                ].map((it, i) => (
                  <div key={i} className={"mle-row is-folder " + (it.on ? "is-on" : "")}>
                    <span className="ficon"><LIB_FIcon kind={it.k}/></span>
                    <span className="name">{it.wb && <span className="wbadge">{it.wb}</span>}{it.n}</span>
                    <span className="meta">{it.m}</span>
                    <span className="chev"><I_LL.chev size={11}/></span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mle-col is-wide">
              <div className="mle-col__hd">
                <span>RJ01234567</span>
                <span className="count">12</span>
              </div>
              <div className="mle-col__list">
                {[
                  { n: "01_オープニング.wav", k: "audio", m: "WAV · 48M", now: true },
                  { n: "02_本編.wav", k: "audio", m: "WAV · 220M" },
                  { n: "03_添い寝.wav", k: "audio", m: "WAV · 180M" },
                  { n: "04_おやすみ.wav", k: "audio", m: "WAV · 60M" },
                  { n: "cover.png", k: "image", m: "PNG · 2.4M" },
                  { n: "tic_track.txt", k: "text", m: "TXT · 1K" },
                  { n: "RJ01234567.pdf", k: "pdf", m: "PDF · 8M" },
                ].map((it, i) => (
                  <div key={i} className={"mle-row is-" + it.k + " " + (it.now ? "is-now is-on is-focused" : "")}>
                    <span className="ficon"><LIB_FIcon kind={it.k}/></span>
                    <span className="name">{it.n}</span>
                    <span className="meta">{it.m}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mle-prv">
              <div className="mle-prv__hd">
                <span className="label">フォルダー · 物理</span>
                <span className="pill">深さ 6 階層</span>
              </div>
              <div className="mle-prv__body">
                <div style={{fontSize: 13, color: "var(--ink-2)", lineHeight: 1.8, maxWidth: 380, paddingTop: 18}}>
                  深い階層を辿っても、祖先フォルダーは左端の <b>細い背表紙（スパイン）</b>に畳まれます。<br/><br/>
                  常に <b>末尾2階層 + プレビュー</b> が全幅を保つので、横スクロールが青天井に増えません。スパインをクリックすればその階層が再展開され、それ以降が畳まれます（Finder のカラム表示の弱点を解消）。
                </div>
                <div style={{display: "flex", gap: 6, paddingTop: 18}}>
                  <button className="ml-btn-primary"><I_LL.add size={12}/> 作品として登録</button>
                  <button className="ml-btn-ghost"><I_LL.play size={12}/> 全wav再生</button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <LIB_Mixer channels={LIB_CH_SINGLE}/>
      </div>
    </div>
  );
}

// ── Scene F: Cross-mode — playback continues across modes (triple) ──
function LibraryCrossMode() {
  const cols = [
    {
      title: "asmr",
      items: [
        { name: "_未整理", kind: "folder", count: "12 件", current: true, focused: false, badge: "8" },
        { name: "夜想曲", kind: "circle", count: "3 作品" },
        { name: "雪枝舎", kind: "circle", count: "2 作品" },
        { name: "茶寮アンナ", kind: "circle", count: "1 作品" },
      ],
    },
    {
      title: "_未整理",
      items: [
        { name: "RJ01234567_茶寮アンナ_月夜のお茶会_v2", kind: "folder", count: "12 件", candidate: true, current: true, focused: true },
        { name: "RJ01198453_夜想曲_深い眠りの森", kind: "folder", count: "9 件", candidate: true },
        { name: "Christmas2024_未編集", kind: "folder", count: "23 件", candidate: true },
      ],
    },
  ];
  return (
    <div className="mle-app">
      <div className="mle-frame is-lib">
        <LIB_AppBar mode="files" playingCount={3} primaryTrack="栞をはさむ"/>
        <LIB_Address path={["/Volumes", "Audio", "asmr", "_未整理"]}/>
        <LIB_Sidebar mode="files"/>
        <div className="mle-body" style={{position: "relative"}}>
          <div className="mle-cols">
            <LIB_StackEdge count={1}/>
            {cols.map((col, i) => (
              <div key={i} className="mle-col">
                <div className="mle-col__hd">
                  <span>{col.title}</span>
                  <span className="count">{col.items.length}</span>
                </div>
                <div className="mle-col__list">
                  {col.items.map((it, j) => {
                    const cls = [
                      "mle-row",
                      "is-" + (it.kind === "circle" ? "folder" : it.kind),
                      it.current ? "is-on" : "",
                      it.focused ? "is-focused" : "",
                      it.candidate ? "is-candidate" : "",
                    ].join(" ");
                    return (
                      <div key={j} className={cls}>
                        <span className="ficon"><LIB_FIcon kind={it.kind}/></span>
                        <span className="name">{it.name}</span>
                        <span className="meta">{it.count}</span>
                        {(it.kind === "folder" || it.kind === "circle") && <span className="chev"><I_LL.chev size={11}/></span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="mle-prv">
              <div className="mle-prv__hd">
                <span className="label">フォルダー</span>
                <span className="pill">候補 12 件</span>
              </div>
              <div className="mle-prv__body">
                <div style={{fontSize: 13, color: "var(--ink-2)", lineHeight: 1.8, maxWidth: 380, paddingTop: 24}}>
                  ファイルモードで未整理フォルダーを開いている状態。<br/>
                  バックグラウンドではライブラリから再生中の <b>3 ch</b> が止まらず流れ続けます — 上部の <span style={{fontFamily: "var(--font-mono)", background: "var(--paper-2)", padding: "1px 6px", borderRadius: 3}}>● 3ch</span> インジケータと、下部のミキサーがその証拠です。
                </div>
              </div>
            </div>
          </div>
          <div className="mll-modepeek">
            <div className="hd">再生は両モードで共通</div>
            <div className="row">
              <span className="ic is-on"><I_LL.gridS size={12}/></span>
              <span>ライブラリ起源 · 3 ch 再生中</span>
            </div>
            <div className="row">
              <span className="ic"><I_LL.folderO size={12}/></span>
              <span>ファイルモードで整理中</span>
              <span className="meta">いまここ</span>
            </div>
            <div style={{fontSize: 10.5, color: "var(--ink-3)", lineHeight: 1.5, paddingTop: 4, borderTop: "1px solid var(--line-soft)"}}>
              ライブラリで「夜の図書館 vol.1」のトラックを Ch に重ね、聴きながら _未整理 フォルダーを片付けることができます。
            </div>
          </div>
        </div>
        <LIB_Mixer channels={LIB_CHS_3}/>
      </div>
    </div>
  );
}

Object.assign(window, {
  LibraryHome,
  LibraryByCircle,
  LibraryByTag,
  LibrarySmart,
  LibraryDetail,
  MixerStates,
  FileDeepSpine,
  LibraryCrossMode,
  LIB_WorkDetail: LibWorkDetail,
  LIB_AxisLanding: AxisLanding,
  LIB_SmartFolderPreview: SmartFolderPreview,
});
