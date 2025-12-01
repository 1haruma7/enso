import { useEffect, useState } from "react";

export default function AuthModal({
  open = false,
  mode = "login",
  onModeChange = () => {},
  onClose = () => {},
  onSubmit = () => {},
  loading = false,
  error = "",
  onSocialLogin = () => {},
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (!open) return;
    setEmail("");
    setPassword("");
    setDisplayName("");
  }, [mode, open]);

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      mode,
      email: email.trim(),
      password,
      displayName: displayName.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <button
          type="button"
          className="absolute right-4 top-4 text-gray-400 transition hover:text-gray-600"
          onClick={onClose}
          aria-label="閉じる"
        >
          ×
        </button>

        <div className="border-b border-gray-100 px-6 pt-6 pb-4">
          <div className="flex gap-2 text-xs font-semibold text-gray-500">
            <button
              type="button"
              className={`rounded-full px-3 py-1 transition ${
                mode === "login"
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
              onClick={() => onModeChange("login")}
            >
              ログイン
            </button>
            <button
              type="button"
              className={`rounded-full px-3 py-1 transition ${
                mode === "signup"
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
              onClick={() => onModeChange("signup")}
            >
              新規登録
            </button>
          </div>
          <h2 className="mt-3 text-xl font-semibold text-gray-900">
            {mode === "login" ? "ようこそ、ログインしてください" : "アカウントを作成"}
          </h2>
          <p className="text-sm text-gray-500">
            メールアドレスとパスワードでサインインできます。
          </p>
        </div>

        <div className="space-y-3 px-6 pb-2 pt-4">
          <button
            type="button"
            disabled={loading}
            onClick={() => onSocialLogin("google")}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-gray-700">
              G
            </span>
            Google で続行
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => onSocialLogin("apple")}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black text-xs font-bold text-white">
              A
            </span>
            Apple で続行
          </button>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <div className="h-[1px] flex-1 bg-gray-200" />
            <span>または</span>
            <div className="h-[1px] flex-1 bg-gray-200" />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 pb-6">
          {mode === "signup" && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                表示名 (任意)
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-gray-400 focus:ring-1 focus:ring-gray-200"
                placeholder="例: Yaggi ユーザー"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              メールアドレス
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-gray-400 focus:ring-1 focus:ring-gray-200"
              placeholder="you@example.com"
              autoComplete={mode === "login" ? "email" : "new-email"}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              パスワード
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-gray-400 focus:ring-1 focus:ring-gray-200"
              placeholder="6文字以上"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
            <p className="mt-1 text-xs text-gray-400">
              セキュリティのため 6 文字以上で設定してください。
            </p>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-500"
            disabled={loading}
          >
            {loading
              ? "処理中..."
              : mode === "login"
                ? "ログイン"
                : "アカウントを作成"}
          </button>

          <p className="text-center text-xs text-gray-400">
            Firebase Authentication で安全に管理されます。
          </p>
        </form>
      </div>
    </div>
  );
}
