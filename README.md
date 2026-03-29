# Server Control Panel

A full-stack web application for managing multiple servers, domains, and deployments. Built with React, TypeScript, Express, and TailwindCSS.

## Features

- **Server Management** - Add and manage multiple servers with SSH connectivity, file browsing, and script execution
- **Domain Management** - Track domains across servers with status monitoring, geo-targeting, and health checks
- **Offer Deployment** - Deploy marketing offers to domains with atomic operations and automatic rollback on failure
- **Job Queue** - Background job processing with real-time WebSocket logs, retry logic, and progress tracking
- **User Roles** - ADMIN and OPERATOR roles with buyer tag assignment and domain claim system
- **Health Monitoring** - Automated domain health checks from multiple geo-locations with DNS block detection
- **Bulk Operations** - Mass domain scanning, offer deployment, status changes, and Google Tag insertion
- **Domain Pool** - Operators can claim domains from an admin-managed pool with configurable limits
- **Financial Tracking** - Domain cost tracking with server IP cost distribution and zone pricing
- **Audit Log** - Full audit trail of all operations with user attribution
- **i18n** - English and Russian language support

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, TailwindCSS |
| UI Components | Radix UI, Lucide Icons, Monaco Editor |
| State | Zustand, TanStack React Query |
| Backend | Express.js, Node.js |
| Real-time | WebSocket (ws) |
| Auth | JWT |

## Project Structure

```
apps/
  api/        Express API server
  web/        React SPA (Vite)
packages/
  types/      Shared TypeScript types
```

## Quick Start

```bash
# Install dependencies
npm install

# Run development servers (API + Web)
npm run dev
```

- **Web UI**: http://localhost:5173
- **API**: http://localhost:3001

### Demo Credentials

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | ADMIN |
| alex_operator | demo | OPERATOR |
| maria_ops | demo | OPERATOR |

## Screenshots

### Domain Management
Full domain table with filtering by status, buyer tag, geo, offer. Supports bulk actions (ban, activate, scan, change offer).

### Job Queue
Real-time job monitoring with WebSocket live logs. Shows progress, retry status, and detailed error messages with rollback info.

### Server Detail
File browser with Monaco editor for in-place file editing. Directory tree navigation and script execution.

### Deploy Domains
Bulk domain deployment wizard with geo/buyer tag filtering, offer selection, and per-domain atomic rollback.

### Health Checks
Domain health monitoring from multiple geo-nodes. DNS block detection with country-level granularity.

## Architecture

### Frontend
- SPA with React Router v6
- Role-based routing (AdminRoute, OperatorRoute)
- API client with automatic token management and retry logic
- Real-time job updates via WebSocket

### Backend
- RESTful API with Express
- JWT authentication with role-based access control
- Background job queue with configurable concurrency
- WebSocket server for live job logs

### Key Concepts
- **Atomic Deployment**: Offer deployments use backup-deploy-verify pattern with automatic rollback on failure
- **Job Queue**: Two-tier queue system (SSH-heavy vs general) with separate concurrency limits
- **Domain Pool**: Admin-managed pool where operators claim domains with configurable limits
- **Health Checks**: Multi-node health monitoring with DNS block detection

## License

MIT
