#!/usr/bin/env node
/**
 * Example 3 - talk to the remote Streamable HTTP MCP server with plain fetch.
 * No dependencies: Node 18+ only.
 *
 * Three free calls:
 *   1. initialize   - protocol handshake
 *   2. tools/list   - how many tools, is token_verdict there
 *   3. tools/call   - token_verdict with no paymentSignature, which returns
 *                     the 402 quote as ordinary text instead of a verdict
 *
 * Nothing here pays. For a paid result, sign the x402 payment on your own
 * machine and pass it as the tool's paymentSignature argument, or run the
 * local stdio server with X402_BUYER_PRIVATE_KEY (see README.md).
 */

const HUB = (process.env.X402_HUB_URL || "https://x402-agent-hub.x402-agent-hub.workers.dev").replace(/\/$/, "");
const MCP = HUB.endsWith("/mcp") ? HUB : `${HUB}/mcp`;

const TOKEN = process.env.TOKEN || "0x940181a94A35A4569E4529A3CDfB74e38FD98631"; // AERO on Base

/** One stateless JSON-RPC round trip. No session id: POST /mcp answers and closes. */
async function rpc(payload) {
  const res = await fetch(MCP, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`HTTP ${res.status}, non-JSON body: ${text.slice(0, 200)}`);
  }
  if (body.error) throw new Error(`JSON-RPC error ${body.error.code}: ${body.error.message}`);
  return { status: res.status, body };
}

async function main() {
  let nextId = 1;
  const rpcCall = (method, params) => rpc({ jsonrpc: "2.0", id: nextId++, method, params });

  console.log(`MCP endpoint: ${MCP}`);
  console.log("");

  // 1. Handshake. Free.
  const init = await rpcCall("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "x402-agent-hub-example", version: "1.0.0" },
  });
  const server = init.body.result?.serverInfo ?? {};
  console.log(
    `initialize   HTTP ${init.status}  ${server.name} ${server.version}  protocol ${init.body.result?.protocolVersion}`,
  );
  console.log("");

  // 2. Discovery. Free, and the list is how an agent decides what exists.
  const list = await rpcCall("tools/list", {});
  const tools = list.body.result?.tools ?? [];
  const verdictTool = tools.find((t) => t.name === "token_verdict");
  const required = verdictTool?.inputSchema?.required ?? [];
  const optional = Object.keys(verdictTool?.inputSchema?.properties ?? {}).filter((k) => !required.includes(k));
  console.log(`tools/list   HTTP ${list.status}  ${tools.length} tools`);
  console.log(`token_verdict: ${verdictTool ? "present" : "MISSING"}`);
  if (verdictTool) {
    console.log(`  required args  ${required.filter((k) => k !== "paymentSignature").join(", ") || "none"}`);
    console.log(`  optional args  ${optional.join(", ")}`);
  }
  console.log("");

  // 3. Call the paid tool with no payment. The server answers 200 with a JSON
  //    string that describes the 402 quote, so a client can pay and retry.
  const call = await rpcCall("tools/call", {
    name: "token_verdict",
    arguments: { token: TOKEN, chain: "base" },
  });
  const text = call.body.result?.content?.[0]?.text;
  if (typeof text !== "string") throw new Error("tools/call returned no text content");
  const quote = JSON.parse(text);

  console.log(`tools/call   token_verdict without paymentSignature   HTTP ${call.status}`);
  console.log(`  error  ${quote.error}`);
  console.log("  howToPay");
  const lines = quote.howToPay ?? [];
  for (const line of lines.slice(0, 3)) console.log(`    ${line}`);
  if (lines.length > 3) {
    console.log(`    (${lines.length - 3} more option${lines.length - 3 === 1 ? "" : "s"} in the full string)`);
  }

  const header = quote.paymentRequiredHeaderBase64 ?? "";
  console.log(`  paymentRequiredHeaderBase64  ${header.slice(0, 80)}...  (${header.length} chars)`);

  if (header) {
    const decoded = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
    const accept = decoded.accepts?.[0];
    if (accept) {
      const usd = (Number(accept.amount) / 1_000_000).toFixed(3);
      console.log(
        `  decodes to  ${accept.scheme} ${accept.amount} atomic USDC = $${usd} on ${accept.network}, payTo ${accept.payTo}`,
      );
    }
  }

  console.log("");
  console.log("Nothing was charged: no payment was attached, so no funds moved.");
  console.log("README.md shows the two ways to turn this quote into a paid verdict.");
}

main().catch((err) => {
  console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
