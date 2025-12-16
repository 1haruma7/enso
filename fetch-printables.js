#!/usr/bin/env node

/**
 * Printables データ取得スクリプト
 * 
 * 注意: このスクリプトは Printables のデータを取得します。
 * 実際に使用する前に、Printables の robots.txt と利用規約を確認してください。
 * 
 * 使用方法:
 *   npm run fetch:printables
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OUTPUT_FILE = join(__dirname, '../src/data/Printables.json');

// データ仕様に基づく正規化関数
function normalize(item, index) {
  return {
    id: index,
    title: item?.title || item?.name || "Untitled",
    source: "Printables",
    image_url: item?.image_url || item?.thumbnail || item?.preview || null,
    source_url: item?.source_url || item?.url || null,
  };
}

async function fetchPrintables() {
  console.log('🔍 Printables データを取得中...\n');

  // より実用的なサンプルデータを生成
  // 実際のスクレイピングを実装する場合は、robots.txt と利用規約を確認してください
  const sampleData = [
    {
      title: "ドローンフレーム",
      image_url: "https://placehold.co/400x400?text=Drone+Frame",
      source_url: "https://www.printables.com/model/123456-drone-frame",
      site: "Printables"
    },
    {
      title: "スマホスタンド",
      image_url: "https://placehold.co/400x400?text=Phone+Stand",
      source_url: "https://www.printables.com/model/789012-phone-stand",
      site: "Printables"
    },
    {
      title: "ケーブルオーガナイザー",
      image_url: "https://placehold.co/400x400?text=Cable+Organizer",
      source_url: "https://www.printables.com/model/345678-cable-organizer",
      site: "Printables"
    },
    {
      title: "フィギュアスタンド",
      image_url: "https://placehold.co/400x400?text=Figure+Stand",
      source_url: "https://www.printables.com/model/456789-figure-stand",
      site: "Printables"
    },
    {
      title: "ツールボックス",
      image_url: "https://placehold.co/400x400?text=Toolbox",
      source_url: "https://www.printables.com/model/567890-toolbox",
      site: "Printables"
    },
    {
      title: "ペン立て",
      image_url: "https://placehold.co/400x400?text=Pen+Holder",
      source_url: "https://www.printables.com/model/678901-pen-holder",
      site: "Printables"
    },
    {
      title: "キーボードスタンド",
      image_url: "https://placehold.co/400x400?text=Keyboard+Stand",
      source_url: "https://www.printables.com/model/789012-keyboard-stand",
      site: "Printables"
    },
    {
      title: "本立て",
      image_url: "https://placehold.co/400x400?text=Book+Stand",
      source_url: "https://www.printables.com/model/890123-book-stand",
      site: "Printables"
    }
  ];

  try {
    // 実際のスクレイピングを実装する場合は、以下のコードを有効化してください
    /*
    const searchUrl = 'https://www.printables.com/model';
    
    console.log(`📡 ${searchUrl} からデータを取得中...`);
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    
    // HTMLからデータを抽出（簡易版）
    // 実際の実装では、より堅牢なパーサー（例: cheerio, jsdom）を使用することを推奨
    const items = [];
    
    // サンプル: HTMLからモデル情報を抽出するロジック
    // 実際のHTML構造に合わせて調整が必要
    const titleMatches = html.match(/<h[23][^>]*>([^<]+)<\/h[23]>/gi) || [];
    const imageMatches = html.match(/<img[^>]+src="([^"]+)"[^>]*>/gi) || [];
    const linkMatches = html.match(/<a[^>]+href="(\/model\/[^"]+)"[^>]*>/gi) || [];
    
    // 実際のデータが取得できた場合
    if (items.length > 0) {
      const normalized = items.map((item, index) => normalize(item, index));
      writeFileSync(OUTPUT_FILE, JSON.stringify(normalized, null, 2), 'utf-8');
      console.log(`✅ ${normalized.length} 件のデータを取得しました`);
      return;
    }
    */
    
    // デモ用: サンプルデータを使用
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
    console.log('💡 実際のスクレイピングを実装する場合は、スクリプト内のコメントアウト部分を有効化してください。\n');

  } catch (error) {
    console.error('❌ エラーが発生しました:', error.message);
    process.exit(1);
  }
}

// 実行
fetchPrintables();

