# cqrcfg - Runtime Config Service

A production-ready Node.js microservice built with **Fastify** that provides a **runtime hierarchical configuration API** with JWT-based subtree access control.

## Features

- **High performance** - Built on Fastify for maximum throughput
- **Swappable storage** - MongoDB, DynamoDB, or etcd
- **Swappable notifications** - WebSocket, Kafka, or AMQP
- Hierarchical JSON configuration storage
- Subtree read/write operations (GET, PATCH, PUT, DELETE)
- JWT authentication with JWKS validation
- Prefix-based authorization from JWT claims
- Real-time change notifications via pub/sub
- Fully stateless design

## Requirements

- Node.js >= 20.0.0
- Storage backend (MongoDB, DynamoDB, or etcd)
- JWKs endpoint for token verification

## Quick Start

### 1. Install dependencies

```bash
npm install

# Install UI dependencies (optional)
npm run ui:install

# Install storage driver (pick one)
npm install mongodb          # For MongoDB
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb  # For DynamoDB
npm install etcd3            # For etcd

# Install notification broker (optional, pick one)
npm install kafkajs          # For Kafka
npm install amqplib          # For AMQP/RabbitMQ
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your settings
```

Required configuration:
- `OIDC_JWKS_URI` - JWKs endpoint for token verification

### 3. Start the server

```bash
# Production
npm start

# Development (with auto-reload)
npm run dev

# Start UI development server (in another terminal)
npm run ui
```

## Web UI

The project includes a React-based web UI for browsing and editing configurations.

### Running the UI

```bash
# Install UI dependencies
npm run ui:install

# Start UI development server (proxies API to localhost:3000)
npm run ui

# Build for production
npm run ui:build
```

The UI will be available at `http://localhost:5173` and requires a valid JWT token with appropriate permissions (`read`, `write`, `list`) to browse and edit configurations.

### Environment Themes

The UI supports runtime theming to visually distinguish between environments (dev, int, prod). Themes are CSS files that override CSS variables.

**Available themes:**
- `ui/public/themes/default.css` - Dark blue (default)
- `ui/public/themes/dev.css` - Green accent
- `ui/public/themes/int.css` - Blue accent
- `ui/public/themes/prod.css` - Red accent

**CSS Variables:**
```css
:root {
  --bg-primary: #1a1a2e;      /* Main background */
  --bg-secondary: #16213e;    /* Sidebar, cards */
  --bg-tertiary: #0f3460;     /* Inputs, buttons */
  --text-primary: #e8e8e8;    /* Main text */
  --text-secondary: #a8a8a8;  /* Muted text */
  --accent: #e94560;          /* Primary accent color */
  --accent-hover: #ff6b6b;    /* Accent hover state */
  --success: #4caf50;
  --warning: #ff9800;
  --error: #f44336;
  --border: #2a2a4a;
  --env-badge-bg: #e94560;    /* Environment badge background */
  --env-badge-text: #ffffff;  /* Environment badge text */
}
```

**To create a custom theme:** Copy an existing theme file and modify the CSS variables.

## Docker Compose

Run the entire stack locally with Docker Compose. Includes a mock OIDC server for local development:

```bash
# Start all services (API, UI, MongoDB, Mock OIDC)
docker compose up -d

# View logs
docker compose logs -f

# Stop all services
docker compose down

# Stop and remove volumes (deletes data)
docker compose down -v
```

**Services:**
- **API**: http://localhost:3000
- **UI**: http://localhost:8080
- **Mock OIDC**: http://localhost:8888 (token generator UI)
- **MongoDB**: localhost:27017

### Getting a Token (Local Development)

1. Open the Mock OIDC token generator: http://localhost:8888
2. Edit the claims JSON to set your desired permissions
3. Click "Generate Token"
4. Copy the token and paste it into the UI at http://localhost:8080

Or via curl:
```bash
# Get a token with full permissions
TOKEN=$(curl -s -X POST http://localhost:8888/token \
  -H 'Content-Type: application/json' \
  -d '{"sub":"testuser","config_permissions":[{"path":"/config","actions":["read","write","list"]}]}' \
  | jq -r '.access_token')

# Use the token
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/config/
```

### Using a Real OIDC Provider

To use a real OIDC provider instead of the mock server, set environment variables:

```bash
# Override mock OIDC with real provider
OIDC_JWKS_URIS=https://your-idp.com/.well-known/jwks.json docker compose up -d
# or
OIDC_ISSUERS=https://accounts.google.com docker compose up -d
```

Or create a `.env` file:
```bash
OIDC_JWKS_URIS=https://your-idp.com/.well-known/jwks.json
# or
OIDC_ISSUERS=https://accounts.google.com
OIDC_AUDIENCE=your-audience
```

### Environment-Specific Themes

Apply environment-specific themes using environment variables:

```bash
# Use built-in themes: default, dev, int, prod
UI_ENV=dev docker compose up -d   # Green theme, "DEV" badge
UI_ENV=int docker compose up -d   # Blue theme, "INT" badge
UI_ENV=prod docker compose up -d  # Red theme, "PROD" badge

# Or specify custom file paths
UI_THEME=./my-theme.css UI_CONFIG=./my-config.js docker compose up -d
```

**To create a custom theme:**

1. Create a theme CSS file (copy from `ui/public/themes/default.css`):
   ```css
   :root {
     --bg-primary: #1a1a2e;
     --accent: #e94560;
     --env-badge-bg: #e94560;
     /* ... other variables */
   }
   ```

2. Create a config.js file:
   ```javascript
   window.__CQRCFG_ENV__ = 'my-env';
   ```

3. Start with custom paths:
   ```bash
   UI_THEME=./my-theme.css UI_CONFIG=./my-config.js docker compose up -d
   ```

## Configuration

### Core Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `HOST` | `0.0.0.0` | Server host |
| `OIDC_JWKS_URIS` | (optional) | Comma-separated direct JWKS endpoint URLs |
| `OIDC_ISSUERS` | (optional) | Comma-separated OIDC issuer URLs (fetches JWKS from each issuer's well-known endpoint) |
| `OIDC_AUDIENCE` | (optional) | Expected JWT audience |
| `OIDC_CLAIMS_HEADERS` | (optional) | Comma-separated header names for claims |

**Note:** At least one of `OIDC_JWKS_URIS` or `OIDC_ISSUERS` must be configured. Keys from all sources are combined for JWT verification.

### Storage Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `STORAGE_TYPE` | `mongodb` | Storage backend: `mongodb`, `dynamodb`, `etcd` |
| `MONGODB_URI` | `mongodb://localhost:27017` | MongoDB connection string |
| `MONGODB_DATABASE` | `cqrcfg` | MongoDB database name |
| `DYNAMODB_TABLE` | `cqrcfg` | DynamoDB table name |
| `AWS_REGION` | `us-east-1` | AWS region for DynamoDB |
| `ETCD_HOSTS` | `http://localhost:2379` | Comma-separated etcd hosts |
| `ETCD_PREFIX` | `/cqrcfg` | Key prefix in etcd |

### Notification Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `NOTIFICATIONS_TYPE` | `websocket` | Notification broker: `websocket`, `kafka`, `amqp` |
| `KAFKA_BROKERS` | `localhost:9092` | Comma-separated Kafka brokers |
| `KAFKA_TOPIC` | `cqrcfg-changes` | Kafka topic for changes |
| `AMQP_URL` | `amqp://localhost` | AMQP connection URL |
| `AMQP_EXCHANGE` | `cqrcfg` | AMQP exchange name |

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

Returns the full JSON tree under the specified path. Requires `read` permission.

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

### List Config Paths

```
GET /config/:path/
```

When the path ends with `/`, returns a list of all paths under the specified prefix. Requires `list` permission.

**Example:**
```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/config/app1/
```

**Response:**
```json
{
  "keys": [
    "/config/app1/db",
    "/config/app1/cache",
    "/config/app1/features"
  ]
}
```

### Search Config Paths (Wildcards)

The list endpoint supports wildcard patterns for searching across paths:

| Pattern | Matches |
|---------|---------|
| `*` | Any characters except `/` (single path segment) |
| `**` | Any characters including `/` (multiple segments) |
| `?` | Single character except `/` |

**Examples:**
```bash
# Find all "db" configs at any single level
curl -H "Authorization: Bearer $TOKEN" "http://localhost:3000/config/*/db/"
# Returns: /config/app1/db, /config/app2/db

# Find all "db" configs at any nesting level
curl -H "Authorization: Bearer $TOKEN" "http://localhost:3000/config/**/db/"
# Returns: /config/app1/db, /config/team1/app1/db, /config/team2/service/db

# Find configs matching pattern
curl -H "Authorization: Bearer $TOKEN" "http://localhost:3000/config/app?/db/"
# Returns: /config/app1/db, /config/app2/db (but not /config/app10/db)
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
  "config_permissions": [
    {
      "path": "/config/app1",
      "actions": ["read", "write", "list"]
    },
    {
      "path": "/config/shared",
      "actions": ["read", "list"]
    }
  ]
}
```

The token is verified against the JWKS endpoint. Multiple issuers are supported - tokens are matched by `kid`.

### Claims Headers

Claims can also be provided via HTTP headers (configured via `OIDC_CLAIMS_HEADERS`). This is useful when a reverse proxy extracts claims from id_tokens. Header values can be:
- Plain JSON
- Base64-encoded JSON
- Signed JWT (verified against JWKS)

### Permission Rules

- `path` in permission must be an exact prefix of the requested path
- Prefix matching is boundary-safe (`/app1` does NOT match `/app10`)
- Actions: `read` (GET without trailing `/`), `list` (GET with trailing `/`), `write` (PATCH, PUT, DELETE)

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
│   └── stream.js         # WebSocket subscriptions
├── services/
│   ├── configService.js  # Config operations
│   └── notificationService.js  # Pub/sub notifications
├── storage/
│   ├── interface.js      # Storage interface
│   ├── mongodb.js        # MongoDB implementation
│   ├── dynamodb.js       # DynamoDB implementation
│   └── etcd.js           # etcd implementation
├── notifications/
│   ├── interface.js      # Notifications interface
│   ├── websocket.js      # In-process pub/sub
│   ├── kafka.js          # Kafka implementation
│   └── amqp.js           # AMQP implementation
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
