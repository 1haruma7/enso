// src/Home.jsx
import {
  ArrowTopRightOnSquareIcon,
  BookmarkIcon,
  HeartIcon as HeartOutlineIcon,
} from "@heroicons/react/24/outline";
import { BookmarkIcon as BookmarkSolidIcon, HeartIcon as HeartSolidIcon } from "@heroicons/react/24/solid";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Masonry from "react-masonry-css";
import { addDoc, collection, getDocs, serverTimestamp } from "firebase/firestore";
import { getDb } from "./firebaseClient.js";
import {
  searchMeilisearch,
  isMeilisearchConfigured,
} from "./meilisearchClient.js";
import { parseTags } from "./tagUtils.js";

const previewDataModules = import.meta.glob(
  "./data/cults_creations_preview.json",
  {
    eager: true,
  }
);
const fullDataModules = import.meta.glob("./data/cults_creations.json");

const previewData =
  previewDataModules["./data/cults_creations_preview.json"]?.default ??
  [];

let bundledFullDataPromise = null;
const loadBundledFullData = async () => {
  if (bundledFullDataPromise) {
    return bundledFullDataPromise;
  }
  const importer = fullDataModules["./data/cults_creations.json"];
  if (!importer) {
    bundledFullDataPromise = Promise.resolve(null);
    return bundledFullDataPromise;
  }
  bundledFullDataPromise = importer()
    .then((module) => module?.default ?? null)
    .catch((error) => {
      console.error("Failed to load bundled cults dataset:", error);
      return null;
    });
  return bundledFullDataPromise;
};

/* ===== 調整ポイント ===== */
const REPEAT_COUNT = 1; // 元データを何倍に水増しするか
const PREFETCH_BATCH_SIZE = 50;
const READY_BATCH_THRESHOLD = 24; // 事前読み込みは少数でよい
const DISPLAY_BATCH_SIZE = 24; // 24枚ずつテンポよく表示
const MAX_READY_QUEUE = DISPLAY_BATCH_SIZE * 3; // 非スクロール時に先読みする最大値
const AUTO_RELEASE_LIMIT = 3; // 非スクロール時に見せる連続バッチ数
const RELEASE_DELAY_MS = 1200;
const IDLE_PREFETCH_DELAY_MS = 1000;

const DETAIL_INITIAL_COUNT = 70; // 詳細ページ右側の初期表示枚数
const DETAIL_PAGE_SIZE = 60; // 詳細ページ右側の追加読み込み枚数
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

const getItemKey = (item) =>
  item?.id || item?.source_url || item?.image_url || null;

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
    tags: Array.from(new Set([...tags, ...parseTags(p?.tags)])),
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

const getLikeDocIdForItem = (item) => {
  const key = item?.source_url || item?.image_url || item?.id;
  return key ? encodeURIComponent(key) : null;
};

const CARD_ASPECT_RATIO_PRESETS = [
  "3 / 4",
  "3 / 5",
  "4 / 6",
  "4 / 7",
  "2 / 3",
];

const SEARCH_RESULTS_BATCH_SIZE = 15;
const aspectRatioCache = new Map();

const UPLOAD_SOURCES = [
  "Maker World",
  "Thingiverse",
  "Printables",
  "Thangs",
  "Cults3D",
  "MyMiniFactory",
];
const UPLOAD_SOURCE_CUSTOM = "__custom__";
const DEFAULT_CUSTOM_SOURCE_LABEL = "カスタム";

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
  onLike,
  isSaved = false,
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
          <div className="flex items-center justify-between gap-2 p-2">
            <button
              type="button"
              className={`pointer-events-auto flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold shadow transition ${
                isLiked
                  ? "bg-white text-red-500"
                  : "bg-white/90 text-gray-700 hover:bg-white"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onLike?.(item);
              }}
              aria-label="いいね"
            >
              {isLiked ? (
                <HeartSolidIcon className="h-4 w-4" />
              ) : (
                <HeartOutlineIcon className="h-4 w-4" />
              )}
              <span className="text-[11px]">
                {typeof likeCount === "number" ? likeCount : 0}
              </span>
            </button>
            <button
              type="button"
              className={`pointer-events-auto rounded-full px-3 py-1 text-xs font-semibold shadow-md transition ${
                isSaved
                  ? "bg-gray-200 text-gray-700"
                  : "bg-white/90 text-gray-700 hover:bg-white"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onSave?.(item);
              }}
              aria-label="保存"
            >
              {isSaved ? (
                <BookmarkSolidIcon className="h-4 w-4" />
              ) : (
                <BookmarkIcon className="h-4 w-4" />
              )}
            </button>
          </div>

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
  const aspectRatio =
    CARD_ASPECT_RATIO_PRESETS[index % CARD_ASPECT_RATIO_PRESETS.length];

  return (
    <div
      className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
      style={{ contain: "content" }}
    >
      <div className="relative w-full bg-gray-100" style={{ aspectRatio }}>
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-gray-100 via-gray-200 to-gray-100" />
        <div className="absolute left-3 top-3 h-8 w-16 rounded-full bg-white/80 shadow-sm" />
        <div className="absolute right-3 top-3 h-8 w-8 rounded-full bg-white/80 shadow-sm" />
      </div>
      <div className="space-y-2 p-4">
        <div className="h-3 w-3/4 rounded bg-gray-100" />
        <div className="h-3 w-1/2 rounded bg-gray-100" />
      </div>
    </div>
  );
}

/* ===== メインコンポーネント ===== */
export default function Home({
  activeTab = "home",
  savedItems = [],
  savedItemsLoaded = false,
  onSaveItem = () => {},
  likedDocIds = new Set(),
  onLikeItem = () => {},
  getLikeCountForItem = () => 0,
  customItems = [],
  onAddCustomItem = () => {},
  query = "",
  homeClearToken = 0,
  user = null,
}) {
  const [fullCultsData, setFullCultsData] = useState(null);

  useEffect(() => {
    let active = true;

    const loadFallback = async () => {
      if (!active) return;
      const bundled = await loadBundledFullData();
      if (bundled) {
        setFullCultsData(bundled);
        return;
      }
      setFullCultsData([]);
    };

    const fetchFromFirestore = async () => {
      const db = getDb();
      if (!db) {
        console.info("Firebase config missing; falling back to local cults data.");
        await loadFallback();
        return;
      }
      try {
        const snapshot = await getDocs(collection(db, "cults_creations"));
        if (!active) return;
        if (!snapshot.size) {
          console.info(
            "Firestore cults_creations collection is empty; using the bundled dataset."
          );
          await loadFallback();
          return;
        }
        const docs = snapshot.docs.map((docSnap) => docSnap.data());
        setFullCultsData(docs);
      } catch (error) {
        console.error("Failed to load cults data from Firestore:", error);
        if (active) {
          await loadFallback();
        }
      }
    };

    fetchFromFirestore();
    return () => {
      active = false;
    };
  }, []);

  const normalizedPreviewItems = useMemo(() => {
    return previewData.map((item, index) => {
      const normalized = normalize(item);
      const fallbackId =
        normalized.id ||
        normalized.source_url ||
        normalized.image_url ||
        `preview-${index}`;
      return {
        ...normalized,
        id: fallbackId,
      };
    });
  }, []);

  const [selected, setSelected] = useState(null); // 詳細ページ用
  const [selectionStack, setSelectionStack] = useState([]); // 戻る用スタック
  const [displayItems, setDisplayItems] = useState(() => normalizedPreviewItems);
  const displayLenRef = useRef(0);
  const scrollLoadStartLenRef = useRef(0);
  const [readyQueueState, setReadyQueueState] = useState([]);
  const readyQueueRef = useRef([]);
  const [isInitialLoading, setIsInitialLoading] = useState(
    normalizedPreviewItems.length === 0
  );
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showScrollLoading, setShowScrollLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const refreshingRef = useRef(false);

  // keep ref in sync for callbacks without waiting for effects
  displayLenRef.current = displayItems.length;
  const [searchVisibleCount, setSearchVisibleCount] = useState(
    SEARCH_RESULTS_BATCH_SIZE
  );
  const seenItemIdsRef = useRef(new Set());
  const prefetchCursorRef = useRef(0);
  const prefetchLockRef = useRef(false);
  const dataSourceKey = fullCultsData ? "full" : "preview";
  const prevDataSourceRef = useRef("");
  const prevItemsRef = useRef(null);
  const [meiliSearchHits, setMeiliSearchHits] = useState(null);
  const [meiliSearchLoading, setMeiliSearchLoading] = useState(false);
  const [meiliSearchError, setMeiliSearchError] = useState("");
  const [meiliSearchExecuted, setMeiliSearchExecuted] = useState(false);
  const meiliConfigured = isMeilisearchConfigured();
  const releaseAllowedRef = useRef(true);
  const releaseDelayTimerRef = useRef(null);
  const releaseReadyBatchRef = useRef(null);
  const autoReleaseActiveRef = useRef(false);
  const autoReleasePausedRef = useRef(false);
  const releaseLoopCountRef = useRef(0);
  const scrollIdleTimerRef = useRef(null);
  const isUserScrollingRef = useRef(false);
  useEffect(() => {
    const seen = seenItemIdsRef.current;
    normalizedPreviewItems.forEach((item) => {
      const key = getItemKey(item);
      if (key) {
        seen.add(key);
      }
    });
  }, [normalizedPreviewItems]);

  const [detailVisible, setDetailVisible] = useState(DETAIL_INITIAL_COUNT); // 詳細右側の表示枚数
  const [showSavedToast, setShowSavedToast] = useState(false);
  const savedToastTimerRef = useRef(null);
  const [lastSavedTitle, setLastSavedTitle] = useState("");
  const prevSavedCountRef = useRef(savedItems.length);
  const savedItemsBaselineReadyRef = useRef(false);
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
  const isItemLiked = (item) => {
    const docId = getLikeDocIdForItem(item);
    return docId ? likedDocIds.has(docId) : false;
  };

  const [uploadForm, setUploadForm] = useState({
    title: "",
    sourceChoice: UPLOAD_SOURCE_CUSTOM,
    sourceCustom: DEFAULT_CUSTOM_SOURCE_LABEL,
    image_url: "",
    source_url: "",
    description: "",
    tags: [],
  });
  const [uploadTagText, setUploadTagText] = useState("");
  const uploadTagComposingRef = useRef(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);
  // 無限スクロール用の番兵
  const sentinelRef = useRef(null); // ホーム用
  const detailSentinelRef = useRef(null); // 詳細ページ右カラム用
  const scrollBeforeSelectionRef = useRef(0); // ホームのカードを開く直前のスクロール位置
  const detailOpenRef = useRef(false);
  const returnCardIdRef = useRef(null);
  const pendingRestoreRef = useRef(null);

  const escapeCssIdentifier = (value) => {
    if (!value) return "";
    if (typeof window !== "undefined" && window.CSS && window.CSS.escape) {
      return window.CSS.escape(value);
    }
    return value.replace(/["\\]/g, "\\$&");
  };

  const scrollToCardOrPosition = ({ cardId, scrollY }) => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return false;
    }
    if (cardId) {
      const escaped = escapeCssIdentifier(cardId);
      const el = document.querySelector(`[data-card-id="${escaped}"]`);
      if (el) {
        el.scrollIntoView({ block: "center" });
        return true;
      }
    }
    if (typeof scrollY === "number") {
      window.scrollTo({ top: scrollY });
      return true;
    }
    return false;
  };

  // 全データを 1 つにまとめて正規化 + id 付与
  const allItems = useMemo(() => {
    const sourceData = fullCultsData ?? previewData;
    const baseSources = [...safe(customItems), ...safe(sourceData)].map(normalize);

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
  }, [customItems, fullCultsData]);

  useEffect(() => {
    if (!query.trim()) {
      setMeiliSearchHits(null);
      setMeiliSearchError("");
      setMeiliSearchExecuted(false);
      setMeiliSearchLoading(false);
      return;
    }
    if (!meiliConfigured) {
      setMeiliSearchHits(null);
      setMeiliSearchError("");
      setMeiliSearchExecuted(false);
      setMeiliSearchLoading(false);
      return;
    }

    let cancelled = false;
    setMeiliSearchLoading(true);
    setMeiliSearchError("");
    searchMeilisearch(query, { limit: 200 })
      .then(({ hits }) => {
        if (cancelled) return;
        setMeiliSearchHits(hits.map((hit) => normalize(hit)));
        setMeiliSearchExecuted(true);
      })
      .catch((error) => {
        if (cancelled) return;
        setMeiliSearchError(
          error?.message || "Meilisearch への接続に失敗しました"
        );
        setMeiliSearchHits(null);
        setMeiliSearchExecuted(true);
      })
      .finally(() => {
        if (!cancelled) {
          setMeiliSearchLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [query, meiliConfigured]);

  useEffect(() => {
    setSearchVisibleCount(SEARCH_RESULTS_BATCH_SIZE);
  }, [query]);

  // 準備済みカードのキューを state と ref で同期する
  const updateReadyQueue = useCallback((updater) => {
    setReadyQueueState((prev) => {
      const next =
        typeof updater === "function" ? updater(prev) : updater;
      readyQueueRef.current = next;
      return next;
    });
  }, []);

  // 読み込み成功したカードを準備キューに追加する
  const enqueueReadyItem = useCallback(
    (item) => {
      updateReadyQueue((prev) => [...prev, item]);
    },
    [updateReadyQueue]
  );

  const scheduleReleaseCooldown = useCallback(() => {
    const handler = () => {
      releaseAllowedRef.current = true;
      releaseDelayTimerRef.current = null;
      if (
        autoReleaseActiveRef.current &&
        releaseLoopCountRef.current < AUTO_RELEASE_LIMIT &&
        readyQueueRef.current.length >= DISPLAY_BATCH_SIZE
      ) {
        const handler = releaseReadyBatchRef.current ?? releaseReadyBatch;
        handler?.();
        return;
      }
      autoReleaseActiveRef.current = false;
      releaseLoopCountRef.current = 0;
      autoReleasePausedRef.current = true;
    };
    if (releaseDelayTimerRef.current && typeof window !== "undefined") {
      window.clearTimeout(releaseDelayTimerRef.current);
    }
    if (typeof window !== "undefined") {
      releaseDelayTimerRef.current = window.setTimeout(handler, RELEASE_DELAY_MS);
    } else {
      handler();
    }
  }, []);

  const releaseReadyBatch = useCallback(() => {
    if (!releaseAllowedRef.current) {
      return false;
    }
    const queue = readyQueueRef.current;
    if (!queue.length) {
      return false;
    }
    if (autoReleaseActiveRef.current && releaseLoopCountRef.current >= AUTO_RELEASE_LIMIT) {
      autoReleaseActiveRef.current = false;
      releaseLoopCountRef.current = 0;
      autoReleasePausedRef.current = true;
      return false;
    }
    const requiredCount = hasMore ? DISPLAY_BATCH_SIZE : 1;
    if (queue.length < requiredCount) {
      if (autoReleaseActiveRef.current) {
        autoReleaseActiveRef.current = false;
        releaseLoopCountRef.current = 0;
        autoReleasePausedRef.current = true;
      }
      return false;
    }
    const takeCount = Math.min(DISPLAY_BATCH_SIZE, queue.length);
    const batch = queue.slice(0, takeCount);
    updateReadyQueue(queue.slice(takeCount));
    setDisplayItems((prev) => {
      if (refreshingRef.current) {
        refreshingRef.current = false;
        if (typeof window !== "undefined") {
          window.scrollTo({ top: 0 });
        }
        return batch;
      }
      return [...prev, ...batch];
    });
    if (isInitialLoading) {
      setIsInitialLoading(false);
    }
    if (autoReleaseActiveRef.current) {
      releaseLoopCountRef.current += 1;
    }
    releaseAllowedRef.current = false;
    scheduleReleaseCooldown();
    return true;
  }, [
    hasMore,
    isInitialLoading,
    scheduleReleaseCooldown,
    updateReadyQueue,
  ]);

  useEffect(() => {
    releaseReadyBatchRef.current = releaseReadyBatch;
    return () => {
      releaseReadyBatchRef.current = null;
    };
  }, [releaseReadyBatch]);

  useEffect(() => {
    return () => {
      if (releaseDelayTimerRef.current && typeof window !== "undefined") {
        window.clearTimeout(releaseDelayTimerRef.current);
      }
    };
  }, []);

  const startAutoReleaseCycle = useCallback(() => {
    if (autoReleaseActiveRef.current) {
      return;
    }
    if (autoReleasePausedRef.current) {
      return;
    }
    if (!releaseAllowedRef.current) {
      return;
    }
    if (readyQueueRef.current.length < READY_BATCH_THRESHOLD) {
      return;
    }
    autoReleaseActiveRef.current = true;
    releaseLoopCountRef.current = 0;
    releaseReadyBatch();
  }, [releaseReadyBatch]);

  useEffect(() => {
    if (readyQueueState.length < READY_BATCH_THRESHOLD) {
      autoReleasePausedRef.current = false;
      return;
    }
    startAutoReleaseCycle();
  }, [readyQueueState.length, startAutoReleaseCycle]);

  useEffect(() => {
    if (!hasMore && readyQueueState.length > 0) {
      releaseReadyBatch();
    }
  }, [hasMore, readyQueueState.length, releaseReadyBatch]);

  // 次のバッチに向けて画像を事前読み込みする
  const schedulePrefetchBatch = useCallback(() => {
    if (prefetchLockRef.current || !allItems.length) {
      return;
    }
    const remainingSpace = MAX_READY_QUEUE - readyQueueRef.current.length;
    if (remainingSpace <= 0) {
      return;
    }
    setLoadError(null);
    prefetchLockRef.current = true;
    try {
      const batch = [];
      let cursor = prefetchCursorRef.current;
      const seen = seenItemIdsRef.current;
      const targetSize = Math.min(PREFETCH_BATCH_SIZE, remainingSpace);
      while (cursor < allItems.length && batch.length < targetSize) {
        const item = allItems[cursor];
        cursor += 1;
        const key = getItemKey(item);
        if (!key || seen.has(key)) {
          continue;
        }
        seen.add(key);
        batch.push(item);
      }
      prefetchCursorRef.current = cursor;
      if (!batch.length) {
        prefetchLockRef.current = false;
        return;
      }
      let completed = 0;
      const handleComplete = () => {
        completed += 1;
        if (completed !== batch.length) {
          return;
        }
        prefetchLockRef.current = false;
        if (
          readyQueueRef.current.length < READY_BATCH_THRESHOLD &&
          prefetchCursorRef.current < allItems.length
        ) {
          schedulePrefetchBatch();
        }
      };
      batch.forEach((item) => {
        const imageUrl = item?.image_url;
        if (!imageUrl) {
          handleComplete();
          return;
        }
        const img = new Image();
        img.onload = () => {
          enqueueReadyItem(item);
          handleComplete();
        };
        img.onerror = () => {
          handleComplete();
        };
        img.src = imageUrl;
      });
    } catch (error) {
      console.error("Failed to prefetch items", error);
      setLoadError("データの読み込みに失敗しました。");
      prefetchLockRef.current = false;
    }
  }, [allItems, enqueueReadyItem]);

  useEffect(() => {
    const resetNeeded =
      prevDataSourceRef.current !== dataSourceKey ||
      prevItemsRef.current !== allItems;
    if (!resetNeeded) {
      return;
    }
    prevDataSourceRef.current = dataSourceKey;
    prevItemsRef.current = allItems;
    const preservedKeys = new Set();
    displayItems.forEach((item) => {
      const key = getItemKey(item);
      if (key) {
        preservedKeys.add(key);
      }
    });
    seenItemIdsRef.current = preservedKeys;
    readyQueueRef.current = [];
    setReadyQueueState([]);
    prefetchCursorRef.current = 0;
    prefetchLockRef.current = false;
    setIsInitialLoading(displayItems.length === 0);
    setLoadError(null);
    schedulePrefetchBatch();
  }, [allItems, dataSourceKey, schedulePrefetchBatch, displayItems]);

  useEffect(() => {
    releaseReadyBatch();
  }, [readyQueueState.length, hasMore, releaseReadyBatch]);

  useEffect(() => {
    if (!hasMore || readyQueueState.length >= READY_BATCH_THRESHOLD) {
      return;
    }
    schedulePrefetchBatch();
  }, [hasMore, readyQueueState.length, schedulePrefetchBatch]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const startIdleTimer = () => {
      if (scrollIdleTimerRef.current) {
        window.clearTimeout(scrollIdleTimerRef.current);
      }
      scrollIdleTimerRef.current = window.setTimeout(() => {
        isUserScrollingRef.current = false;
        if (
          hasMore &&
          readyQueueRef.current.length < MAX_READY_QUEUE
        ) {
          schedulePrefetchBatch();
        }
        if (readyQueueRef.current.length >= READY_BATCH_THRESHOLD) {
          startAutoReleaseCycle();
        }
      }, IDLE_PREFETCH_DELAY_MS);
    };
    const handleScroll = () => {
      isUserScrollingRef.current = true;
      autoReleaseActiveRef.current = false;
      releaseLoopCountRef.current = 0;
      autoReleasePausedRef.current = false;
      startIdleTimer();
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    startIdleTimer();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollIdleTimerRef.current) {
        window.clearTimeout(scrollIdleTimerRef.current);
        scrollIdleTimerRef.current = null;
      }
    };
  }, [hasMore, schedulePrefetchBatch, startAutoReleaseCycle]);

  useEffect(() => {
    if (!allItems.length) {
      setHasMore(false);
      return;
    }
    const scanningComplete = prefetchCursorRef.current >= allItems.length;
    const hasPendingQueue = readyQueueState.length > 0;
    setHasMore(!(scanningComplete && !hasPendingQueue));
  }, [allItems.length, readyQueueState.length]);

  useEffect(() => {
    setIsLoadingMore(hasMore && readyQueueState.length < READY_BATCH_THRESHOLD);
  }, [hasMore, readyQueueState.length]);

  const handleRetryLoading = useCallback(() => {
    if (isLoadingMore) return;
    setLoadError(null);
    scrollLoadStartLenRef.current = displayLenRef.current;
    setShowScrollLoading(true);
    schedulePrefetchBatch();
  }, [isLoadingMore, schedulePrefetchBatch]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (activeTab !== "home" || !node || !hasMore) {
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const inView = entries.some((entry) => entry.isIntersecting);
        if (inView) {
          if (!refreshingRef.current && !isInitialLoading && !query.trim()) {
            refreshingRef.current = true;
          }
          scrollLoadStartLenRef.current = displayLenRef.current;
          setShowScrollLoading(true);
          schedulePrefetchBatch();
        }
      },
      {
        rootMargin: "400px 0px 400px 0px",
        threshold: 0,
      }
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [activeTab, hasMore, schedulePrefetchBatch, isInitialLoading, query]);

  useEffect(() => {
    if (!showScrollLoading) return;
    if (activeTab !== "home" || query.trim()) {
      setShowScrollLoading(false);
      return;
    }
    if (loadError || !hasMore) {
      setShowScrollLoading(false);
      return;
    }
    if (displayItems.length > scrollLoadStartLenRef.current) {
      setShowScrollLoading(false);
    }
  }, [showScrollLoading, activeTab, query, loadError, hasMore, displayItems.length]);
 
  const filteredItems = useMemo(() => {
    // 検索クエリあり: 全データからヒットさせる
    if (!query) return displayItems;

    const useRemoteResults =
      meiliSearchExecuted && !meiliSearchError && meiliSearchHits !== null;
    if (useRemoteResults) {
      return meiliSearchHits;
    }

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
  }, [
    displayItems,
    query,
    allItems,
    meiliSearchHits,
    meiliSearchError,
    meiliSearchExecuted,
  ]);

  const searchResults = query
    ? filteredItems.slice(0, searchVisibleCount)
    : filteredItems;
  const hasMoreSearchResults = filteredItems.length > searchVisibleCount;

  const placeholderCount = useMemo(() => {
    if (!hasMore && !isInitialLoading) return 0;
    const needed = READY_BATCH_THRESHOLD - readyQueueState.length;
    if (needed <= 0) return 0;
    return Math.min(DISPLAY_BATCH_SIZE, needed);
  }, [hasMore, isInitialLoading, readyQueueState.length]);

  const loadingPlaceholderItems = useMemo(() => {
    if (placeholderCount <= 0 || displayItems.length > 0) {
      return [];
    }
    return Array.from({ length: placeholderCount }, (_, index) => (
      <div key={`skeleton-${index}`} className="mb-4">
        <CardSkeleton index={index} />
      </div>
    ));
  }, [placeholderCount, displayItems.length]);


  const showEmptySearchMessage =
    query.trim() && !meiliSearchLoading && filteredItems.length === 0;

  const handleUploadInputChange = (e) => {
    const { name, value } = e.target;
    if (name === "sourceChoice") {
      setUploadForm((prev) => {
        const next = { ...prev, sourceChoice: value };
        if (value === UPLOAD_SOURCE_CUSTOM && !prev.sourceCustom?.trim()) {
          next.sourceCustom = DEFAULT_CUSTOM_SOURCE_LABEL;
        }
        return next;
      });
    } else {
      setUploadForm((prev) => ({ ...prev, [name]: value }));
    }
    if (uploadMessage) setUploadMessage("");
  };

  const addUploadTags = useCallback((incoming) => {
    const next = parseTags(incoming);
    if (!next.length) return;
    setUploadForm((prev) => ({
      ...prev,
      tags: Array.from(new Set([...(prev.tags || []), ...next])),
    }));
  }, []);

  const removeUploadTagAt = useCallback((index) => {
    setUploadForm((prev) => ({
      ...prev,
      tags: (prev.tags || []).filter((_, i) => i !== index),
    }));
  }, []);

  const commitUploadTagText = useCallback(
    (rawText) => {
      const tags = parseTags(rawText);
      if (tags.length) {
        addUploadTags(tags);
      }
      setUploadTagText("");
    },
    [addUploadTags]
  );

  const processUploadTagsInput = useCallback(
    (raw) => {
      // If user typed a new `#` while already composing one tag,
      // commit everything before the last `#` and keep the rest.
      const hashPositions = [];
      for (let i = 0; i < raw.length; i += 1) {
        if (raw[i] === "#") hashPositions.push(i);
      }
      if (hashPositions.length >= 2) {
        const lastHashIndex = hashPositions[hashPositions.length - 1];
        const committable = raw.slice(0, lastHashIndex);
        const remainder = raw.slice(lastHashIndex);
        addUploadTags(committable);
        setUploadTagText(remainder);
        return;
      }

      // Commit on delimiters (space/comma/newline/、) if a hashtag exists.
      if (/[,\uFF0C、\n\s]$/.test(raw) && /#/.test(raw)) {
        addUploadTags(raw);
        setUploadTagText("");
        return;
      }

      setUploadTagText(raw);
    },
    [addUploadTags]
  );

  const handleUploadTagsChange = useCallback(
    (e) => {
      const raw = e.target.value;
      // IME（日本語入力）中は確定処理をしない。確定時（compositionend）にまとめて処理する。
      if (uploadTagComposingRef.current) {
        setUploadTagText(raw);
        return;
      }
      processUploadTagsInput(raw);
    },
    [processUploadTagsInput]
  );

  const handleUploadTagsKeyDown = useCallback(
    (e) => {
      if (uploadTagComposingRef.current) {
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        commitUploadTagText(uploadTagText);
        return;
      }
      if (e.key === "Backspace") {
        if (!uploadTagText && uploadForm.tags?.length) {
          e.preventDefault();
          removeUploadTagAt(uploadForm.tags.length - 1);
        }
        return;
      }
      if (e.key === "#") {
        const trimmed = uploadTagText.trim();
        if (trimmed && trimmed !== "#") {
          e.preventDefault();
          addUploadTags(trimmed);
          setUploadTagText("#");
        }
      }
    },
    [
      addUploadTags,
      commitUploadTagText,
      removeUploadTagAt,
      uploadForm.tags,
      uploadTagText,
    ]
  );

  const handleUploadSubmit = (e) => {
    e.preventDefault();
    if (uploadTagText.trim()) {
      commitUploadTagText(uploadTagText);
    }
    if (!user) {
      setUploadMessage("投稿にはログインが必要です。右上のボタンからログインしてください。");
      return;
    }
    if (!uploadForm.title.trim() || !uploadForm.image_url.trim()) {
      setUploadMessage("タイトルと画像URLは必須です");
      return;
    }
    const cleanedTags = parseTags(uploadForm.tags);
    const resolvedSource =
      uploadForm.sourceChoice === UPLOAD_SOURCE_CUSTOM
        ? uploadForm.sourceCustom?.trim() || DEFAULT_CUSTOM_SOURCE_LABEL
        : uploadForm.sourceChoice;
    onAddCustomItem({
      ...uploadForm,
      description: uploadForm.description.trim(),
      source: resolvedSource,
      tags: cleanedTags,
      author: user.displayName || user.email || "Anonymous",
      authorUid: user.uid,
    });
    setUploadForm({
      title: "",
      sourceChoice: UPLOAD_SOURCE_CUSTOM,
      sourceCustom: DEFAULT_CUSTOM_SOURCE_LABEL,
      image_url: "",
      source_url: "",
      description: "",
      tags: [],
    });
    setUploadTagText("");
    setUploadMessage("自分のコレクションに追加しました");
  };

  const handleSubmitFeedback = async (e) => {
    e?.preventDefault();
    const message = feedbackText.trim();
    if (!message || feedbackSending) return;
    setFeedbackError("");
    setFeedbackSent(false);
    const db = getDb();
    if (!db) {
      setFeedbackError("送信先の設定が見つかりません。");
      return;
    }
    setFeedbackSending(true);
    try {
      await addDoc(collection(db, "feedback"), {
        message,
        createdAt: serverTimestamp(),
        source: "enso-web",
        section: activeTab,
        query: query?.trim() || "",
        user: user
          ? {
              uid: user.uid || "",
              email: user.email || "",
              displayName: user.displayName || "",
            }
          : null,
      });
      setFeedbackText("");
      setFeedbackSent(true);
      window.setTimeout(() => setFeedbackSent(false), 2500);
    } catch (error) {
      console.error("Failed to submit feedback:", error);
      setFeedbackError("送信に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setFeedbackSending(false);
    }
  };

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
  const overlayCandidates = useMemo(
    () => shuffleItems(recommendedSlice).slice(0, 12),
    [recommendedSlice]
  );
  const isOverlaySaved = selected ? isItemSaved(selected) : false;
  const isOverlayLiked = selected ? isItemLiked(selected) : false;
  const overlayLikeCount = selected ? getLikeCountForItem(selected) : 0;

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
    if (!selected) return;
    // セクションを切り替えたら詳細モーダルは閉じる（左バー操作など）
    clearSelection();
  }, [activeTab]);

  useEffect(() => {
    if (!homeClearToken) return;
    const shouldRestoreScroll = detailOpenRef.current;
    const scrollY = scrollBeforeSelectionRef.current;
    const restoreTarget =
      shouldRestoreScroll && typeof scrollY === "number"
        ? {
            cardId: returnCardIdRef.current,
            scrollY,
          }
        : null;
    pendingRestoreRef.current = restoreTarget;
    clearSelection();
    schedulePrefetchBatch();
  }, [homeClearToken, schedulePrefetchBatch]);

  // 選択カードを開くときは一度スクロールをトップに戻してから詳細を表示
  // 親からのホームリセット指示で詳細を閉じてトップに戻す
  const visibleBeforeSelectionRef = useRef(0);

  useEffect(() => {
    if (selected) {
      return;
    }
    const target = pendingRestoreRef.current;
    if (!target) {
      return;
    }
    pendingRestoreRef.current = null;
    const handle = requestAnimationFrame(() => {
      scrollToCardOrPosition(target);
    });
    return () => cancelAnimationFrame(handle);
  }, [selected, displayItems.length]);

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
    if (!savedItemsLoaded) return;
    prevSavedCountRef.current = savedItems.length;
    savedItemsBaselineReadyRef.current = true;
  }, [savedItemsLoaded, savedItems.length]);

  useEffect(() => {
    if (!savedItemsBaselineReadyRef.current) return;
    if (savedItems.length > prevSavedCountRef.current) {
      const lastItem = savedItems[savedItems.length - 1];
      triggerSavedToast(lastItem?.title);
    }
    prevSavedCountRef.current = savedItems.length;
  }, [savedItems]);

  const openItem = (item) => {
    visibleBeforeSelectionRef.current = displayItems.length;
    const currentScroll = window.scrollY;
    if (!selected) {
      scrollBeforeSelectionRef.current = currentScroll;
    }
    returnCardIdRef.current = item?.id || null;
    detailOpenRef.current = true;
    setSelectionStack((prev) => [...prev, { item: selected, scrollY: currentScroll }]);
    setSelected(item);
    window.scrollTo({ top: 0 });
  };

  const handleBack = () => {
    if (selectionStack.length === 0) {
      const restoreTarget = {
        cardId: returnCardIdRef.current,
        scrollY: scrollBeforeSelectionRef.current,
      };
      clearSelection();
      scrollToCardOrPosition(restoreTarget);
      return;
    }
    const last = selectionStack[selectionStack.length - 1];
    setSelectionStack((prev) => prev.slice(0, -1));
    const nextItem = last?.item || null;
    if (!nextItem) {
      const restoreTarget = {
        cardId: returnCardIdRef.current,
        scrollY: last?.scrollY,
      };
      clearSelection();
      scrollToCardOrPosition(restoreTarget);
      return;
    }
    returnCardIdRef.current = nextItem.id || null;
    setSelected(nextItem);
    detailOpenRef.current = true;
  };

  const clearSelection = () => {
    setSelected(null);
    setSelectionStack([]);
    detailOpenRef.current = false;
    scrollBeforeSelectionRef.current = 0;
    returnCardIdRef.current = null;
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

  const rightRecommendations = overlayCandidates.slice(0, 6);
  const bottomRecommendations = overlayCandidates.slice(6);
  const detailOverlay = selected ? (
    <div
      className="fixed bottom-0 left-16 right-0 top-[76px] z-50"
      onClick={handleBack}
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/60" aria-hidden="true" />
      <div className="relative h-full overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto w-full max-w-7xl">
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow transition hover:bg-gray-100"
              onClick={handleBack}
            >
              <span>←</span>
              <span>戻る</span>
            </button>
          </div>

          <div
            className="mt-6 rounded-3xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid gap-8 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <div className="relative rounded-2xl bg-gray-50 p-4 shadow-sm">
                  <img
                    src={selected.image_url || PLACEHOLDER_IMG_LARGE}
                    alt={selected.title}
                    className="w-full rounded-2xl object-contain"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = PLACEHOLDER_IMG_LARGE;
                    }}
                  />
                  <div className="absolute left-3 top-4">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onLikeItem?.(selected);
                      }}
                      className={`flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-full border border-white bg-white/90 p-1 text-gray-600 shadow transition ${
                        isOverlayLiked ? "text-red-500" : "text-gray-600"
                      }`}
                      aria-label="いいね"
                    >
                      {isOverlayLiked ? (
                        <HeartSolidIcon className="h-5 w-5" />
                      ) : (
                        <HeartOutlineIcon className="h-5 w-5" />
                      )}
                      <span className="text-[11px] font-semibold">
                        {overlayLikeCount}
                      </span>
                    </button>
                  </div>
                  <div className="absolute right-3 top-4">
                    <button
                      type="button"
                      onClick={() => handleToggleSave(selected)}
                      className={`flex h-11 w-11 items-center justify-center rounded-full border border-white bg-white/90 p-1 text-gray-600 shadow transition hover:border-gray-300 ${
                        isOverlaySaved ? "text-gray-700" : "text-gray-600"
                      }`}
                      aria-label="保存"
                    >
                      {isOverlaySaved ? (
                        <BookmarkSolidIcon className="h-5 w-5" />
                      ) : (
                        <BookmarkIcon className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-4">
                    <span className="text-sm text-gray-500">
                      {selected.source || "Unknown"}
                    </span>
                    {selected.source_url && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(
                            selected.source_url,
                            "_blank",
                            "noreferrer"
                          );
                        }}
                        className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-800 shadow-sm transition hover:bg-gray-200"
                        aria-label="元サイトで開く"
                      >
                        <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                        <span>元サイト</span>
                      </button>
                    )}
                  </div>
                  <div className="mt-2 space-y-2">
                    <h3 className="text-2xl font-semibold text-gray-900">
                      {selected.title}
                    </h3>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-3">
                  {bottomRecommendations.map((item) => (
                    <div
                      key={item.id}
                      className="h-full rounded-2xl bg-white p-3 shadow-sm"
                      data-card-id={item.id}
                    >
                      <Card
                        item={item}
                        onExpand={() => openItem(item)}
                        onSave={handleToggleSave}
                        onLike={onLikeItem}
                        isSaved={isItemSaved(item)}
                        isLiked={isItemLiked(item)}
                        likeCount={getLikeCountForItem(item)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-4 lg:col-span-2">
                <div className="grid grid-cols-2 gap-4">
                  {rightRecommendations.map((item) => (
                    <div
                      key={item.id}
                      className="h-full rounded-2xl bg-white p-3 shadow-sm"
                      data-card-id={item.id}
                    >
                      <Card
                        item={item}
                        onExpand={() => openItem(item)}
                        onSave={handleToggleSave}
                        onLike={onLikeItem}
                        isSaved={isItemSaved(item)}
                        isLiked={isItemLiked(item)}
                        likeCount={getLikeCountForItem(item)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-full border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                onClick={() => handleToggleSave(selected)}
              >
                {isItemSaved(selected) ? "保存済" : "保存"}
              </button>
            </div>
            {canLoadMoreRecommended && (
              <div ref={detailSentinelRef} className="h-8" />
            )}
          </div>
        </div>
      </div>
    </div>
  ) : null;

  if (activeTab === "saved") {
    return (
      <>
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
                <div key={item.id} className="mb-4" data-card-id={item.id}>
                  <Card
                    item={item}
                    onExpand={() => openItem(item)}
                    onSave={handleToggleSave}
                    onLike={onLikeItem}
                    isSaved={isItemSaved(item)}
                    isLiked={isItemLiked(item)}
                    likeCount={getLikeCountForItem(item)}
                  />
                </div>
              ))}
            </Masonry>
          )}
        </div>
        {detailOverlay}
      </>
    );
  }

  if (activeTab === "upload") {
    return (
      <>
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
                タグ（ハッシュタグ入力）
              </label>
              <div className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus-within:border-gray-400">
                <div className="flex flex-wrap gap-2">
                  {(uploadForm.tags || []).map((tag, index) => (
                    <button
                      key={`${tag}-${index}`}
                      type="button"
                      className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                      onClick={() => removeUploadTagAt(index)}
                      aria-label={`タグ ${tag} を削除`}
                      title="クリックで削除"
                    >
                      <span className="text-gray-500">#</span>
                      <span>{tag}</span>
                      <span className="text-gray-400">×</span>
                    </button>
                  ))}
                  <input
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    value={uploadTagText}
                    onChange={handleUploadTagsChange}
                    onKeyDown={handleUploadTagsKeyDown}
                    onCompositionStart={() => {
                      uploadTagComposingRef.current = true;
                    }}
                    onCompositionEnd={(e) => {
                      uploadTagComposingRef.current = false;
                      processUploadTagsInput(e.currentTarget.value);
                    }}
                    onBlur={() => {
                      if (uploadTagText.trim()) {
                        commitUploadTagText(uploadTagText);
                      }
                    }}
                    className="min-w-[12ch] flex-1 border-0 bg-transparent p-0 text-sm outline-none"
                    placeholder={
                      uploadForm.tags?.length
                        ? "#タグを追加"
                        : "例：#miniature #drone #organizer"
                    }
                  />
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                `#` を押してタグを入力すると確定します（Enterでも確定、Backspaceで最後のタグを削除）。
              </p>
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
                name="sourceChoice"
                value={uploadForm.sourceChoice}
                onChange={handleUploadInputChange}
                className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-400"
              >
                <option value={UPLOAD_SOURCE_CUSTOM}>カスタム（自由入力）</option>
                {UPLOAD_SOURCES.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
              {uploadForm.sourceChoice === UPLOAD_SOURCE_CUSTOM && (
                <input
                  type="text"
                  name="sourceCustom"
                  value={uploadForm.sourceCustom}
                  onChange={handleUploadInputChange}
                  className="mt-3 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-400"
                  placeholder={DEFAULT_CUSTOM_SOURCE_LABEL}
                />
              )}
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
      {detailOverlay}
      </>
    );
  }

  if (activeTab === "explore") {
    const hasQuery = Boolean(query.trim());

    if (hasQuery) {
      const meiliSearchActive =
        meiliSearchExecuted && !meiliSearchError && meiliSearchHits !== null;
      const searchStatusText = meiliSearchLoading
        ? "Meilisearch で検索中..."
        : meiliSearchActive
          ? "Meilisearch からの結果を表示"
          : meiliSearchError
            ? "Meilisearch に接続できずローカル検索に切り替えています"
            : meiliConfigured
              ? "ローカル検索（Meilisearch へ接続中）"
              : "ローカル検索";
      return (
        <>
          <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase text-gray-400">
                Explore Search
              </p>
              <h2 className="text-3xl font-semibold">
                「{query}」の検索結果
              </h2>
              <p className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                <span>{filteredItems.length} 件ヒットしました</span>
                <span className="text-xs font-medium text-gray-400">
                  {searchStatusText}
                </span>
              </p>
              {meiliSearchError && (
                <p className="mt-1 text-xs text-red-500">
                  Meilisearch に接続できません。ローカル検索で続行します。
                </p>
              )}
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
            {searchResults.map((it) => (
              <div key={it.id} className="mb-4" data-card-id={it.id}>
                <Card
                  item={it}
                  onExpand={() => openItem(it)}
                  onSave={handleToggleSave}
                  onLike={onLikeItem}
                  isSaved={isItemSaved(it)}
                  isLiked={isItemLiked(it)}
                  likeCount={getLikeCountForItem(it)}
                />
              </div>
            ))}
            {loadingPlaceholderItems}
          </Masonry>
          )}
          {hasMoreSearchResults && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                className="rounded-full border border-gray-200 bg-white px-6 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-gray-300 hover:bg-gray-50"
                onClick={() =>
                  setSearchVisibleCount((prev) =>
                    Math.min(
                      prev + SEARCH_RESULTS_BATCH_SIZE,
                      filteredItems.length
                    )
                  )
                }
              >
                さらに {SEARCH_RESULTS_BATCH_SIZE} 件読み込む
              </button>
            </div>
          )}
          </div>
          {detailOverlay}
        </>
      );
    }

    const trendingItems = filteredItems.slice(0, 8);
    const pick = computeDailyPick(filteredItems, todayKey);
    const rising = filteredItems.slice(1, 4);
    const fresh = filteredItems.slice(4, 7);

    return (
      <>
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
                <div key={item.id} className="mb-4" data-card-id={item.id}>
                  <Card
                    item={item}
                    onExpand={() => openItem(item)}
                    onSave={handleToggleSave}
                    onLike={onLikeItem}
                    isSaved={isItemSaved(item)}
                    isLiked={isItemLiked(item)}
                    likeCount={getLikeCountForItem(item)}
                  />
                </div>
              ))}
            </Masonry>
          </div>
        )}
        </div>
        {detailOverlay}
      </>
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
        {detailOverlay}
      </>
    );
  }
  return (
    <>
      <div className="mx-auto max-w-[1400px] px-3 sm:px-4">
        <div className="py-4">
          {activeTab === "home" && !query.trim() && (
            <div className="mb-6 rounded-3xl border border-gray-200 bg-white/80 p-5 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-gray-400">
                    Feedback
                  </p>
                  <h2 className="text-lg font-semibold text-gray-900">
                    ご意見箱
                  </h2>
                  <p className="text-sm text-gray-500">
                    改善してほしい点・追加してほしい機能などを自由に書いてください。
                  </p>
                </div>
                {feedbackSent && (
                  <div className="rounded-full bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700">
                    送信しました。ありがとうございます！
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmitFeedback} className="mt-4 space-y-3">
                <textarea
                  value={feedbackText}
                  onChange={(e) => {
                    setFeedbackText(e.target.value);
                    if (feedbackError) setFeedbackError("");
                  }}
                  rows={3}
                  maxLength={1000}
                  className="w-full resize-none rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 outline-none focus:border-gray-400"
                  placeholder="例：検索結果の並び替えがほしい / お気に入りのフォルダ分けがしたい / UIが見づらい など"
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-gray-400">
                    {feedbackText.length}/1000
                  </p>
                  <button
                    type="submit"
                    disabled={feedbackSending || !feedbackText.trim()}
                    className="rounded-full bg-gray-900 px-5 py-2 text-sm font-semibold text-white shadow transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                  >
                    {feedbackSending ? "送信中..." : "送信する"}
                  </button>
                </div>
                {feedbackError && (
                  <p className="text-xs font-medium text-red-600">
                    {feedbackError}
                  </p>
                )}
              </form>
            </div>
          )}
          <Masonry
            breakpointCols={breakpointColumnsObj}
            className="my-masonry-grid"
            columnClassName="my-masonry-grid_column"
          >
            {filteredItems.map((it) => (
              <div key={it.id} className="mb-4" data-card-id={it.id}>
                <Card
                  item={it}
                  onExpand={() => openItem(it)}
                  onSave={handleToggleSave}
                  onLike={onLikeItem}
                  isSaved={isItemSaved(it)}
                  isLiked={isItemLiked(it)}
                  likeCount={getLikeCountForItem(it)}
                />
              </div>
            ))}
          </Masonry>

          {!isInitialLoading && hasMore && (
            <div ref={sentinelRef} className="h-10" />
          )}

          {loadError && (
            <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700">
              <p>{loadError}</p>
              <button
                type="button"
                onClick={handleRetryLoading}
                className="rounded-full border border-red-300 px-4 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
              >
                再読み込み
              </button>
            </div>
          )}

          {!isInitialLoading && !hasMore && (
            <div className="mt-3 text-center text-sm text-gray-500">
              最後まで読み込みました
            </div>
          )}

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
      {detailOverlay}
    </>
  );
}
