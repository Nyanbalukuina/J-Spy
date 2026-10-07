<p align="center">
  <img src="public/icons/icon128.png" width="128" alt="J-Spy Logo">
</p>

# J-Spy - JSON Focused API Monitor
# 🚀 J-Spy - Chrome DevTools Extension

**Modern & Lightweight API Monitoring Tool built with Svelte 5**

`J-Spy` は、Web開発者がバックエンドとの通信（JSON）をストレスなく、かつ詳細に監視するために設計された Chrome デベロッパーツール拡張機能です。

## ✨ 注目ポイント

* **⚡ Svelte 5 (Runes) 搭載**: 最新のリアクティブ・エンジンにより、大量の通信ログもサクサク動作します。
* **🎯 インテリジェント・フィルタリング**: 画像やフォントなどのノイズを除去し、純粋な **JSON データ通信** のみを表示します。
* **💎 二重 JSON パース機能**: 文字列としてエスケープされた複雑な JSON レスポンスも、自動でオブジェクト化してツリー表示します。
* **🍪 コンテキスト・クッキー表示**: 選択した通信のドメインに紐づく Cookie を即座にリストアップ。
* **🌘 サイバーパンク UI**: DevTools のダークテーマに最適化された、エンジニア向けのクールなデザイン。

---

## 🛠 開発環境のセットアップ

### 推奨環境
* **Runtime**: Node.js (v18以上推奨)
* **IDE**: [VS Code](https://code.visualstudio.com/) + [Svelte extension](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode)

### インストール
```bash
npm install

```

---

## 🚀 ビルドとインストール方法

このプロジェクトは Svelte 5 + Vite で構成されています。拡張機能として動かすにはビルド後のファイルを Chrome に読み込ませる必要があります。

### 1. プロジェクトのビルド

```bash
npm run build

```

実行後、プロジェクト内に `dist` フォルダが生成されます。

### 2. Chrome への読み込み

1. Chrome ブラウザで `chrome://extensions/` を開きます。
2. 右上の **「デベロッパー モード」** を ON にします。
3. **「展開して読み込む」** をクリックします。
4. このプロジェクトの **`dist`** フォルダを選択します。

### 3. 使い方

1. 任意のウェブサイトを開きます。
2. **F12**（または右クリック > 検証）でデベロッパーツールを開きます。
3. 上部タブの「J-Spy」（隠れている場合は `>>` をクリック）を選択します。
4. ページをリロードすると、通信のキャプチャが開始されます。

---

## 📂 プロジェクト構造

* `src/App.svelte`: メインの UI と通信監視ロジック（Svelte 5 Runes 使用）
* `public/manifest.json`: 拡張機能の設定ファイル
* `devtools.html / devtools.js`: DevTools にパネルを登録するためのエントリーポイント

---

## 💡 開発のヒント

* **自動更新**: 拡張機能の性質上、コードの変更を反映させるには `npm run build` を行い、Chrome の拡張機能画面で「更新（🔄）」ボタンを押してください。
* **判定ロジック**: `App.svelte` 内で `mimeType.includes('json')` を使用して、バックエンドからの通信を判別しています。

---

## 🛡 ライセンス

[MIT License](https://www.google.com/search?q=LICENSE)

---

### 🤝 コントリビューション

バグ報告や機能要望（「検索機能が欲しい！」「コピーボタンが欲しい！」など）は、Issue または Pull Request までお気軽にどうぞ！

## UIの開発プレビュー

`npm run dev` で表示される通常のブラウザ画面には、15件の架空の通信とCookieが自動で表示されます。各行をクリックしてJSONツリー、エラー、空のレスポンスなどを確認できます。`Clear All` で空の一覧、`Reset Samples` でサンプルの復元を確認できます。

サンプルはViteの開発モードかつDevTools APIがない環境のみで読み込まれます。`npm run build` で生成する拡張機能には含まれません。
