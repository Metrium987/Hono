# HONO ERP

**The first AI-native ERP built for modern business.**

HONO is a full-stack Enterprise Resource Planning platform that combines a complete billing engine, CRM, inventory management, client portal, storefront, and financial reporting with a native **Model Context Protocol (MCP)** server — giving AI assistants direct, permissioned access to your business data.

---

## Why HONO?

Most ERPs are monolithic relics from the 2000s — Python, PHP, Java, complex servers to maintain. HONO is built from the ground up on modern infrastructure:

| | HONO | Traditional ERP |
|---|---|---|
| **Stack** | Next.js 16 + Supabase (serverless) | Python/PHP monolith |
| **Deploy** | `vercel deploy` — instant | Dedicated server, sysadmin needed |
| **AI** | Native MCP server, 24 tools, RBAC-filtered | Bolted-on plugin or nothing |
| **Auth** | Dual-path: client portal (magic link) + ERP (password) + API keys | Single auth or complex SSO |
| **Search** | pgvector semantic search (OpenAI embeddings) | Basic SQL LIKE queries |
| **PDF** | Server-side react-pdf, PF-compliant templates | Separate tool or library |
| **Payments** | Local + Stripe checkout + webhook | Often separate payment gateway |
| **Multi-tenant** | Team-scoped RLS at database level | Table-per-tenant or complex schemas |
| **i18n** | next-intl, zero hardcoded strings | Usually English-only |

---

## Capabilities

### Billing Engine
- **Invoices** — Dynamic line items, TVA selection, live totals, PDF download, email via Resend, auto-status (draft→sent→paid/partial/overdue)
- **Quotes** — Create, send, accept, convert to invoice, validity dates, PDF
- **Credit Notes** — Full refund workflow with stock restoration
- **Invoice Payments** — Record payments, auto-status trigger, Stripe Checkout integration
- **Recurring Invoices** — Scheduled auto-generation (requires migration deploy)
- **Invoice Events** — Complete audit trail (created, sent, viewed, paid, etc.)
- **Invoice Number Rules** — Configurable prefixes, sequences, Free Mode renumbering

### Catalog & CRM
- **Products** — Multi-category, multi-language translations, stock tracking, low stock alerts, FTS + vector search
- **Customers** — CRM with N° TAHITI / VAT number, B2B/B2C, portal access toggle, search
- **Vendors** — Contact management with tax ID

### Storefront & Client Portal
- **Product listing** — Category filter, search, HT/TTC pricing
- **Cart** — Quantity controls, line totals, localStorage persistence
- **Checkout** — Contact form → auto-generates quote
- **Portal** — Magic link auth, dashboard with document counts, quotes/invoices/orders history

### Financial Reports
- **Profit & Loss** — Revenue (invoiced + other income) vs expenses, net income, profit margin, expense ratio
- **VAT by Rate** — Taxable base and VAT collected per rate
- **Client Statement** — Customer invoices + payments with totals

### Expenses & Income
- Expense tracking with categories, vendors, currency, receipt upload
- Non-invoice income tracking with customer links
- Vendor management with N° TAHITI

### AI & Automation
- **MCP Server** — 24 tools across invoices, quotes, products, customers, orders, payments, settings. Dynamic tool filtering based on API key permissions.
- **OpenAPI 3.0 Spec** — All 30+ endpoints documented
- **pgvector Semantic Search** — Vector embeddings on products and customers (infrastructure ready)

### Admin & Configuration
- **RBAC** — 4 default roles (Admin, Manager, Salesperson, Accountant), JSONB permissions per module
- **Educational / Free Mode** — Restrict edits to finalized documents for training
- **API Key Management** — Create, revoke, permission-scoped keys
- **Tax Rates** — Configure rates per locale
- **Currencies** — Multi-currency with exchange rates
- **Payment Methods** — Offline (cash, check, card, bank transfer) + online (Stripe, PayPal)

### Legal & Compliance
- N° TAHITI / VAT number on invoices, quotes, credit notes, vendors, customers
- French Polynesia TVA rates (1%, 5%, 13%, 16%, 0% exempt)
- Legal mentions, service date, late fee, RIB/IBAN on PDFs
- B2B validation (requires tax ID)
- Franchise en base support
- Archived document history for renumbering audit trail

---

## License

**GNU Affero General Public License v3.0 (AGPL-3.0)**

HONO is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation.

This license ensures that if anyone runs a modified version on a network server (SaaS), they must make their source code available to users. It protects your business from competitors cloning your work while keeping the project open.

**For commercial use (installing for clients, selling as a service):** You keep the AGPL — it allows you to charge for installation, support, and maintenance. The AGPL only requires you to make the source available to the people you serve, which is compatible with your business model.

If a client wants an exception (closed-source integration), you can sell them a commercial license — that's a conversation for later when you have customers asking.

---

## Quick Start

```bash
git clone https://github.com/your-org/hono
cd hono
cp .env.example .env.local
# Fill in your Supabase and Stripe credentials
npm install
npm run dev
```

Deploy to Vercel:
```bash
vercel deploy
```

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict) |
| UI | Tailwind CSS 4 + shadcn/ui |
| Database | Supabase (PostgreSQL + pgvector) |
| Auth | Supabase Auth (SSR) + magic link + API keys |
| Payments | Stripe Checkout + local payment recording |
| Email | Resend + React Email |
| PDF | @react-pdf/renderer |
| AI Protocol | Model Context Protocol (MCP) |
| Locales | fr, ty, mq (Tahitian, Marquesan) |
| Deployment | Vercel (Edge + Serverless) |

---

*Built for French Polynesia, engineered for the world.*
