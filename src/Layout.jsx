// src/Layout.jsx
import React, { useRef, useState } from "react";
import {
  HomeIcon,
  MagnifyingGlassIcon,
  BellIcon,
  ChatBubbleLeftRightIcon,
  Cog6ToothIcon,
  PlusCircleIcon,
  UserCircleIcon,
  Squares2X2Icon,
  ClockIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import ensoLogo from "/enso.svg";

const navItems = [
  { id: "home", label: "ホーム", Icon: HomeIcon },
  { id: "explore", label: "探索", Icon: MagnifyingGlassIcon },
  { id: "saved", label: "保存", Icon: Squares2X2Icon },
  { id: "upload", label: "投稿", Icon: PlusCircleIcon, bordered: true },
];
const PANEL_TOP_OFFSET = 76; // 上部固定バーの高さぶん余白

export default function Layout({
  children,
  activeSection = "home",
  onNavigate = () => {},
  onToggleNotifications = () => {},
  onToggleMessages = () => {},
  showNotifications = false,
  showMessages = false,
  searchValue = "",
  onSearchChange = () => {},
  onSearchSubmit = () => {},
  onSearchFocus = () => {},
  onCloseSearchSuggestions = () => {},
  showSearchSuggestions = false,
  searchHistory = [],
  onSuggestionClick = () => {},
  popularKeywords = [],
  searchPlaceholder = "検索する",
  searchEnabled = true,
  user = null,
  authReady = false,
  onRequestAuth = () => {},
  onLogout = () => {},
  onClearSearch = () => {},
  onHomeClick = () => {},
}) {
  const searchInputRef = useRef(null);
  const shouldShowSuggestions = showSearchSuggestions && searchEnabled;
  const [showProfilePanel, setShowProfilePanel] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [policyTab, setPolicyTab] = useState("terms");

  const handleSuggestionSelect = (value) => {
    onSuggestionClick(value);
    searchInputRef.current?.focus();
  };

  const userInitial =
    user?.displayName?.[0] || user?.email?.[0] || (user ? "U" : "");
  const userLabel = user?.displayName || user?.email || "ゲスト";

  const handleProfileClick = () => {
    if (!authReady) return;
    if (user) {
      setShowProfilePanel(true);
    } else {
      onRequestAuth();
    }
  };

  const closeProfilePanel = () => {
    setShowProfilePanel(false);
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* ===== 左のツールバー ===== */}
      <aside className="fixed inset-y-0 left-0 z-50 flex w-16 flex-col items-center gap-6 border-r bg-white/95 py-4">
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm"
          title="enso"
          aria-label="enso ホーム"
          onClick={() => {
            closeProfilePanel();
            if (activeSection === "home") {
              onHomeClick();
            } else {
              onNavigate("home");
            }
          }}
        >
          <img
            src={ensoLogo}
            alt="enso"
            className="h-9 w-9 rounded-full object-cover"
            draggable="false"
          />
        </button>

        {navItems.map((item) => {
          const IconComponent = item.Icon;
          return (
            <button
              key={item.id}
              type="button"
              className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                item.bordered ? "border border-gray-300 hover:bg-gray-50" : "hover:bg-gray-100"
              } ${
                activeSection === item.id
                  ? "bg-gradient-to-br from-gray-900 to-slate-900 text-white shadow-lg"
                  : "text-gray-900 hover:text-gray-900"
              }`}
              title={item.label}
              onClick={() => {
                closeProfilePanel();
                if (item.id === "home") {
                  if (activeSection === "home") {
                    onHomeClick();
                  } else {
                    onNavigate("home");
                  }
                  return;
                }
                onNavigate(item.id);
              }}
            >
              <IconComponent className="h-6 w-6" />
            </button>
          );
        })}

        {/*
        <div className="relative">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-gray-100"
            title="通知"
            onClick={() => {
              closeProfilePanel();
              onToggleNotifications();
            }}
          >
            <BellIcon className="h-6 w-6 text-gray-700" />
          </button>
          <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">
            9+
          </span>
        </div>

        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-gray-100"
          title="メッセージ"
          onClick={() => {
            closeProfilePanel();
            onToggleMessages();
          }}
        >
          <ChatBubbleLeftRightIcon className="h-6 w-6 text-gray-700" />
        </button>
        */}

        <div className="mt-auto space-y-2">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-gray-100"
            title="設定"
            onClick={() => {
              setPolicyTab("terms");
              setShowPolicyModal(true);
            }}
          >
            <Cog6ToothIcon className="h-6 w-6 text-gray-700" />
          </button>
        </div>
      </aside>

      {/* 通知・メッセージパネル */}
      {/*
      {showNotifications && (
        <div
          className="fixed z-40 flex w-64 flex-col border-r border-gray-200 bg-white shadow-lg"
          style={{
            left: "4rem",
            top: `${PANEL_TOP_OFFSET}px`,
            height: `calc(100% - ${PANEL_TOP_OFFSET}px)`,
          }}
        >
          <div className="border-b px-4 py-3 font-semibold">通知</div>
          <div className="flex-1 overflow-y-auto px-4 py-3 text-sm text-gray-600">
            <p className="mb-3">・新しい3Dモデルが追加されました。</p>
            <p className="mb-3">・保存した「船」に似たモデルが見つかりました。</p>
            <p>・Cults3Dからのおすすめがあります。</p>
          </div>
        </div>
      )}
      {showMessages && (
        <div
          className="fixed z-40 flex w-64 flex-col border-r border-gray-200 bg-white shadow-lg"
          style={{
            left: showNotifications ? "calc(4rem + 16rem)" : "4rem",
            top: `${PANEL_TOP_OFFSET}px`,
            height: `calc(100% - ${PANEL_TOP_OFFSET}px)`,
          }}
        >
          <div className="border-b px-4 py-3 font-semibold">メッセージ</div>
          <div className="flex-1 overflow-y-auto px-4 py-3 text-sm text-gray-600">
            <p className="mb-3">・デザイナーA「このモデルのフィードバックをお願いします」</p>
            <p>・ユーザーB「保存ありがとうございます！」</p>
          </div>
        </div>
      )}
      */}

      {/* ===== 右側（ヘッダー＋コンテンツ） ===== */}
      <div className="ml-16 flex min-h-screen flex-1 flex-col">
        {/* 上部に固定される検索バー */}
        <header className="fixed left-16 right-0 top-0 z-40 h-[76px] border-b bg-white/90 backdrop-blur">
          <div className="mx-auto flex h-full w-full max-w-7xl items-center gap-4 px-6 py-3">
            {/* ページ上部を占有する検索入力 */}
            <form onSubmit={onSearchSubmit} className="relative flex-1">
            <div
              className={`flex items-center rounded-full bg-gray-100 px-5 py-3 shadow-inner ${
                searchEnabled ? "" : "opacity-60"
              }`}
            >
              <MagnifyingGlassIcon className="mr-3 h-5 w-5 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) =>
                  searchEnabled ? onSearchChange(e.target.value) : null
                }
                onFocus={() => searchEnabled && onSearchFocus()}
                className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
                disabled={!searchEnabled}
              />
              {searchEnabled && searchValue && (
                <button
                  type="button"
                  onClick={() => {
                    onClearSearch();
                    onCloseSearchSuggestions();
                    searchInputRef.current?.focus();
                  }}
                  className="ml-2 rounded-full bg-transparent p-1 text-gray-500 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  aria-label="検索をクリア"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              )}
            </div>

              {shouldShowSuggestions && (
                <div className="absolute left-0 right-0 top-[calc(100%+12px)] z-50 max-h-[60vh] overflow-y-auto overscroll-contain rounded-xl border border-gray-200 bg-white shadow-lg">
                  {searchHistory.length > 0 && (
                    <div className="border-b border-gray-100 p-2">
                      <p className="px-3 py-1 text-xs text-gray-500">
                        最近の検索
                      </p>
                      {searchHistory.map((history, idx) => (
                        <button
                          key={`${history}-${idx}`}
                          type="button"
                          onClick={() => handleSuggestionSelect(history)}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-50"
                        >
                          <ClockIcon className="h-4 w-4 text-gray-400" />
                          {history}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="p-2">
                    <p className="px-3 py-1 text-xs text-gray-500">
                      よく使うキーワード
                    </p>
                    <div className="flex flex-wrap gap-2 px-3 pb-2">
                      {popularKeywords.map((keyword) => (
                        <button
                          key={keyword}
                          type="button"
                          onClick={() => handleSuggestionSelect(keyword)}
                          className="rounded-full bg-gray-100 px-3 py-1.5 text-xs transition-colors hover:bg-gray-200"
                        >
                          {keyword}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </form>

            {/* 右端：プロフィール / ログイン */}
            <button
              type="button"
              className="relative ml-2 flex h-10 items-center gap-2 rounded-full bg-gray-900 px-3 py-1 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 disabled:opacity-60"
              title={user ? "プロフィール" : "ログイン / 新規登録"}
              onClick={handleProfileClick}
              disabled={!authReady}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-base font-bold uppercase">
                {user ? userInitial : "↗"}
              </span>
              <div className="flex flex-col items-start leading-tight">
                <span className="text-xs text-white/70">
                  {user ? "ようこそ" : "ログイン / 登録"}
                </span>
                <span className="text-xs font-semibold">
                  {user ? userLabel : "Firebase Auth"}
                </span>
              </div>
            </button>
          </div>
        </header>

        {/* メインコンテンツ */}
        <main className="flex-1" style={{ paddingTop: `${PANEL_TOP_OFFSET}px` }}>
          {children}
        </main>
      </div>

      {shouldShowSuggestions && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => {
            onCloseSearchSuggestions();
            closeProfilePanel();
          }}
        />
      )}

      {user && showProfilePanel && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={closeProfilePanel}
          />
          <div className="fixed right-4 top-16 z-50 w-96 rounded-3xl bg-white shadow-2xl ring-1 ring-gray-200">
            <div className="flex items-center gap-4 border-b border-gray-100 px-6 py-5">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-900 text-lg font-bold text-white">
                {userInitial}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">{userLabel}</p>
                {user?.email && (
                  <p className="text-xs text-gray-500">{user.email}</p>
                )}
              </div>
            <button
              type="button"
              className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              onClick={() => {
                if (activeSection === "home") {
                  onHomeClick();
                } else {
                  onNavigate("home");
                }
                closeProfilePanel();
              }}
            >
              ホームへ
            </button>
            </div>

            <div className="space-y-3 px-6 py-4">
              <p className="text-sm font-semibold text-gray-800">保存したアイデア</p>
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-600">
                保存したアイテムがここに表示されます。
              </div>
              <button
                type="button"
                className="w-full rounded-full bg-gray-900 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-800"
                onClick={() => {
                  closeProfilePanel();
                  onLogout();
                }}
              >
                ログアウト
              </button>
            </div>
          </div>
        </>
      )}
      <PolicyModal
        open={showPolicyModal}
        tab={policyTab}
        onClose={() => setShowPolicyModal(false)}
        onTabChange={setPolicyTab}
      />
    </div>
  );
}

const TERMS_SECTIONS = [
  {
    title: "第1条（本サービスの概要）",
    content: [
      "Enso は、ユーザーが外部サイトの 3D モデルの「URL を投稿して共有する」Pinterest型のキュレーションサービスです。",
      "当社が合法的に取得可能な API（例：Thingiverse API / NASA API など）を通じて取得したメタデータ（タイトル・画像・URL 等）を表示する場合があります。",
      "本サービスでは以下を行います：",
    ],
    list: [
      "外部サイトの 3D モデルページへのリンク表示",
      "サムネイル画像やタイトルの表示（外部サイトに帰属）",
      "ユーザー投稿による URL コレクション（ボード）作成",
      "当社による合法API経由のデータ収集",
      "AIを使用した英日翻訳およびタグ生成",
      "広告配信（Google AdSense 等）による収益化",
    ],
  },
  {
    title: "第2条（外部サイトの著作権・リンクの扱い）",
    content: [
      "本サービスに表示される画像・タイトル・説明文などの外部サイトのコンテンツは、すべて各サイトの著作権者に帰属します。",
      "本サービスは「外部サイトページへのリンク」「サムネイルとしての引用表示」を行うものであり、3Dモデルデータ（STL等）は一切保持しません。",
      "外部サイトの規約に基づき、Thingiverse API・NASA・Smithsonian 等、合法的にデータ取得を許可しているサービスのみを使用します。",
      "外部サイトの画像・タイトルなどの引用は、著作権法第32条（引用）および API ライセンス範囲内で行います。",
      "当社はユーザーが外部サイトへ誘導するだけであり、外部サイトの著作物を販売・再配布するものではありません。",
      "広告収入の取得は、本規約と各サイトのAPI利用条件に適合する範囲で行います。",
    ],
  },
  {
    title: "第3条（ユーザー投稿）",
    list: [
      "ユーザーは外部サイトの URL を投稿できます。",
      "投稿された URL の内容（著作権やライセンス）は、投稿者の責任で確認するものとします。",
      "ユーザーは、第三者の権利を侵害しない形で URL を投稿してください。",
      "侵害の疑いがある投稿は、当社の判断により削除することがあります。",
    ],
  },
  {
    title: "第4条（AI翻訳・タグ生成について）",
    content: [
      "本サービスでは OpenAI などの AI API を以下の目的で利用します：",
    ],
    list: [
      "英語タイトルの日本語翻訳（title_ja）",
      "タグ（tags_ja / tags_en）の自動生成",
      "検索精度向上のための意味解析（クエリ拡張）",
      "AIの出力は正確性を保証するものではなく、ユーザーの自己判断で利用するものとします。",
    ],
  },
  {
    title: "第5条（利用者の年齢）",
    content: [
      "未成年の方は年齢に関わらず、保護者の同意を得たうえで利用してください。",
      "保護者の同意が確認できない場合、本サービスの利用をお断りする場合があります。",
    ],
  },
  {
    title: "第6条（ログイン）",
    list: [
      "Google アカウント",
      "Apple アカウント",
      "メールアドレス（パスワード方式）",
      "ログイン情報の管理はユーザー自身の責任とします。",
    ],
  },
  {
    title: "第7条（ユーザーのボード・コレクション）",
    list: [
      "ユーザーが作成したボードは公開設定の場合、他のユーザーに表示されます。",
      "非公開設定も将来的に選択できます。",
      "運営は著作権・不適切内容・スパム対策のため、必要に応じて閲覧制限・削除を行う権利を有します。",
    ],
  },
  {
    title: "第8条（禁止事項）",
    list: [
      "著作権・商標権を侵害する URL の投稿",
      "外部サイトの画像を無断でダウンロード・再配布する行為",
      "スクレイピング・自動収集の無許可実行",
      "虚偽情報の投稿",
      "違法・暴力・性的・差別的内容の投稿",
      "外部サイトの規約に反する行為",
      "他者になりすます行為",
      "当社の運営を妨害する行為",
    ],
  },
  {
    title: "第9条（広告について）",
    content: [
      "本サービスは Google AdSense などの広告を掲載します。",
      "広告により取得されるデータの扱いは、Google のプライバシーポリシーに従います。",
    ],
  },
  {
    title: "第10条（免責事項）",
    list: [
      "本サービスは外部リンク集であり、掲載情報の正確性・合法性は保証しません。",
      "外部リンク先の内容について、当社は責任を負いません。",
      "AIで生成された翻訳・タグの正確性も保証しません。",
      "ユーザー間のトラブルは当事者間で解決するものとします。",
      "サービスは予告なく変更・停止されることがあります。",
    ],
  },
  {
    title: "第11条（データの取り扱い）",
    list: [
      "Firebase 等のクラウドサービスを使用し、以下を保存します：ユーザーアカウント情報、投稿URL・ボード情報、翻訳済みタイトル・タグ、ログデータ。",
      "当社は個人情報を適切に取り扱い、第三者に提供することはありません。",
    ],
  },
  {
    title: "第12条（規約の改定）",
    content: [
      "当社は必要に応じ本規約を変更できます。",
      "重大な変更を行う場合、本サービス内で事前に通知します。",
    ],
  },
  {
    title: "第13条（準拠法）",
    content: ["本規約は日本法に準拠します。"],
  },
];
const PRIVACY_SECTIONS = [
  {
    title: "第1条（収集する情報）",
    content: ["当社は以下の情報を取得・保存します。"],
    list: [
      "ログイン情報（Google・Apple・メールのユーザーID/メールアドレス/アイコン）",
      "ユーザー投稿情報（URL、ボード、タイトル、タグ）",
      "アクセスログ（IP、OS、ブラウザ、日時、検索クエリ、閲覧・クリック履歴、広告情報）",
      "AI API で使用するタイトル/翻訳/タグ（個人情報は含みません）",
    ],
  },
  {
    title: "第2条（情報の利用目的）",
    list: [
      "ログイン認証・投稿データの保存/表示・検索機能",
      "利用データ分析によるサービス/UX改善",
      "スパム投稿やなりすまし対策",
      "広告配信（Google AdSense 等）の最適化・レポート",
      "法令遵守（違法投稿・利用規約違反の調査）",
    ],
  },
  {
    title: "第3条（第三者提供）",
    list: [
      "ユーザーの同意がある場合",
      "法令に基づく場合",
      "緊急時（生命・財産保護）",
      "Google・OpenAI・Firebase などの委託先（目的外利用禁止）",
    ],
  },
  {
    title: "第4条（Cookie・広告識別子について）",
    list: [
      "Cookie / Google AdSense / Google Analytics / Firebase Analytics を利用",
      "広告最適化や行動分析のために活用",
      "Cookie を拒否すると一部機能が制限されます。",
    ],
  },
  {
    title: "第5条（外部サイトのリンクについて）",
    content: [
      "Thingiverse / Cults3D / Printables 等へのリンク集です。",
      "外部サイトの内容・プライバシーには責任を負いません。",
      "リンク先の規約・ポリシーを確認してください。",
    ],
  },
  {
    title: "第6条（データの保存期間）",
    list: [
      "アカウント削除申請時",
      "不正利用確認時",
      "利用目的達成後、合理的期間経過後に削除",
      "Firebase 上のデータは削除後に復元されません。",
    ],
  },
  {
    title: "第7条（ユーザーの権利）",
    list: [
      "アカウント削除",
      "投稿削除",
      "保存データ閲覧請求",
      "プライバシーに関する問い合わせ",
    ],
  },
  {
    title: "第8条（未成年の利用）",
    content: [
      "未成年の方は必ず保護者の同意を得て利用してください。",
      "同意が得られない場合は利用を控えてください。",
    ],
  },
  {
    title: "第9条（安全管理措置）",
    list: [
      "Firebase Security Rules によるアクセス制限",
      "HTTPS 通信による暗号化",
      "アクセスログ監視・不正アクセス対策",
      "外部APIへの個人情報送信禁止",
    ],
  },
  {
    title: "第10条（ポリシーの変更）",
    content: [
      "必要に応じて本ポリシーを変更します。",
      "重大な変更がある場合は通知します。",
    ],
  },
  {
    title: "第11条（お問い合わせ窓口）",
    content: ["📩 enso.corporation11@gmail.com"],
  },
];

function PolicyModal({ open, tab, onClose, onTabChange }) {
  if (!open) return null;

  const sections = tab === "privacy" ? PRIVACY_SECTIONS : TERMS_SECTIONS;
  const tabButtonClass = (value) =>
    `rounded-full px-4 py-2 text-sm font-semibold ${
      tab === value ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-50"
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-6">
      <div className="relative w-full max-w-4xl overflow-hidden rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-black/10">
        <button
          type="button"
          className="absolute right-4 top-4 text-gray-400 transition hover:text-gray-600"
          onClick={onClose}
          aria-label="ポリシーを閉じる"
        >
          ×
        </button>
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-semibold text-gray-900">Enso ポリシー</h2>
          <div className="flex gap-2">
            <button type="button" className={tabButtonClass("terms")} onClick={() => onTabChange("terms")}>
              利用規約
            </button>
            <button type="button" className={tabButtonClass("privacy")} onClick={() => onTabChange("privacy")}>
              プライバシーポリシー
            </button>
          </div>
        </div>
        <p className="mt-2 text-sm text-gray-500">
          本サービスを利用することで、本規約・本ポリシーに同意したものとみなします。
        </p>
        <div className="mt-5 space-y-5 overflow-y-auto pr-3" style={{ maxHeight: "70vh" }}>
          {sections.map((section) => (
            <article key={section.title} className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900">{section.title}</h3>
              {section.content?.map((paragraph) => (
                <p key={paragraph} className="text-sm leading-relaxed text-gray-600">
                  {paragraph}
                </p>
              ))}
              {section.list && (
                <ul className="list-disc space-y-1 pl-6 text-sm text-gray-600">
                  {section.list.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
        <p className="mt-5 text-xs text-gray-400">【以上】</p>
      </div>
    </div>
  );
}
