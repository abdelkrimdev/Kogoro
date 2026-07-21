# Electrobun for desktop GUI

We need a desktop GUI for Kogoro. We chose Electrobun over Electron and Tauri.

Electron bundles Chromium (~200MB) and runs a full browser engine per app — overkill for a media library manager. Tauri requires Rust, which doesn't match our TypeScript/Bun stack. Electrobun uses the system's native webview (WebKit on macOS, WebView2 on Windows, WebKitGTK on Linux), runs Bun as the backend runtime, and ships ~14MB bundles with sub-50ms startup. It supports typed RPC between main process and webview, which fits our hybrid communication pattern (commands for actions, queries for reads).

The tradeoff is platform-dependent rendering — WebKit and WebView2 behave differently — but our UI is data-driven (grids, tables, forms) rather than pixel-perfect, so this is acceptable. We can bundle CEF later if cross-platform consistency becomes critical.
