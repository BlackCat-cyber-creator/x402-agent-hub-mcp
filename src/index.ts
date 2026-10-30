#!/usr/bin/env node
/**
 * x402 Agent Hub — Official Model Context Protocol (MCP) Client Server
 *
 * Connects Claude Desktop, Claude Code, Cursor, Windsurf, OpenCode, and any MCP host
 * to the live x402 Agent Hub gateway with automatic Base Mainnet USDC micropayments.
 *
 * Environment Variables:
 *   X402_BUYER_PRIVATE_KEY - Optional scoped EVM private key (0x...) funded with $1-$5 USDC on Base Mainnet
 *   X402_HUB_URL           - Optional gateway override (defaults to https://x402-agent-hub.x402-agent-hub.workers.dev)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import { z } from "zod";

const DEFAULT_HUB_URL = "https://x402-agent-hub.x402-agent-hub.workers.dev";
const HUB_URL = (process.env.X402_HUB_URL || DEFAULT_HUB_URL).replace(/\/$/, "");
const RAW_KEY = process.env.X402_BUYER_PRIVATE_KEY?.trim();
const BUYER_KEY = RAW_KEY
  ? ((RAW_KEY.startsWith("0x") ? RAW_KEY : `0x${RAW_KEY}`) as `0x${string}`)
  : undefined;

function buildHttpFetcher(): typeof globalThis.fetch {
  if (!BUYER_KEY) return fetch;
  const signer = privateKeyToAccount(BUYER_KEY);
  const client = new x402Client();
  registerExactEvmScheme(client, { signer });
  return wrapFetchWithPayment(fetch, client);
}

const paidFetch = buildHttpFetcher();

async function callHub(path: string, init?: RequestInit): Promise<string> {
  const res = await paidFetch(`${HUB_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (res.status === 402) {
    const paymentHeader = res.headers.get("payment-required");
    let quoteDetails = "";
    if (paymentHeader) {
      try {
        const decoded = JSON.parse(Buffer.from(paymentHeader, "base64").toString("utf8"));
        const accept = decoded?.accepts?.[0];
        if (accept?.amount) {
          const usd = (Number(accept.amount) / 1_000_000).toFixed(3);
          quoteDetails = ` (Quote: $${usd} USDC on ${accept.network})`;
        }
      } catch {
        // ignore header parse error
      }
    }
    throw new Error(
      `HTTP 402 Payment Required${quoteDetails}. Configure X402_BUYER_PRIVATE_KEY with a scoped Base Mainnet USDC agent wallet ($1-$5 USDC), or try the 1-click storefront at https://tryponcho.com/m/x402-agent-hub.x402-agent-hub.workers.dev`,
    );
  }

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`x402 Agent Hub returned HTTP ${res.status}: ${text}`);
  }
  return text;
}

const server = new McpServer({
  name: "x402-agent-hub",
  version: "1.0.0",
});

server.tool(
  "get_hub_catalog",
  "FREE ($0.00): Inspect the live x402 Agent Hub service catalog, supported CFD/Forex tickers, per-call USDC pricing, and wallet payment readiness.",
  {},
  async () => {
    const res = await fetch(`${HUB_URL}/`, {
      headers: { Accept: "application/json" },
    });
    const catalog = await res.json();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              buyerWalletConfigured: Boolean(BUYER_KEY),
              storefrontUrl: "https://tryponcho.com/m/x402-agent-hub.x402-agent-hub.workers.dev",
              hub: catalog,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.tool(
  "get_ict_sessions",
  "Get live ICT Killzones (Asian, London Open, NY Open, London Close), 60m Silver Bullet FVG windows, CFD rollover spread-danger alerts, and Wednesday/Friday triple-swap flags ($0.005 USDC on Base).",
  {
    at: z
      .string()
      .optional()
      .describe("Optional ISO-8601 UTC timestamp to evaluate (defaults to live current UTC time)"),
  },
  async ({ at }) => {
    const qs = at ? `?at=${encodeURIComponent(at)}` : "";
    return {
      content: [{ type: "text", text: await callHub(`/v1/trading/sessions${qs}`) }],
    };
  },
);

server.tool(
  "get_cfd_microstructure",
  "Get institutional ECN calibrated spreads, round-turn commissions, M1 ATR, spread-to-ATR execution cost ratios across M1-H1, scalping suitability, and live MT5 FVGs for XAUUSD, BTCUSD, NAS100, US30, US500, GER40, JPN225, USOUSD, EURUSD, GBPUSD, USDJPY ($0.01 USDC on Base).",
  {
    symbol: z
      .string()
      .optional()
      .describe("Optional ticker like XAUUSD, NAS100, BTCUSD, US30, GER40, USOUSD, EURUSD. Omit for all 14 symbols."),
  },
  async ({ symbol }) => {
    const qs = symbol ? `?symbol=${encodeURIComponent(symbol)}` : "";
    return {
      content: [{ type: "text", text: await callHub(`/v1/trading/microstructure${qs}`) }],
    };
  },
);

server.tool(
  "calculate_prop_firm_risk",
  "Calculate exact CFD/Forex lot size factoring ECN spread+commission friction and prop-firm daily/max drawdown auto-lock status ($0.01 USDC on Base).",
  {
    symbol: z.string().describe("Instrument symbol, e.g. XAUUSD, NAS100, BTCUSD, EURUSD"),
    accountBalanceUsd: z.number().describe("Starting/reference prop-firm account balance in USD (e.g. 100000)"),
    currentEquityUsd: z.number().optional().describe("Current live account equity in USD"),
    riskPercent: z.number().describe("Risk percentage per trade (e.g. 0.5 for 0.5%)"),
    stopLossPriceDistance: z
      .number()
      .describe("Stop-loss distance in raw price units (e.g. 4.5 on XAUUSD, 25 on NAS100)"),
    dailyDrawdownLimitPercent: z.number().optional().describe("Daily drawdown breach % (default 5)"),
    maxTotalDrawdownLimitPercent: z.number().optional().describe("Max total drawdown breach % (default 10)"),
  },
  async (input) => ({
    content: [
      {
        type: "text",
        text: await callHub("/v1/trading/prop-risk", {
          method: "POST",
          body: JSON.stringify(input),
        }),
      },
    ],
  }),
);

server.tool(
  "extract_clean_markdown",
  "Fetch any public webpage and convert it into clean, token-efficient LLM Markdown with metadata and token count ($0.005 USDC on Base).",
  {
    url: z.string().url().describe("Public http/https URL to convert to Markdown"),
    maxChars: z.number().optional().describe("Maximum Markdown characters (500-50000, default 15000)"),
  },
  async (input) => ({
    content: [
      {
        type: "text",
        text: await callHub("/v1/web/extract", {
          method: "POST",
          body: JSON.stringify(input),
        }),
      },
    ],
  }),
);

server.tool(
  "enrich_business_lead",
  "Enrich a business URL for SDR/sales outreach: sanitize noisy brand names, detect phantom wa.me/linktr.ee/marketplace links, extract normalized E.164 WhatsApp/mobile phones (rejecting office PSTN landlines), find emails/socials, and detect CMS/analytics pixels ($0.015 USDC on Base).",
  {
    url: z.string().describe("Business website, social bio, or marketplace URL"),
    businessName: z.string().optional().describe("Optional raw business title to sanitize"),
  },
  async (input) => ({
    content: [
      {
        type: "text",
        text: await callHub("/v1/web/lead-enrich", {
          method: "POST",
          body: JSON.stringify(input),
        }),
      },
    ],
  }),
);

server.tool(
  "audit_technical_seo",
  "Run an instant 0-100 Technical SEO & Website Modernization Audit scorecard with prioritized fixes ($0.02 USDC on Base).",
  {
    url: z.string().describe("Target website URL to audit"),
  },
  async (input) => ({
    content: [
      {
        type: "text",
        text: await callHub("/v1/web/seo-audit", {
          method: "POST",
          body: JSON.stringify(input),
        }),
      },
    ],
  }),
);

server.tool(
  "render_visual_card",
  "Render a deterministic, typo-free 1200x630 OpenGraph banner, 1080x1350 social KPI slide, or trading signal sparkline card as SVG + data URI ($0.025 USDC on Base).",
  {
    template: z.enum(["og_banner", "social_kpi", "trading_signal"]).optional(),
    title: z.string().describe("Primary card headline"),
    subtitle: z.string().optional(),
    badge: z.string().optional(),
    metricLabel: z.string().optional(),
    metricValue: z.string().optional(),
    metricDelta: z.string().optional(),
    sparkline: z.array(z.number()).optional().describe("Numeric values for area sparkline chart"),
    brandName: z.string().optional(),
    accentColor: z.string().optional().describe("6-digit hex accent color, e.g. #10B981"),
    theme: z.enum(["dark", "light"]).optional(),
  },
  async (input) => ({
    content: [
      {
        type: "text",
        text: await callHub("/v1/render/card", {
          method: "POST",
          body: JSON.stringify({ ...input, format: "json" }),
        }),
      },
    ],
  }),
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("MCP server fatal error:", err);
  process.exit(1);
});

