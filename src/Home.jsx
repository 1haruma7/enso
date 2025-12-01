// src/Home.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Masonry from "react-masonry-css";
import { VariableSizeList as List } from "react-window";
import cu from "./data/cults_creations.json";

/* ===== 調整ポイント ===== */
const INITIAL_COUNT = 48; // ホーム画面で最初に表示する枚数
const PAGE_SIZE = 32; // ホーム画面の追加読み込み枚数
const REPEAT_COUNT = 1; // 元データを何倍に水増しするか

const DETAIL_INITIAL_COUNT = 70; // 詳細ページ右側の初期表示枚数
const DETAIL_PAGE_SIZE = 40; // 詳細ページ右側の追加読み込み枚数

const LOAD_DELAY_MS = 120; // ローディング演出用ディレイ
const PLACEHOLDER_IMG = "https://placehold.co/600x800?text=No+Image";
const PLACEHOLDER_IMG_LARGE = "https://placehold.co/800x800?text=No+Image";
const CARD_IMAGE_ASPECT_RATIO = "3 / 4";

const EXPLORE_FEATURES = [
  {
    id: "feature-1",
    title: "今日のピック",
    caption: "いま注目の1枚をすぐチェック",
    badge: "注目",
    accent: "from-white to-white",
  },
  {
    id: "feature-2",
    title: "人気上昇中",
    caption: "保存数が増えているモデル",
    badge: "人気",
    accent: "from-white to-white",
  },
  {
    id: "feature-3",
    title: "新着",
    caption: "最近追加されたコレクション",
    badge: "新着",
    accent: "from-white to-white",
  },
];

const EXPLORE_CATEGORIES = [
  { id: "cat-animals", label: "動物", accent: "from-blue-50 to-blue-100" },
  { id: "cat-art", label: "アート", accent: "from-pink-50 to-pink-100" },
  { id: "cat-design", label: "デザイン", accent: "from-purple-50 to-purple-100" },
  { id: "cat-diy", label: "DIY / ハンドメイド", accent: "from-amber-50 to-amber-100" },
  { id: "cat-food", label: "食品と飲料", accent: "from-orange-50 to-orange-100" },
  { id: "cat-interior", label: "室内装飾", accent: "from-lime-50 to-lime-100" },
  { id: "cat-fashion", label: "ファッション", accent: "from-rose-50 to-rose-100" },
  { id: "cat-travel", label: "旅行", accent: "from-cyan-50 to-cyan-100" },
];

const TAG_FILTERS = [
  "#print-in-place",
  "#miniature",
  "#lighting",
  "#figure",
  "#organizer",
  "#gadget",
  "#robotics",
];

/* ===== ヘルパ ===== */
const safe = (a) => (Array.isArray(a) ? a : []);
const normalize = (p) => {
  const tags = Array.from(
    new Set([...(safe(p?.tags_ja)), ...(safe(p?.tags_en))])
  );
  return {
    id: p?.id ?? null,
    title: p?.title_ja || p?.title || p?.name || "Untitled",
    titleEn: p?.title_en || p?.title || p?.name || "",
    tags,
    source: p?.site || p?.source || "Unknown",
    image_url: p?.image_url || p?.thumbnail || p?.preview || PLACEHOLDER_IMG,
    source_url: p?.source_url || p?.url || null,
    isCustom: Boolean(p?.isCustom),
  };
};

const shuffleItems = (items) => {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const CARD_ASPECT_RATIO_PRESETS = [
  "3 / 4",
  "3 / 5",
  "4 / 6",
  "4 / 7",
  "2 / 3",
];

const aspectRatioCache = new Map();

const getAspectRatioForCard = (id) => {
  if (!id) {
    return CARD_ASPECT_RATIO_PRESETS[0];
  }
  if (aspectRatioCache.has(id)) {
    return aspectRatioCache.get(id);
  }
  let acc = 0;
  for (let i = 0; i < id.length; i += 1) {
    acc = (acc * 31 + id.charCodeAt(i)) >>> 0;
  }
  const ratio =
    CARD_ASPECT_RATIO_PRESETS[
      acc % CARD_ASPECT_RATIO_PRESETS.length
    ];
  aspectRatioCache.set(id, ratio);
  return ratio;
};

const computeDailyPick = (items, dateKey) => {
  if (!items || items.length === 0) return null;
  const hash = dateKey
    .split("")
    .reduce((acc, ch) => ((acc * 31 + ch.charCodeAt(0)) >>> 0), 0);
  return items[hash % items.length];
};

/* ===== 画像カード ===== */
function Card({
  item,
  onExpand,
  onSave,
  isSaved = false,
  onLike,
  isLiked = false,
  likeCount = 0,
}) {
  const { id, title, source, image_url } = item;
  const [loaded, setLoaded] = useState(false);
  const [imgSrc, setImgSrc] = useState(image_url || PLACEHOLDER_IMG);
  const aspectRatio = useMemo(() => getAspectRatioForCard(id), [id]);

  return (
    <div
      onClick={onExpand}
      className="group relative overflow-hidden rounded-2xl bg-white shadow-sm transition-shadow duration-300 hover:shadow-xl cursor-pointer"
    >
      {/* 画像部分 */}
      <div className="relative w-full" style={{ aspectRatio }}>
        <img
          src={imgSrc}
          alt={title}
          className={`absolute inset-0 h-full w-full rounded-2xl object-cover transition-opacity duration-300 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
          loading="lazy"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => {
            if (imgSrc !== PLACEHOLDER_IMG) {
              setImgSrc(PLACEHOLDER_IMG);
            } else {
              setLoaded(true);
            }
          }}
        />

        {!loaded && (
          <div className="absolute inset-0 rounded-2xl bg-gray-100 animate-pulse" />
        )}

        {/* hover オーバーレイ（保存 / タイトル / 共有 / その他） */}
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between bg-gradient-to-t from-black/60 via-black/10 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          {/* 上部：いいね & 保存ボタン */}
          <div className="flex justify-between p-2">
            <button
              type="button"
              className={`pointer-events-auto flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold shadow-md transition ${
                isLiked ? "bg-white text-red-500" : "bg-white/80 text-gray-700 hover:bg-white"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onLike?.(item);
              }}
            >
              <span>{isLiked ? "♥" : "♡"}</span>
              <span>{likeCount}</span>
            </button>
            <button
              type="button"
              className={`pointer-events-auto rounded-full px-3 py-1 text-xs font-semibold shadow-md transition ${
                isSaved
                  ? "bg-gray-200 text-gray-700"
                  : "bg-red-500 text-white hover:bg-red-600"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onSave?.(item);
              }}
            >
              {isSaved ? "保存済" : "保存"}
            </button>
          </div>

          {/* 下部：タイトル＋共有 / その他 */}
          <div className="flex items-end justify-between gap-3 p-3">
            <div className="max-w-[70%] text-left text-white">
              <p className="text-sm font-semibold leading-snug line-clamp-2">
                {title}
              </p>
              <p className="text-xs text-white/80">{source}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-xs shadow hover:bg-white"
                onClick={(e) => {
                  e.stopPropagation();
                  window.alert("共有（ダミー）");
                }}
              >
                ↗
              </button>
              <button
                type="button"
                className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-xs shadow hover:bg-white"
                onClick={(e) => {
                  e.stopPropagation();
                  window.alert("その他（ダミー）");
                }}
              >
                ⋯
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 余白確保用のダミー div（hover 時のみテキスト表示） */}
      <div className="h-0" />
    </div>
  );
}

/* ===== ローディング用スケルトン ===== */
function CardSkeleton({ index }) {
  const heightPattern = [220, 260, 300, 340, 380, 420];
  const h = heightPattern[index % heightPattern.length];

  return (
    <div
      className="overflow-hidden rounded-2xl bg-gray-100 animate-pulse"
      style={{ minHeight: h }}
    />
  );
}

/* ===== メインコンポーネント ===== */
export default function Home({
  activeTab = "home",
  savedItems = [],
  onSaveItem = () => {},
  likedItems = [],
  onLikeItem = () => {},
  getLikeCountForItem = () => 0,
  customItems = [],
  onAddCustomItem = () => {},
  query = "",
  homeResetToken = 0,
  homeClearToken = 0,
  user = null,
}) {
  const [selected, setSelected] = useState(null); // 詳細ページ用
  const [selectionStack, setSelectionStack] = useState([]); // 戻る用スタック
  const [visible, setVisible] = useState(INITIAL_COUNT); // ホームの表示枚数
  const [loadingMore, setLoadingMore] = useState(false); // ホームの追加読み込み中

  const [detailVisible, setDetailVisible] = useState(DETAIL_INITIAL_COUNT); // 詳細右側の表示枚数
  const [showSavedToast, setShowSavedToast] = useState(false);
  const savedToastTimerRef = useRef(null);
  const [lastSavedTitle, setLastSavedTitle] = useState("");
  const prevSavedCountRef = useRef(savedItems.length);
  const matchesItem = (a, b) => {
    if (!a || !b) return false;
    if (a.id && b.id && a.id === b.id) return true;
    if (a.source_url && b.source_url && a.source_url === b.source_url) {
      return true;
    }
    return false;
  };
  const isItemSaved = (item) =>
    savedItems.some((saved) => matchesItem(saved, item));
  const isItemLiked = (item) =>
    likedItems.some((liked) => matchesItem(liked, item));
  const likeCountOf = (item) =>
    typeof getLikeCountForItem === "function" ? getLikeCountForItem(item) : 0;

  const [uploadForm, setUploadForm] = useState({
    title: "",
    source: "Custom",
    image_url: "",
    source_url: "",
    description: "",
    tags: "",
  });
  const [uploadMessage, setUploadMessage] = useState("");
  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // 無限スクロール用の番兵
  const sentinelRef = useRef(null); // ホーム用
  const detailSentinelRef = useRef(null); // 詳細ページ右カラム用

  // 全データを 1 つにまとめて正規化 + id 付与
  const allItems = useMemo(() => {
    const baseSources = [...safe(customItems), ...safe(cu)].map(normalize);

    const expanded = Array.from({ length: REPEAT_COUNT }).flatMap((_, r) =>
      baseSources.map((item, i) => {
        const baseId =
          item.id ||
          item.source_url ||
          item.image_url ||
          `${item.source || "item"}-${item.title || i}-${i}`;
        return {
          ...item,
          id: `${baseId}--${r}`,
        };
      })
    );

    return shuffleItems(expanded);
  }, [customItems, homeResetToken]);

  const canLoadMore = visible < allItems.length;
  const items = allItems.slice(0, visible);

  const filteredItems = useMemo(() => {
    // 検索クエリあり: 全データからヒットさせる
    if (!query) return items;

    const q = query.toLowerCase();
    return allItems.filter((it) => {
      const searchable = [
        it.title,
        it.titleEn,
        it.source,
        ...safe(it.tags),
      ]
        .join(" ")
        .toLowerCase();
      return searchable.includes(q);
    });
  }, [items, query, allItems]);

  const showEmptySearchMessage =
    query.trim() && filteredItems.length === 0;

  const handleUploadInputChange = (e) => {
    const { name, value } = e.target;
    setUploadForm((prev) => ({ ...prev, [name]: value }));
    if (uploadMessage) setUploadMessage("");
  };

  const handleUploadSubmit = (e) => {
    e.preventDefault();
    if (!user) {
      setUploadMessage("投稿にはログインが必要です。右上のボタンからログインしてください。");
      return;
    }
    if (!uploadForm.title.trim() || !uploadForm.image_url.trim()) {
      setUploadMessage("タイトルと画像URLは必須です");
      return;
    }
    const cleanedTags = uploadForm.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    onAddCustomItem({
      ...uploadForm,
      description: uploadForm.description.trim(),
      tags: cleanedTags,
      author: user.displayName || user.email || "Anonymous",
      authorUid: user.uid,
    });
    setUploadForm({
      title: "",
      source: "Custom",
      image_url: "",
      source_url: "",
      description: "",
      tags: "",
    });
    setUploadMessage("自分のコレクションに追加しました");
  };

  /* ===== ホーム画面：無限スクロール ===== */
  useEffect(() => {
    if (!sentinelRef.current) return;
    const el = sentinelRef.current;

    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (hit && canLoadMore && !loadingMore) {
          setLoadingMore(true);
          setTimeout(() => {
            setVisible((v) => Math.min(v + PAGE_SIZE, allItems.length));
            setLoadingMore(false);
          }, LOAD_DELAY_MS);
        }
      },
      {
        rootMargin: "600px 0px 600px 0px",
        threshold: 0,
      }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [canLoadMore, loadingMore, allItems.length]);

  /* ===== Masonry のカラム設定（ホーム） ===== */
  const breakpointColumnsObj = {
    default: 5,
    1280: 4,
    1024: 3,
    768: 2,
    480: 1,
  };

  /* ===== おすすめ（selected に基づく） ===== */
  const recommended = useMemo(() => {
    if (!selected) return [];

    // 1. まず「同じサイト」のアイテムを優先的に集める
    const sameSource = allItems.filter(
      (item) => item.source === selected.source && item.id !== selected.id
    );

    // 2. まだ数が少ない場合に備えて、他サイトのアイテムも後ろに足しておく
    const others = allItems.filter(
      (item) => item.source !== selected.source && item.id !== selected.id
    );

    const merged = [...sameSource, ...others];

    // 3. 念のため ID でユニーク化（重複防止）
    const uniqueById = Array.from(
      new Map(merged.map((it) => [it.id, it])).values()
    );

    return uniqueById;
  }, [selected, allItems]);

  // 詳細ページ右側で今表示している分
  const recommendedSlice = useMemo(
    () => recommended.slice(0, detailVisible),
    [recommended, detailVisible]
  );

  const canLoadMoreRecommended = detailVisible < recommended.length;

  /* ===== selected が変わったら右カラムをリセット ===== */
  useEffect(() => {
    if (!selected) return;
    setDetailVisible(DETAIL_INITIAL_COUNT);
  }, [selected]);

  /* ===== 詳細ページ右側：無限スクロール ===== */
  useEffect(() => {
    if (!selected) return; // 詳細ページでのみ動作
    if (!detailSentinelRef.current) return;

    const el = detailSentinelRef.current;

    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (hit && canLoadMoreRecommended) {
          setDetailVisible((v) =>
            Math.min(v + DETAIL_PAGE_SIZE, recommended.length)
          );
        }
      },
      {
        rootMargin: "400px 0px 400px 0px",
        threshold: 0,
      }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [selected, canLoadMoreRecommended, recommended.length]);

  useEffect(() => {
    if (activeTab !== "home" && activeTab !== "explore") {
      clearSelection();
    }
  }, [activeTab]);

  // 選択カードを開くときは一度スクロールをトップに戻してから詳細を表示
  // 親からのホームリセット指示で詳細を閉じてトップに戻す
  useEffect(() => {
    clearSelection();
    setVisible(INITIAL_COUNT);
    setLoadingMore(false);
    window.scrollTo({ top: 0 });
  }, [homeResetToken]);

  const visibleBeforeSelectionRef = useRef(INITIAL_COUNT);

  useEffect(() => {
    if (!homeClearToken) return;
    clearSelection();
    setVisible((prev) => {
      const target =
        visibleBeforeSelectionRef.current +
        PAGE_SIZE * 4; // 一度に4バッチ先まで補填
      return Math.min(allItems.length, Math.max(prev, target));
    });
  }, [homeClearToken, allItems.length]);

  const triggerSavedToast = (title) => {
    setLastSavedTitle(title || "アイデア");
    if (savedToastTimerRef.current) {
      clearTimeout(savedToastTimerRef.current);
    }
    setShowSavedToast(true);
    savedToastTimerRef.current = setTimeout(() => {
      setShowSavedToast(false);
    }, 1800);
  };

  const handleToggleSave = (item) => {
    const alreadySaved = isItemSaved(item);
    onSaveItem(item); // 親側でトグル
    if (!alreadySaved) {
      triggerSavedToast(item?.title);
    } else {
      setShowSavedToast(false);
    }
  };

  useEffect(() => {
    return () => {
      if (savedToastTimerRef.current) {
        clearTimeout(savedToastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (savedItems.length > prevSavedCountRef.current) {
      const lastItem = savedItems[savedItems.length - 1];
      triggerSavedToast(lastItem?.title);
    }
    prevSavedCountRef.current = savedItems.length;
  }, [savedItems]);

  const handleToggleLike = (item) => {
    onLikeItem(item); // 親側でトグル
  };

  const openItem = (item) => {
    visibleBeforeSelectionRef.current = visible;
    const currentScroll = window.scrollY;
    setSelectionStack((prev) => [...prev, { item: selected, scrollY: currentScroll }]);
    setSelected(item);
    window.scrollTo({ top: 0 });
  };

  const handleBack = () => {
    if (selectionStack.length === 0) {
      setSelected(null);
      return;
    }
    const last = selectionStack[selectionStack.length - 1];
    setSelectionStack((prev) => prev.slice(0, -1));
    setSelected(last?.item || null);
    if (typeof last?.scrollY === "number") {
      window.scrollTo({ top: last.scrollY });
    }
  };

  const clearSelection = () => {
    setSelected(null);
    setSelectionStack([]);
  };

  const prevQueryRef = useRef(query);
  useEffect(() => {
    if (
      prevQueryRef.current !== query &&
      selected &&
      query.trim()
    ) {
      clearSelection();
      window.scrollTo({ top: 0 });
    }
    prevQueryRef.current = query;
  }, [query, selected]);

  /* ===== selected があるときは「詳細ビュー」 ===== */
  if (selected) {
    // 詳細ビュー全体で「5列」をイメージして、
    // そのうち左3列ぶんはメインカード + その下の3列 Masonry、
    // 右2列ぶんは横の Masonry に振り分ける。

    const isSelectedSaved = isItemSaved(selected);
    const LEFT_COLS = 3;
    const RIGHT_COLS = 2;

    const leftStream = [];
    const rightStream = [];
    recommendedSlice.forEach((item, idx) => {
      const pos = idx % (LEFT_COLS + RIGHT_COLS);
      if (pos < LEFT_COLS) {
        leftStream.push(item);
      } else {
        rightStream.push(item);
      }
    });

    const leftBreakpointCols = {
      default: 3,
      1280: 3,
      1024: 3,
      768: 2,
      640: 1,
    };
    const rightBreakpointCols = {
      default: 2,
      1280: 2,
      1024: 2,
      768: 1,
      640: 1,
    };

    return (
      <>
        <div className="mx-auto max-w-7xl px-4 py-8">
          {/* 戻るボタン */}
          <div className="mb-6 flex items-center justify-between">
            <button
              type="button"
              className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900"
              onClick={handleBack}
            >
              <span>←</span>
              <span>戻る</span>
            </button>
          </div>

          {/* 上段：左にメインカード＋左3列のストリーム / 右に2列のストリーム */}
          <div className="grid gap-8 lg:grid-cols-5">
            {/* 左：選択中のメイン画像 + 左3列 Masonry */}
            <div className="lg:col-span-3">
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="relative">
                  <img
                    src={selected.image_url || PLACEHOLDER_IMG_LARGE}
                    alt={selected.title}
                    className="max-h-[70vh] w-full rounded-2xl bg-gray-100 object-contain"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = PLACEHOLDER_IMG_LARGE;
                    }}
                  />

                  {/* 上部オーバーレイアイコン */}
                  <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
                    <div className="flex justify-between p-3">
                      <div className="flex gap-2">
                      <button
                        type="button"
                        className={`pointer-events-auto flex items-center gap-1 rounded-full px-3 py-2 text-sm shadow transition ${
                          isItemLiked(selected)
                            ? "bg-white text-red-500"
                            : "bg-white/90 text-gray-700 hover:bg-white"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleLike(selected);
                        }}
                      >
                        <span>{isItemLiked(selected) ? "♥" : "♡"}</span>
                        <span className="text-xs font-semibold">{likeCountOf(selected)}</span>
                      </button>
                        <button
                          type="button"
                          className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-sm shadow"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.alert("共有（ダミー）");
                          }}
                        >
                          ↗
                        </button>
                        <button
                          type="button"
                          className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-sm shadow"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.alert("その他（ダミー）");
                          }}
                        >
                          ⋯
                        </button>
                      </div>
                      <button
                        type="button"
                        className={`pointer-events-auto rounded-full px-4 py-2 text-xs font-semibold shadow transition ${
                          isSelectedSaved
                            ? "bg-gray-200 text-gray-700"
                            : "bg-red-500 text-white hover:bg-red-600"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSave(selected);
                        }}
                      >
                        {isSelectedSaved ? "保存済" : "保存"}
                      </button>
                    </div>
                  </div>
                </div>

                <h3 className="mt-6 break-words text-2xl font-semibold">
                  {selected.title}
                </h3>

                <div className="mt-3 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold">
                    {(selected.author || selected.source || "U")[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {selected.author || "投稿者"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {selected.source || "Unknown"}
                    </p>
                  </div>
                </div>

                {selected.source_url && (
                  <a
                    href={selected.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-2 rounded-full border border-gray-300 px-6 py-3 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50"
                  >
                    <span>🔗</span>
                    <span>元ページを開く</span>
                  </a>
                )}

                {/* コメント入力欄（ダミー） */}
                <div className="mt-6">
                  <p className="mb-2 text-sm font-medium text-gray-800">
                    コメントを追加
                  </p>
                  <textarea
                    rows={3}
                    className="w-full rounded-2xl border border-gray-200 p-3 text-sm outline-none focus:border-gray-400 focus:ring-0"
                    placeholder="素敵なアイデアについてコメントしてみましょう（ダミー）"
                  />
                </div>
              </div>

              {/* 左3列のおすすめストリーム */}
              {leftStream.length > 0 && (
                <div className="mt-8">
                  <Masonry
                    breakpointCols={leftBreakpointCols}
                    className="my-masonry-grid"
                    columnClassName="my-masonry-grid_column"
                  >
                    {leftStream.map((item) => (
                      <div key={item.id} className="mb-4">
                        <Card
                          item={item}
                          onExpand={() => openItem(item)}
                        onSave={handleToggleSave}
                        onLike={handleToggleLike}
                        isLiked={isItemLiked(item)}
                        isSaved={isItemSaved(item)}
                        likeCount={likeCountOf(item)}
                      />
                    </div>
                  ))}
                  </Masonry>
                </div>
              )}
            </div>

            {/* 右：2列のおすすめストリーム */}
            <div className="lg:col-span-2">
              {rightStream.length > 0 && (
                <Masonry
                  breakpointCols={rightBreakpointCols}
                  className="my-masonry-grid"
                  columnClassName="my-masonry-grid_column"
                >
                  {rightStream.map((item) => (
                    <div key={item.id} className="mb-4">
                      <Card
                        item={item}
                        onExpand={() => openItem(item)}
                        onSave={handleToggleSave}
                        onLike={handleToggleLike}
                        isLiked={isItemLiked(item)}
                        isSaved={isItemSaved(item)}
                        likeCount={likeCountOf(item)}
                      />
                    </div>
                  ))}
                </Masonry>
              )}
            </div>
          </div>

          {/* 詳細ビュー用の無限スクロール番兵と「もっと見る」ボタン */}
          {canLoadMoreRecommended && <div ref={detailSentinelRef} className="h-8" />}
        </div>
      </>
    );
  }

  if (activeTab === "saved") {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold">保存したアイデア</h2>
          <p className="text-sm text-gray-500">
            気に入ったカードをあとから見返せるようにまとめています。
          </p>
        </div>

        {savedItems.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center text-sm text-gray-500 shadow-sm">
            まだ保存されたカードはありません。「保存」ボタンから集めてみましょう。
          </div>
        ) : (
          <Masonry
            breakpointCols={{
              default: 4,
              1280: 3,
              1024: 3,
              768: 2,
              640: 1,
            }}
            className="my-masonry-grid"
            columnClassName="my-masonry-grid_column"
          >
            {savedItems.map((item) => (
              <div key={item.id} className="mb-4">
                <Card
                  item={item}
                  onExpand={() => openItem(item)}
                  onSave={handleToggleSave}
                  onLike={handleToggleLike}
                  isLiked={isItemLiked(item)}
                  isSaved={isItemSaved(item)}
                  likeCount={likeCountOf(item)}
                />
              </div>
            ))}
          </Masonry>
        )}
      </div>
    );
  }

  if (activeTab === "upload") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold">お気に入りのモデルを投稿</h2>
          <p className="mt-2 text-sm text-gray-500">
            気になる3Dモデルの情報を貼り付けて、enso内でいつでも見られるようにしましょう。
          </p>

          <form onSubmit={handleUploadSubmit} className="mt-8 space-y-5">
            <div>
              <label className="text-sm font-semibold text-gray-700">
                タイトル
              </label>
              <input
                type="text"
                name="title"
                value={uploadForm.title}
                onChange={handleUploadInputChange}
                className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-400"
                placeholder="例：3DBenchy"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700">
                画像URL
              </label>
              <input
                type="url"
                name="image_url"
                value={uploadForm.image_url}
                onChange={handleUploadInputChange}
                className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-400"
                placeholder="https://example.com/image.jpg"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700">
                説明文（非表示）
              </label>
              <textarea
                name="description"
                value={uploadForm.description}
                onChange={handleUploadInputChange}
                className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-400"
                placeholder="このアイデアの補足情報を書いてください（公開されません）"
                rows={3}
              />
              <p className="mt-1 text-xs text-gray-500">
                説明文とタグは内部で保持しますがホーム画面には表示されません。
              </p>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700">
                タグ（カンマ区切り、非表示）
              </label>
              <input
                type="text"
                name="tags"
                value={uploadForm.tags}
                onChange={handleUploadInputChange}
                className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-400"
                placeholder="例：miniature,drone,red"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700">
                元リンク
              </label>
              <input
                type="url"
                name="source_url"
                value={uploadForm.source_url}
                onChange={handleUploadInputChange}
                className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-400"
                placeholder="https://www.thingiverse.com/..."
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700">
                ソース
              </label>
              <select
                name="source"
                value={uploadForm.source}
                onChange={handleUploadInputChange}
                className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-400"
              >
                <option value="Custom">Custom</option>
                <option value="Cults3D">Cults3D</option>
              </select>
            </div>
            <button
              type="submit"
              className="w-full rounded-full bg-gray-900 py-3 text-sm font-semibold text-white shadow hover:bg-gray-800"
            >
              投稿する
            </button>
          </form>
          {uploadMessage && (
            <p className="mt-4 text-center text-sm text-emerald-600">
              {uploadMessage}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (activeTab === "explore") {
    const hasQuery = Boolean(query.trim());

    if (hasQuery) {
      return (
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase text-gray-400">
                Explore Search
              </p>
              <h2 className="text-3xl font-semibold">
                「{query}」の検索結果
              </h2>
              <p className="text-sm text-gray-500">
                {filteredItems.length} 件ヒットしました
              </p>
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="rounded-2xl bg-white p-10 text-center text-sm text-gray-500 shadow-sm">
              一致するアイテムが見つかりませんでした。キーワードを変えてみてください。
            </div>
          ) : (
            <Masonry
              breakpointCols={breakpointColumnsObj}
              className="my-masonry-grid"
              columnClassName="my-masonry-grid_column"
            >
              {filteredItems.map((it) => (
              <div key={it.id} className="mb-4">
                <Card
                  item={it}
                  onExpand={() => openItem(it)}
                  onSave={handleToggleSave}
                  onLike={handleToggleLike}
                  isLiked={isItemLiked(it)}
                  isSaved={isItemSaved(it)}
                  likeCount={likeCountOf(it)}
                />
              </div>
            ))}
            </Masonry>
          )}
        </div>
      );
    }

    const trendingItems = filteredItems.slice(0, 8);
    const pick = computeDailyPick(filteredItems, todayKey);
    const rising = filteredItems.slice(1, 4);
    const fresh = filteredItems.slice(4, 7);

    return (
      <div className="mx-auto max-w-6xl px-4 py-10 space-y-12">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase text-gray-400">
            Explore
          </p>
            <h1 className="text-3xl font-semibold text-gray-900">
              ensoで新しいモデルと出会おう
            </h1>
          <p className="text-sm text-gray-500">
            今日のピック・人気上昇中・新着からすぐにチェック。
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-3xl border border-gray-100 bg-white/80 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-gray-400">
                  今日のピック
                </p>
                <p className="text-xl font-semibold text-gray-900">いま見るべき1枚</p>
              </div>
              <button
                type="button"
                className="rounded-full border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                もっと見る
              </button>
            </div>
            {pick ? (
              <button
                type="button"
                onClick={() => openItem(pick)}
                className="mt-4 flex w-full items-center gap-5 rounded-3xl bg-gradient-to-br from-gray-50 to-white p-6 text-left transition hover:-translate-y-0.5 hover:shadow-2xl"
              >
                <div className="h-40 w-40 overflow-hidden rounded-3xl bg-gray-100 lg:h-44 lg:w-44">
                  <img
                    src={pick.image_url || PLACEHOLDER_IMG}
                    alt={pick.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="flex-1">
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-4 py-1 text-xs font-semibold text-gray-600">
                    注目
                  </span>
                  <p className="mt-2 text-2xl font-semibold text-gray-900 leading-snug line-clamp-2">
                    {pick.title}
                  </p>
                  <p className="text-xs text-gray-500">{pick.source}</p>
                </div>
              </button>
            ) : (
              <div className="mt-6 h-32 rounded-2xl bg-gray-50" />
            )}
          </div>

          <div className="space-y-4 rounded-3xl border border-gray-100 bg-white/80 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-gray-400">
                  人気上昇中
                </p>
                <p className="text-sm text-gray-600">保存が増えているアイデア</p>
              </div>
            </div>
            <div className="space-y-3">
              {rising.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openItem(item)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-gray-50 px-3 py-2 text-left transition hover:-translate-y-0.5 hover:shadow-sm"
                >
                  <div className="h-14 w-14 overflow-hidden rounded-xl bg-white">
                    <img
                      src={item.image_url || PLACEHOLDER_IMG}
                      alt={item.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] font-semibold text-gray-900 line-clamp-2">
                      {item.title}
                    </p>
                    <p className="text-[11px] text-gray-500">{item.source}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">カテゴリから探す</h2>
              <p className="text-sm text-gray-500">
                人気カテゴリは大きく表示。タグで絞り込めます。
              </p>
            </div>
            <button
              type="button"
              className="rounded-full border border-gray-300 px-4 py-1.5 text-sm text-gray-600 transition hover:bg-gray-50"
            >
              もっと見る
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {EXPLORE_CATEGORIES.slice(0, 3).map((category) => (
              <button
                type="button"
                key={category.id}
                className={`flex h-32 flex-col justify-between rounded-3xl border border-gray-100 bg-gradient-to-br ${category.accent} p-4 text-left text-gray-800 shadow-sm transition hover:-translate-y-0.5`}
              >
                <span className="text-xs uppercase text-gray-500">Category</span>
                <span className="text-2xl font-semibold">{category.label}</span>
                <span className="text-xs text-gray-600">おすすめを表示</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 rounded-3xl border border-gray-100 bg-white/70 p-4 shadow-sm">
            {TAG_FILTERS.map((tag) => (
              <button
                key={tag}
                type="button"
                className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:-translate-y-0.5 hover:border-gray-300 hover:bg-gray-50"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {trendingItems.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase text-gray-400">
                  Trending
                </p>
                <h2 className="text-xl font-semibold">注目のアイデア</h2>
              </div>
              <button
                type="button"
                className="rounded-full border border-gray-900 px-4 py-1.5 text-sm font-semibold text-gray-900 shadow hover:bg-gray-900 hover:text-white"
                onClick={() =>
                  window.scrollTo({ top: 0, behavior: "smooth" })
                }
              >
                さらに表示
              </button>
            </div>
            <Masonry
              breakpointCols={{
                default: 4,
                1280: 3,
                1024: 3,
                768: 2,
                640: 1,
              }}
              className="my-masonry-grid"
              columnClassName="my-masonry-grid_column"
            >
              {trendingItems.map((item) => (
                <div key={item.id} className="mb-4">
                  <Card
                    item={item}
                    onExpand={() => openItem(item)}
                    onSave={handleToggleSave}
                    onLike={handleToggleLike}
                    isLiked={isItemLiked(item)}
                    isSaved={isItemSaved(item)}
                    likeCount={likeCountOf(item)}
                  />
                </div>
              ))}
            </Masonry>
          </div>
        )}
      </div>
    );
  }

  /* ===== 通常のホーム（一覧）表示 ===== */
  if (showEmptySearchMessage) {
    return (
      <>
        <div className="mx-auto max-w-[1400px] px-3 sm:px-4">
          <div className="py-4">
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white/70 px-6 py-8 text-center text-sm text-gray-500 shadow-sm">
              「{query}」に一致するアイテムは見つかりませんでした。キーワードを変えて再検索してください。
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-[1400px] px-3 sm:px-4">
        <div className="py-4">
          <Masonry
            breakpointCols={breakpointColumnsObj}
            className="my-masonry-grid"
            columnClassName="my-masonry-grid_column"
          >
            {filteredItems.map((it) => (
              <div key={it.id} className="mb-4">
                <Card
                  item={it}
                  onExpand={() => openItem(it)}
                  onSave={handleToggleSave}
                  onLike={handleToggleLike}
                  isLiked={isItemLiked(it)}
                  isSaved={isItemSaved(it)}
                  likeCount={likeCountOf(it)}
                />
              </div>
            ))}

            {/* 追加読み込み中のスケルトン */}
            {loadingMore &&
              Array.from({
                length: Math.min(PAGE_SIZE, allItems.length - visible),
              }).map((_, i) => (
                <div key={`sk-${i}`} className="mb-4">
                  <CardSkeleton index={visible + i} />
                </div>
              ))}
          </Masonry>

          {/* 無限スクロール番兵（ホーム） */}
          {canLoadMore && <div ref={sentinelRef} className="h-10" />}

          {filteredItems.length === 0 && query.trim() && (
            <div className="mt-8 rounded-2xl border border-dashed border-gray-300 bg-white/70 px-6 py-8 text-center text-sm text-gray-500 shadow-sm">
              現在のキーワードに一致するアイテムは見つかりませんでした。
              <br />
              キーワードを変えて再検索してください。
            </div>
          )}
        </div>
      </div>
      {/* 保存トースト */}
      <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-end px-4 pb-6 sm:px-6">
        <div
          className={`transition-all duration-300 ${
            showSavedToast ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <div className="flex items-center gap-3 rounded-2xl bg-gray-900/95 px-5 py-3 text-sm font-semibold text-white shadow-2xl ring-1 ring-white/10 backdrop-blur">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg">
              ✓
            </span>
            <div className="leading-tight">
              <p className="text-[11px] uppercase tracking-[0.15em] text-gray-300">
                保存完了
              </p>
              <p className="text-sm">{lastSavedTitle}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
