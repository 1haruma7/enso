#!/usr/bin/env node

/**
 * Thingiverse データ取得スクリプト
 * 
 * 注意: このスクリプトはデモ用です。
 * 実際に使用する前に、Thingiverse の robots.txt と利用規約を確認してください。
 * 
 * 使用方法:
 *   npm run fetch:thingiverse
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OUTPUT_FILE = join(__dirname, '../src/data/Thingiverse.json');

// データ仕様に基づく正規化関数
function normalize(item, index) {
  return {
    id: index,
    title: item?.title || item?.name || "Untitled",
    source: "Thingiverse",
    image_url: item?.image_url || item?.thumbnail || item?.preview || null,
    source_url: item?.source_url || item?.url || null,
  };
}

async function fetchThingiverse() {
  console.log('🔍 Thingiverse データを取得中...\n');

  try {
    // 注意: Thingiverse の公開APIがある場合はそれを使用してください
    // この例では、サンプルデータを生成しています
    
    // 実際のスクレイピング実装例（コメントアウト）
    /*
    const response = await fetch('https://www.thingiverse.com/explore/newest');
    const html = await response.text();
    // HTMLをパースしてデータを抽出
    // ...
    */

    // より実用的なサンプルデータを生成
    // 実際のスクレイピングを実装する場合は、robots.txt と利用規約を確認してください
    const sampleData = [
      {
        title: "iPhoneスタンド",
        image_url: "https://placehold.co/400x400?text=iPhone+Stand",
        source_url: "https://www.thingiverse.com/thing:123456",
        site: "Thingiverse"
      },
      {
        title: "おもちゃの飛行機",
        image_url: "https://placehold.co/400x400?text=Toy+Airplane",
        source_url: "https://www.thingiverse.com/thing:789012",
        site: "Thingiverse"
      },
      {
        title: "ガジェットホルダー",
        image_url: "https://placehold.co/400x400?text=Gadget+Holder",
        source_url: "https://www.thingiverse.com/thing:345678",
        site: "Thingiverse"
      },
      {
        title: "ケーススタンド",
        image_url: "https://placehold.co/400x400?text=Case+Stand",
        source_url: "https://www.thingiverse.com/thing:456789",
        site: "Thingiverse"
      },
      {
        title: "フィギュアディスプレイ",
        image_url: "https://placehold.co/400x400?text=Figure+Display",
        source_url: "https://www.thingiverse.com/thing:567890",
        site: "Thingiverse"
      },
      {
        title: "キーホルダー",
        image_url: "https://placehold.co/400x400?text=Key+Holder",
        source_url: "https://www.thingiverse.com/thing:678901",
        site: "Thingiverse"
      },
      {
        title: "コインホルダー",
        image_url: "https://placehold.co/400x400?text=Coin+Holder",
        source_url: "https://www.thingiverse.com/thing:789012",
        site: "Thingiverse"
      },
      {
        title: "ペンスタンド",
        image_url: "https://placehold.co/400x400?text=Pen+Stand",
        source_url: "https://www.thingiverse.com/thing:890123",
        site: "Thingiverse"
      }
    ];

    console.log('📝 サンプルデータを生成します...\n');

    // 正規化
    const normalized = sampleData.map((item, index) => normalize(item, index));

    // JSONファイルに書き込み
    writeFileSync(OUTPUT_FILE, JSON.stringify(normalized, null, 2), 'utf-8');

    console.log(`✅ ${normalized.length} 件のデータを取得しました`);
    console.log(`📁 保存先: ${OUTPUT_FILE}\n`);

    // データ仕様の確認
    console.log('📋 データ仕様チェック:');
    normalized.forEach((item, idx) => {
      console.log(`  ${idx + 1}. ${item.title} (${item.source})`);
      console.log(`     - image_url: ${item.image_url ? '✓' : '✗'}`);
      console.log(`     - source_url: ${item.source_url ? '✓' : '✗'}`);
    });

    console.log('\n✨ 完了！アプリをリロードして新データを確認してください。\n');

  } catch (error) {
    console.error('❌ エラーが発生しました:', error.message);
    process.exit(1);
  }
}

// 実行
fetchThingiverse();

