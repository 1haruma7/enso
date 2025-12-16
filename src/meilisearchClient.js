import { MeiliSearch } from "meilisearch";

const host = (import.meta.env.VITE_MEILISEARCH_HOST || "").trim();
const apiKey = (import.meta.env.VITE_MEILISEARCH_API_KEY || "").trim();
const indexName =
  (import.meta.env.VITE_MEILISEARCH_INDEX || "enso-models").trim();

const hasConfig = Boolean(host && indexName);
const client = hasConfig ? new MeiliSearch({ host, apiKey }) : null;

export const isMeilisearchConfigured = () => hasConfig;

export async function searchMeilisearch(query, options = {}) {
  if (!hasConfig || !client || !query.trim()) {
    return { hits: [] };
  }

  const index = client.index(indexName);
  return index.search(query, {
    limit: 200,
    attributesToRetrieve: ["*"],
    ...options,
  });
}

export const getMeilisearchConfig = () => ({
  host,
  apiKey,
  indexName,
});
