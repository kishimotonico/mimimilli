// DEPRECATED (2026-05): 旧ワイヤーフレーム JSX。UIデザインの正典は design_handoff_mimimilli_library/ (mimimilli) に移行済み。参照非推奨。
import { useState, useMemo, useRef, useCallback } from "react";

const MOCK_WORKS = Array.from({ length: 24 }, (_, i) => ({
  id: i + 1,
  title: [
    "【ブルーアーカイブ】ミヤコ(水着)ASMR～ふたりきりの島でおはようを。～",
    "癒し系耳かきASMR ～安眠のお手伝い～",
    "バイノーラル添い寝ボイス vol.3",
    "深夜の囁きカウンセリング",
    "雨音と共に眠る夜 -Sleep with Rain-",
    "秘密の放課後マッサージ",
    "星降る夜のプラネタリウム朗読",
    "ふわふわ耳かき専門店へようこそ",
  ][i % 8],
  tags: [
    ["バイノーラル", "ASMR", "cv/藤田茜", "サークル/Yostar"],
    ["耳かき", "癒し", "ASMR", "cv/花守ゆみり"],
    ["添い寝", "囁き", "バイノーラル", "R-15"],
    ["癒し", "囁き", "cv/花澤香菜", "ASMR"],
    ["環境音", "安眠", "ASMR", "バイノーラル"],
    ["マッサージ", "R-15", "ASMR", "cv/佐倉綾音"],
    ["朗読", "癒し", "環境音", "バイノーラル"],
    ["耳かき", "ASMR", "バイノーラル", "cv/東山奈央"],
  ][i % 8],
  urls: i % 4 === 0
    ? [{ label: "DLsite", url: "https://www.dlsite.com/home/work/=/product_id/RJ" + (401000 + i) + ".html" }, { label: "FANZA", url: "https://www.dmm.co.jp/dc/doujin/-/detail/=/cid/d_" + (200000 + i) + "/" }]
    : i % 4 === 1
    ? [{ label: "DLsite", url: "https://www.dlsite.com/home/work/=/product_id/RJ" + (401000 + i) + ".html" }]
    : i % 4 === 2
    ? [{ label: "FANZA", url: "https://www.dmm.co.jp/dc/doujin/-/detail/=/cid/d_" + (200000 + i) + "/" }, { label: "Twitter", url: "https://x.com/example" }, { label: "公式サイト", url: "https://example.com" }]
    : [],
  hasError: i === 5 || i === 11,
  trackCount: [6, 4, 8, 5, 3, 7, 4, 5][i % 8],
  totalDuration: ["1:10:13", "0:45:30", "2:01:45", "0:55:20", "0:32:10", "1:22:05", "0:48:33", "1:15:00"][i % 8],
  totalDurationSec: [4213, 2730, 7305, 3320, 1930, 4925, 2913, 4500][i % 8],
  bookmarked: i === 0 || i === 2 || i === 7,
  lastPlayed: i < 4 ? ["2025-06-20 23:15", "2025-06-19 01:30", "2025-06-18 22:00", "2025-06-15 20:45"][i] : null,
  addedAt: "2025-0" + (1 + (i % 6)) + "-" + String(10 + i).padStart(2, "0"),
}));

const MOCK_TRACKS = [
  { title: "01.『タイトルコール』", duration: "00:08", durationSec: 8 },
  { title: "02.『モーニングコールの時間ですよ』", duration: "11:32", durationSec: 692 },
  { title: "03.『ストレッチ、手伝ってください』", duration: "22:15", durationSec: 1335 },
  { title: "04.『身体の検査をしておきましょう』", duration: "16:11", durationSec: 971 },
  { title: "05.『もう少し傍に』", duration: "11:45", durationSec: 705 },
  { title: "06.『おやすみなさい』", duration: "08:22", durationSec: 502 },
];

const MOCK_FILES = [
  { name: "SE無し", type: "folder", children: [
    { name: "mp3", type: "folder", children: [
      { name: "01_タイトルコール.mp3", type: "audio", size: "192 KB" },
      { name: "02_モーニングコール.mp3", type: "audio", size: "16.2 MB" },
      { name: "03_ストレッチ.mp3", type: "audio", size: "31.2 MB" },
      { name: "04_身体の検査.mp3", type: "audio", size: "22.7 MB" },
      { name: "05_もう少し傍に.mp3", type: "audio", size: "16.5 MB" },
      { name: "06_おやすみなさい.mp3", type: "audio", size: "11.8 MB" },
    ]},
  ]},
  { name: "SE有り", type: "folder", children: [
    { name: "mp3", type: "folder", children: [
      { name: "01_タイトルコール.mp3", type: "audio", size: "210 KB" },
      { name: "02_モーニングコール.mp3", type: "audio", size: "17.1 MB" },
      { name: "03_ストレッチ.mp3", type: "audio", size: "33.0 MB" },
      { name: "04_身体の検査.mp3", type: "audio", size: "24.1 MB" },
      { name: "05_もう少し傍に.mp3", type: "audio", size: "17.2 MB" },
      { name: "06_おやすみなさい.mp3", type: "audio", size: "12.5 MB" },
    ]},
  ]},
  { name: "ボーナストラック", type: "folder", children: [{ name: "bonus_01.mp3", type: "audio", size: "8.4 MB" }] },
  { name: "cover.jpg", type: "image", size: "1.2 MB", width: 1200, height: 1200 },
  { name: "jacket_back.jpg", type: "image", size: "980 KB", width: 1200, height: 1200 },
  { name: "特典イラスト_01.png", type: "image", size: "3.4 MB", width: 2048, height: 1448 },
  { name: "特典イラスト_02.png", type: "image", size: "4.1 MB", width: 2048, height: 1448 },
  { name: "readme.txt", type: "text", size: "2 KB" },
];

const GRID_SIZES = [
  { label: "S", cover: 120 },
  { label: "M", cover: 160 },
  { label: "L", cover: 200 },
  { label: "XL", cover: 260 },
];

const SORT_OPTIONS = [
  { id: "added-desc", label: "追加日（新しい順）" },
  { id: "added-asc", label: "追加日（古い順）" },
  { id: "title-asc", label: "タイトル（A→Z）" },
  { id: "title-desc", label: "タイトル（Z→A）" },
  { id: "duration-desc", label: "再生時間（長い順）" },
  { id: "duration-asc", label: "再生時間（短い順）" },
  { id: "recent", label: "最近再生した順" },
  { id: "random", label: "ランダム" },
];

const hues = [210, 340, 160, 270, 30, 190, 300, 50];

/* ─── Primitives ─── */
function CoverPlaceholder({ index, size = 160, hasError = false, bookmarked = false, style: extra }) {
  const hue = hues[index % hues.length];
  return (
    <div style={{
      width: size, height: size,
      background: `linear-gradient(135deg, hsl(${hue}, 40%, 28%) 0%, hsl(${hue + 30}, 35%, 18%) 100%)`,
      borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative", flexShrink: 0, ...extra,
    }}>
      <span style={{ fontSize: Math.max(size * 0.09, 10), opacity: 0.3, color: "#fff" }}>{size > 60 ? "Cover" : ""}</span>
      {hasError && (
        <div style={{
          position: "absolute", top: 5, right: 5, background: "#e53e3e", borderRadius: "50%",
          width: Math.max(size * 0.12, 16), height: Math.max(size * 0.12, 16),
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: Math.max(size * 0.07, 9), fontWeight: 700, color: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,.4)",
        }}>!</div>
      )}
      {bookmarked && (
        <div style={{
          position: "absolute", top: 5, left: 5, fontSize: Math.max(size * 0.1, 12),
          filter: "drop-shadow(0 1px 2px rgba(0,0,0,.5))",
        }}>🔖</div>
      )}
    </div>
  );
}

function ImagePlaceholder({ hue = 200, w = 160, h = 160, label }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: 4, flexShrink: 0,
      background: `linear-gradient(135deg, hsl(${hue}, 30%, 25%) 0%, hsl(${hue + 20}, 25%, 16%) 100%)`,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <span style={{ fontSize: 10, opacity: 0.35, color: "#fff", textAlign: "center", padding: 4, whiteSpace: "pre-line" }}>{label || "Image"}</span>
    </div>
  );
}

function Btn({ children, onClick, style: s, title }) {
  return (
    <button onClick={onClick} title={title} style={{
      background: "none", border: "none", color: "#ccc", cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 0, ...s,
    }}>{children}</button>
  );
}

function UrlButtons({ urls, compact = false }) {
  if (!urls || urls.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {urls.map((u, i) => (
        <button key={i} onClick={(e) => e.stopPropagation()} title={u.url} style={{
          display: "inline-flex", alignItems: "center", gap: 3,
          fontSize: compact ? 10 : 11, color: "#5b8def",
          background: "#5b8def12", border: "1px solid #5b8def30",
          borderRadius: 4, padding: compact ? "2px 6px" : "3px 8px", cursor: "pointer",
        }}>
          <span style={{ fontSize: compact ? 10 : 11 }}>↗</span>{u.label}
        </button>
      ))}
    </div>
  );
}

/* ─── Header ─── */
function Header({ searchQuery, setSearchQuery, onRefresh, onSettingsClick, gridSizeIdx, setGridSizeIdx, viewMode, setViewMode }) {
  return (
    <div style={{
      height: 52, background: "#1a1a2e", borderBottom: "1px solid #2a2a40",
      display: "flex", alignItems: "center", padding: "0 16px", gap: 10, flexShrink: 0,
    }}>
      <span style={{ fontSize: 15, fontWeight: 700, color: "#e2e2f0", letterSpacing: 0.5, marginRight: 4, whiteSpace: "nowrap" }}>🎧 AudioLib</span>

      <div style={{ flex: 1, maxWidth: 420, position: "relative" }}>
        <input type="text" placeholder="作品名・タグで検索..."
          value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: "100%", height: 32, background: "#252540", border: "1px solid #3a3a55",
            borderRadius: 6, color: "#e2e2f0", padding: "0 12px 0 32px", fontSize: 13,
            outline: "none", boxSizing: "border-box",
          }}
        />
        <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", fontSize: 13, opacity: 0.45, color: "#e2e2f0" }}>🔍</span>
      </div>

      {/* View mode toggle */}
      <div style={{ display: "flex", background: "#252540", borderRadius: 5, overflow: "hidden" }}>
        {[
          { id: "grid", icon: "▦", tip: "グリッド表示" },
          { id: "table", icon: "☰", tip: "テーブル表示" },
        ].map((m) => (
          <Btn key={m.id} onClick={() => setViewMode(m.id)} title={m.tip} style={{
            width: 30, height: 28, fontSize: 14,
            color: viewMode === m.id ? "#5b8def" : "#666",
            background: viewMode === m.id ? "#5b8def15" : "transparent",
          }}>{m.icon}</Btn>
        ))}
      </div>

      {/* Grid size (only shown in grid mode) */}
      {viewMode === "grid" && (
        <div style={{ display: "flex", alignItems: "center", gap: 2, background: "#252540", borderRadius: 5, padding: "2px 4px" }}>
          <Btn title="縮小" onClick={() => setGridSizeIdx(Math.max(0, gridSizeIdx - 1))}
            style={{ fontSize: 14, color: gridSizeIdx === 0 ? "#555" : "#aaa", width: 24, height: 24 }}>−</Btn>
          <span style={{ fontSize: 10, color: "#888", width: 20, textAlign: "center" }}>{GRID_SIZES[gridSizeIdx].label}</span>
          <Btn title="拡大" onClick={() => setGridSizeIdx(Math.min(GRID_SIZES.length - 1, gridSizeIdx + 1))}
            style={{ fontSize: 14, color: gridSizeIdx === GRID_SIZES.length - 1 ? "#555" : "#aaa", width: 24, height: 24 }}>+</Btn>
        </div>
      )}

      <Btn onClick={onRefresh} title="再読み込み" style={{ width: 32, height: 32, fontSize: 16, color: "#aaa", border: "1px solid #3a3a55", borderRadius: 6 }}>↻</Btn>
      <Btn onClick={onSettingsClick} title="設定" style={{ width: 32, height: 32, fontSize: 15, color: "#aaa", border: "1px solid #3a3a55", borderRadius: 6 }}>⚙</Btn>
    </div>
  );
}

/* ─── Search Conditions Bar ─── */
function SearchConditionsBar({ searchQuery, setSearchQuery, tagFilters, setTagFilters, sortId, setSortId, showSortMenu, setShowSortMenu, resultCount }) {
  const hasConditions = searchQuery || tagFilters.length > 0;
  const sortLabel = SORT_OPTIONS.find((o) => o.id === sortId)?.label || "";

  return (
    <div style={{
      padding: "8px 20px", borderBottom: "1px solid #1e1e38", flexShrink: 0,
      display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
      background: "#15152c",
    }}>
      {/* Active filters */}
      {hasConditions && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
          {searchQuery && (
            <span style={{
              fontSize: 11, color: "#d0d0e0", background: "#5b8def18", border: "1px solid #5b8def30",
              padding: "2px 8px", borderRadius: 4, display: "inline-flex", alignItems: "center", gap: 4,
            }}>
              検索: "{searchQuery}"
              <span onClick={() => setSearchQuery("")} style={{ cursor: "pointer", opacity: 0.6, fontSize: 10 }}>✕</span>
            </span>
          )}
          {tagFilters.map((tag, i) => (
            <span key={i} style={{
              fontSize: 11, color: "#8bb4e8", background: "#5b8def12", border: "1px solid #5b8def25",
              padding: "2px 8px", borderRadius: 4, display: "inline-flex", alignItems: "center", gap: 4,
            }}>
              {tag}
              <span onClick={() => setTagFilters(tagFilters.filter((_, j) => j !== i))} style={{ cursor: "pointer", opacity: 0.6, fontSize: 10 }}>✕</span>
            </span>
          ))}
          <Btn onClick={() => { setSearchQuery(""); setTagFilters([]); }} title="条件をクリア"
            style={{ fontSize: 10, color: "#888", padding: "2px 6px" }}>すべてクリア</Btn>
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* Result count */}
      <span style={{ fontSize: 11, color: "#666" }}>{resultCount} 作品</span>

      {/* Sort */}
      <div style={{ position: "relative" }}>
        <button onClick={() => setShowSortMenu(!showSortMenu)} style={{
          display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#aaa",
          background: "#252540", border: "1px solid #3a3a55", borderRadius: 5,
          padding: "3px 10px", cursor: "pointer",
        }}>
          並び替え: {sortLabel} <span style={{ fontSize: 8 }}>▼</span>
        </button>
        {showSortMenu && (
          <>
            <div style={{ position: "fixed", inset: 0, zIndex: 50 }} onClick={() => setShowSortMenu(false)} />
            <div style={{
              position: "absolute", top: "100%", right: 0, marginTop: 4,
              background: "#1e1e36", border: "1px solid #3a3a55", borderRadius: 6,
              boxShadow: "0 4px 16px rgba(0,0,0,.4)", zIndex: 51, minWidth: 200, padding: "4px 0",
            }}>
              {SORT_OPTIONS.map((opt) => (
                <div key={opt.id} onClick={() => { setSortId(opt.id); setShowSortMenu(false); }} style={{
                  padding: "6px 14px", fontSize: 12, cursor: "pointer",
                  color: sortId === opt.id ? "#5b8def" : "#c0c0d8",
                  background: sortId === opt.id ? "#5b8def10" : "transparent",
                }}
                  onMouseEnter={(e) => { if (sortId !== opt.id) e.currentTarget.style.background = "#ffffff06"; }}
                  onMouseLeave={(e) => { if (sortId !== opt.id) e.currentTarget.style.background = "transparent"; }}
                >{opt.label}</div>
              ))}
              <div style={{ borderTop: "1px solid #2a2a40", margin: "4px 0" }} />
              <div style={{ padding: "6px 14px", fontSize: 11, color: "#555", cursor: "not-allowed" }} title="将来実装予定">
                💾 プリセットとして保存...
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Work Card (with double-click fix) ─── */
function WorkCard({ work, onClick, onDoubleClick, isSelected, coverSize }) {
  const [hovered, setHovered] = useState(false);
  const clickTimer = useRef(null);

  const handleClick = useCallback((e) => {
    if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; return; }
    clickTimer.current = setTimeout(() => { clickTimer.current = null; onClick(); }, 200);
  }, [onClick]);

  const handleDoubleClick = useCallback((e) => {
    if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; }
    onDoubleClick();
  }, [onDoubleClick]);

  return (
    <div onClick={handleClick} onDoubleClick={handleDoubleClick}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        width: coverSize, cursor: "pointer", transition: "transform 0.15s",
        transform: hovered ? "translateY(-2px)" : "none",
      }}>
      <div style={{
        borderRadius: 6, overflow: "hidden",
        outline: isSelected ? "2px solid #5b8def" : hovered ? "1px solid #5b8def55" : "1px solid transparent",
        outlineOffset: 2, transition: "outline 0.15s",
      }}>
        <CoverPlaceholder index={work.id} size={coverSize} hasError={work.hasError} bookmarked={work.bookmarked} />
      </div>
      <div style={{
        marginTop: 6, fontSize: coverSize < 140 ? 10 : 12, color: "#d0d0e0", lineHeight: 1.35,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{work.title}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: coverSize < 140 ? 9 : 11, color: "#777", marginTop: 2 }}>
        <span>{work.trackCount}曲 · {work.totalDuration}</span>
        {work.lastPlayed && <span style={{ color: "#5b8def55", fontSize: coverSize < 140 ? 8 : 9 }}>● 最近再生</span>}
      </div>
    </div>
  );
}

/* ─── Table Row ─── */
function TableRow({ work, onClick, onDoubleClick, isSelected, playingWorkId }) {
  const [hovered, setHovered] = useState(false);
  const clickTimer = useRef(null);

  const handleClick = useCallback(() => {
    if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; return; }
    clickTimer.current = setTimeout(() => { clickTimer.current = null; onClick(); }, 200);
  }, [onClick]);

  const handleDoubleClick = useCallback(() => {
    if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; }
    onDoubleClick();
  }, [onDoubleClick]);

  const isPlaying = playingWorkId === work.id;

  return (
    <div onClick={handleClick} onDoubleClick={handleDoubleClick}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", padding: "6px 12px", gap: 12,
        borderRadius: 4, cursor: "pointer",
        background: isSelected ? "#5b8def12" : hovered ? "#ffffff05" : "transparent",
        borderBottom: "1px solid #1e1e38",
      }}>
      <CoverPlaceholder index={work.id} size={40} hasError={work.hasError} bookmarked={false} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12, color: isPlaying ? "#5b8def" : "#e2e2f0",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          display: "flex", alignItems: "center", gap: 4,
        }}>
          {isPlaying && <span style={{ fontSize: 10 }}>▶</span>}
          {work.bookmarked && <span style={{ fontSize: 10 }}>🔖</span>}
          {work.title}
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 3, maxWidth: 200 }}>
        {work.tags.slice(0, 3).map((t, i) => (
          <span key={i} style={{
            fontSize: 10, color: t.includes("/") ? "#7aa8d8" : "#999",
            background: "#252540", padding: "1px 5px", borderRadius: 3,
          }}>{t}</span>
        ))}
        {work.tags.length > 3 && <span style={{ fontSize: 10, color: "#555" }}>+{work.tags.length - 3}</span>}
      </div>
      <span style={{ fontSize: 11, color: "#777", width: 50, textAlign: "right", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{work.trackCount}曲</span>
      <span style={{ fontSize: 11, color: "#777", width: 60, textAlign: "right", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{work.totalDuration}</span>
      {work.hasError && <span style={{ fontSize: 12, flexShrink: 0 }} title="エラーあり">⚠️</span>}
      {work.lastPlayed && <span style={{ fontSize: 9, color: "#5b8def55", flexShrink: 0 }}>●</span>}
    </div>
  );
}

/* ─── Library Views ─── */
function LibraryGrid({ works, selectedId, onSelect, onOpenFull, coverSize }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: coverSize < 140 ? 14 : 18, padding: "16px 20px" }}>
      {works.map((w) => (
        <WorkCard key={w.id} work={w}
          onClick={() => onSelect(w.id)} onDoubleClick={() => onOpenFull(w.id)}
          isSelected={selectedId === w.id} coverSize={coverSize}
        />
      ))}
    </div>
  );
}

function LibraryTable({ works, selectedId, onSelect, onOpenFull, playingWorkId }) {
  return (
    <div style={{ padding: "8px 12px" }}>
      {/* Table header */}
      <div style={{
        display: "flex", alignItems: "center", padding: "4px 12px", gap: 12,
        fontSize: 10, color: "#555", fontWeight: 600, letterSpacing: 0.5,
        borderBottom: "1px solid #2a2a40", marginBottom: 4,
      }}>
        <div style={{ width: 40 }} />
        <div style={{ flex: 1 }}>タイトル</div>
        <div style={{ width: 200, textAlign: "center" }}>タグ</div>
        <div style={{ width: 50, textAlign: "right" }}>曲数</div>
        <div style={{ width: 60, textAlign: "right" }}>再生時間</div>
        <div style={{ width: 16 }} />
        <div style={{ width: 12 }} />
      </div>
      {works.map((w) => (
        <TableRow key={w.id} work={w}
          onClick={() => onSelect(w.id)} onDoubleClick={() => onOpenFull(w.id)}
          isSelected={selectedId === w.id} playingWorkId={playingWorkId}
        />
      ))}
    </div>
  );
}

/* ─── Detail Panel (Quick View) ─── */
function DetailPanel({ work, onClose, onPlay, playingTrack, onOpenFull }) {
  return (
    <div style={{
      position: "fixed", top: 52, right: 0, bottom: 0, width: 370,
      background: "#1c1c32", borderLeft: "1px solid #2a2a40", zIndex: 100,
      display: "flex", flexDirection: "column",
      animation: "slideIn 0.2s ease-out", boxShadow: "-4px 0 24px rgba(0,0,0,.45)",
    }}>
      <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid #2a2a40" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#e2e2f0" }}>クイックビュー</span>
        <div style={{ display: "flex", gap: 4 }}>
          <Btn onClick={onOpenFull} title="フルビューで開く" style={{ fontSize: 11, color: "#5b8def", padding: "3px 8px", border: "1px solid #5b8def30", borderRadius: 4, background: "#5b8def10" }}>
            詳細を開く ↗
          </Btn>
          <Btn onClick={onClose} style={{ fontSize: 16, color: "#777", marginLeft: 4 }}>✕</Btn>
        </div>
      </div>

      <div style={{ overflowY: "auto", flex: 1, padding: 14 }}>
        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
          <CoverPlaceholder index={work.id} size={90} hasError={work.hasError} bookmarked={work.bookmarked} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e2f0", lineHeight: 1.4, marginBottom: 4 }}>{work.title}</div>
            <div style={{ fontSize: 11, color: "#777", marginBottom: 4 }}>{work.trackCount}曲 · {work.totalDuration}</div>
            {work.lastPlayed && <div style={{ fontSize: 10, color: "#5b8def88", marginBottom: 4 }}>最終再生: {work.lastPlayed}</div>}
            {work.hasError && (
              <div style={{ fontSize: 10, color: "#e53e3e", background: "#e53e3e15", padding: "3px 7px", borderRadius: 4, marginBottom: 6 }}>⚠ 一部のトラックが見つかりません</div>
            )}
            <UrlButtons urls={work.urls} compact />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: "#777", marginBottom: 5, fontWeight: 600, letterSpacing: 0.5 }}>タグ</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {work.tags.map((tag, i) => (
              <span key={i} style={{
                fontSize: 11, color: tag.includes("/") ? "#8bb4e8" : "#b8b8d0",
                background: tag.includes("/") ? "#5b8def10" : "#28283f",
                padding: "2px 7px", borderRadius: 3, display: "inline-flex", alignItems: "center", gap: 4,
              }}>{tag}<span style={{ cursor: "pointer", opacity: 0.4, fontSize: 9 }}>✕</span></span>
            ))}
            <span style={{ fontSize: 11, color: "#5b8def", background: "#5b8def12", padding: "2px 7px", borderRadius: 3, cursor: "pointer" }}>+ 追加</span>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 10, color: "#777", marginBottom: 6, fontWeight: 600 }}>トラック ({MOCK_TRACKS.length})</div>
          {MOCK_TRACKS.map((track, i) => {
            const isPlaying = playingTrack === i;
            return (
              <div key={i} onClick={() => onPlay(i)} style={{
                display: "flex", alignItems: "center", padding: "7px 8px", borderRadius: 4,
                cursor: "pointer", background: isPlaying ? "#5b8def15" : "transparent", marginBottom: 1,
              }}
                onMouseEnter={(e) => { if (!isPlaying) e.currentTarget.style.background = "#ffffff06"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = isPlaying ? "#5b8def15" : "transparent"; }}
              >
                <span style={{ width: 18, fontSize: 11, color: isPlaying ? "#5b8def" : "#555", flexShrink: 0, textAlign: "center" }}>
                  {isPlaying ? "▶" : `${i + 1}`}
                </span>
                <div style={{ flex: 1, minWidth: 0, marginLeft: 4 }}>
                  <div style={{ fontSize: 12, color: isPlaying ? "#5b8def" : "#d0d0e0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.title}</div>
                </div>
                <span style={{ fontSize: 10, color: "#666", flexShrink: 0, marginLeft: 8, fontVariantNumeric: "tabular-nums" }}>{track.duration}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── File Tree ─── */
function FileTreeItem({ item, depth = 0, onPlayFile, onPreviewImage }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const indent = depth * 20;
  const iconMap = { folder: "📁", audio: "🔊", image: "🖼", text: "📄" };

  if (item.type === "folder") {
    return (
      <div>
        <div onClick={() => setExpanded(!expanded)} style={{
          display: "flex", alignItems: "center", padding: "5px 8px", paddingLeft: 8 + indent, cursor: "pointer",
          borderRadius: 4, fontSize: 12, color: "#d0d0e0",
        }}
          onMouseEnter={(e) => e.currentTarget.style.background = "#ffffff06"}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
        >
          <span style={{ fontSize: 10, color: "#666", width: 16, textAlign: "center", flexShrink: 0 }}>{expanded ? "▾" : "▸"}</span>
          <span style={{ marginRight: 6 }}>{iconMap.folder}</span>
          <span style={{ flex: 1 }}>{item.name}</span>
          <span style={{ fontSize: 10, color: "#555" }}>{item.children.length}項目</span>
        </div>
        {expanded && item.children.map((child, i) => (
          <FileTreeItem key={i} item={child} depth={depth + 1} onPlayFile={onPlayFile} onPreviewImage={onPreviewImage} />
        ))}
      </div>
    );
  }

  const isAudio = item.type === "audio";
  const isImage = item.type === "image";
  return (
    <div onClick={() => { if (isAudio && onPlayFile) onPlayFile(item); if (isImage && onPreviewImage) onPreviewImage(item); }}
      style={{
        display: "flex", alignItems: "center", padding: "5px 8px", paddingLeft: 8 + indent,
        borderRadius: 4, fontSize: 12, color: "#c0c0d8", cursor: (isAudio || isImage) ? "pointer" : "default",
      }}
      onMouseEnter={(e) => { if (isAudio || isImage) e.currentTarget.style.background = "#ffffff06"; }}
      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
    >
      <span style={{ width: 16, flexShrink: 0 }} />
      <span style={{ marginRight: 6 }}>{iconMap[item.type] || "📄"}</span>
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</span>
      {isAudio && <span style={{ fontSize: 10, color: "#5b8def", marginRight: 8, flexShrink: 0 }}>▶ 再生</span>}
      {isImage && <span style={{ fontSize: 10, color: "#8b8def", marginRight: 8, flexShrink: 0 }}>プレビュー</span>}
      <span style={{ fontSize: 10, color: "#555", flexShrink: 0 }}>{item.size}</span>
    </div>
  );
}

/* ─── Full View ─── */
function FullView({ work, onClose, onPlay, playingTrack }) {
  const [activeTab, setActiveTab] = useState("tracks");
  const [previewImage, setPreviewImage] = useState(null);

  return (
    <div style={{
      position: "fixed", inset: 0, top: 52, background: "#13132a", zIndex: 80,
      display: "flex", flexDirection: "column", animation: "fadeIn 0.2s ease-out",
    }}>
      <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>

      <div style={{
        display: "flex", alignItems: "center", gap: 12, padding: "12px 20px",
        borderBottom: "1px solid #2a2a40", flexShrink: 0,
      }}>
        <Btn onClick={onClose} title="ライブラリに戻る" style={{ fontSize: 13, color: "#888", gap: 4, padding: "4px 10px", border: "1px solid #3a3a55", borderRadius: 5 }}>← 戻る</Btn>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#e2e2f0", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{work.title}</span>
        <UrlButtons urls={work.urls} />
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Left sidebar */}
        <div style={{ width: 300, flexShrink: 0, overflowY: "auto", padding: 20, borderRight: "1px solid #2a2a40" }}>
          <CoverPlaceholder index={work.id} size={260} hasError={work.hasError} bookmarked={work.bookmarked} style={{ borderRadius: 8 }} />
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#e2e2f0", lineHeight: 1.4, marginBottom: 4 }}>{work.title}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: "#777" }}>{work.trackCount}曲 · {work.totalDuration}</span>
              {work.bookmarked && <span style={{ fontSize: 12 }} title="ブックマーク中">🔖</span>}
            </div>
            {work.lastPlayed && <div style={{ fontSize: 11, color: "#5b8def88", marginBottom: 8 }}>最終再生: {work.lastPlayed}</div>}
            {work.hasError && (
              <div style={{ fontSize: 11, color: "#e53e3e", background: "#e53e3e15", padding: "6px 10px", borderRadius: 5, marginBottom: 12 }}>⚠ 一部のトラックが見つかりません</div>
            )}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: "#777", marginBottom: 6, fontWeight: 600, letterSpacing: 0.5 }}>タグ</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {work.tags.map((tag, i) => (
                  <span key={i} style={{
                    fontSize: 11, color: tag.includes("/") ? "#8bb4e8" : "#b8b8d0",
                    background: tag.includes("/") ? "#5b8def10" : "#28283f",
                    padding: "3px 8px", borderRadius: 3, display: "inline-flex", alignItems: "center", gap: 4,
                  }}>{tag}<span style={{ cursor: "pointer", opacity: 0.4, fontSize: 9 }}>✕</span></span>
                ))}
                <span style={{ fontSize: 11, color: "#5b8def", background: "#5b8def12", padding: "3px 8px", borderRadius: 3, cursor: "pointer" }}>+ 追加</span>
              </div>
            </div>
            <div style={{ paddingTop: 12, borderTop: "1px solid #2a2a40" }}>
              <div style={{ fontSize: 10, color: "#777", marginBottom: 5, fontWeight: 600, letterSpacing: 0.5 }}>メタ情報</div>
              <div style={{ fontSize: 11, color: "#555", lineHeight: 1.9 }}>
                <div>パス: <span style={{ color: "#888" }}>dlsite/genre-a/RJ{401000 + work.id}/</span></div>
                <div>追加日: <span style={{ color: "#888" }}>{work.addedAt}</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: tabs */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #2a2a40", flexShrink: 0 }}>
            {[{ id: "tracks", label: `トラック (${MOCK_TRACKS.length})` }, { id: "files", label: `ファイル (${MOCK_FILES.length})` }].map((tab) => (
              <div key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                fontSize: 12, padding: "10px 20px", cursor: "pointer",
                color: activeTab === tab.id ? "#5b8def" : "#777",
                borderBottom: activeTab === tab.id ? "2px solid #5b8def" : "2px solid transparent",
                fontWeight: activeTab === tab.id ? 600 : 400,
              }}>{tab.label}</div>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            {activeTab === "tracks" && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <button onClick={() => onPlay(0)} style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "6px 16px",
                    background: "#5b8def", border: "none", borderRadius: 5, color: "#fff", fontSize: 12, cursor: "pointer", fontWeight: 600,
                  }}>▶ すべて再生</button>
                  <span style={{ fontSize: 11, color: "#666" }}>合計: {work.totalDuration}</span>
                </div>
                {MOCK_TRACKS.map((track, i) => {
                  const isPlaying = playingTrack === i;
                  return (
                    <div key={i} onClick={() => onPlay(i)} style={{
                      display: "flex", alignItems: "center", padding: "10px 12px", borderRadius: 5,
                      cursor: "pointer", background: isPlaying ? "#5b8def12" : "transparent", marginBottom: 2,
                    }}
                      onMouseEnter={(e) => { if (!isPlaying) e.currentTarget.style.background = "#ffffff06"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = isPlaying ? "#5b8def12" : "transparent"; }}
                    >
                      <span style={{ width: 28, fontSize: 12, color: isPlaying ? "#5b8def" : "#555", flexShrink: 0, textAlign: "center" }}>
                        {isPlaying ? "▶" : `${i + 1}`}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: isPlaying ? "#5b8def" : "#e2e2f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.title}</div>
                      </div>
                      <span style={{ fontSize: 11, color: "#666", flexShrink: 0, marginLeft: 12, fontVariantNumeric: "tabular-nums" }}>{track.duration}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === "files" && (
              <div>
                <div style={{ fontSize: 11, color: "#777", marginBottom: 12 }}>作品フォルダーの物理構造です。音声ファイルは再生、画像はプレビューできます。</div>
                {previewImage && (
                  <div style={{ marginBottom: 16, background: "#1a1a2e", borderRadius: 8, padding: 12, border: "1px solid #2a2a40" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 12, color: "#e2e2f0" }}>🖼 {previewImage.name}</span>
                      <Btn onClick={() => setPreviewImage(null)} style={{ fontSize: 14, color: "#777" }}>✕</Btn>
                    </div>
                    <ImagePlaceholder hue={220} w={400} h={280} label={`${previewImage.name}\n${previewImage.width}×${previewImage.height}`} />
                    <div style={{ fontSize: 10, color: "#555", marginTop: 6 }}>{previewImage.width}×{previewImage.height} · {previewImage.size}</div>
                  </div>
                )}
                <div style={{ background: "#1a1a2e", borderRadius: 6, padding: "8px 4px", border: "1px solid #2a2a40" }}>
                  {MOCK_FILES.map((item, i) => (
                    <FileTreeItem key={i} item={item} depth={0} onPlayFile={() => {}} onPreviewImage={(f) => setPreviewImage(f)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Player Bar ─── */
function PlayerBar({ track, work, onExpand, loop, setLoop }) {
  const [progress, setProgress] = useState(35);
  const [volume, setVolume] = useState(75);
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, height: 72,
      background: "#141426", borderTop: "1px solid #2a2a40",
      display: "flex", alignItems: "center", padding: "0 14px", zIndex: 200,
    }}>
      <div onClick={onExpand} style={{ display: "flex", alignItems: "center", gap: 10, flex: "0 0 auto", cursor: "pointer", marginRight: 12 }}>
        <CoverPlaceholder index={work.id} size={48} />
        <div style={{ maxWidth: 140, minWidth: 80 }}>
          <div style={{ fontSize: 12, color: "#e2e2f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.title}</div>
          <div style={{ fontSize: 10, color: "#777", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{work.title}</div>
        </div>
        <span style={{ fontSize: 10, color: "#555", marginLeft: 2 }}>▲</span>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Btn onClick={() => setLoop(!loop)} title="ループ" style={{ fontSize: 12, color: loop ? "#5b8def" : "#666", width: 26, height: 26 }}>🔁</Btn>
          <Btn title="前のトラック" style={{ fontSize: 14, color: "#ccc", width: 26, height: 26 }}>⏮</Btn>
          <Btn title="10秒戻る" style={{ fontSize: 10, color: "#aaa", width: 28, height: 26, fontWeight: 700 }}>-10s</Btn>
          <button style={{
            background: "#e2e2f0", border: "none", borderRadius: "50%",
            width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", fontSize: 13, color: "#1a1a2e",
          }}>▶</button>
          <Btn title="10秒進む" style={{ fontSize: 10, color: "#aaa", width: 28, height: 26, fontWeight: 700 }}>+10s</Btn>
          <Btn title="次のトラック" style={{ fontSize: 14, color: "#ccc", width: 26, height: 26 }}>⏭</Btn>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", maxWidth: 680, padding: "0 4px" }}>
          <span style={{ fontSize: 10, color: "#888", width: 38, textAlign: "right", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>01:23</span>
          <div style={{ flex: 1, height: 4, background: "#2a2a40", borderRadius: 2, position: "relative", cursor: "pointer" }}
            onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setProgress(((e.clientX - r.left) / r.width) * 100); }}>
            <div style={{ width: `${progress}%`, height: "100%", background: "#5b8def", borderRadius: 2 }} />
            <div style={{ position: "absolute", left: `${progress}%`, top: "50%", transform: "translate(-50%,-50%)", width: 10, height: 10, background: "#e2e2f0", borderRadius: "50%", opacity: 0.9 }} />
          </div>
          <span style={{ fontSize: 10, color: "#888", width: 38, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{track.duration}</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, flex: "0 0 110px", marginLeft: 12 }}>
        <span style={{ fontSize: 13, color: "#777" }}>🔊</span>
        <div style={{ flex: 1, height: 3, background: "#2a2a40", borderRadius: 2, cursor: "pointer", position: "relative" }}
          onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setVolume(((e.clientX - r.left) / r.width) * 100); }}>
          <div style={{ width: `${volume}%`, height: "100%", background: "#5b8def", borderRadius: 2 }} />
        </div>
      </div>
    </div>
  );
}

/* ─── Full Screen Player ─── */
function FullScreenPlayer({ track, work, onClose, loop, setLoop }) {
  const [progress, setProgress] = useState(35);
  const [volume, setVolume] = useState(75);
  return (
    <div style={{ position: "fixed", inset: 0, background: "#0c0c1a", zIndex: 300, display: "flex", flexDirection: "column", animation: "slideUp 0.25s ease-out" }}>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px" }}>
        <Btn onClick={onClose} style={{ fontSize: 12, color: "#888", gap: 4 }}><span>▼</span><span>閉じる</span></Btn>
        <span style={{ fontSize: 11, color: "#555" }}>再生中</span>
        <UrlButtons urls={work.urls} compact />
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: "0 40px", minHeight: 0 }}>
        <CoverPlaceholder index={work.id} size={220} />
        <div style={{ textAlign: "center", maxWidth: 460 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: "#e2e2f0", marginBottom: 5 }}>{track.title}</div>
          <div style={{ fontSize: 12, color: "#777" }}>{work.title}</div>
        </div>
        <div style={{ width: "100%", maxWidth: 560 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <span style={{ fontSize: 11, color: "#888", width: 40, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>01:23</span>
            <div style={{ flex: 1, height: 5, background: "#2a2a40", borderRadius: 3, cursor: "pointer", position: "relative" }}
              onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setProgress(((e.clientX - r.left) / r.width) * 100); }}>
              <div style={{ width: `${progress}%`, height: "100%", background: "#5b8def", borderRadius: 3 }} />
              <div style={{ position: "absolute", left: `${progress}%`, top: "50%", transform: "translate(-50%,-50%)", width: 14, height: 14, background: "#e2e2f0", borderRadius: "50%" }} />
            </div>
            <span style={{ fontSize: 11, color: "#888", width: 40, fontVariantNumeric: "tabular-nums" }}>{track.duration}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}>
            <Btn onClick={() => setLoop(!loop)} title="ループ" style={{ fontSize: 15, color: loop ? "#5b8def" : "#666", width: 36, height: 36 }}>🔁</Btn>
            <Btn title="前のトラック" style={{ fontSize: 20, color: "#ccc", width: 36, height: 36 }}>⏮</Btn>
            <Btn title="10秒戻る" style={{ fontSize: 12, color: "#aaa", width: 36, height: 36, fontWeight: 700 }}>-10s</Btn>
            <button style={{
              background: "#e2e2f0", border: "none", borderRadius: "50%",
              width: 52, height: 52, display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", fontSize: 20, color: "#1a1a2e",
            }}>▶</button>
            <Btn title="10秒進む" style={{ fontSize: 12, color: "#aaa", width: 36, height: 36, fontWeight: 700 }}>+10s</Btn>
            <Btn title="次のトラック" style={{ fontSize: 20, color: "#ccc", width: 36, height: 36 }}>⏭</Btn>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 16 }}>
            <span style={{ fontSize: 13, color: "#777" }}>🔊</span>
            <div style={{ width: 120, height: 3, background: "#2a2a40", borderRadius: 2, cursor: "pointer", position: "relative" }}
              onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setVolume(((e.clientX - r.left) / r.width) * 100); }}>
              <div style={{ width: `${volume}%`, height: "100%", background: "#5b8def", borderRadius: 2 }} />
            </div>
          </div>
        </div>
      </div>
      <div style={{ padding: "0 24px 16px", maxHeight: 180, overflowY: "auto", flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: "#777", marginBottom: 6, fontWeight: 600 }}>トラックリスト</div>
        {MOCK_TRACKS.map((t, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", padding: "5px 8px", borderRadius: 4,
            background: i === 0 ? "#5b8def15" : "transparent", marginBottom: 1, cursor: "pointer",
          }}>
            <span style={{ width: 18, fontSize: 10, color: i === 0 ? "#5b8def" : "#555", textAlign: "center" }}>{i === 0 ? "▶" : `${i + 1}`}</span>
            <span style={{ flex: 1, fontSize: 12, color: i === 0 ? "#5b8def" : "#d0d0e0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginLeft: 4 }}>{t.title}</span>
            <span style={{ fontSize: 10, color: "#555", marginLeft: 8, fontVariantNumeric: "tabular-nums" }}>{t.duration}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Modals ─── */
function SettingsModal({ onClose, onScan, scanning }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 250, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "#1e1e34", borderRadius: 10, padding: 22, width: 420, boxShadow: "0 8px 30px rgba(0,0,0,.5)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#e2e2f0" }}>設定</span>
          <Btn onClick={onClose} style={{ fontSize: 16, color: "#777" }}>✕</Btn>
        </div>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 5 }}>ルートフォルダー</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, padding: "7px 10px", background: "#252540", borderRadius: 5, border: "1px solid #3a3a55", fontSize: 12, color: "#999" }}>D:\Audio\Library</div>
            <button style={{ padding: "7px 12px", background: "#2d5a8e", border: "none", borderRadius: 5, color: "#e2e2f0", fontSize: 12, cursor: "pointer" }}>変更</button>
          </div>
        </div>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 5 }}>ライブラリスキャン</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={onScan} style={{
              padding: "7px 14px", background: scanning ? "#3a3a55" : "#252540",
              border: "1px solid #3a3a55", borderRadius: 5, color: "#e2e2f0", fontSize: 12,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
            }}>
              <span style={{ display: "inline-block", animation: scanning ? "spin 1s linear infinite" : "none" }}>{scanning ? "⟳" : "↻"}</span>
              {scanning ? "スキャン中..." : "フルスキャン実行"}
            </button>
            <span style={{ fontSize: 10, color: "#555" }}>前回: 2025-06-15 14:30</span>
          </div>
        </div>
        <div style={{ fontSize: 10, color: "#444", borderTop: "1px solid #2a2a40", paddingTop: 10 }}>AudioLib v0.1.0 (Phase 1)</div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

function NewWorkPopup({ onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 250, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "#1e1e34", borderRadius: 10, padding: 20, width: 420, boxShadow: "0 8px 30px rgba(0,0,0,.5)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#e2e2f0" }}>📁 新しい作品が見つかりました</span>
          <Btn onClick={onClose} style={{ fontSize: 16, color: "#777" }}>✕</Btn>
        </div>
        <div style={{ background: "#252540", borderRadius: 6, padding: 12, marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ width: 60, height: 60, background: "linear-gradient(135deg, hsl(270,40%,28%), hsl(300,35%,18%))", borderRadius: 4, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 8, color: "#fff", opacity: 0.3 }}>Cover</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: "#e2e2f0", fontWeight: 600, marginBottom: 4 }}>RJ401025 (新規フォルダー検出)</div>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>dlsite/genre-c/RJ401025/</div>
              <div style={{ fontSize: 10, color: "#666" }}>MP3ファイル × 8 · カバー画像あり</div>
            </div>
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>タイトル</div>
          <input type="text" defaultValue="RJ401025" style={{
            width: "100%", height: 30, background: "#1a1a2e", border: "1px solid #3a3a55",
            borderRadius: 5, color: "#e2e2f0", padding: "0 10px", fontSize: 12, outline: "none", boxSizing: "border-box",
          }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>タグ（スクレイピング結果）</div>
          <div style={{ fontSize: 10, color: "#555", background: "#1a1a2e", borderRadius: 5, padding: "8px 10px", border: "1px solid #3a3a55" }}>
            <span style={{ color: "#888" }}>フェーズ2で自動取得予定</span> — 手動追加は登録後に可能
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "6px 16px", background: "transparent", border: "1px solid #3a3a55", borderRadius: 5, color: "#aaa", fontSize: 12, cursor: "pointer" }}>スキップ</button>
          <button onClick={onClose} style={{ padding: "6px 16px", background: "#2d5a8e", border: "none", borderRadius: 5, color: "#e2e2f0", fontSize: 12, cursor: "pointer" }}>登録する</button>
        </div>
      </div>
    </div>
  );
}

/* ─── App ─── */
export default function App() {
  const [searchQuery, setSearchQuery] = useState("");
  const [tagFilters, setTagFilters] = useState([]);
  const [selectedWorkId, setSelectedWorkId] = useState(null);
  const [fullViewWorkId, setFullViewWorkId] = useState(null);
  const [playingTrack, setPlayingTrack] = useState(null);
  const [playingWork, setPlayingWork] = useState(null);
  const [showFullPlayer, setShowFullPlayer] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showNewWork, setShowNewWork] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [gridSizeIdx, setGridSizeIdx] = useState(1);
  const [loop, setLoop] = useState(false);
  const [viewMode, setViewMode] = useState("grid");
  const [sortId, setSortId] = useState("added-desc");
  const [showSortMenu, setShowSortMenu] = useState(false);

  const coverSize = GRID_SIZES[gridSizeIdx].cover;

  const filteredWorks = useMemo(() => {
    let works = MOCK_WORKS.filter((w) => {
      const matchText = !searchQuery || w.title.toLowerCase().includes(searchQuery.toLowerCase()) || w.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchTags = tagFilters.length === 0 || tagFilters.every((tf) => w.tags.some((t) => t.toLowerCase().includes(tf.toLowerCase())));
      return matchText && matchTags;
    });
    // Basic sort demo
    if (sortId === "title-asc") works = [...works].sort((a, b) => a.title.localeCompare(b.title));
    else if (sortId === "title-desc") works = [...works].sort((a, b) => b.title.localeCompare(a.title));
    else if (sortId === "duration-desc") works = [...works].sort((a, b) => b.totalDurationSec - a.totalDurationSec);
    else if (sortId === "duration-asc") works = [...works].sort((a, b) => a.totalDurationSec - b.totalDurationSec);
    else if (sortId === "random") works = [...works].sort(() => Math.random() - 0.5);
    return works;
  }, [searchQuery, tagFilters, sortId]);

  const selectedWork = MOCK_WORKS.find((w) => w.id === selectedWorkId);
  const fullViewWork = MOCK_WORKS.find((w) => w.id === fullViewWorkId);

  const handleScan = () => {
    setScanning(true);
    setTimeout(() => { setScanning(false); setShowNewWork(true); }, 2000);
  };

  const handlePlay = (trackIndex, work) => {
    const w = work || selectedWork || fullViewWork;
    setPlayingTrack(trackIndex);
    setPlayingWork(w);
  };

  const handleOpenFull = (id) => { setSelectedWorkId(null); setFullViewWorkId(id); };
  const isPlayerVisible = playingTrack !== null && playingWork !== null;

  return (
    <div style={{
      width: "100%", height: "100vh", background: "#13132a", color: "#e2e2f0",
      display: "flex", flexDirection: "column",
      fontFamily: "'Segoe UI', 'Noto Sans JP', sans-serif", overflow: "hidden",
    }}>
      <Header
        searchQuery={searchQuery} setSearchQuery={setSearchQuery}
        onRefresh={handleScan} onSettingsClick={() => setShowSettings(true)}
        gridSizeIdx={gridSizeIdx} setGridSizeIdx={setGridSizeIdx}
        viewMode={viewMode} setViewMode={setViewMode}
      />

      {!fullViewWork && (
        <SearchConditionsBar
          searchQuery={searchQuery} setSearchQuery={setSearchQuery}
          tagFilters={tagFilters} setTagFilters={setTagFilters}
          sortId={sortId} setSortId={setSortId}
          showSortMenu={showSortMenu} setShowSortMenu={setShowSortMenu}
          resultCount={filteredWorks.length}
        />
      )}

      {fullViewWork ? (
        <FullView work={fullViewWork} onClose={() => setFullViewWorkId(null)}
          onPlay={(i) => handlePlay(i, fullViewWork)}
          playingTrack={playingWork?.id === fullViewWork.id ? playingTrack : null}
        />
      ) : (
        <div style={{ flex: 1, overflowY: "auto" }}>
          {viewMode === "grid" ? (
            <LibraryGrid works={filteredWorks} selectedId={selectedWorkId}
              onSelect={(id) => setSelectedWorkId(id === selectedWorkId ? null : id)}
              onOpenFull={handleOpenFull} coverSize={coverSize}
            />
          ) : (
            <LibraryTable works={filteredWorks} selectedId={selectedWorkId}
              onSelect={(id) => setSelectedWorkId(id === selectedWorkId ? null : id)}
              onOpenFull={handleOpenFull} playingWorkId={playingWork?.id}
            />
          )}
        </div>
      )}

      {selectedWork && !fullViewWork && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 90 }} onClick={() => setSelectedWorkId(null)} />
          <DetailPanel work={selectedWork} onClose={() => setSelectedWorkId(null)}
            onPlay={(i) => handlePlay(i, selectedWork)}
            playingTrack={playingWork?.id === selectedWork.id ? playingTrack : null}
            onOpenFull={() => handleOpenFull(selectedWork.id)}
          />
        </>
      )}

      {isPlayerVisible && !showFullPlayer && (
        <PlayerBar track={MOCK_TRACKS[playingTrack]} work={playingWork}
          onExpand={() => setShowFullPlayer(true)} loop={loop} setLoop={setLoop} />
      )}

      {isPlayerVisible && showFullPlayer && (
        <FullScreenPlayer track={MOCK_TRACKS[playingTrack]} work={playingWork}
          onClose={() => setShowFullPlayer(false)} loop={loop} setLoop={setLoop} />
      )}

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} onScan={handleScan} scanning={scanning} />}
      {showNewWork && <NewWorkPopup onClose={() => setShowNewWork(false)} />}

      {isPlayerVisible && !showFullPlayer && !fullViewWork && <div style={{ height: 72, flexShrink: 0 }} />}
    </div>
  );
}
