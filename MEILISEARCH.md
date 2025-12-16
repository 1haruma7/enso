# Enso で Meilisearch を使う

Enso から Meilisearch（`meilisearch-main` リポジトリ）に接続して検索体験を向上させるための手順です。以下の手順を順番に実行してください。

## 1. Meilisearch 本体の準備

1. Rust 環境があれば、`meilisearch-main` ディレクトリに移動してビルドします。
   ```bash
   cd ../meilisearch-main
   cargo build --release
   ```
   Mac や Linux では問題なく動くはずです。公式バイナリを使う場合は `download-latest.sh` などを利用しても構いません。

2. サーバーを起動します。たとえばローカル用の設定例：
   ```bash
   ./target/release/meilisearch \
     --http-addr 127.0.0.1:7700 \
     --master-key yourmasterkey \
     --db-path ./data.ms
   ```
   `--master-key` を省略すると認証なしになりますが、あとで API キーが必要な場合は必ず指定してください。

3. サーバーが `http://127.0.0.1:7700` で起動したら、次の手順に移ります。

## 2. Enso の設定

Enso 側では以下の環境変数を `.env`（開発中）や `.env.example`（共有用）に設定してください。

```
VITE_MEILISEARCH_HOST=http://127.0.0.1:7700
VITE_MEILISEARCH_INDEX=enso-models
VITE_MEILISEARCH_API_KEY=yourmasterkey # サーバーを master-key 付きで起動した場合
```

これらの値は `enso/src/meilisearchClient.js` で読み込まれ、検索コンポーネント（`Home.jsx`）が Meilisearch のレスポンスを優先的に表示します。

## 3. サンプルデータの投入（シード）

Enso は `src/data/cults_creations.json` にあるモデルデータを Meilisearch に登録するための helper スクリプトを用意しています。Meilisearch サーバーが起動している状態で、Enso ディレクトリ内から次のコマンドを実行してください。

```bash
# 必要であれば環境変数を指定
MEILISEARCH_HOST=http://127.0.0.1:7700 \
MEILISEARCH_INDEX=enso-models \
MEILISEARCH_MASTER_KEY=yourmasterkey \
npm run seed:meilisearch
```

このスクリプトは既存のドキュメントを削除し `src/data/cults_creations.json` の内容を normalized した形で一気に登録します。

## 4. 動作確認とデバッグ

- Enso を `npm run dev` で起動し、検索バーにワードを入力すると Meilisearch のヒットが表示されます（`explore` タブやホーム画面で適用）。
- Meilisearch への接続に失敗した場合は UI 上部に「ローカル検索で続行」などのステータスが表示されます。
- 追加のデータを登録したい場合は再度シードスクリプトを実行してください。

## 5. 運用時のヒント

- データやインデックス設定を変更したらシードスクリプトを再実行して、一度インデックスをリロードしてください。
- 本番環境では `--master-key` を使い、`VITE_MEILISEARCH_API_KEY` に同じ値を設定して認証を有効にしておくと安全です。
- `meilisearch-main` の `./target/release/meilisearch --help` で利用できるオプションを確認し、ログ出力先やスナップショットの周期なども調整してください。
