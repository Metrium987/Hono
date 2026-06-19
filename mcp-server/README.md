# Hono MCP Server

Model Context Protocol (MCP) server for AI-controllable access to the Hono ERP system.

## Architecture

The MCP server sits between AI assistants (Claude, Cursor, etc.) and the Hono REST API:

```
AI Assistant ⟷ MCP Server ⟷ Hono REST API (API key auth)
```

## Prerequisites

- Node.js 18+
- A Hono API key with appropriate permissions (`hk_...` prefix)
- The Hono app running (or deployed)

## Setup

1. Install dependencies:
   ```bash
   cd mcp-server
   npm init -y
   npm install @modelcontextprotocol/sdk
   ```

2. Create `.env`:
   ```
   HONO_API_URL=https://hono.pf/api/v1
   HONO_API_KEY=hk_your_api_key_here
   PORT=3100
   ```

3. Start:
   ```bash
   node index.js
   ```

## Tools Exposed

The MCP server exposes the following tools based on the API key's role permissions:

### Invoices
- `list_invoices` — Get paginated invoice list (filters: status, customer_id)
- `get_invoice` — Get invoice detail with items/payments
- `create_invoice` — Create invoice with items
- `send_invoice` — Send invoice via email
- `download_invoice_pdf` — Get invoice PDF URL

### Quotes
- `list_quotes` — Get paginated quote list
- `get_quote` — Get quote detail
- `create_quote` — Create quote with items
- `convert_quote` — Convert quote to invoice
- `download_quote_pdf` — Get quote PDF URL

### Products
- `list_products` — Get paginated product list (filters: search, category, low_stock)
- `get_product` — Get product detail
- `create_product` — Create product with translations
- `update_product` — Update product

### Customers
- `list_customers` — Get paginated customer list
- `get_customer` — Get customer detail
- `create_customer` — Create customer

### Orders
- `list_orders` — Get paginated order list
- `get_order` — Get order detail
- `create_order` — Create order with items

### Payments
- `record_payment` — Record payment on an invoice
- `list_payments` — List payments for an invoice

### Settings
- `create_api_key` — Create a new API key
- `list_payment_methods` — List payment methods

## Dynamic Tool Filtering

Each API key is tied to a `team_role` which has a JSONB `permissions` field. The MCP server filters available tools based on these permissions:

```json
{
  "invoices": ["read", "write"],
  "catalog": ["read"],
  "clients": ["read"]
}
```

Tools requiring `write` permission on a module are only exposed if the key has that permission.

## Security

- API keys are hashed with SHA-256 and stored as `key_hash`
- The raw key is shown **once** at creation time
- Keys can be revoked via the API key management UI
- All MCP requests pass through the same `withAuth()` middleware as browser requests

## Usage with Claude

Add to your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "hono": {
      "command": "node",
      "args": ["path/to/mcp-server/index.js"],
      "env": {
        "HONO_API_URL": "https://hono.pf/api/v1",
        "HONO_API_KEY": "hk_your_key_here"
      }
    }
  }
}
```

## Usage with Cursor

In Cursor, add the MCP server via Settings → MCP Servers:

```
Name: Hono
Type: command
Command: node path/to/mcp-server/index.js
Environment: HONO_API_URL=https://hono.pf/api/v1, HONO_API_KEY=hk_your_key_here
```
