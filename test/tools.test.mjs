// Tests for the stdio MCP server, run with Node's built-in test runner (`npm test`).
//
// They spawn the compiled dist/index.js over stdio, as an MCP host does. The child gets
// no X402_BUYER_PRIVATE_KEY, and X402_HUB_URL points at a mock hub on 127.0.0.1, so no
// test can sign a payment or reach the real hub.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const SERVER = fileURLToPath(new URL("../dist/index.js", import.meta.url));
const SCHEMA_SNAPSHOT = fileURLToPath(new URL("./fixtures/tool-schemas.json", import.meta.url));

// The public tool set. A change here adds or removes a buyer-facing tool.
const EXPECTED_TOOLS = [
  "get_hub_catalog",
  "get_ict_sessions",
  "get_cfd_microstructure",
  "calculate_prop_firm_risk",
  "extract_clean_markdown",
  "enrich_business_lead",
  "audit_technical_seo",
  "render_visual_card",
  "audit_crypto_token",
  "generate_outreach_dossier",
  "chain_native_balance",
  "chain_token_balance",
  "chain_token_info",
  "chain_transaction_status",
  "chain_address_info",
  "chain_ens_resolve",
  "chain_portfolio",
  "company_search",
  "company_profile",
  "company_financials",
  "company_filings",
  "company_insider_trades",
  "entity_search",
  "entity_company",
  "entity_person",
  "token_verdict",
];
const FREE_TOOLS = new Set(["get_hub_catalog"]);

// Each paid call is an irreversible USDC payment at the listed price: not read-only, not
// idempotent (a repeat call pays again). No tool deletes or overwrites the buyer's data,
// so none is destructive. All reach the live hub, so all are open-world.
const FREE_HINTS = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };
const PAID_HINTS = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true };
const HINT_KEYS = Object.keys(FREE_HINTS);

const PAYMENT_HEADERS = ["payment-signature", "x-payment"];

// Mock hub: the catalog answers 200, every paid route answers an x402 challenge.
const hubRequests = [];
const hub = http.createServer((req, res) => {
  hubRequests.push({ method: req.method, url: req.url, headers: req.headers });
  req.resume();
  if (req.url === "/") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ name: "mock hub" }));
    return;
  }
  const challenge = { x402Version: 2, accepts: [{ scheme: "exact", network: "eip155:8453", amount: "2000" }] };
  res.writeHead(402, {
    "content-type": "application/json",
    "payment-required": Buffer.from(JSON.stringify(challenge)).toString("base64"),
  });
  res.end("{}");
});

let client;
let tools;

before(
  async () => {
    await new Promise((resolve) => hub.listen(0, "127.0.0.1", resolve));
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [SERVER],
      // The SDK passes only a short allow-list of the parent's env (PATH and the like),
      // so no wallet key can leak in; the catalog test below confirms it.
      env: { X402_HUB_URL: `http://127.0.0.1:${hub.address().port}` },
      stderr: "pipe",
    });
    client = new Client({ name: "x402-agent-hub-mcp-tests", version: "0.0.0" });
    await client.connect(transport);
    ({ tools } = await client.listTools());
  },
  { timeout: 30_000 },
);

after(async () => {
  await client?.close();
  hub.closeAllConnections();
  await new Promise((resolve) => hub.close(resolve));
});

test("the tool set is exactly the expected one (none added or removed)", () => {
  const names = tools.map((t) => t.name);
  assert.deepEqual([...names].sort(), [...EXPECTED_TOOLS].sort());
});

test("tool names are unique", () => {
  const names = tools.map((t) => t.name);
  assert.equal(new Set(names).size, names.length);
});

test("every tool exposes an object input schema with described properties", () => {
  for (const tool of tools) {
    assert.equal(tool.inputSchema?.type, "object", `${tool.name}: inputSchema.type`);
    const props = tool.inputSchema.properties ?? {};
    assert.equal(typeof props, "object", `${tool.name}: properties`);
    for (const [key, schema] of Object.entries(props)) {
      assert.ok(schema.description?.trim(), `${tool.name}.${key}: missing description`);
    }
  }
});

// The buyer contract of one argument: everything but its description text.
function contractOf(schema) {
  const out = {};
  for (const key of ["type", "enum", "format", "default"]) {
    if (schema[key] !== undefined) out[key] = schema[key];
  }
  if (schema.items) out.items = contractOf(schema.items);
  return out;
}

function argumentContracts() {
  return Object.fromEntries(
    tools.map((tool) => [
      tool.name,
      {
        required: [...(tool.inputSchema.required ?? [])].sort(),
        properties: Object.fromEntries(
          Object.entries(tool.inputSchema.properties ?? {}).map(([key, schema]) => [key, contractOf(schema)]),
        ),
      },
    ]),
  );
}

// Argument names, types, enums, formats, required lists and defaults are buyer contracts
// that must match the hub API. Change the fixture only on purpose, with the hub change;
// UPDATE_SCHEMA_SNAPSHOT=1 npm test rewrites it from the current build.
test("argument schemas match the committed snapshot", () => {
  const current = argumentContracts();
  if (process.env.UPDATE_SCHEMA_SNAPSHOT === "1") {
    writeFileSync(SCHEMA_SNAPSHOT, `${JSON.stringify(current, null, 2)}\n`);
  }
  assert.deepEqual(current, JSON.parse(readFileSync(SCHEMA_SNAPSHOT, "utf8")));
});

test("every tool has a title and all four annotation hints with honest values", () => {
  for (const tool of tools) {
    assert.ok(tool.title?.trim(), `${tool.name}: title`);
    assert.equal(tool.annotations?.title, tool.title, `${tool.name}: annotations.title`);
    for (const key of HINT_KEYS) {
      assert.equal(typeof tool.annotations[key], "boolean", `${tool.name}: ${key} must be set`);
    }
    const hints = Object.fromEntries(HINT_KEYS.map((key) => [key, tool.annotations[key]]));
    assert.deepEqual(hints, FREE_TOOLS.has(tool.name) ? FREE_HINTS : PAID_HINTS, tool.name);
  }
});

test("descriptions agree with the free/paid annotations", () => {
  for (const tool of tools) {
    if (FREE_TOOLS.has(tool.name)) {
      assert.match(tool.description, /^FREE \(\$0\.00\)/, tool.name);
    } else {
      assert.match(tool.description, /\(\$0\.\d+ USDC on Base\)/, tool.name);
    }
  }
});

test("with no wallet configured the catalog says so", async () => {
  const result = await client.callTool({ name: "get_hub_catalog", arguments: {} });
  assert.notEqual(result.isError, true);
  const body = JSON.parse(result.content[0].text);
  assert.equal(body.buyerWalletConfigured, false);
  assert.deepEqual(body.hub, { name: "mock hub" });
});

// Smallest valid arguments for a tool, built from its JSON input schema.
function minimalArgs(inputSchema) {
  const args = {};
  for (const key of inputSchema.required ?? []) {
    const schema = inputSchema.properties[key];
    if (schema.enum) args[key] = schema.enum[0];
    else if (schema.type === "number") args[key] = 1;
    else if (schema.type === "array") args[key] = [];
    else if (schema.format === "uri") args[key] = "https://example.com";
    else args[key] = "0x0000000000000000000000000000000000000001";
  }
  return args;
}

test("with no wallet, every paid tool fails cleanly: one unsigned request, quote shown, no payment", async () => {
  const paid = tools.filter((t) => !FREE_TOOLS.has(t.name));
  assert.equal(paid.length, EXPECTED_TOOLS.length - FREE_TOOLS.size);
  for (const tool of paid) {
    const start = hubRequests.length;
    const result = await client.callTool({ name: tool.name, arguments: minimalArgs(tool.inputSchema) });
    const text = result.content?.[0]?.text ?? "";
    assert.equal(result.isError, true, `${tool.name}: must be an error result`);
    assert.match(text, /HTTP 402 Payment Required/, tool.name);
    assert.match(text, /\$0\.002 USDC on eip155:8453/, `${tool.name}: quote`);
    assert.match(text, /X402_BUYER_PRIVATE_KEY/, `${tool.name}: setup hint`);
    const sent = hubRequests.slice(start);
    assert.equal(sent.length, 1, `${tool.name}: exactly one hub request`);
    for (const header of PAYMENT_HEADERS) {
      assert.equal(sent[0].headers[header], undefined, `${tool.name}: sent ${header}`);
    }
  }
});
