// src/components/ModelModal.jsx
import React from "react";

export default function ModelModal({ model, onClose }) {
  if (!model) return null; // model がないときは何も表示しない

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      {/* モーダル本体 */}
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-slate-900 p-6 shadow-xl border border-slate-700">
        {/* 上部：タイトル + 閉じるボタン */}
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">
              {model.title}
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              by {model.author} ・ {model.source.toUpperCase()}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-200 hover:bg-slate-700"
          >
            ✕ 閉じる
          </button>
        </div>

        {/* 画像 */}
        <div className="mb-4 overflow-hidden rounded-xl bg-slate-800">
          {model.image ? (
            <img
              src={model.image}
              alt={model.title}
              className="w-full object-cover"
            />
          ) : (
            <div className="flex h-48 items-center justify-center text-xs text-slate-400">
              No Image
            </div>
          )}
        </div>

        {/* リンクやメタ情報 */}
        <div className="space-y-3 text-sm text-slate-200">
          {model.url && (
            <a
              href={model.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
            >
              外部サイトで開く
              <span>↗</span>
            </a>
          )}

          <div className="text-xs text-slate-400">
            <p>※ ここにあとで「説明文」「タグ」「類似モデル」などを追加していくイメージ。</p>
          </div>
        </div>
      </div>
    </div>
  );
}