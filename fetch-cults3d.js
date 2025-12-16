#!/usr/bin/env node

/**
 * Cults3D データ取得スクリプト
 * 
 * 注意: このスクリプトは Cults3D のデータを取得します。
 * 実際に使用する前に、Cults3D の robots.txt と利用規約を確認してください。
 * 
 * 使用方法:
 *   npm run fetch:cults3d
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OUTPUT_FILE = join(__dirname, '../src/data/cults_creations.json');

// データ仕様に基づく正規化関数
function normalize(item, index) {
  return {
    id: index,
    title: item?.title || item?.name || "Untitled",
    source: "Cults3D",
    image_url: item?.image_url || item?.thumbnail || item?.preview || null,
    source_url: item?.source_url || item?.url || null,
    description: item?.description || item?.body || "",
  };
}

async function fetchCults3D() {
  console.log('🔍 Cults3D データを取得中...\n');

  // より実用的なサンプルデータを生成
  // 実際のスクレイピングを実装する場合は、robots.txt と利用規約を確認してください
  const sampleData = [
    {
      title: "ツールホルダー",
      image_url: "https://placehold.co/400x400?text=Tool+Holder",
      source_url: "https://cults3d.com/en/3d-model/tool-holder",
      site: "Cults3D",
      description: "デスクまわりに置ける小物入れ。工具やペンを立てられます。"
    },
    {
      title: "デスクオーガナイザー",
      image_url: "https://placehold.co/400x400?text=Desk+Organizer",
      source_url: "https://cults3d.com/en/3d-model/desk-organizer",
      site: "Cults3D",
      description: "書類や小物の置き場所を整理するトレーと仕切りのセットです。"
    },
    {
      title: "スマートフォンケース",
      image_url: "https://placehold.co/400x400?text=Phone+Case",
      source_url: "https://cults3d.com/en/3d-model/phone-case",
      site: "Cults3D",
      description: "衝撃に強く持ちやすい形状のカスタムケース。カメラ穴付き。"
    },
    {
      title: "フィギュアベース",
      image_url: "https://placehold.co/400x400?text=Figure+Base",
      source_url: "https://cults3d.com/en/3d-model/figure-base",
      site: "Cults3D",
      description: "キャラクターフィギュアを飾るための装飾的な台座。高さ調整も可。"
    },
    {
      title: "本立て",
      image_url: "https://placehold.co/400x400?text=Book+Stand",
      source_url: "https://cults3d.com/en/3d-model/book-stand",
      site: "Cults3D",
      description: "複数の書籍をしっかり支える滑り止め付きのブックエンド。"
    },
    {
      title: "ランプシェード",
      image_url: "https://placehold.co/400x400?text=Lamp+Shade",
      source_url: "https://cults3d.com/en/3d-model/lamp-shade",
      site: "Cults3D",
      description: "光の透過をコントロールするレトロなデザインのランプシェード。"
    },
    {
      title: "花瓶",
      image_url: "https://placehold.co/400x400?text=Vase",
      source_url: "https://cults3d.com/en/3d-model/vase",
      site: "Cults3D",
      description: "水草や花を飾るための細身の花器。底面の安定性も確保。"
    },
    {
      title: "時計スタンド",
      image_url: "https://placehold.co/400x400?text=Clock+Stand",
      source_url: "https://cults3d.com/en/3d-model/clock-stand",
      site: "Cults3D",
      description: "スマートウォッチなどを置いておける角度付きのスタンド。"
    }
  ];

  try {
    // 実際のスクレイピングを実装する場合は、以下のコードを有効化してください
    /*
    const searchUrl = 'https://cults3d.com/en/3d-models';
    
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
    const linkMatches = html.match(/<a[^>]+href="(\/en\/3d-model\/[^"]+)"[^>]*>/gi) || [];
    
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
fetchCults3D();
