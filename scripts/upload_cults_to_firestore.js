#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import admin from "firebase-admin";

const DEFAULT_DATA_PATH = "src/data/cults_creations.json";
const DEFAULT_COLLECTION = "cults_creations";
const DEFAULT_BATCH_SIZE = 400;

function printUsage() {
  console.log(`
Usage: npm run upload:cults -- [options]

Options:
  --data <path>         Path to the JSON file to upload (default: src/data/cults_creations.json)
  --collection <name>   Firestore collection name to write into (default: cults_creations)
  --credentials <path>  Path to a Firebase service account JSON file (or rely on GOOGLE_APPLICATION_CREDENTIALS/FIREBASE_SERVICE_ACCOUNT)
  --batch-size <n>      Number of documents to write per batch (default: 400)
  --dry-run             Parse the JSON and report how many documents would be written without touching Firestore
  --help                Show this help message
`.trim());
}

function parseArgs() {
  const args = {
    data: null,
    collection: null,
    credentials: null,
    batchSize: null,
    dryRun: false,
    help: false,
  };

  const tokens = process.argv.slice(2);
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === "--help") {
      args.help = true;
      break;
    }
    if (token === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (token === "--data" && tokens[index + 1]) {
      args.data = tokens[++index];
      continue;
    }
    if (token === "--collection" && tokens[index + 1]) {
      args.collection = tokens[++index];
      continue;
    }
    if (token === "--credentials" && tokens[index + 1]) {
      args.credentials = tokens[++index];
      continue;
    }
    if (token === "--batch-size" && tokens[index + 1]) {
      args.batchSize = Number(tokens[++index]);
      continue;
    }
    console.warn(`Unknown option: ${token}`);
  }
  return args;
}

function resolvePath(value) {
  if (!value) return null;
  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
}

function computeDocId(entry, index) {
  const candidates = [
    entry?.source_url,
    entry?.image_url,
    entry?.title_en,
    entry?.title,
    entry?.name,
    entry?.title_ja,
    entry?.id,
  ].filter(Boolean);
  if (candidates.length === 0) {
    candidates.push(`item-${index}`);
  }
  const key = candidates.join("||");
  return crypto.createHash("sha256").update(key).digest("hex");
}

async function loadJson(filePath) {
  const content = await fs.readFile(filePath, "utf-8");
  return JSON.parse(content);
}

async function main() {
  const parsedArgs = parseArgs();
  if (parsedArgs.help) {
    printUsage();
    process.exit(0);
  }

  const credentialsSource =
    parsedArgs.credentials ??
    process.env.FIREBASE_SERVICE_ACCOUNT ??
    process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!credentialsSource) {
    console.error(
      "Firebase credentials not provided. Set FIREBASE_SERVICE_ACCOUNT, GOOGLE_APPLICATION_CREDENTIALS, or pass --credentials."
    );
    process.exit(1);
  }

  const credentialsPath = resolvePath(credentialsSource);
  if (!credentialsPath) {
    console.error("Failed to resolve credentials path.");
    process.exit(1);
  }

  const dataPath = resolvePath(parsedArgs.data ?? DEFAULT_DATA_PATH);
  const collectionName =
    parsedArgs.collection ?? process.env.CULTS_COLLECTION ?? DEFAULT_COLLECTION;
  const batchSize =
    parsedArgs.batchSize && parsedArgs.batchSize > 0
      ? Math.floor(parsedArgs.batchSize)
      : DEFAULT_BATCH_SIZE;

  console.log("Preparing to upload cults dataset...");
  console.log(`- JSON source: ${dataPath}`);
  console.log(`- Firestore collection: ${collectionName}`);
  console.log(`- Credentials: ${credentialsPath}`);
  console.log(`- Batch size: ${batchSize}`);
  if (parsedArgs.dryRun) {
    console.log("- Running in dry-run mode (no writes will occur)");
  }

  const rawCredentials = await fs.readFile(credentialsPath, "utf-8");
  const serviceAccount = JSON.parse(rawCredentials);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  const db = admin.firestore();
  const collectionRef = db.collection(collectionName);

  const json = await loadJson(dataPath);
  if (!Array.isArray(json)) {
    throw new Error(`${dataPath} did not contain a JSON array`);
  }

  const entries = json.filter((item) => item && typeof item === "object");
  if (!entries.length) {
    console.log("No valid entries to upload. Exiting.");
    return;
  }

  let totalProcessed = 0;
  let batch = db.batch();
  let pending = 0;
  const seenIds = new Set();

  for (let index = 0; index < entries.length; index += 1) {
    const item = entries[index];
    const docId = computeDocId(item, index);
    if (seenIds.has(docId)) {
      continue;
    }
    seenIds.add(docId);

    const docRef = collectionRef.doc(docId);
    const dataToWrite = {
      ...item,
      syncedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (!parsedArgs.dryRun) {
      batch.set(docRef, dataToWrite, { merge: true });
      pending += 1;
    }
    totalProcessed += 1;

    if (!parsedArgs.dryRun && pending >= batchSize) {
      await batch.commit();
      console.log(`Committed ${totalProcessed} documents so far...`);
      batch = db.batch();
      pending = 0;
    }
  }

  if (!parsedArgs.dryRun && pending > 0) {
    await batch.commit();
  }

  if (parsedArgs.dryRun) {
    console.log(`[dry-run] Processed ${totalProcessed} documents. No writes were performed.`);
  } else {
    console.log(
      `Finished uploading ${totalProcessed} documents into Firestore collection '${collectionName}'.`
    );
  }
}

main().catch((error) => {
  console.error("Upload failed:", error);
  process.exit(1);
});
