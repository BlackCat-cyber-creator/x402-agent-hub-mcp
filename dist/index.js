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
    ? (RAW_KEY.startsWith("0x") ? RAW_KEY : `0x${RAW_KEY}`)
    : undefined;
function buildHttpFetcher() {
    if (!BUYER_KEY)
        return fetch;
    const signer = privateKeyToAccount(BUYER_KEY);
    const client = new x402Client();
    registerExactEvmScheme(client, { signer });
    return wrapFetchWithPayment(fetch, client);
}
const paidFetch = buildHttpFetcher();
async function callHub(path, init) {
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
            }
            catch {
                // ignore header parse error
            }
        }
        throw new Error(`HTTP 402 Payment Required${quoteDetails}. Configure X402_BUYER_PRIVATE_KEY with a scoped Base Mainnet USDC agent wallet ($1-$5 USDC), or try the 1-click storefront at https://tryponcho.com/m/x402-agent-hub.x402-agent-hub.workers.dev`);
    }
    const text = await res.text();
    if (!res.ok) {
        throw new Error(`x402 Agent Hub returned HTTP ${res.status}: ${text}`);
    }
    return text;
}
const server = new McpServer({
    name: "x402-agent-hub",
    version: "1.4.0",
});
server.tool("get_hub_catalog", "FREE ($0.00): Inspect the live x402 Agent Hub service catalog, supported CFD/Forex tickers, per-call USDC pricing, and wallet payment readiness.", {}, async () => {
    const res = await fetch(`${HUB_URL}/`, {
        headers: { Accept: "application/json" },
    });
    const catalog = await res.json();
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify({
                    buyerWalletConfigured: Boolean(BUYER_KEY),
                    storefrontUrl: "https://tryponcho.com/m/x402-agent-hub.x402-agent-hub.workers.dev",
                    hub: catalog,
                }, null, 2),
            },
        ],
    };
});
server.tool("get_ict_sessions", "Get live ICT Killzones (Asian, London Open, NY Open, London Close), 60m Silver Bullet FVG windows, CFD rollover spread-danger alerts, and Wednesday/Friday triple-swap flags ($0.005 USDC on Base).", {
    at: z
        .string()
        .optional()
        .describe("Optional ISO-8601 UTC timestamp to evaluate (defaults to live current UTC time)"),
}, async ({ at }) => {
    const qs = at ? `?at=${encodeURIComponent(at)}` : "";
    return {
        content: [{ type: "text", text: await callHub(`/v1/trading/sessions${qs}`) }],
    };
});
server.tool("get_cfd_microstructure", "Get institutional ECN calibrated spreads, round-turn commissions, M1 ATR, spread-to-ATR execution cost ratios across M1-H1, scalping suitability, and live MT5 FVGs for XAUUSD, BTCUSD, NAS100, US30, US500, GER40, JPN225, USOUSD, EURUSD, GBPUSD, USDJPY ($0.01 USDC on Base).", {
    symbol: z
        .string()
        .optional()
        .describe("Optional ticker like XAUUSD, NAS100, BTCUSD, US30, GER40, USOUSD, EURUSD. Omit for all 14 symbols."),
}, async ({ symbol }) => {
    const qs = symbol ? `?symbol=${encodeURIComponent(symbol)}` : "";
    return {
        content: [{ type: "text", text: await callHub(`/v1/trading/microstructure${qs}`) }],
    };
});
server.tool("calculate_prop_firm_risk", "Calculate exact CFD/Forex lot size factoring ECN spread+commission friction and prop-firm daily/max drawdown auto-lock status ($0.01 USDC on Base).", {
    symbol: z.string().describe("Instrument symbol, e.g. XAUUSD, NAS100, BTCUSD, EURUSD"),
    accountBalanceUsd: z.number().describe("Starting/reference prop-firm account balance in USD (e.g. 100000)"),
    currentEquityUsd: z.number().optional().describe("Current live account equity in USD"),
    riskPercent: z.number().describe("Risk percentage per trade (e.g. 0.5 for 0.5%)"),
    stopLossPriceDistance: z
        .number()
        .describe("Stop-loss distance in raw price units (e.g. 4.5 on XAUUSD, 25 on NAS100)"),
    dailyDrawdownLimitPercent: z.number().optional().describe("Daily drawdown breach % (default 5)"),
    maxTotalDrawdownLimitPercent: z.number().optional().describe("Max total drawdown breach % (default 10)"),
}, async (input) => ({
    content: [
        {
            type: "text",
            text: await callHub("/v1/trading/prop-risk", {
                method: "POST",
                body: JSON.stringify(input),
            }),
        },
    ],
}));
server.tool("extract_clean_markdown", "Fetch any public webpage and convert it into clean, token-efficient LLM Markdown with metadata and token count ($0.005 USDC on Base).", {
    url: z.string().url().describe("Public http/https URL to convert to Markdown"),
    maxChars: z.number().optional().describe("Maximum Markdown characters (500-50000, default 15000)"),
}, async (input) => ({
    content: [
        {
            type: "text",
            text: await callHub("/v1/web/extract", {
                method: "POST",
                body: JSON.stringify(input),
            }),
        },
    ],
}));
server.tool("enrich_business_lead", "Enrich a business URL for SDR/sales outreach: sanitize noisy brand names, detect phantom wa.me/linktr.ee/marketplace links, extract normalized E.164 WhatsApp/mobile phones (rejecting office PSTN landlines), find emails/socials, and detect CMS/analytics pixels ($0.015 USDC on Base).", {
    url: z.string().describe("Business website, social bio, or marketplace URL"),
    businessName: z.string().optional().describe("Optional raw business title to sanitize"),
}, async (input) => ({
    content: [
        {
            type: "text",
            text: await callHub("/v1/web/lead-enrich", {
                method: "POST",
                body: JSON.stringify(input),
            }),
        },
    ],
}));
server.tool("audit_technical_seo", "Run an instant 0-100 Technical SEO & Website Modernization Audit scorecard with prioritized fixes ($0.02 USDC on Base).", {
    url: z.string().describe("Target website URL to audit"),
}, async (input) => ({
    content: [
        {
            type: "text",
            text: await callHub("/v1/web/seo-audit", {
                method: "POST",
                body: JSON.stringify(input),
            }),
        },
    ],
}));
server.tool("render_visual_card", "Render a deterministic, typo-free 1200x630 OpenGraph banner, 1080x1350 social KPI slide, or trading signal sparkline card as SVG + data URI ($0.025 USDC on Base).", {
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
}, async (input) => ({
    content: [
        {
            type: "text",
            text: await callHub("/v1/render/card", {
                method: "POST",
                body: JSON.stringify({ ...input, format: "json" }),
            }),
        },
    ],
}));
server.tool("audit_crypto_token", "Audit any Base, Ethereum, Arbitrum, Optimism, Polygon, BSC, Avalanche, or Solana token contract for honeypots, buy/sell transfer taxes, hidden ownership, whale concentration, LP locks, live DEX liquidity depth, and AMM slippage impact for an intended USD trade size. On Base, Ethereum, BSC, Arbitrum, Optimism and Polygon it also simulates a real buy -> sell round trip to measure actual taxes and confirm the token can be sold ($0.01 USDC on Base).", {
    tokenAddress: z
        .string()
        .describe("0x-prefixed EVM token contract address or Base58 Solana mint address"),
    chain: z
        .enum(["base", "ethereum", "arbitrum", "optimism", "polygon", "bsc", "avalanche", "solana"])
        .optional()
        .describe("Target chain (defaults to 'base' for 0x addresses or 'solana' for Base58)"),
    intendedOrderUsd: z
        .number()
        .optional()
        .describe("Intended swap size in USD to estimate AMM pool price impact (default 1000)"),
}, async (input) => ({
    content: [
        {
            type: "text",
            text: await callHub("/v1/crypto/token-audit", {
                method: "POST",
                body: JSON.stringify(input),
            }),
        },
    ],
}));
server.tool("generate_outreach_dossier", "Generate a complete B2B SDR Outreach Dossier in 1 call: Brand Sanitizer, Phantom Lead Shield, E.164 WhatsApp/email contacts, CMS/pixel stack, 0-100 Technical SEO revenue-leak audit, and ready-to-send personalized WhatsApp & Cold Email scripts ($0.05 USDC on Base).", {
    url: z.string().describe("Target business website, social bio, or marketplace URL"),
    businessName: z.string().optional().describe("Optional raw business title to sanitize"),
    agencyOffer: z
        .string()
        .optional()
        .describe("Optional description of your product/agency offer to weave into the scripts"),
}, async (input) => ({
    content: [
        {
            type: "text",
            text: await callHub("/v1/web/outreach-dossier", {
                method: "POST",
                body: JSON.stringify(input),
            }),
        },
    ],
}));
// Data APIs: cheap single reads across 7 EVM chains and US public-company data from SEC
// EDGAR. Failed reads (bad input, not found, upstream outage) return an error status and
// are never charged.
const CHAIN = z
    .string()
    .optional()
    .describe("base (default), ethereum, arbitrum, optimism, polygon, bsc or avalanche");
const ADDRESS = z.string().describe("0x-prefixed wallet or contract address");
const TOKEN = z.string().describe("0x-prefixed ERC-20 token contract address");
const TICKER = z.string().optional().describe("US stock ticker, e.g. AAPL or BRK.B (or pass cik)");
const CIK = z.string().optional().describe("SEC Central Index Key, e.g. 320193 (alternative to ticker)");
const DATA_TOOLS = [
    {
        name: "chain_native_balance",
        path: "/v1/chain/balance",
        description: "Native coin balance (ETH, BNB, POL, AVAX) of any address on 7 EVM chains, raw and formatted ($0.002 USDC on Base).",
        shape: { chain: CHAIN, address: ADDRESS },
    },
    {
        name: "chain_token_balance",
        path: "/v1/chain/token-balance",
        description: "ERC-20 balance of an address, already scaled by the token's decimals, with symbol ($0.002 USDC on Base).",
        shape: { chain: CHAIN, address: ADDRESS, token: TOKEN },
    },
    {
        name: "chain_token_info",
        path: "/v1/chain/token-info",
        description: "ERC-20 name, symbol, decimals and formatted total supply ($0.002 USDC on Base).",
        shape: { chain: CHAIN, token: TOKEN },
    },
    {
        name: "chain_transaction_status",
        path: "/v1/chain/tx",
        description: "Transaction status (pending/success/reverted), confirmations, block time, value and all-in fee incl. L1 data fee ($0.002 USDC on Base).",
        shape: { chain: CHAIN, hash: z.string().describe("0x-prefixed 32-byte transaction hash") },
    },
    {
        name: "chain_address_info",
        path: "/v1/chain/address-info",
        description: "Classify an address before interacting: EOA, EIP-7702-delegated EOA or contract, nonce, balance, and proxy implementation (EIP-1967, ZeppelinOS, EIP-1167) ($0.003 USDC on Base).",
        shape: { chain: CHAIN, address: ADDRESS },
    },
    {
        name: "chain_ens_resolve",
        path: "/v1/chain/ens",
        description: "Resolve an ENS name to an address, or an address to its primary ENS name. Pass exactly one of name/address ($0.002 USDC on Base).",
        shape: {
            name: z.string().optional().describe("ENS name, e.g. vitalik.eth"),
            address: z.string().optional().describe("Address to reverse-resolve"),
        },
    },
    {
        name: "chain_portfolio",
        path: "/v1/chain/portfolio",
        description: "One-call multichain portfolio: native + USDC/USDT balances on Base, Ethereum, Arbitrum, Optimism, Polygon, BSC and Avalanche, with total stablecoin USD ($0.005 USDC on Base).",
        shape: {
            address: ADDRESS,
            chains: z.string().optional().describe("Optional comma-separated subset, e.g. base,arbitrum"),
        },
    },
    {
        name: "company_search",
        path: "/v1/company/search",
        description: "Find a US public company's ticker, legal name, exchange and SEC CIK by name or ticker ($0.002 USDC on Base).",
        shape: {
            q: z.string().describe("Ticker or company name fragment, e.g. nvidia"),
            limit: z.string().optional().describe("Max results, 1-25 (default 10)"),
        },
    },
    {
        name: "company_profile",
        path: "/v1/company/profile",
        description: "SEC company profile: industry, exchanges, fiscal year end, address, former names and links to the latest 10-K/10-Q/8-K ($0.002 USDC on Base).",
        shape: { ticker: TICKER, cik: CIK },
    },
    {
        name: "company_financials",
        path: "/v1/company/financials",
        description: "Annual or quarterly fundamentals from SEC XBRL (US-GAAP filers): revenue, operating/net income, diluted EPS, operating cash flow, capex, free cash flow, assets, liabilities, equity, cash, margins and YoY growth ($0.005 USDC on Base).",
        shape: {
            ticker: TICKER,
            cik: CIK,
            period: z.string().optional().describe("annual (default) or quarterly"),
            limit: z.string().optional().describe("Number of periods, 1-12 (default 4)"),
        },
    },
    {
        name: "company_filings",
        path: "/v1/company/filings",
        description: "Latest SEC filings (10-K, 10-Q, 8-K, S-1...) with 8-K item numbers and direct document links, filterable by form and date ($0.002 USDC on Base).",
        shape: {
            ticker: TICKER,
            cik: CIK,
            form: z.string().optional().describe("Comma-separated form types, e.g. 10-K,8-K"),
            since: z.string().optional().describe("Only filings on/after YYYY-MM-DD"),
            limit: z.string().optional().describe("Max filings, 1-50 (default 10)"),
        },
    },
    {
        name: "company_insider_trades",
        path: "/v1/company/insider-trades",
        description: "Parsed SEC Form 4 insider trades: insider name and role, buy/sell/award code, shares, price, USD value, holdings after, 10b5-1 flag, plus a buy/sell summary ($0.005 USDC on Base).",
        shape: {
            ticker: TICKER,
            cik: CIK,
            limit: z.string().optional().describe("Recent Form 4 filings to parse, 1-20 (default 10)"),
        },
    },
];
for (const tool of DATA_TOOLS) {
    server.tool(tool.name, tool.description, tool.shape, async (args) => {
        const query = new URLSearchParams();
        for (const [key, value] of Object.entries(args)) {
            if (typeof value === "string" && value.trim())
                query.set(key, value.trim());
        }
        const qs = query.toString();
        return {
            content: [{ type: "text", text: await callHub(qs ? `${tool.path}?${qs}` : tool.path, { method: "GET" }) }],
        };
    });
}
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((err) => {
    console.error("MCP server fatal error:", err);
    process.exit(1);
});
