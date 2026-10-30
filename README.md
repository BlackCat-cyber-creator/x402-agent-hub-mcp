# x402 Agent Hub — MCP Server

Model Context Protocol (**MCP**) server connecting **Claude Desktop**, **Claude Code**, **Cursor**, **Windsurf**, and **OpenCode** to **[x402 Agent Hub](https://tryponcho.com/m/x402-agent-hub.x402-agent-hub.workers.dev)** — zero API keys, zero monthly subscriptions, pay-per-call (`$0.005`–`$0.025` USDC) on **Base Mainnet** via the open [x402](https://x402.org) protocol.

## Tools Included

| Tool | Price (USDC) | Description |
| :--- | :---: | :--- |
| `get_hub_catalog` | **FREE (`$0`)** | Inspect live catalog, supported CFD/FX symbols, and buyer wallet status. |
| `get_ict_sessions` | `$0.005` | Live ICT Killzones (Asian, London Open, NY Open, London Close), 60m Silver Bullet FVG windows, rollover spread-danger alerts, and Wednesday/Friday triple-swap flags. |
| `get_cfd_microstructure` | `$0.010` | Tick-calibrated ECN spreads, round-turn commissions, M1 ATR, M1–H1 spread-to-ATR execution ratios, and scalping suitability across 14 symbols (`XAUUSD`, `BTCUSD`, `NAS100`, `US30`, `US500`, `GER40`, `JPN225`, `USOUSD`, `EURUSD`, `GBPUSD`, `USDJPY`, etc.). |
| `calculate_prop_firm_risk` | `$0.010` | Exact lot-size calculator factoring ECN spread+commission friction plus prop-firm daily/max drawdown auto-lock protection. |
| `extract_clean_markdown` | `$0.005` | Convert any public URL into clean, token-efficient LLM Markdown with metadata & token estimate. |
| `enrich_business_lead` | `$0.015` | SDR business domain enricher: Brand Sanitizer, Phantom Lead Shield (`wa.me` / `linktr.ee` / marketplace detector), normalized E.164 WhatsApp/mobile phones (rejecting office PSTN landlines), emails, socials & CMS/pixel stack. |
| `audit_technical_seo` | `$0.020` | Instant `0-100` Technical SEO & Website Modernization Audit with prioritized fixes. |
| `render_visual_card` | `$0.025` | Deterministic, typo-free `1200x630` OpenGraph banner, `1080x1350` social KPI slide, or trading sparkline card (`SVG` + data URI). |

---

## Quick Setup

### Option 1 — Zero-Install Remote Streamable HTTP MCP (Smithery / Cursor / Claude / Windsurf)

Connect directly to the hosted Cloudflare Edge Streamable HTTP endpoint:

- **Remote MCP Server URL:** `https://x402-agent-hub.x402-agent-hub.workers.dev/mcp`
- **Auto-Pay Header (Optional):** Pass `x-buyer-private-key: 0xYOUR_SCOPED_AGENT_WALLET_PRIVATE_KEY` (or `?x402BuyerPrivateKey=0x...`) to automatically settle `$0.005`–`$0.025` Base Mainnet USDC micropayments per call.

### Option 2 — Local `npx` Stdio MCP (Claude Desktop / Cursor / Windsurf)

Add to your `claude_desktop_config.json` or `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "x402-agent-hub": {
      "command": "npx",
      "args": ["-y", "github:BlackCat-cyber-creator/x402-agent-hub-mcp"],
      "env": {
        "X402_BUYER_PRIVATE_KEY": "0xYOUR_SCOPED_AGENT_WALLET_PRIVATE_KEY"
      }
    }
  }
}
```

> **Security Tip:** Always use a dedicated, disposable agent wallet funded with only `$2`–`$5` USDC on **Base Mainnet** (`eip155:8453`) — never use a primary savings wallet.

## Direct HTTP / OpenAPI Discovery (No MCP Needed)

- **1-Click Web Storefront:** https://tryponcho.com/m/x402-agent-hub.x402-agent-hub.workers.dev
- **OpenAPI 3.1.0 Spec:** https://x402-agent-hub.x402-agent-hub.workers.dev/openapi.json
- **Agent Guide (`llms.txt`):** https://x402-agent-hub.x402-agent-hub.workers.dev/llms.txt

