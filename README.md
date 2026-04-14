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
```

## Configuration

### Core Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `HOST` | `0.0.0.0` | Server host |
| `OIDC_JWKS_URI` | (required) | JWKs endpoint URL |
| `OIDC_AUDIENCE` | (optional) | Expected JWT audience |
| `OIDC_CLAIMS_HEADERS` | (optional) | Comma-separated header names for claims |

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
      "actions": ["read", "write"]
    },
    {
      "path": "/config/shared",
      "actions": ["read"]
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
- Actions: `read` (GET), `write` (PATCH, PUT, DELETE)

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
