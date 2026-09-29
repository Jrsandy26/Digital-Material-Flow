# 🛠️ AI Assistant & Platform Compatibility Guide

Welcome! This document provides an easy-to-understand breakdown of the **Digital Material Flow Planning & Line Feeding System** architecture, build scripts, development tools, and deployment environments. 

Whether you are a developer, an AI coding assistant (like **Google AI Studio**, **Cursor**, **Windsurf**, **v0**, **Bolt.new**, **Replit**, or **Lovable**), or deploying to **Vercel** or **VS Code**, this guide ensures 100% smooth setup and perfect compatibility.

---

## 📌 1. Project Architecture

The application uses a **Full-Stack Hybrid Architecture** where a single Node process handles both the backend Express.js APIs and the frontend Vite React SPA.

```
├── api/                    # Vercel Serverless functions (for production serverless environments)
│   └── index.ts            # Entry point for Vercel pointing to Express
├── src/
│   ├── server/
│   │   └── app.ts          # Core Express.js application, API routes, and logic
│   ├── context/
│   │   └── MaterialFlowContext.tsx  # Centralized React State Management
│   ├── components/         # Modular React components
│   └── main.tsx            # React application entry point
├── server-entry.ts         # Server runner that integrates Vite (development) or serves static assets (production)
├── vercel.json             # Deployment routing configuration
└── package.json            # Script definitions and dependency masterlist
```

### Key Behaviors:
* **Development Mode**: Express.js uses Vite as middleware (`vite.createServer` in `server-entry.ts`). It hosts the development environment on `http://localhost:3000` and supports hot-module loading and API proxies automatically.
* **Production Mode**: Vite builds the frontend into a static `dist` directory. Express then serves these static files from `dist` and falls back to `dist/index.html` for single-page routing (SPA).

---

## 💻 2. VS Code Compatibility

To develop, run, and debug this application in Visual Studio Code, use the pre-configured configurations located in the `.vscode/` directory.

### Workspace Configurations (`.vscode/`):
* **`settings.json`**:
  * Configures typescript workspace library.
  * Auto-formats your files on save using Prettier.
  * Integrates the Tailwind CSS CSS language server.
  * Minimizes workspace search noise by excluding `node_modules` and `dist`.
* **`launch.json`**:
  * **Dev Server (VS Code)**: Launces the development server directly within the integrated terminal with debuggers attached on port `9229`.
  * **Launch Chrome against localhost**: Automatically launches a Chrome browser instance targeting `http://localhost:3000` for client-side debugging.
* **`tasks.json`**:
  * Maps build and development processes directly to VS Code Task runners (run via `Ctrl+Shift+B` or Command Palette -> `Run Task`).

---

## ⚡ 3. Vercel Deployment & Serverless Compatibility

This project is fully optimized for zero-configuration, instant deployments on Vercel.

### Vercel Integration Components:
1. **`vercel.json`**:
   Configured to use the Vite framework. It redirects all `/api/*` requests to the Vercel serverless function `/api/index.ts` and routes all other requests to the SPA fallback `index.html`.
2. **`api/index.ts`**:
   The serverless handler that imports our central Express application (`app`) from `src/server/app.ts` and exports it as a default module. Vercel automatically converts this into an isolated, auto-scaling serverless function.

---

## 🤖 4. Guidance for Other AI Coding Assistants (AI Studio, Cursor, Bolt, etc.)

When another AI model or editor works on this codebase, they must adhere to these strict rules to avoid breaking the application:

### Rule A: Never hardcode port numbers
* Always read `process.env.PORT` first (defaulting to `3000`) inside `server-entry.ts`. Port `3000` is the single externally accessible port.

### Rule B: Preserve the dual-process dev pipeline
* The `"dev"` script inside `package.json` must always execute `tsx server-entry.ts`. Do **not** split into a separate frontend Vite server and a backend Express server; doing so will cause cross-origin (CORS) errors and break the reverse proxy.

### Rule C: esbuild Node bundle
* The production build script utilizes `esbuild` to compile our TypeScript server (`server-entry.ts`) into a single CommonJS file (`dist/server.cjs`) with `--packages=external` and `--sourcemap`. This avoids strict Node ESM relative resolution conflicts and improves startup speed.

### Rule D: Maintain state in `MaterialFlowContext`
* All global states (production plans, parts masters, trips logistics, and parsed spreadsheets) are kept in `/src/context/MaterialFlowContext.tsx`. To edit, add, or alter state calculations, edit this context rather than scattering state in isolated pages.

---

## 🚀 5. Development Command Reference

| Action | Command | Description |
| :--- | :--- | :--- |
| **Install** | `npm install` | Installs both frontend and server-side dependencies. |
| **Run Dev** | `npm run dev` | Boots Express + Vite integration on `http://localhost:3000` |
| **Build Project** | `npm run build` | Compiles the frontend SPA and bundles the server using `esbuild` into `dist/` |
| **Run Prod** | `npm start` | Launches the precompiled standalone server. |
| **Lint Check** | `npm run lint` | Verifies TypeScript compilation accuracy without generating output. |
