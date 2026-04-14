# cqrcfg - Runtime Config Service

A production-ready Node.js microservice built with **Fastify** that provides a **runtime hierarchical configuration API** with OIDC-based subtree access control.

## Features

- **High performance** - Built on Fastify for maximum throughput
- Hierarchical JSON configuration storage
- Subtree read/write operations (GET, PATCH, PUT, DELETE)
- OIDC JWT authentication (RS256/ES256)
- Prefix-based authorization from JWT claims
- MongoDB persistence with indexed paths
- WebSocket change streams for real-time updates
- Fully stateless design

## Requirements

- Node.js >= 20.0.0
- MongoDB 4.4+
- OIDC Identity Provider with JWKs endpoint

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your settings
```

Required configuration:
- `MONGODB_URI` - MongoDB connection string
- `OIDC_ISSUER` - Your OIDC provider URL (e.g., `https://auth.example.com`)

### 3. Start the server

```bash
# Production
npm start

# Development (with auto-reload)
npm run dev
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `HOST` | `0.0.0.0` | Server host |
| `MONGODB_URI` | `mongodb://localhost:27017` | MongoDB connection string |
| `MONGODB_DATABASE` | `cqrcfg` | Database name |
| `OIDC_ISSUER` | (required) | OIDC issuer URL |
| `OIDC_JWKS_URI` | `{issuer}/.well-known/jwks.json` | JWKs endpoint |
| `OIDC_AUDIENCE` | (optional) | Expected JWT audience |

## API Endpoints

All endpoints (except `/health`) require a valid JWT in the `Authorization: Bearer <token>` header.

### Health Check

```
GET /health
```

Returns service status (no authentication required).

### Get Config Subtree

```
GET /config/:path
```

Returns the full JSON tree under the specified path.

**Example:**
```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/config/app1
```

**Response:**
```json
{
  "db": {
    "host": "localhost",
    "port": 5432
  },
  "features": {
    "enabled": true
  }
}
```

### Merge Update Config (PATCH)

```
PATCH /config/:path
Content-Type: application/json
```

Deep merges the request body into the existing configuration at the path.

**Example:**
```bash
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"host": "new-host"}' \
  http://localhost:3000/config/app1/db
```

### Replace Config (PUT)

```
PUT /config/:path
Content-Type: application/json
```

Completely replaces the configuration at the path.

**Example:**
```bash
curl -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"host": "new-host", "port": 5433}' \
  http://localhost:3000/config/app1/db
```

### Delete Config Subtree

```
DELETE /config/:path
```

Deletes all configuration under the specified path.

**Example:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/config/app1/db
```

## WebSocket Streams

Subscribe to real-time configuration changes via WebSocket.

```
WS /stream/:path?token=<jwt>
```

**Note:** Requires MongoDB replica set for change streams.

**Example (JavaScript):**
```javascript
const ws = new WebSocket('ws://localhost:3000/stream/app1?token=YOUR_JWT');

ws.onmessage = (event) => {
  const change = JSON.parse(event.data);
  console.log('Config changed:', change);
};
```

**Events:**
```json
{"type": "connected", "path": "/config/app1", "user": "user123"}
{"type": "change", "operation": "update", "path": "/config/app1/db", "data": {...}}
```

## JWT Token Format

The service expects JWT tokens with the following claims:

```json
{
  "sub": "user123",
  "iss": "https://auth.example.com",
  "config_permissions": [
    {
      "path": "/config/app1",
      "actions": ["read", "write"]
    },
    {
      "path": "/config/shared",
      "actions": ["read"]
    }
  ]
}
```

### Permission Rules

- `path` in permission must be an exact prefix of the requested path
- Prefix matching is boundary-safe (`/app1` does NOT match `/app10`)
- Actions: `read` (GET), `write` (PATCH, PUT, DELETE)

## Data Model

MongoDB collection: `config`

```json
{
  "path": "/config/app1/db",
  "data": {
    "host": "localhost",
    "port": 5432
  },
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

Indexes:
- Unique index on `path`

## Project Structure

```
src/
├── index.js              # Server entry point
├── config.js             # Environment configuration
├── middleware/
│   ├── auth.js           # JWT authentication
│   ├── authz.js          # Authorization (permissions)
│   └── normalizePath.js  # Path normalization
├── routes/
│   ├── config.js         # Config CRUD routes
│   └── stream.js         # WebSocket change streams
├── services/
│   ├── database.js       # MongoDB connection
│   ├── configService.js  # Config operations
│   └── streamService.js  # Change stream service
└── utils/
    └── tree.js           # Tree building utilities
```

## Error Responses

All errors return JSON:

```json
{
  "error": "Error Type",
  "message": "Human-readable description"
}
```

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Bad Request | Invalid JSON or path format |
| 401 | Unauthorized | Missing or invalid JWT |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Config path doesn't exist |
| 500 | Internal Server Error | Unexpected error |

## License

MIT
