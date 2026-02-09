# Deployment & DevOps Guide

## Production Environment

| Component | URL | Platform |
|-----------|-----|----------|
| **Frontend** | `https://app.mindloop.cloud` | Dokploy (Docker) |
| **Backend API** | `https://lacaleta-api.mindloop.cloud` | Dokploy (Docker) |
| **Database** | PostgreSQL | Dokploy managed |
| **Monitoring** | `https://uptime.mindloop.cloud` | Uptime Kuma |
| **Error Tracking** | Sentry | `@sentry/node` |

## Docker Configuration

### Frontend (`mindloop-costos`)
```dockerfile
# Multi-stage build
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### Backend (`lacaleta-api`)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

## Environment Variables

### Backend (`lacaleta-api/.env`)
```bash
# Required
PORT=3000
DATABASE_URL=postgresql://user:pass@host:5432/dbname
JWT_SECRET=your-secret-key
INVITATION_CODE=secure-invitation-code

# Optional - Integrations
SENTRY_DSN=https://xxx@sentry.io/xxx
RESEND_API_KEY=re_xxx
ANTHROPIC_API_KEY=sk-ant-xxx

# CORS (defaults built into server.js)
# ALLOWED_ORIGINS added programmatically: localhost:5173, localhost:5177, app.mindloop.cloud
```

### Frontend (`mindloop-costos/.env`)
```bash
# Required
VITE_API_BASE_URL=https://lacaleta-api.mindloop.cloud

# Chat (required for chatbot functionality)
VITE_CHAT_WEBHOOK_URL=https://n8n.example.com/webhook/chat

# Optional
VITE_APP_NAME=MindLoop CostOS
VITE_APP_VERSION=1.0.0
VITE_APP_ENV=production

# Feature flags
VITE_DEBUG_MODE=false
VITE_PERFORMANCE_MONITORING=true

# Cache
VITE_CACHE_TTL=300000

# External services (optional)
VITE_SENTRY_DSN=
VITE_GA_ID=
```

## CORS Configuration

Allowed origins (hardcoded in `server.js`):
```javascript
const ALLOWED_ORIGINS = [
  'http://localhost:5173',           // Vite dev
  'http://localhost:5177',           // Alt dev port
  'https://app.mindloop.cloud',     // Production frontend
  'https://lacaleta-api.mindloop.cloud'  // API self-reference
];
```

Security: Requests without `Origin` header are rejected (except for public paths like `/api/health`).

## Rate Limiting

- **Global**: 100 requests per 15 minutes per IP
- **Auth endpoints**: Separate stricter limiter via `authLimiter`
- Custom in-memory implementation (not Redis-based)

## Monitoring

### Uptime Kuma Heartbeat
- Backend sends heartbeat every 60 seconds
- Heartbeat only sent if DB query `SELECT 1` succeeds
- URL: `https://uptime.mindloop.cloud/api/push/nw9yvLKJzf`

### Sentry
- Backend: `@sentry/node` with Express error handler
- DSN configured via `SENTRY_DSN` environment variable
- Debug endpoint: `GET /debug-sentry` (triggers test error)

### Health Checks
- `GET /api/health` — Basic (public, no auth)
- `GET /api/system/health-check` — Deep (auth required): DB connection, recipes without ingredients, negative stock, inventory value, today's sales

## Database Connection Pool

```javascript
const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 10,                    // Max connections
  idleTimeoutMillis: 60000,   // 1 min idle
  connectionTimeoutMillis: 30000, // 30s connect timeout
  statement_timeout: 30000,    // 30s query timeout
  ssl: { rejectUnauthorized: false }
});
```

## Deployment Workflow

1. Push code to GitHub repository
2. Dokploy auto-detects changes and triggers build
3. Docker image is built using multi-stage Dockerfile
4. Container is deployed and health-checked

### Common Issues
- **502 Bad Gateway**: Docker cache not cleared → force rebuild in Dokploy
- **CORS errors**: Check origin against `ALLOWED_ORIGINS` array
- **DB connection**: Verify `DATABASE_URL` in Dokploy environment settings
- **Stale frontend**: Browser cache + GitHub Pages CDN → hard refresh + purge cache

## NPM Scripts

### Backend (`lacaleta-api`)
```bash
npm start           # Start server (production)
npm run dev         # Start with nodemon (development)
npm test            # Run unit tests
npm run test:e2e    # Run E2E tests
```

### Frontend (`mindloop-costos`)
```bash
npm run dev         # Start Vite dev server (port 5173)
npm run build       # Production build
npm run preview     # Preview production build
npm run lint        # ESLint
npm run format      # Prettier
npm test            # Jest tests
```
