# ClipPalette

**[English](#english) | [日本語](#japanese)**

---

<a name="japanese"></a>
## 日本語

**ClipPalette** は Windows 向けのクリップボード管理アプリです。Tauri v2（Rust）と React 19 で構築されており、コピーした内容を自動的に保存・検索・整理できます。

### 機能

- **自動クリップボード監視** — 500ms ポーリングでテキスト・画像を自動キャプチャ
- **全文検索** — 過去のクリップを瞬時に検索
- **タグ管理** — クリップにタグを付けて分類
- **ピン留め** — 重要なクリップを固定表示
- **コードハイライト** — Prism.js によるシンタックスハイライト（言語自動検出）
- **OGP プレビュー** — URL から OGP 情報を取得して表示
- **スニペット管理** — よく使うテキストをスニペットとして保存
- **システムトレイ常駐** — バックグラウンドで動作、タスクバーに表示されない
- **グローバルショートカット** — `Alt+V` でウィンドウの表示/非表示を切り替え
- **自動起動** — Windows スタートアップ時に自動起動

### 技術スタック

| 分類 | 技術 |
|------|------|
| デスクトップフレームワーク | Tauri v2.11 |
| バックエンド | Rust + rusqlite (SQLite) + arboard v3 |
| フロントエンド | React 19 + TypeScript |
| スタイリング | Tailwind CSS v4 |
| 状態管理 | Zustand |
| アイコン | lucide-react |
| ビルドツール | Vite |

### セットアップ

**必要な環境:**
- [Node.js](https://nodejs.org/) v18 以上
- [Rust](https://www.rust-lang.org/tools/install) (最新安定版)
- [Tauri CLI](https://v2.tauri.app/start/prerequisites/)

```bash
# リポジトリをクローン
git clone https://github.com/bal17nw-star/ClipPalette.git
cd ClipPalette

# 依存関係をインストール
npm install

# 開発モードで起動
npm run tauri dev

# リリースビルド
npm run tauri build
```

### 使い方

1. アプリを起動するとシステムトレイに常駐します
2. `Alt+V` でウィンドウを表示/非表示できます
3. クリップボードにコピーした内容が自動的に履歴に追加されます
4. 検索バーで過去のクリップを検索できます
5. クリップをクリックするとクリップボードに再コピーされます

### データ保存場所

```
%APPDATA%\com.clippalette.app\clippalette.db
```

無制限でクリップを保存できます。

ダウンロードはこちらから(https://github.com/bal17nw-star/ClipPalette#)

---

<a name="english"></a>
## English

**ClipPalette** is a Windows clipboard manager built with Tauri v2 (Rust) and React 19. It automatically saves, searches, and organizes everything you copy.

### Features

- **Automatic Clipboard Monitoring** — Captures text and images via 500ms polling
- **Full-Text Search** — Instantly search through your clip history
- **Tag Management** — Categorize clips with custom tags
- **Pin Clips** — Keep important clips pinned at the top
- **Code Highlighting** — Syntax highlighting via Prism.js with auto language detection
- **OGP Preview** — Fetch and display OGP metadata for URLs
- **Snippet Manager** — Save frequently used text as reusable snippets
- **System Tray** — Runs in the background, hidden from the taskbar
- **Global Shortcut** — Toggle window visibility with `Alt+V`
- **Auto-start** — Automatically launches on Windows startup

### Tech Stack

| Category | Technology |
|----------|------------|
| Desktop Framework | Tauri v2.11 |
| Backend | Rust + rusqlite (SQLite) + arboard v3 |
| Frontend | React 19 + TypeScript |
| Styling | Tailwind CSS v4 |
| State Management | Zustand |
| Icons | lucide-react |
| Build Tool | Vite |

### Setup

**Prerequisites:**
- [Node.js](https://nodejs.org/) v18 or higher
- [Rust](https://www.rust-lang.org/tools/install) (latest stable)
- [Tauri CLI](https://v2.tauri.app/start/prerequisites/)

```bash
# Clone the repository
git clone https://github.com/bal17nw-star/ClipPalette.git
cd ClipPalette

# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for release
npm run tauri build
```

### Usage

1. Launch the app — it will appear in the system tray
2. Press `Alt+V` to show/hide the window
3. Anything you copy is automatically added to the history
4. Use the search bar to find past clips
5. Click a clip to copy it back to the clipboard

### Data Location

```
%APPDATA%\com.clippalette.app\clippalette.db
```

You can save an unlimited number of clips.

Download here(https://github.com/bal17nw-star/ClipPalette#)

### Project Structure

```
ClipPalette/
├── src/                        # React frontend
│   ├── components/
│   │   ├── ClipCard.tsx        # Individual clip display
│   │   ├── ClipGrid.tsx        # Clip list/grid layout
│   │   ├── CodeBlock.tsx       # Syntax-highlighted code view
│   │   ├── OGPPreview.tsx      # URL OGP card preview
│   │   ├── SearchBar.tsx       # Search input
│   │   ├── Sidebar.tsx         # Tag/filter sidebar
│   │   └── SnippetPanel.tsx    # Snippet management panel
│   ├── hooks/
│   │   └── useKeyboard.ts      # Keyboard shortcut hooks
│   ├── lib/
│   │   └── detectCode.ts       # Language auto-detection
│   ├── store/
│   │   └── clipStore.ts        # Zustand global state
│   ├── types/
│   │   └── index.ts            # TypeScript type definitions
│   └── App.tsx                 # Root layout
└── src-tauri/                  # Rust backend
    └── src/
        ├── lib.rs              # Tauri setup, tray, global shortcut
        ├── clipboard.rs        # Background polling thread
        ├── db.rs               # SQLite CRUD via rusqlite
        ├── commands.rs         # Tauri commands exposed to frontend
        └── models.rs           # Shared data models
```

### License

MIT
