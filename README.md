# ⚓ Vessel Harbour Logger

A modern, full-stack monorepo application for tracking real-time maritime traffic and logging visits to the Oslofjord inner harbour region.

## 🌟 Features

- **Real-Time AIS Tracking**: Connects to [AISStream.io](https://aisstream.io/) to ingest live Automatic Identification System (AIS) telemetry from vessels at sea.
- **Live Map Visualization**: Interactive React Leaflet map displaying live vessel movements and highlighted harbour zones.
- **Smart Zone Detection**: Computes point-in-polygon math in real-time to detect when a vessel enters a mapped harbour zone.
- **Stateful WebSockets**: In-memory vessel cache hydrates new frontend connections instantly so there are no blank screens on page load.
- **Persistent Visit Logging**: Stores harbour visits in a local SQLite database using Prisma ORM with one row per vessel per zone (upsert model).
- **End-to-End Type Safety**: Strictly typed using TypeScript monorepo workspaces, with Zod runtime validation on incoming external AIS telemetry.
- **Gorgeous UI**: Glassmorphism-inspired design with subtle micro-animations and Tailwind CSS styling.

## 🏗️ Architecture

The project is structured as an NPM workspaces monorepo:

- **`@vessel/shared` (`/packages/shared`)**: Shared TypeScript interfaces (e.g., `VesselPosition`, `ServerMessage`), Zod schemas for AIS message validation, and hardcoded `HARBOUR_ZONES` configuration. Used by both client and server.
- **`backend` (`/backend`)**: Node.js server powered by Express. Handles AISStream WebSocket ingestion, harbour zone visit detection, SQLite persistence (Prisma), and WebSocket broadcasting to frontend clients.
- **`frontend` (`/frontend`)**: Vite + React SPA. Consumes a single WebSocket connection for live vessel positions and visit alerts, and renders an interactive map alongside a visit log.

## 🚀 Getting Started

### Prerequisites

- Node.js (v22+ required)
- A free API key from [AISStream.io](https://aisstream.io)

### 1. Installation

Clone the repository and install dependencies from the root directory:

```bash
npm install
```

> **Note:** A `postinstall` hook automatically runs `prisma generate` so the Prisma client is ready to use immediately.

### 2. Environment Configuration

Copy the example environment file and fill in your API key:

```bash
cp .env.example .env
```

The only required variable is `AISSTREAM_API_KEY`. See `.env.example` for the full list of optional configuration variables.

### 3. Database Setup

Initialize the SQLite database:

```bash
npm run db:push -w backend
```

### 4. Run the Dev Server

Launch the entire stack concurrently (shared type compilation, backend server, and frontend Vite server):

```bash
npm run dev
```

The application will be available on **http://localhost:5173**.

> **Note on Free-Tier Data Limits:** If you rapidly restart the development server multiple times in a row, the AISStream API rate-limiter may temporarily drop payloads. If your screen says "Waiting for vessel data", simply leave the app running for 60 seconds and the AIS packets will naturally begin flowing in once your session cools down.

## 🐳 Docker Deployment (Homelab)

The project includes a multi-stage Dockerfile that serves the backend, frontend, and WebSocket server from a single container.

To deploy:

```bash
docker compose up -d --build
```

The container's entrypoint automatically runs `prisma db push --accept-data-loss` on startup, so schema changes (like new constraints) are applied seamlessly. To start with a completely empty database, delete the volume first:

```bash
docker compose down -v
docker compose up -d --build
```

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, React-Leaflet, Tailwind CSS
- **Backend**: Node.js, Express, `ws` (WebSockets), Zod
- **Database**: SQLite (`better-sqlite3`), Prisma ORM
- **Tooling**: TypeScript, ESLint, Prettier, Concurrently
