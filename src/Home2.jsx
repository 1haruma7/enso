// src/pages/Home.jsx
import { useMemo, useState } from "react";
import cultsData from "./data/cults_creations.json";

export default function Home() {
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");

  // ① 各サイトのデータを1つの配列にまとめる
  const allModels = useMemo(() => {
    const normalize = (items, source) =>
      items.map((item) => ({
        id: item.id || item.url || Math.random().toString(36).slice(2),
        title: item.title || item.name || "No title",
        author: item.author || item.creator || "Unknown",
        image: item.image || item.thumbnail || null,
        url: item.url,
        source,
      }));

    return normalize(cultsData, "cults3d");
  }, []);

  // ② 検索キーワード & サイト絞り込み
  const filteredModels = useMemo(() => {
    return allModels.filter((m) => {
      const matchSource =
        sourceFilter === "all" ? true : m.source === sourceFilter;

      const q = query.toLowerCase();
      const matchQuery =
        !q ||
        m.title.toLowerCase().includes(q) ||
        m.author.toLowerCase().includes(q);

      return matchSource && matchQuery;
    });
  }, [allModels, query, sourceFilter]);

  return (
    <div className="space-y-6">
      {/* ヘッダー的な説明 */}
      <section className="space-y-2">
        <h2 className="text-2xl font-bold">
          日本版3Dモデル横断検索
          <span className="ml-2 text-sm text-gray-400">（ローカルβ）</span>
        </h2>
        <p className="text-sm text-gray-400">
          Cults3D をローカルJSONから表示します。
        </p>
      </section>

      {/* 検索エリア */}
      <section className="space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <input
            type="text"
            placeholder="キーワードで検索（例：gun、robot、chair...）"
            className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <select
            className="w-full md:w-52 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
          >
            <option value="all">すべて</option>
            <option value="cults3d">Cults3D</option>
          </select>
        </div>
        <p className="text-xs text-gray-400">
          ヒット数：{filteredModels.length}件 / 全{allModels.length}件
        </p>
      </section>

      {/* モデル一覧 */}
      <section className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {filteredModels.map((m) => (
          <a
            key={m.id}
            href={m.url}
            target="_blank"
            rel="noreferrer"
            className="group rounded-xl border border-gray-800 bg-gray-900/60 p-3 transition hover:border-blue-500 hover:bg-gray-900"
          >
            <div className="mb-2 aspect-video overflow-hidden rounded-lg bg-gray-800">
              {m.image ? (
                <img
                  src={m.image}
                  alt={m.title}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-gray-500">
                  No Image
                </div>
              )}
            </div>
            <div className="space-y-1">
              <h3 className="line-clamp-2 text-sm font-semibold">
                {m.title}
              </h3>
              <p className="text-xs text-gray-400">by {m.author}</p>
              <span className="inline-flex items-center rounded-full bg-gray-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gray-400">
                {m.source}
              </span>
            </div>
          </a>
        ))}
      </section>
    </div>
  );
}
