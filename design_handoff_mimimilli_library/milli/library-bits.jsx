// mimimilli — Library mode shared bits
//   AppBar (replaces window menu bar)
//   Sidebar (slim)
//   Mixer + Channel (shared with explorer scope; redefined locally)
//   AxisCol (col 0: pivot taxonomies)
//   EntryCol generics (col 1+)
//   WorkRowCard (work entry — has thumbnail)
//   LibraryWorkDetail (rich preview pane)
//   SmartFolderBuilder (rule UI)
/* eslint-disable */
/* global ML_WORKS, ML_CoverFrame, ML_Tag, ML_I, ML_TRACKS_YORULIB */

const I_L = ML_I;
const W_L = (id) => ML_WORKS.find(w => w.id === id);

// ── parse "mm:ss" / "h:mm:ss" → seconds ──
function parseTime_L(s) {
  const parts = s.split(":").map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

// ── File icon ──
function FIcon_L({ kind, size = 14 }) {
  if (kind === "folder" || kind === "circle") return <I_L.folder size={size}/>;
  if (kind === "work-registered") return <I_L.folder size={size}/>;
  if (kind === "audio") return <I_L.audio size={size}/>;
  if (kind === "image") return <I_L.image size={size}/>;
  if (kind === "video") return <I_L.video size={size}/>;
  if (kind === "text") return <I_L.text size={size}/>;
  if (kind === "pdf") return <I_L.pdf size={size}/>;
  return <I_L.file size={size}/>;
}

// ── App top bar (no window chrome, no mode tabs — mode lives in the left nav) ──
function AppBar({ mode = "library", playingCount = 3, primaryTrack = "栞をはさむ" }) {
  return (
    <div className="mll-bar">
      <div className="mll-bar__brand">
        <div className="mll-bar__mark">m</div>
        <div className="mll-bar__name">mimimilli</div>
      </div>

      {playingCount > 0 && (
        <>
          <div className="mll-bar__divider"/>
          <div className="mll-bar__pulse" title={`${playingCount} ch 同時再生中 — メインCh: ${primaryTrack}`}>
            <span className="dot"/>
            <span className="ch">{playingCount}ch</span>
            <span className="sep">·</span>
            <span className="lbl">{primaryTrack}</span>
          </div>
        </>
      )}

      <div className="mll-bar__spacer"/>

      <div className="mll-bar__search">
        <I_L.search size={13}/>
        <input placeholder={mode === "files" ? "このフォルダー内を検索（ファイル名 · 拡張子 ...）" : "ライブラリを検索（タイトル · CV · タグ · RJ ...）"}/>
        <span className="kbd">⌘K</span>
      </div>

      <button className="mll-bar__icbtn" title="スキャン"><I_L.refresh size={14}/></button>
      <button className="mll-bar__icbtn" title="通知"><I_L.bell size={14}/><span className="dot"/></button>
      <button className="mll-bar__icbtn" title="設定"><I_L.cog size={14}/></button>
    </div>
  );
}

// ── Address bar (slim — search lives in AppBar) ──
function LibAddress({ path }) {
  return (
    <div className="mle-addr is-lib">
      <button className="mle-navbtn"><I_L.arrowL size={14}/></button>
      <button className="mle-navbtn"><I_L.arrowR size={14}/></button>
      <button className="mle-navbtn"><I_L.refresh size={13}/></button>
      <div className="mle-crumbs">
        {path.map((p, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="mle-crumbs__sep">/</span>}
            <button className={`mle-crumbs__seg ${i === path.length - 1 ? "is-last" : ""}`}>{p}</button>
          </React.Fragment>
        ))}
      </div>
      <div className="mle-addr__vtoggle">
        <button className="is-on" title="カラム"><I_L.gridS size={13}/></button>
        <button title="リスト"><I_L.list size={14}/></button>
        <button title="グリッド"><I_L.grid size={13}/></button>
      </div>
      <button className="mle-navbtn" title="並び替え"><I_L.sort size={13}/></button>
      <button className="mle-navbtn" title="その他"><I_L.more size={14}/></button>
    </div>
  );
}

// ── Left nav = PRIMARY mode switch (ファイル / ライブラリ) + cross-mode surfaces.
//    Library views/facets/smart-folders live in the axis rail (col0), not here. ──
function LibSidebar({ mode = "library", view = null }) {
  return (
    <aside className="mle-side">
      <div className="mle-side__group">
        <div className="mle-side__hd">モード</div>
        <button className={`mle-side__btn is-mode ${mode === "files" ? "is-on" : ""}`}>
          <span className="mle-side__icbox"><I_L.folderO size={20}/></span>
          ファイル
        </button>
        <button className={`mle-side__btn is-mode ${mode === "library" ? "is-on" : ""}`}>
          <span className="mle-side__icbox"><I_L.gridS size={18}/></span>
          ライブラリ
        </button>
      </div>
      <div className="mle-side__group">
        <button className={`mle-side__btn ${view === "playing" ? "is-on" : ""} has-badge`}>
          <span className="mle-side__icbox"><I_L.audio size={18}/></span>
          再生中
          <span className="mle-side__badge">3</span>
        </button>
        <button className={`mle-side__btn ${view === "recents" ? "is-on" : ""}`}>
          <span className="mle-side__icbox"><I_L.refresh size={18}/></span>
          履歴
        </button>
        <button className={`mle-side__btn ${view === "fav" ? "is-on" : ""}`}>
          <span className="mle-side__icbox"><I_L.star size={18}/></span>
          お気に入り
        </button>
        <button className={`mle-side__btn ${view === "pinned" ? "is-on" : ""}`}>
          <span className="mle-side__icbox"><I_L.bookmark size={18}/></span>
          ピン留め
        </button>
      </div>
      <div className="mle-side__sp"/>
      <div className="mle-side__group" style={{borderTop: "none"}}>
        <button className="mle-side__btn">
          <span className="mle-side__icbox"><I_L.user size={18}/></span>
          自分
        </button>
      </div>
    </aside>
  );
}

// ── Pivot Axis column (col 0 in library) ──
const LIB_AXES = {
  view: [
    { id: "all",      name: "すべての作品", count: "347", icon: "gridS" },
    { id: "recent",   name: "最近再生", count: "18",  icon: "refresh" },
    { id: "added",    name: "最近追加", count: "23",  icon: "add", badge: "23" },
    { id: "fav",      name: "お気に入り", count: "42",  icon: "star" },
    { id: "unplayed", name: "未再生",     count: "12",  icon: "audio" },
    { id: "missing",  name: "ファイル欠損", count: "2",   icon: "err" },
  ],
  facet: [
    { id: "circle",   name: "サークル", count: "32", icon: "folder" },
    { id: "cv",       name: "CV",       count: "28", icon: "user" },
    { id: "series",   name: "シリーズ", count: "24", icon: "bookmark" },
    { id: "cat",      name: "カテゴリ", count: "8",  icon: "list" },
    { id: "tag",      name: "タグ",     count: "62", icon: "filter" },
    { id: "year",     name: "追加日",   count: "—",  icon: "refresh" },
  ],
  smart: [
    { id: "smart-sleep",   name: "就寝用ロング", count: "9", icon: "gridS" },
    { id: "smart-rain",    name: "雨音 — 今夜", count: "5", icon: "gridS" },
    { id: "smart-akane",   name: "月白あかね 全件", count: "6", icon: "gridS" },
    { id: "smart-new",     name: "今月の新着 環境音", count: "4", icon: "gridS" },
    { id: "smart-need",    name: "未整理 / 補完待ち", count: "8", icon: "gridS" },
    { id: "smart-new-add", name: "+ 新規スマートフォルダー", icon: "add", action: true },
  ],
};

function AxisRow({ ax, current, focused }) {
  const Ic = I_L[ax.icon] || I_L.folder;
  return (
    <div className={`mll-axis ${current ? "is-on" : ""} ${focused ? "is-focused" : ""} ${ax.action ? "is-action" : ""}`}>
      <span className="ic"><Ic size={14}/></span>
      <span className="nm">{ax.name}</span>
      {ax.badge && <span className="badge">{ax.badge}</span>}
      {!ax.action && <span className="count">{ax.count}</span>}
      {!ax.action && <span className="chev"><I_L.chev size={11}/></span>}
    </div>
  );
}

function AxisColumn({ activeId, focusedId }) {
  return (
    <div className="mle-col is-axis">
      <div className="mle-col__hd">
        <span>ライブラリ</span>
        <span className="count">347 件</span>
      </div>
      <div className="mle-col__list">
        <div className="mll-axisgroup">
          <div className="mll-axisgroup__hd">ビュー</div>
          {LIB_AXES.view.map(ax => (
            <AxisRow key={ax.id} ax={ax} current={ax.id === activeId} focused={ax.id === focusedId}/>
          ))}
        </div>
        <div className="mll-axisgroup">
          <div className="mll-axisgroup__hd">分類軸</div>
          {LIB_AXES.facet.map(ax => (
            <AxisRow key={ax.id} ax={ax} current={ax.id === activeId} focused={ax.id === focusedId}/>
          ))}
        </div>
        <div className="mll-axisgroup">
          <div className="mll-axisgroup__hd">スマートフォルダー</div>
          {LIB_AXES.smart.map(ax => (
            <AxisRow key={ax.id} ax={ax} current={ax.id === activeId} focused={ax.id === focusedId}/>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Work row card (with cover thumbnail) — used in work-list columns ──
function WorkRow({ work, current, focused, playing, fav, hideMeta }) {
  return (
    <div className={`mll-wrow ${current ? "is-on" : ""} ${focused ? "is-focused" : ""}`}>
      <div className="mll-wrow__cv">
        <ML_CoverFrame id={`wr-${work.id}`} kind={work.cover} inks={work.inks} paper={work.paper} title={work.title}/>
      </div>
      <div className="mll-wrow__body">
        <span className="mll-wrow__title">{work.title}</span>
        {!hideMeta && (
          <span className="mll-wrow__sub">
            {work.tags.find(t => t.k === "サークル")?.v || work.tags.find(t => t.k === "シリーズ")?.v || "—"} · {work.trackCount}tr · {work.duration}
          </span>
        )}
      </div>
      <div className="mll-wrow__meta">
        {playing && <span className="now">▸ 再生中</span>}
        {fav && <span className="fav"><I_L.starF size={10}/></span>}
        {!playing && !fav && <span>{work.addedLabel}</span>}
      </div>
    </div>
  );
}

// ── Entry row (col 1 — circle / cv / series / etc) ──
function EntryRow({ entry, current, focused, isCv }) {
  return (
    <div className={`mll-erow ${isCv ? "is-cv" : ""} ${current ? "is-on" : ""} ${focused ? "is-focused" : ""}`}>
      <span className="ic">
        {isCv ? entry.name.slice(0, 1) : <I_L.folder size={13}/>}
      </span>
      <span className="nm">{entry.name}</span>
      <span className="count">{entry.count}</span>
    </div>
  );
}

// ── Stack edge (passive: ancestor columns are stacked off-screen left) ──
function StackEdge({ count }) {
  return (
    <div className="mle-colstack" title="前の階層はスタック。移動はパンくずから">
      <div className="mle-colstack__edges">
        <span/><span/><span/><span/>
      </div>
    </div>
  );
}

// ── Drill header — collapsed parent levels stacked atop a column ──
function DrillHeader({ crumbs = [], sub }) {
  // crumbs: [{ axis, value, count, icon }]
  return (
    <div className="mle-drill">
      {crumbs.map((c, i) => (
        <div key={i} className="mle-drill__crumb">
          <span className="mle-drill__back"><I_L.arrowL size={13}/></span>
          {c.axis && <span className="mle-drill__axis">{c.axis}</span>}
          {c.axis && <span className="mle-drill__sep">/</span>}
          <span className="mle-drill__val">
            {c.icon && <span className="ic">{c.icon}</span>}
            {c.value}
          </span>
          {c.count && <span className="mle-drill__count">{c.count}</span>}
          <span className="mle-drill__chev"><I_L.chevD size={11}/></span>
        </div>
      ))}
      {sub && (
        <div className="mle-drill__sub">
          <span>{sub.label}</span>
          <span className="count">{sub.count}</span>
        </div>
      )}
    </div>
  );
}

// ── Single-file compact transport (DEFAULT playback state) ──
function SingleBar({ ch }) {
  const work = W_L(ch.workId);
  if (!work) return null;
  const pct = ((parseTime_L(ch.now) / parseTime_L(ch.dur === "—:—" ? "20:00" : ch.dur)) * 100) || 35;
  return (
    <div className="mle-bar1">
      <div className="mle-bar1__now">
        <div className="mle-bar1__cover">
          <ML_CoverFrame id={`b1-${ch.id}`} kind={work.cover} inks={work.inks} paper={work.paper} title={work.title}/>
        </div>
        <div className="mle-bar1__meta">
          <span className="mle-bar1__track">{ch.track}</span>
          <span className="mle-bar1__work">{work.title}</span>
        </div>
        <button className="mle-bar1__fav is-on"><I_L.starF size={13}/></button>
      </div>

      <div className="mle-bar1__transport">
        <button className="mle-bar1__tbtn" title="前へ"><I_L.prev size={15}/></button>
        <button className="mle-bar1__play"><I_L.pause size={14}/></button>
        <button className="mle-bar1__tbtn" title="次へ"><I_L.next size={15}/></button>
      </div>

      <div className="mle-bar1__scrub">
        <span className="mle-bar1__time is-now">{ch.now}</span>
        <div className="mle-bar1__track-w"><div className="mle-bar1__fill" style={{width: `${Math.min(96, pct)}%`}}/></div>
        <span className="mle-bar1__time">{ch.dur}</span>
      </div>

      <div className="mle-bar1__right">
        <button className={`mle-bar1__iconbtn ${ch.loop ? "is-on" : ""}`} title="ループ"><I_L.loopOne size={15}/></button>
        <div className="mle-bar1__vol">
          <I_L.volume size={14} style={{color: "var(--ink-3)"}}/>
          <div className="mle-bar1__voltrack" style={{["--vol"]: `${ch.vol}%`}}/>
        </div>
        <div className="mle-bar1__divider"/>
        <button className="mle-bar1__stack" title="別の音声を重ねて同時再生">
          <span className="ic"><I_L.add size={13}/></span>
          重ねて再生
        </button>
        <button className="mle-bar1__iconbtn" title="キュー"><I_L.queue size={15}/></button>
        <button className="mle-bar1__iconbtn" title="拡大"><I_L.fs size={14}/></button>
      </div>
    </div>
  );
}

// ── Mixer ──
function LibMixerChannel({ ch }) {
  const work = W_L(ch.workId);
  if (!work) return null;
  const pct = ((parseTime_L(ch.now) / parseTime_L(ch.dur === "—:—" ? "20:00" : ch.dur)) * 100) || 35;
  return (
    <div className={`mle-ch is-${ch.color}`}>
      <span className="mle-ch__stripe"/>
      <div className="mle-ch__top">
        <span className="mle-ch__chno">CH {ch.chNo}</span>
        <div className="mle-ch__thumb">
          <ML_CoverFrame id={`mx-${ch.id}`} kind={work.cover} inks={work.inks} paper={work.paper} title={work.title}/>
        </div>
        <div className="mle-ch__meta">
          <span className="mle-ch__name">{ch.track}</span>
          <span className="mle-ch__work">{work.title}</span>
        </div>
        <div className="mle-ch__topbtns">
          <button className={`is-solo ${ch.solo ? "is-on" : ""}`} title="Solo">S</button>
          <button className={`is-mute ${ch.mute ? "is-on" : ""}`} title="Mute">M</button>
          <button title="チャンネルを閉じる"><I_L.x size={11}/></button>
        </div>
      </div>
      <div className="mle-ch__scrub">
        <span className="mle-ch__time is-now">{ch.now}</span>
        <div className="mle-ch__track"><div className="mle-ch__fill" style={{width: `${Math.min(100, pct)}%`}}/></div>
        <span className="mle-ch__time">{ch.dur}</span>
      </div>
      <div className="mle-ch__bot">
        <button className={`mle-ch__playbtn ${ch.state === "paused" ? "is-paused" : ""}`}>
          {ch.state === "playing" ? <I_L.pause size={11}/> : <I_L.play size={11}/>}
        </button>
        <div className="mle-ch__vol">
          <I_L.volume size={12} style={{color: "var(--ink-3)"}}/>
          <div className="mle-ch__voltrack" style={{["--vol"]: `${ch.vol}%`}}/>
        </div>
        <button className={`mle-ch__loop ${ch.loop ? "is-on" : ""}`} title="ループ"><I_L.loopOne size={12}/></button>
      </div>
    </div>
  );
}

function LibMixer({ channels = [] }) {
  // 0 → empty hint bar; 1 → compact single transport (DEFAULT); 2-3 → multi-ch mixer
  if (channels.length === 0) {
    return (
      <div className="mle-bar1 is-empty">
        <I_L.audio size={15} style={{color: "var(--ink-3)"}}/>
        <span>ファイル / 作品をクリックして再生</span>
        <span className="k">Shift+クリック</span>
        <span>で重ねて同時再生</span>
      </div>
    );
  }
  if (channels.length === 1) {
    return <SingleBar ch={channels[0]}/>;
  }
  return (
    <div className="mle-mixer">
      <div className="mle-mixer__master">
        <div className="mle-mixer__masterhd">同時再生<span className="max">/ 3ch まで</span></div>
        <div className="mle-mixer__mastercount">
          {channels.length}<small>ch</small>
        </div>
        <div className="mle-mixer__masterbtns">
          <button className="mle-mixer__masterbtn is-primary">
            <I_L.pause size={11}/> 全停止
          </button>
          <button className="mle-mixer__masterbtn"><I_L.fs size={11}/></button>
        </div>
      </div>
      <div className="mle-mixer__chs">
        {channels.map((ch) => <LibMixerChannel key={ch.id} ch={ch}/>)}
        {channels.length < 3 && (
          <div className="mle-mixer__add">
            <button className="mle-mixer__addbtn">
              <I_L.add size={20}/>
              チャンネル追加
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Default mixer channels
const LIB_CH_SINGLE = [
  { id: "c0", color: "coral", workId: "w-yorulib-1", track: "栞をはさむ", chNo: "01", dur: "06:48", now: "02:18", state: "playing", vol: 82 },
];

// Default mixer channels
const LIB_CHS_3 = [
  { id: "c1", color: "sky",     workId: "w-amaoto-natsu", track: "縁側に座る", chNo: "01", dur: "12:30", now: "04:12", state: "playing", vol: 70 },
  { id: "c2", color: "coral",   workId: "w-yorulib-1",    track: "栞をはさむ", chNo: "02", dur: "06:48", now: "02:18", state: "playing", vol: 88, primary: true },
  { id: "c3", color: "mustard", workId: "w-makistove",    track: "薪の爆ぜる音 (ループ)", chNo: "03", dur: "—:—", now: "13:42", state: "playing", vol: 45, loop: true },
];
const LIB_CHS_2 = [LIB_CHS_3[0], LIB_CHS_3[1]];
const LIB_CHS_1 = [LIB_CHS_3[1]];

Object.assign(window, {
  LIB_AppBar: AppBar,
  LIB_Address: LibAddress,
  LIB_Sidebar: LibSidebar,
  LIB_AxisColumn: AxisColumn,
  LIB_WorkRow: WorkRow,
  LIB_EntryRow: EntryRow,
  LIB_Mixer: LibMixer,
  LIB_SingleBar: SingleBar,
  LIB_StackEdge: StackEdge,
  LIB_DrillHeader: DrillHeader,
  LIB_CHS_1, LIB_CHS_2, LIB_CHS_3, LIB_CH_SINGLE,
  LIB_FIcon: FIcon_L,
  LIB_AXES_DATA: LIB_AXES,
  parseTime_L,
});
