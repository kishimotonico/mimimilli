// mimimilli — icons + shared chrome (top bar, toolbar, filter strip, player, tag)
/* eslint-disable */

// ── Icons (16px default; line, 1.6 stroke) ──────────────────
const _Icon = ({ d, size = 16, fill, stroke = "currentColor", strokeWidth = 1.5, viewBox = "0 0 24 24" }) => (
  <svg width={size} height={size} viewBox={viewBox} fill={fill ?? "none"} stroke={fill ? "none" : stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
);

const ML_I = {
  search:   (p) => <_Icon {...p} d={["M11 19a8 8 0 1 1 0 -16 8 8 0 0 1 0 16Z", "M21 21l-4.3-4.3"]}/>,
  play:     (p) => <_Icon {...p} fill="currentColor" d="M7 4.5v15l12-7.5z"/>,
  pause:    (p) => <_Icon {...p} fill="currentColor" d="M6.5 4h3.5v16H6.5zM14 4h3.5v16H14z"/>,
  prev:     (p) => <_Icon {...p} fill="currentColor" d="M6 4h2v16H6zM20 4L9 12l11 8z"/>,
  next:     (p) => <_Icon {...p} fill="currentColor" d="M16 4h2v16h-2zM4 4l11 8 -11 8z"/>,
  shuffle:  (p) => <_Icon {...p} d={["M3 6h2.5a3 3 0 0 1 2.5 1.4l8 11.2a3 3 0 0 0 2.5 1.4H21", "M16 18l3 3 3 -3", "M3 18h2.5a3 3 0 0 0 2.5 -1.4l1 -1.4", "M21 6h-2.5a3 3 0 0 0 -2.5 1.4l-1 1.4", "M16 6l3 -3 3 3"]}/>,
  loopOne:  (p) => <_Icon {...p} d={["M4 10V8a2 2 0 0 1 2 -2h12", "M20 14v2a2 2 0 0 1 -2 2H6", "M17 4l3 3 -3 3", "M7 14l-3 3 3 3", "M11 11l1 -1v5"]}/>,
  volume:   (p) => <_Icon {...p} d={["M11 4L6 8H3v8h3l5 4z", "M15 9.5a3 3 0 0 1 0 5", "M18 6.5a7 7 0 0 1 0 11"]}/>,
  queue:    (p) => <_Icon {...p} d={["M3 6h13M3 12h10M3 18h7", "M19 14v6M16 17h6"]}/>,
  fs:       (p) => <_Icon {...p} d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>,
  ext:      (p) => <_Icon {...p} d={["M14 4h6v6", "M20 4l-8 8", "M19 13v5a2 2 0 0 1 -2 2H6a2 2 0 0 1 -2 -2V7a2 2 0 0 1 2 -2h5"]}/>,
  folder:   (p) => <_Icon {...p} d="M3 7v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2 -2V9a2 2 0 0 0 -2 -2h-7l-2 -2H5a2 2 0 0 0 -2 2z"/>,
  folderO:  (p) => <_Icon {...p} d={["M3 7v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2 -2v-7", "M21 9V8a1 1 0 0 0 -1 -1h-7l-2 -2H5a2 2 0 0 0 -2 2v3"]}/>,
  file:     (p) => <_Icon {...p} d={["M14 3H6a2 2 0 0 0 -2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2V9z", "M14 3v6h6"]}/>,
  image:    (p) => <_Icon {...p} d={["M3 5h18v14H3z", "M3 16l5 -5 4 4 3 -3 6 6", "M8 11a1.5 1.5 0 1 1 0 -3 1.5 1.5 0 0 1 0 3z"]}/>,
  audio:    (p) => <_Icon {...p} d={["M9 17V6l11 -3v11", "M9 17a3 3 0 1 1 -3 -3", "M20 14a3 3 0 1 1 -3 -3"]}/>,
  video:    (p) => <_Icon {...p} d={["M3 6h12a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1H3z", "M16 10l5 -3v10l-5 -3z"]}/>,
  text:     (p) => <_Icon {...p} d={["M5 4h11l3 3v13a1 1 0 0 1 -1 1H5z", "M8 11h7M8 14h7M8 17h5"]}/>,
  pdf:      (p) => <_Icon {...p} d={["M5 4h10l4 4v12a1 1 0 0 1 -1 1H5z", "M14 4v4h4", "M8 13v4M8 13h1.2a1 1 0 1 1 0 2H8"]}/>,
  chev:     (p) => <_Icon {...p} d="M9 6l6 6 -6 6"/>,
  chevD:    (p) => <_Icon {...p} d="M6 9l6 6 6 -6"/>,
  arrowL:   (p) => <_Icon {...p} d="M14 5l-7 7 7 7"/>,
  arrowR:   (p) => <_Icon {...p} d="M10 5l7 7 -7 7"/>,
  more:     (p) => <_Icon {...p} fill="currentColor" d="M5 11a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0 -2.4zM12 11a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0 -2.4zM19 11a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0 -2.4z"/>,
  download: (p) => <_Icon {...p} d={["M12 4v12", "M7 11l5 5 5 -5", "M5 20h14"]}/>,
  pin:      (p) => <_Icon {...p} d={["M9 4h6l-1 6 4 4H6l4 -4z", "M12 14v6"]}/>,
  star:     (p) => <_Icon {...p} d="M12 3l2.7 5.7 6.3 .9 -4.5 4.4 1.1 6.2 -5.6 -3 -5.6 3 1.1 -6.2 -4.5 -4.4 6.3 -.9z"/>,
  starF:    (p) => <_Icon {...p} fill="currentColor" d="M12 3l2.7 5.7 6.3 .9 -4.5 4.4 1.1 6.2 -5.6 -3 -5.6 3 1.1 -6.2 -4.5 -4.4 6.3 -.9z"/>,
  cog:      (p) => <_Icon {...p} d={["M12 15a3 3 0 1 0 0 -6 3 3 0 0 0 0 6Z","M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1 .1a2 2 0 1 1 -2.8 2.8l-.1 -.1a1.7 1.7 0 0 0 -1.8 -.3 1.7 1.7 0 0 0 -1 1.5V21a2 2 0 1 1 -4 0v-.1a1.7 1.7 0 0 0 -1 -1.5 1.7 1.7 0 0 0 -1.8 .3l-.1 .1a2 2 0 1 1 -2.8 -2.8l.1 -.1a1.7 1.7 0 0 0 .3 -1.8 1.7 1.7 0 0 0 -1.5 -1H3a2 2 0 1 1 0 -4h.1a1.7 1.7 0 0 0 1.5 -1 1.7 1.7 0 0 0 -.3 -1.8l-.1 -.1a2 2 0 1 1 2.8 -2.8l.1 .1a1.7 1.7 0 0 0 1.8 .3H9a1.7 1.7 0 0 0 1 -1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8 -.3l.1 -.1a2 2 0 1 1 2.8 2.8l-.1 .1a1.7 1.7 0 0 0 -.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0 -1.5 1Z"]}/>,
  refresh:  (p) => <_Icon {...p} d={["M21 12a9 9 0 0 1 -15 6.7L3 16", "M3 12a9 9 0 0 1 15 -6.7L21 8", "M21 4v4h-4", "M3 20v-4h4"]}/>,
  add:      (p) => <_Icon {...p} d={["M12 5v14", "M5 12h14"]}/>,
  list:     (p) => <_Icon {...p} d={["M8 6h13M8 12h13M8 18h13", "M3 6h.01M3 12h.01M3 18h.01"]}/>,
  grid:     (p) => <_Icon {...p} d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>,
  gridS:    (p) => <_Icon {...p} d="M3 3h5v5H3zM10 3h5v5h-5zM17 3h5v5h-5zM3 10h5v5H3zM10 10h5v5h-5zM17 10h5v5h-5zM3 17h5v5H3zM10 17h5v5h-5zM17 17h5v5h-5z"/>,
  sort:     (p) => <_Icon {...p} d={["M8 4v16M4 8l4 -4 4 4", "M16 20V4M20 16l-4 4 -4 -4"]}/>,
  filter:   (p) => <_Icon {...p} d="M4 4h16l-6 8v6l-4 2v-8z"/>,
  x:        (p) => <_Icon {...p} d="M6 6l12 12M18 6L6 18"/>,
  err:      (p) => <_Icon {...p} d={["M12 4l10 17H2z", "M12 10v5", "M12 18v0"]}/>,
  heart:    (p) => <_Icon {...p} d="M12 20s-7 -4.3 -7 -10a4 4 0 0 1 7 -2.7A4 4 0 0 1 19 10c0 5.7 -7 10 -7 10z"/>,
  bell:     (p) => <_Icon {...p} d={["M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3 -2 3 -9", "M10 21a2 2 0 0 0 4 0"]}/>,
  signal:   (p) => <_Icon {...p} d={["M2 11a14 14 0 0 1 20 0", "M5 14.5a10 10 0 0 1 14 0", "M8 18a6 6 0 0 1 8 0"]}/>,
  battery:  (p) => <_Icon {...p} d={["M3 8h16v8H3z", "M21 11v2"]}/>,
  user:     (p) => <_Icon {...p} d={["M4 21a8 8 0 0 1 16 0", "M12 12a4 4 0 1 0 0 -8 4 4 0 0 0 0 8z"]}/>,
  menu:     (p) => <_Icon {...p} d="M4 7h16M4 12h16M4 17h16"/>,
  link:     (p) => <_Icon {...p} d={["M10 14a4 4 0 0 0 5.6 0L19 10.6a4 4 0 0 0 -5.6 -5.6l-.7 .7", "M14 10a4 4 0 0 0 -5.6 0L5 13.4a4 4 0 0 0 5.6 5.6l.7 -.7"]}/>,
  bookmark: (p) => <_Icon {...p} d="M6 4h12v17l-6 -4 -6 4z"/>,
  back:     (p) => <_Icon {...p} d={["M19 12H5", "M11 6l-6 6 6 6"]}/>,
  caret:    (p) => <_Icon {...p} fill="currentColor" d="M7 10l5 5 5 -5z"/>,
};
window.ML_I = ML_I;

// ── Tag chip ────────────────────────────────────────────────
function Tag({ tag }) {
  if (tag.f) return <span className="ml-tag flat">{tag.f}</span>;
  const kind = (
    tag.k === "cv" ? "cv" :
    tag.k === "サークル" ? "circle" :
    tag.k === "シリーズ" ? "series" :
    "cat"
  );
  const catLabel = (
    tag.k === "cv" ? "CV" :
    tag.k === "サークル" ? "CIR" :
    tag.k === "シリーズ" ? "SR" :
    "CAT"
  );
  return (
    <span className={`ml-tag is-anno ${kind}`}>
      <span className="ml-tag__cat">{catLabel}</span>
      <span className="ml-tag__val">{tag.v}</span>
    </span>
  );
}
window.ML_Tag = Tag;

// ── Top title-menu bar (36px) ───────────────────────────────
function TitleBar({ subtitle }) {
  return (
    <div className="ml-tbar">
      <div className="ml-tbar__brand">
        <div className="ml-tbar__mark">m</div>
        <div className="ml-tbar__name">mimimilli</div>
      </div>
      <div className="ml-tbar__menus">
        <button className="ml-tbar__menu">ファイル</button>
        <button className="ml-tbar__menu">編集</button>
        <button className="ml-tbar__menu">表示</button>
        <button className="ml-tbar__menu">再生</button>
        <button className="ml-tbar__menu">ウィンドウ</button>
        <button className="ml-tbar__menu">ヘルプ</button>
      </div>
      <div className="ml-tbar__spacer" />
      {subtitle && <span className="ml-tbar__status ml-mono">{subtitle}</span>}
      <span className="ml-tbar__status">
        <span className="ml-tbar__pulse" />
        スキャン済 · 2 時間前
      </span>
      <button className="ml-tbar__icbtn"><ML_I.bell size={14}/></button>
      <button className="ml-tbar__icbtn"><ML_I.cog size={14}/></button>
    </div>
  );
}
window.ML_TitleBar = TitleBar;

// ── Toolbar (52px) — primary nav + search + scan ────────────
function ToolBar({ active = "library", view = "grid", onView, showVToggle = true, rightExtras = null }) {
  return (
    <div className="ml-tools">
      <div className="ml-segs">
        <button className={`ml-seg ml-latin ${active === "library" ? "is-on" : ""}`}>
          Library <span className="ml-seg__count">347</span>
        </button>
        <button className={`ml-seg ml-latin ${active === "recents" ? "is-on" : ""}`}>
          Recents <span className="ml-seg__count">18</span>
        </button>
        <button className={`ml-seg ml-latin ${active === "tags" ? "is-on" : ""}`}>
          Tags <span className="ml-seg__count">62</span>
        </button>
        <button className={`ml-seg ml-latin ${active === "folders" ? "is-on" : ""}`}>
          Folders
        </button>
      </div>

      <div className="ml-tools__search">
        <ML_I.search size={14}/>
        <input placeholder="タイトル・タグ・CV で絞り込み (例: cv/月白)" defaultValue=""/>
        <span className="ml-tools__kbd">⌘K</span>
      </div>

      <div className="ml-tools__spacer"/>

      {rightExtras}

      {showVToggle && (
        <div className="ml-vtoggle">
          <button className={view === "grid" ? "is-on" : ""} title="グリッド"><ML_I.grid size={14}/></button>
          <button className={view === "list" ? "is-on" : ""} title="リスト"><ML_I.list size={14}/></button>
        </div>
      )}

      <button className="ml-tools__btn">
        <ML_I.sort size={13}/> 追加日 <ML_I.chevD size={11}/>
      </button>
      <div className="ml-tools__divider"/>
      <button className="ml-tools__btn is-primary">
        <ML_I.refresh size={13}/> スキャン
      </button>
    </div>
  );
}
window.ML_ToolBar = ToolBar;

// ── Filter strip ───────────────────────────────────────────
function Filters({ chips = [{k:"cv", v:"月白あかね"},{k:"カテゴリ", v:"環境音"},{f:"バイノーラル"}], hits = 23 }) {
  return (
    <div className="ml-filters">
      <button className="ml-fchip" style={{color:"var(--ink-2)"}}>
        <ML_I.filter size={11}/> 絞り込みを追加
      </button>
      <span className="ml-divider"/>
      {chips.map((c, i) => (
        <button key={i} className="ml-fchip is-on">
          {c.k ? <><span style={{color:"var(--ink-3)", fontFamily:"var(--font-mono)", fontSize:10, marginRight:3}}>{c.k}/</span>{c.v}</> : c.f}
          <span className="ml-x">×</span>
        </button>
      ))}
      <span className="ml-filters__count ml-mono">{hits} 件ヒット</span>
    </div>
  );
}
window.ML_Filters = Filters;

// ── Bottom Player bar ──────────────────────────────────────
function PlayerBar({ work, track, current = "07:42", total = "27:18", playing = true }) {
  return (
    <div className="ml-player">
      <div className="ml-player__bar"/>
      <div className="ml-player__now">
        <div className="ml-player__thumb">
          <ML_CoverFrame id={`p-${work.id}`} kind={work.cover} palette={work.palette} title={work.title}/>
        </div>
        <div className="ml-player__nowmeta">
          <span className="ml-player__nowtitle">{track}</span>
          <span className="ml-player__nowwork">{work.title}</span>
        </div>
        <button className="ml-player__btn" title="お気に入り"><ML_I.heart size={14}/></button>
      </div>

      <div className="ml-player__center">
        <div className="ml-player__btns">
          <button className="ml-player__btn"><ML_I.shuffle size={13}/></button>
          <button className="ml-player__btn"><ML_I.prev size={13}/></button>
          <button className="ml-player__btn is-jump" title="−10秒">−10</button>
          <button className="ml-player__playbtn">{playing ? <ML_I.pause size={14}/> : <ML_I.play size={14}/>}</button>
          <button className="ml-player__btn is-jump" title="+10秒">+10</button>
          <button className="ml-player__btn"><ML_I.next size={13}/></button>
          <button className="ml-player__btn is-on"><ML_I.loopOne size={13}/></button>
        </div>
        <div className="ml-player__scrub">
          <span className="ml-player__time is-now">{current}</span>
          <div className="ml-player__track">
            <div className="ml-player__fill" style={{width: "28%"}}/>
            <div className="ml-player__knob" style={{left: "28%"}}/>
          </div>
          <span className="ml-player__time">{total}</span>
        </div>
      </div>

      <div className="ml-player__right">
        <button className="ml-player__btn" title="キュー"><ML_I.queue size={14}/></button>
        <div className="ml-player__volume">
          <ML_I.volume size={13}/>
          <div className="ml-player__voltrack"/>
        </div>
        <button className="ml-player__btn" title="フルスクリーン"><ML_I.fs size={13}/></button>
      </div>
    </div>
  );
}
window.ML_PlayerBar = PlayerBar;

// ── Floating Player variant ────────────────────────────────
function FloatingPlayer({ work, track }) {
  return (
    <div className="ml-fplayer">
      <div className="ml-fplayer__row">
        <div className="ml-fplayer__thumb">
          <ML_CoverFrame id={`fp-${work.id}`} kind={work.cover} palette={work.palette} title={work.title}/>
        </div>
        <div className="ml-fplayer__meta">
          <span className="ml-fplayer__title">{track}</span>
          <span className="ml-fplayer__work">{work.title}</span>
        </div>
      </div>
      <div className="ml-fplayer__scrub">
        <span>07:42</span>
        <div className="ml-fplayer__track"><div className="ml-fplayer__fill" style={{width:"28%"}}/></div>
        <span style={{color:"var(--ink-3)"}}>27:18</span>
      </div>
      <div className="ml-fplayer__btns">
        <button className="ml-player__btn"><ML_I.shuffle size={13}/></button>
        <button className="ml-player__btn"><ML_I.prev size={13}/></button>
        <button className="ml-player__btn is-jump">−10</button>
        <button className="ml-player__playbtn"><ML_I.pause size={14}/></button>
        <button className="ml-player__btn is-jump">+10</button>
        <button className="ml-player__btn"><ML_I.next size={13}/></button>
        <button className="ml-player__btn"><ML_I.queue size={14}/></button>
      </div>
    </div>
  );
}
window.ML_FloatingPlayer = FloatingPlayer;

// ── Side Player variant (right column with queue) ─────────
function SidePlayer({ work, track, queue }) {
  return (
    <div className="ml-splayer">
      <div className="ml-splayer__cover">
        <ML_CoverFrame id={`sp-${work.id}`} kind={work.cover} palette={work.palette} title={work.title}/>
      </div>
      <div>
        <div className="ml-splayer__title">{track}</div>
        <div className="ml-splayer__work">{work.title}</div>
      </div>
      <div className="ml-splayer__times">
        <span style={{color:"var(--ink-0)"}}>07:42</span>
        <div className="ml-splayer__track"><div className="ml-splayer__fill" style={{width:"28%"}}/></div>
        <span>27:18</span>
      </div>
      <div className="ml-splayer__btns">
        <button className="ml-player__btn"><ML_I.shuffle size={13}/></button>
        <button className="ml-player__btn"><ML_I.prev size={14}/></button>
        <button className="ml-player__playbtn" style={{width:42, height:42}}><ML_I.pause size={16}/></button>
        <button className="ml-player__btn"><ML_I.next size={14}/></button>
        <button className="ml-player__btn is-on"><ML_I.loopOne size={13}/></button>
      </div>
      <div className="ml-splayer__queue">
        <div className="ml-splayer__qhd">Up Next · この作品</div>
        {(queue || []).slice(0, 8).map((t) => (
          <div key={t.i} className={`ml-splayer__qrow ${t.playing ? "is-on" : ""}`}>
            <span className="num">{String(t.i).padStart(2, "0")}</span>
            <span className="nm">{t.name}</span>
            <span className="tm">{t.dur}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
window.ML_SidePlayer = SidePlayer;
