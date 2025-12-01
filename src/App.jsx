import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import Layout from "./Layout.jsx";
import Home from "./Home.jsx";
import AuthModal from "./AuthModal.jsx";
import { getAuthClient, getDb } from "./firebaseClient.js";

const SEARCH_HISTORY_KEY = "yaggi3d_search_history";
const MAX_HISTORY = 10;
const POPULAR_KEYWORDS = [
  "iphone stand",
  "drone",
  "figure",
  "gadget",
  "toy",
  "holder",
  "organizer",
];

function getSearchHistory() {
  try {
    const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveSearchHistory(query) {
  if (!query.trim()) return;
  try {
    const history = getSearchHistory();
    const filtered = history.filter(
      (h) => h.toLowerCase() !== query.toLowerCase()
    );
    const updated = [query, ...filtered].slice(0, MAX_HISTORY);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // localStorage が使えない場合は無視
  }
}

function loadCustomItems() {
  return [];
}

function persistCustomItems(items) {
  // クラウド優先。ローカルキャッシュは保持しない。
}

function loadSavedItems() {
  return [];
}

function persistSavedItems(items) {
  // クラウド保存のためローカルは使用しない。
}

function loadLikedItems() {
  return [];
}

function persistLikedItems(items) {
  // クラウド保存優先。ローカルキャッシュは保持しない。
}

const mergeCustomItems = (current, incoming) => {
  const map = new Map();
  const add = (item) => {
    if (!item) return;
    const key = item.source_url || item.id;
    if (!key) return;
    map.set(key, { ...item, isCustom: true });
  };
  current.forEach(add);
  incoming.forEach(add);
  return Array.from(map.values());
};

const isSameItem = (a, b) => {
  if (!a || !b) return false;
  if (a.id && b.id && a.id === b.id) return true;
  if (a.source_url && b.source_url && a.source_url === b.source_url) {
    return true;
  }
  return false;
};

const getLikeKey = (item) => {
  const rawKey = item?.source_url || item?.image_url || item?.id;
  if (!rawKey) return null;
  return encodeURIComponent(rawKey);
};

const SECTION_BY_PATH = {
  "/home": "home",
  "/explore": "explore",
  "/saved": "saved",
  "/upload": "upload",
};

function getSectionFromPath(path) {
  return SECTION_BY_PATH[path] || "home";
}

function buildPathFromSection(section) {
  return Object.entries(SECTION_BY_PATH).find(([, value]) => value === section)?.[0] || "/home";
}

function App() {
  const [activeSection, setActiveSection] = useState(() =>
    getSectionFromPath(window.location.pathname)
  );
  const [savedItems, setSavedItems] = useState([]);
  const [likedItems, setLikedItems] = useState([]);
  const [customItems, setCustomItems] = useState(() => loadCustomItems());
  const [likeCounts, setLikeCounts] = useState({});
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchHistory, setSearchHistory] = useState(() =>
    getSearchHistory()
  );
  const [authUser, setAuthUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [homeResetToken, setHomeResetToken] = useState(0);
  const [homeClearToken, setHomeClearToken] = useState(0);

  useEffect(() => {
    document.title = "enso";
  }, []);

  useEffect(() => {
    const auth = getAuthClient();
    if (!auth) {
      setAuthReady(true);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setSavedItems([]);
    const db = getDb();
    if (!db || !authUser) return;

    const savedRef = collection(db, "users", authUser.uid, "savedItems");
    const unsubscribe = onSnapshot(
      savedRef,
      (snapshot) => {
        const items = snapshot.docs.map((docSnap) => ({
          ...docSnap.data(),
          id: docSnap.id,
        }));
        setSavedItems(items);
      },
      (err) => {
        console.error("Firestore savedItems onSnapshot error:", err);
      }
    );

    return () => unsubscribe?.();
  }, [authUser]);

  useEffect(() => {
    const db = getDb();
    if (!db) return;

    const unsubscribe = onSnapshot(
      collection(db, "likeCounts"),
      (snapshot) => {
        const counts = {};
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (typeof data?.count === "number") {
            counts[docSnap.id] = Math.max(0, data.count);
          }
        });
        setLikeCounts(counts);
      },
      (err) => {
        console.error("Firestore likeCounts onSnapshot error:", err);
      }
    );

    return () => unsubscribe?.();
  }, []);

  useEffect(() => {
    const db = getDb();
    if (!db) {
      console.warn("Firestore config not found. Falling back to local storage only.");
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const snap = await getDocs(collection(db, "customItems"));
        if (cancelled) return;
        const remoteItems =
          snap.docs.map((doc) => ({
            ...doc.data(),
            id: doc.id,
            isCustom: true,
          })) || [];
        if (remoteItems.length > 0) {
          setCustomItems((prev) => mergeCustomItems(prev, remoteItems));
        }
      } catch {
        // Firestore が使えない場合はローカルのみで運用
      }
    })();

    const unsubscribe = onSnapshot(
      collection(db, "customItems"),
      (snapshot) => {
        const remoteItems =
          snapshot.docs.map((doc) => ({
            ...doc.data(),
            id: doc.id,
            isCustom: true,
          })) || [];
        setCustomItems((prev) => mergeCustomItems(prev, remoteItems));
      },
      (err) => {
        console.error("Firestore onSnapshot error:", err);
      }
    );

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  const getLikeCountForItem = (item) => {
    const key = getLikeKey(item);
    if (!key) return 0;
    return likeCounts[key] || 0;
  };

  const syncLikeCountToFirestore = async (item, delta) => {
    const db = getDb();
    if (!db || !delta) return;
    const likeKey = getLikeKey(item);
    if (!likeKey) return;

    const likeDocRef = doc(db, "likeCounts", likeKey);
    try {
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(likeDocRef);
        const current = snap.exists() && typeof snap.data()?.count === "number"
          ? snap.data().count
          : 0;
        const next = Math.max(0, current + delta);
        transaction.set(
          likeDocRef,
          {
            count: next,
            title: item.title || "Untitled",
            source: item.source || "Unknown",
            source_url: item.source_url || "",
            image_url: item.image_url || "",
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      });
    } catch (err) {
      console.error("Failed to sync like count to Firestore:", err);
    }
  };

  const handleSaveItem = (item) => {
    if (!authUser) {
      handleOpenAuth("login");
      return;
    }
    const db = getDb();
    const key = getLikeKey(item);
    if (!db || !key) return;

    setSavedItems((prev) => {
      const exists = prev.some((it) => isSameItem(it, item));
      if (exists) {
        return prev.filter((it) => !isSameItem(it, item));
      }
      return [{ ...item, savedBy: authUser.uid }, ...prev];
    });

    const ref = doc(db, "users", authUser.uid, "savedItems", key);
    const exists = savedItems.some((it) => isSameItem(it, item));
    (async () => {
      try {
        if (exists) {
          await deleteDoc(ref);
        } else {
          await setDoc(
            ref,
            {
              ...item,
              savedBy: authUser.uid,
              savedAt: serverTimestamp(),
            },
            { merge: true }
          );
        }
      } catch (err) {
        console.error("Failed to toggle saved item:", err);
      }
    })();
  };

  const handleLikeItem = (item) => {
    setLikedItems((prev) => {
      const exists = prev.some((it) => isSameItem(it, item));
      const delta = exists ? -1 : 1;
      const likeKey = getLikeKey(item);

      if (likeKey) {
        setLikeCounts((prevCounts) => {
          const nextCount = Math.max(0, (prevCounts[likeKey] || 0) + delta);
          return { ...prevCounts, [likeKey]: nextCount };
        });
        syncLikeCountToFirestore(item, delta);
      }

      if (exists) {
        return prev.filter((it) => !isSameItem(it, item));
      }
      return [item, ...prev];
    });
  };

  const handleAddCustomItem = async (item) => {
    const trimmedTitle = item.title?.trim();
    if (!trimmedTitle) return;
    const trimmedImage = item.image_url?.trim() || "";
    const trimmedSource = item.source?.trim() || "Custom";
    const trimmedSourceUrl = item.source_url?.trim() || "";
    const customId = `custom-${Date.now()}`;
    const canonicalSourceUrl =
      trimmedSourceUrl || trimmedImage || `custom://${customId}`;

    const newItem = {
      ...item,
      id: customId,
      title: trimmedTitle,
      source: trimmedSource,
      image_url: trimmedImage,
      source_url: canonicalSourceUrl,
      isCustom: true,
    };
    setCustomItems((prev) => [newItem, ...prev]);
    const db = getDb();
    if (db) {
      try {
        const docRef = await addDoc(collection(db, "customItems"), newItem);
        setCustomItems((prev) =>
          mergeCustomItems(
            prev.filter((it) => it.id !== customId),
            [{ ...newItem, id: docRef.id }]
          )
        );
      } catch (err) {
        console.error("Failed to add custom item to Firestore:", err);
        // Firestore が使えない場合はローカルのみで運用
      }
    }
    setActiveSection("home");
  };

  const handleNavigate = (section, options = {}) => {
    const path = buildPathFromSection(section);
    if (!options.skipHistory) {
      window.history.pushState({ section }, "", path);
    }
    if (section === "home") {
      setQuery("");
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (activeSection === "home") {
        setHomeClearToken((t) => t + 1);
      } else {
        setHomeResetToken((t) => t + 1);
      }
    }
    setActiveSection(section);
    setShowNotifications(false);
    setShowMessages(false);
    if (section !== "explore") {
      setShowSuggestions(false);
    }
  };

  useEffect(() => {
    const onPopState = (event) => {
      const section = (event.state?.section && event.state.section) || getSectionFromPath(window.location.pathname);
      handleNavigate(section, { skipHistory: true });
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const toggleNotifications = () => {
    setShowNotifications((prev) => !prev);
    setShowMessages(false);
  };

  const toggleMessages = () => {
    setShowMessages((prev) => !prev);
    setShowNotifications(false);
  };

  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      setShowSuggestions(false);
      return;
    }
    saveSearchHistory(trimmed);
    setSearchHistory(getSearchHistory());
    setShowSuggestions(false);
  };

  const handleSuggestionClick = (value) => {
    setQuery(value);
    saveSearchHistory(value);
    setSearchHistory(getSearchHistory());
    setShowSuggestions(false);
  };

  const handleSearchChange = (value) => {
    setQuery(value);
    setShowSuggestions(true);
  };

  const handleSearchFocus = () => {
    setShowSuggestions(true);
  };

  const handleCloseSuggestions = () => {
    setShowSuggestions(false);
  };

  const handleSearchClear = () => {
    setQuery("");
    setShowSuggestions(false);
  };

  const handleOpenAuth = (mode = "login") => {
    setAuthMode(mode);
    setAuthError("");
    setShowAuthModal(true);
  };

  const handleAuthSubmit = async ({ mode, email, password, displayName }) => {
    const auth = getAuthClient();
    if (!auth) {
      setAuthError("Firebase の設定が見つかりません。VITE_FIREBASE_* を設定してください。");
      return;
    }
    setAuthLoading(true);
    setAuthError("");
    try {
      if (mode === "signup") {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (displayName && cred?.user) {
          await updateProfile(cred.user, { displayName: displayName.slice(0, 30) });
        }
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      setShowAuthModal(false);
    } catch (err) {
      setAuthError(err?.message || "認証に失敗しました");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    const auth = getAuthClient();
    if (!auth) return;
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Failed to sign out:", err);
    }
  };

  const handleSocialLogin = async (providerName) => {
    const auth = getAuthClient();
    if (!auth) {
      setAuthError("Firebase の設定が見つかりません。VITE_FIREBASE_* を設定してください。");
      return;
    }
    setAuthLoading(true);
    setAuthError("");
    try {
      let provider;
      if (providerName === "google") {
        provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
      } else if (providerName === "apple") {
        provider = new OAuthProvider("apple.com");
        provider.addScope("email");
        provider.addScope("name");
      } else {
        throw new Error("Unsupported provider");
      }
      await signInWithPopup(auth, provider);
      setShowAuthModal(false);
    } catch (err) {
      setAuthError(err?.message || "ソーシャルログインに失敗しました");
    } finally {
      setAuthLoading(false);
    }
  };

  const searchEnabled = activeSection === "explore" || activeSection === "home";

  return (
    <>
      <Layout
      activeSection={activeSection}
      onNavigate={handleNavigate}
      onToggleNotifications={toggleNotifications}
      onToggleMessages={toggleMessages}
      showNotifications={showNotifications}
      showMessages={showMessages}
      searchValue={query}
      onSearchChange={handleSearchChange}
      onSearchSubmit={handleSearchSubmit}
      onSearchFocus={handleSearchFocus}
      onCloseSearchSuggestions={handleCloseSuggestions}
      showSearchSuggestions={showSuggestions && searchEnabled}
      searchHistory={searchHistory}
      onSuggestionClick={handleSuggestionClick}
      onClearSearch={handleSearchClear}
      popularKeywords={POPULAR_KEYWORDS}
      searchEnabled={searchEnabled}
      searchPlaceholder="3Dモデルを検索（例: iphone stand, drone, figure ...）"
      user={authUser}
      authReady={authReady}
      onRequestAuth={() => handleOpenAuth("login")}
      onLogout={handleLogout}
      onHomeClick={() => {
        setQuery("");
        setHomeClearToken((t) => t + 1);
      }}
    >
      <Home
        activeTab={activeSection}
        savedItems={savedItems}
        onSaveItem={handleSaveItem}
        likedItems={likedItems}
        onLikeItem={handleLikeItem}
        getLikeCountForItem={getLikeCountForItem}
        customItems={customItems}
        onAddCustomItem={handleAddCustomItem}
      query={query}
      homeResetToken={homeResetToken}
      homeClearToken={homeClearToken}
      user={authUser}
    />
    </Layout>
    <AuthModal
      open={showAuthModal}
      mode={authMode}
      onModeChange={(mode) => {
        setAuthMode(mode);
        setAuthError("");
      }}
      onClose={() => {
        setShowAuthModal(false);
        setAuthError("");
      }}
      onSubmit={handleAuthSubmit}
      loading={authLoading}
      error={authError}
      onSocialLogin={handleSocialLogin}
    />
    </>
  );
}

export default App;
