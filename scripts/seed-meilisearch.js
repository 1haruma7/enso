#!/usr/bin/env node

import { readFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { MeiliSearch } from "meilisearch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MEILI_HOST = process.env.MEILISEARCH_HOST || "http://127.0.0.1:7700";
const MEILI_KEY =
  process.env.MEILISEARCH_MASTER_KEY ||
  process.env.MEILISEARCH_API_KEY ||
  process.env.MEILISEARCH_KEY ||
  "";
const MEILI_INDEX = process.env.MEILISEARCH_INDEX || "enso-models";

const DATA_PATH = join(__dirname, "../src/data/cults_creations.json");

const safeArray = (value) => (Array.isArray(value) ? value : []);

const normalizeDocument = (item, index) => {
  const tags = Array.from(
    new Set([
      ...safeArray(item.tags_en),
      ...safeArray(item.tags_ja),
      ...safeArray(item.tags),
    ])
  );
  return {
    id:
      item.id ||
      item.source_url ||
      item.image_url ||
      `model-${index}-${Math.random().toString(36).slice(2, 8)}`,
    title: item.title || item.title_en || item.title_ja || "Untitled",
    title_en: item.title_en || item.title || "",
    title_ja: item.title_ja || item.title || "",
    source: item.site || item.source || item.source_name || "Unknown",
    source_url: item.source_url || item.url || "",
    image_url:
      item.image_url || item.thumbnail || item.preview || item.image_url || "",
    price: item.price || "",
    is_free: typeof item.is_free === "boolean" ? item.is_free : null,
    tags,
    tags_en: safeArray(item.tags_en),
    tags_ja: safeArray(item.tags_ja),
    description_en: item.description_en || "",
    description_ja: item.description_ja || "",
  };
};

async function main() {
  console.log(`Loading dataset from ${DATA_PATH}`);
  const raw = await readFile(DATA_PATH, "utf-8");
  const dataset = JSON.parse(raw);
  if (!Array.isArray(dataset) || dataset.length === 0) {
    console.error("Dataset is empty or malformed.");
    process.exit(1);
  }

  const documents = dataset.map(normalizeDocument);
  const client = new MeiliSearch({ host: MEILI_HOST, apiKey: MEILI_KEY });
  const index = client.index(MEILI_INDEX);

  console.log(`Clearing existing documents in index "${MEILI_INDEX}"...`);
  const deleteTask = await index.deleteAllDocuments();
  await index.waitForPendingUpdate(deleteTask.updateId);

  try {
    await index.updatePrimaryKey("id");
  } catch (error) {
    if (!/primary key is already defined/i.test(error?.message || "")) {
      console.warn("Unable to update primary key:", error?.message);
    }
  }

  console.log(
    `Pushing ${documents.length} documents to "${MEILI_INDEX}" at ${MEILI_HOST}`
  );
  const update = await index.addDocuments(documents);
  await index.waitForPendingUpdate(update.updateId);

  console.log("Meilisearch seed complete!");
  console.log(
    "Restart your dev server if it is running so trees can pick up the refreshed search index."
  );
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
