# Digital Material Flow Planning & Line Feeding System

> **Two-Wheeler Assembly Facility #01**  
> An industrial-grade material handling, milk-run optimization, and line-feeding execution system.

---

## 📋 Overview

The **Digital Material Flow Planning & Line Feeding System** provides end-to-end logistics optimization and real-time execution monitoring for manufacturing assembly lines. Designed for high-volume manufacturing environments, it automates line feeding, trip scheduling, operator workload balancing, Standard Work Combination Sheet (SWCT) analytics, and real-time inventory tracking.

---

## ✨ Key Features

- **🏭 Executive Logistics Dashboard**: Real-time KPI tracking for line-feeding status, fleet utilization, active trips, and critical stock alerts.
- **📦 Part Master Management**: Comprehensive parts catalog with usage rates, bin capacities, store locations, and Point-of-Consumption (POC) drop points.
- **🚚 Milk-Run & Trip Planning**: Automated co-loading and bin-packing algorithms for Jumbo Trolleys, Battery Operated Vehicles (BOVs), Hand Pallet Trucks, and Manual Handling.
- **⏱️ SWCT Analytics & Standard Work Builder**: Standard Work Combination Table analytics, cycle time decomposition (walking, waiting, manual handling, transit), and interactive activity simulation.
- **👥 Operator Management & Duty Roster**: Operator workload distribution, shift trip schedules, and real-time status tracking.
- **📊 Real-Time Inventory & Line Feeding**: Live POC inventory depletion tracking, auto-replenishment triggers, and buffer coverage alerts.
- **📥 Excel Import & Export**: Import production master spreadsheets and export complete reports to Excel, CSV, or formatted PDF.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide Icons, Recharts, Framer Motion
- **Backend**: Express.js, Node.js, `tsx`, `esbuild`
- **Build Tool**: Vite
- **Deployment Support**: Cloud Run, Vercel Serverless Functions, Docker / Node standalone

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- **Node.js**: v18 or higher
- **npm**: v9 or higher

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd <repository-directory>
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Access the application:**
   - **Local URL**: `http://localhost:3000/`
   - **Network URL**: `http://<your-local-ip>:3000/` (Accessible from mobile devices on the same Wi-Fi network)

---

## 💻 VS Code Integration

This project includes workspace configuration for Visual Studio Code:

- **Debugging (`F5`)**: Launch the development server directly with full Node.js debugging attached (`Dev Server (VS Code)`).
- **Tasks**: Pre-configured npm tasks in `.vscode/tasks.json` for running `npm run dev` and `npm run build`.
- **IntelliSense & Formatting**: Pre-configured Tailwind CSS IntelliSense and TypeScript formatting in `.vscode/settings.json`.

---

## ☁️ Deployment

### 1. Vercel Deployment
The repository includes a root `vercel.json` and a serverless entry point at `api/index.ts`.
- Simply connect your repository to Vercel.
- Vercel will automatically detect the Vite build settings and serve backend routes via serverless functions.

### 2. Docker / Node Production Build
```bash
# Create production build
npm run build

# Start production server
npm start
```

---

## 📁 Directory Structure

```text
├── api/                    # Vercel serverless function wrapper
├── src/
│   ├── components/         # Feature modules and layout components
│   │   ├── features/       # Dashboard, Line Feeding, Operators, SWCT, Parts, Trips
│   │   └── common/         # Modals, maps, shared controls
│   ├── context/            # React state context (MaterialFlowContext)
│   ├── data/               # Master dataset initializers
│   ├── server/             # Decoupled Express API routes
│   ├── types/              # TypeScript interfaces
│   └── utils/              # Calculation engines, Excel parser, PDF generator
├── .vscode/                # VS Code launch debuggers & task configs
├── server.ts               # Local & container server entry point
├── vercel.json             # Vercel deployment configuration
└── vite.config.ts          # Vite build configuration
```

---

## 🛠️ Multi-Platform & AI Assistant Compatibility

For detailed configuration instructions on running this project in different AI IDEs (**Google AI Studio, Cursor, Windsurf, v0, Bolt, Replit, Lovable**), configuring **VS Code tasks**, or deploying to **Vercel**, please refer to the comprehensive [COMPATIBILITY_GUIDE.md](./COMPATIBILITY_GUIDE.md).

---

## 📄 License

Internal Manufacturing Control System — Designed for Two-Wheeler Assembly Facility #01.
