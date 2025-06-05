# MCP PayloadCMS Server

This project implements a Model Context Protocol (MCP) JSON-RPC server for PayloadCMS.
It automatically generates sample content and exposes five RPC tools.

## Development

1. **Install dependencies** (requires internet access):
   ```bash
   npm install
   ```
2. **Compile TypeScript**:
   ```bash
   npm run build
   ```
3. **Run in development**:
   ```bash
   npm run dev
   ```

Ensure you create a `.env` file with the following variables:

```dotenv
PAYLOAD_HOST=https://payload.local
PAYLOAD_USERNAME=admin@example.com
PAYLOAD_PASSWORD=str0ngP@ssw0rd
PORT=4000
```

## Usage

The server exposes a `/mcp` JSON-RPC endpoint. Example request using curl:

```bash
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "getSampleContent"
  }'
```
