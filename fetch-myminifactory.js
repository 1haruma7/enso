#!/usr/bin/env node

/**
 * MyMiniFactory データ取得スクリプト
 *
 * 注意: このスクリプトはデモ用です。
 * 実際に使用する前に、MyMiniFactory の robots.txt と利用規約を確認してください。
 *
 * 使用方法:
 *   npm run fetch:myminifactory
 */

import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OUTPUT_FILE = join(__dirname, "../src/data/MyMiniFactory.json");

// データ仕様に基づく正規化関数
function normalize(item, index) {
  return {
    id: index,
    title: item?.title || item?.name || "Untitled",
    source: "MyMiniFactory",
    image_url: item?.image_url || item?.thumbnail || item?.preview || null,
    source_url: item?.source_url || item?.url || null,
  };
}

async function fetchMyMiniFactory() {
  console.log("🔍 MyMiniFactory データを取得中...\n");

  try {
    // 注意: 公開APIがある場合はそちらを利用してください。
    // 以下はデモ用のサンプルデータ生成です。
    const sampleData = [
      {
        title: "チェス駒セット",
        image_url: "https://placehold.co/400x400?text=Chess+Set",
        source_url: "https://www.myminifactory.com/object/3d-print-123456",
        site: "MyMiniFactory",
      },
      {
        title: "ペンスタンド",
        image_url: "https://placehold.co/400x400?text=Pen+Stand",
        source_url: "https://www.myminifactory.com/object/3d-print-234567",
        site: "MyMiniFactory",
      },
      {
        title: "フラワーポット",
        image_url: "https://placehold.co/400x400?text=Flower+Pot",
        source_url: "https://www.myminifactory.com/object/3d-print-345678",
        site: "MyMiniFactory",
      },
      {
        title: "ドラゴンフィギュア",
        image_url: "https://placehold.co/400x400?text=Dragon+Figure",
        source_url: "https://www.myminifactory.com/object/3d-print-456789",
        site: "MyMiniFactory",
      },
      {
        title: "デスクオーガナイザー",
        image_url: "https://placehold.co/400x400?text=Desk+Organizer",
        source_url: "https://www.myminifactory.com/object/3d-print-567890",
        site: "MyMiniFactory",
      },
      {
        title: "ケーブルクリップ",
        image_url: "https://placehold.co/400x400?text=Cable+Clip",
        source_url: "https://www.myminifactory.com/object/3d-print-678901",
        site: "MyMiniFactory",
      },
      {
        title: "ゲームコントローラースタンド",
        image_url: "https://placehold.co/400x400?text=Controller+Stand",
        source_url: "https://www.myminifactory.com/object/3d-print-789012",
        site: "MyMiniFactory",
      },
      {
        title: "イヤホンホルダー",
        image_url: "https://placehold.co/400x400?text=Earphone+Holder",
        source_url: "https://www.myminifactory.com/object/3d-print-890123",
        site: "MyMiniFactory",
      },
    ];

    console.log("📝 サンプルデータを生成します...\n");

    // 正規化
    const normalized = sampleData.map((item, index) => normalize(item, index));

    // JSONファイルに書き込み
    writeFileSync(OUTPUT_FILE, JSON.stringify(normalized, null, 2), "utf-8");

    console.log(`✅ ${normalized.length} 件のデータを取得しました`);
    console.log(`📁 保存先: ${OUTPUT_FILE}\n`);

    // データ仕様の確認
    console.log("📋 データ仕様チェック:");
    normalized.forEach((item, idx) => {
      console.log(`  ${idx + 1}. ${item.title} (${item.source})`);
      console.log(`     - image_url: ${item.image_url ? "✓" : "✗"}`);
      console.log(`     - source_url: ${item.source_url ? "✓" : "✗"}`);
    });

    console.log("\n✨ 完了！アプリをリロードして新データを確認してください。\n");
  } catch (error) {
    console.error("❌ エラーが発生しました:", error.message);
    process.exit(1);
  }
}

// 実行
fetchMyMiniFactory();
