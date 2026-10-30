---
name: x402-agent-hub
description: Institutional onchain Base/EVM/Solana token honeypot & DEX liquidity audits, ECN CFD/Forex microstructure & ICT killzones (XAUUSD, NAS100, BTCUSD, EURUSD), prop-firm position sizing, B2B WhatsApp/SEO outreach dossiers, and deterministic SVG/PNG visual cards via x402 Base Mainnet USDC micropayments. Use whenever auditing a crypto token contract for rug/tax/slippage risk, checking Forex/CFD spreads or ICT Silver Bullet killzones, sizing prop-firm lots, enriching business leads for sales outreach, auditing technical SEO, or rendering typo-free OpenGraph/KPI cards.
---

# x402 Agent Hub Skill

Pay-per-call (`$0.005`–`$0.050` USDC on **Base Mainnet**, `eip155:8453`) intelligence & rendering endpoints powered by the open **x402 v2** protocol — zero API keys, zero accounts, zero monthly subscriptions.

- **Gateway Origin:** `https://x402-agent-hub.x402-agent-hub.workers.dev`
- **OpenAPI 3.1 Spec:** `https://x402-agent-hub.x402-agent-hub.workers.dev/openapi.json`
- **Remote Streamable HTTP MCP:** `https://x402-agent-hub.x402-agent-hub.workers.dev/mcp`
- **Web Storefront:** `https://tryponcho.com/m/x402-agent-hub.x402-agent-hub.workers.dev`

## Available Endpoints & MCP Tools

1. **Onchain Token Rug, Honeypot, Tax & DEX Liquidity Audit (`$0.050` USDC)**
   - **HTTP:** `POST /v1/crypto/token-audit`
   - **MCP Tool:** `audit_crypto_token`
   - **Body:** `{ "tokenAddress": "0x940181a94A35A4569E4529A3CDfB74e38FD98631", "chain": "base", "intendedOrderUsd": 2500 }`
   - Supports `base`, `ethereum`, `arbitrum`, `optimism`, `polygon`, `bsc`, `avalanche`, and `solana`. Returns `0-100` `safetyScore`, `verdict`, `riskFlags`, GoPlus bytecode flags, DexScreener pool depth + AMM price-impact sizing, and `swapSimulation`: a live buy → sell round trip from a fresh wallet (Base, Ethereum, BSC, Arbitrum, Optimism, Polygon) with measured `buyTaxPercent` / `sellTaxPercent`. A `SELL_BLOCKED` status forces `DO_NOT_TRADE_CRITICAL_RISK`.

2. **All-in-One B2B SDR Outreach Dossier (`$0.050` USDC)**
   - **HTTP:** `POST /v1/web/outreach-dossier`
   - **MCP Tool:** `generate_outreach_dossier`
   - **Body:** `{ "url": "https://target-company.com", "agencyOffer": "Next.js conversion redesign & AI WhatsApp booking" }`
   - Single-call Brand Sanitizer, Phantom Lead Shield (`wa.me` / `linktr.ee` / marketplace detector), normalized E.164 WhatsApp/mobile & email extraction, `0-100` SEO revenue-leak audit, and ready-to-send personalized WhatsApp + Cold Email scripts.

3. **ICT Killzones, Silver Bullets & CFD Rollover Alerts (`$0.005` USDC)**
   - **HTTP:** `GET /v1/trading/sessions?at=<optional-ISO-8601>`
   - **MCP Tool:** `get_ict_sessions`

4. **Institutional ECN CFD & Forex Microstructure Oracle (`$0.010` USDC)**
   - **HTTP:** `GET /v1/trading/microstructure?symbol=XAUUSD`
   - **MCP Tool:** `get_cfd_microstructure`
   - Covers 14 symbols (`XAUUSD`, `BTCUSD`, `NAS100`, `US30`, `US500`, `GER40`, `JPN225`, `USOUSD`, `EURUSD`, `GBPUSD`, `USDJPY`, `AUDUSD`, `USDCAD`, `XAGUSD`).

5. **Prop-Firm Lot Sizing & Drawdown Auto-Lock Guard (`$0.010` USDC)**
   - **HTTP:** `POST /v1/trading/prop-risk`
   - **MCP Tool:** `calculate_prop_firm_risk`
   - **Body:** `{ "symbol": "XAUUSD", "accountBalanceUsd": 100000, "currentEquityUsd": 99200, "riskPercent": 0.5, "stopLossPriceDistance": 4.5 }`

6. **Clean LLM Webpage Markdown Extractor (`$0.005` USDC)**
   - **HTTP:** `POST /v1/web/extract` (`{ "url": "https://example.com" }`)
   - **MCP Tool:** `extract_clean_markdown`

7. **Business Lead & E.164 WhatsApp Enricher (`$0.015` USDC)**
   - **HTTP:** `POST /v1/web/lead-enrich` (`{ "url": "https://example.com" }`)
   - **MCP Tool:** `enrich_business_lead`

8. **Technical SEO & Modernization Audit (`$0.020` USDC)**
   - **HTTP:** `POST /v1/web/seo-audit` (`{ "url": "https://example.com" }`)
   - **MCP Tool:** `audit_technical_seo`

9. **Deterministic SVG / PNG Visual Card Studio (`$0.025` USDC)**
   - **HTTP:** `POST /v1/render/card` (`{ "template": "trading_signal", "title": "XAUUSD NY Open", "sparkline": [40, 44, 51, 63, 68], "format": "json" }`)
   - **MCP Tool:** `render_visual_card`

## How Agents Connect & Pay

- **Option A — Remote Streamable HTTP MCP:** Connect your MCP client to `https://x402-agent-hub.x402-agent-hub.workers.dev/mcp` (no wallet key is sent; paid tools accept a client-signed `paymentSignature` argument).
- **Option B — Local Stdio MCP:** `npx -y github:BlackCat-cyber-creator/x402-agent-hub-mcp` with `X402_BUYER_PRIVATE_KEY=0x...` (payments are signed locally; the key never leaves your machine).
- **Option C — Direct x402 HTTP (`@x402/fetch` or AgentCash CLI):**
  ```bash
  npx --yes agentcash fetch https://x402-agent-hub.x402-agent-hub.workers.dev/v1/crypto/token-audit \
    -m POST -b '{"tokenAddress":"0x940181a94A35A4569E4529A3CDfB74e38FD98631","chain":"base"}'
  ```

