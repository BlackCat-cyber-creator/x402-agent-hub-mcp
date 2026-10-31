#!/usr/bin/env node
/**
 * Example 1 - buy one x402 answer over plain HTTP.
 *
 * Without a key: send the request, read the HTTP 402 quote, print it. No
 * wallet, no payment, costs nothing.
 * With a key: sign an EIP-3009 USDC authorization for $0.015 on Base and
 * print the token verdict.
 *
 * The key is read from BUYER_PRIVATE_KEY or X402_BUYER_PRIVATE_KEY only.
 * It is never printed, never written to disk and never sent to the server:
 * only the address appears in the output.
 *
 * Node 18+ (global fetch, ESM).
 */

import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const HUB = (process.env.X402_HUB_URL || "https://x402-agent-hub.x402-agent-hub.workers.dev").replace(/\/$/, "");

// AERO on Base. Swap TOKEN / CHAIN to price any other token.
const TOKEN = process.env.TOKEN || "0x940181a94A35A4569E4529A3CDfB74e38FD98631";
const CHAIN = process.env.CHAIN || "base";

const endpoint = `${HUB}/v1/crypto/token-verdict?token=${TOKEN}&chain=${CHAIN}`;

const rawKey = (process.env.BUYER_PRIVATE_KEY || process.env.X402_BUYER_PRIVATE_KEY || "").trim();
const key = rawKey ? (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) : undefined;

/** 6-decimal USDC atomic units -> dollars, e.g. 15000 -> $0.015 */
const dollars = (atomic) => `$${(Number(atomic) / 1_000_000).toFixed(3)}`;

/**
 * Unpaid path: one fetch, expect 402, decode the payment-required header.
 * This is the machine-readable quote every x402 client starts from.
 */
async function showQuote() {
  console.log("No BUYER_PRIVATE_KEY set, so this run is the unpaid path: it reads the 402 quote only.");
  console.log("");
  console.log(`GET ${endpoint}`);

  const res = await fetch(endpoint);
  const body = await res.text();
  if (res.status !== 402) {
    throw new Error(`expected HTTP 402 without a payment, got HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const header = res.headers.get("payment-required");
  if (!header) throw new Error("HTTP 402 without a payment-required header");

  const quote = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
  const accept = quote.accepts?.[0];
  if (!accept) throw new Error("payment-required header has no accepts[] entry");

  console.log(`HTTP ${res.status} ${res.statusText}`);
  console.log(`body: ${body}`);
  console.log("");
  console.log("decoded payment-required header:");
  console.log(`  network           ${accept.network}`);
  console.log(`  scheme            ${accept.scheme}`);
  console.log(`  asset             ${accept.asset}`);
  console.log(`  amount            ${accept.amount} atomic units = ${dollars(accept.amount)} USDC`);
  console.log(`  payTo             ${accept.payTo}`);
  console.log(`  maxTimeoutSeconds ${accept.maxTimeoutSeconds}`);
  console.log(`  resource          ${quote.resource?.url}`);
  console.log("");
  console.log("To buy this answer, put a dedicated wallet's key in the environment (never in a file),");
  console.log("fund it with $2-5 USDC on Base, and run the same command again:");
  console.log("");
  console.log("  BUYER_PRIVATE_KEY=0x...  node verdict.mjs");
  console.log("");
  console.log("A call that fails is not charged.");
}

/**
 * Paid path: wrap fetch so a 402 is answered with a signed USDC authorization.
 * $0.015 leaves the wallet only if the verdict comes back.
 */
async function buyVerdict() {
  const signer = privateKeyToAccount(key);
  console.log(`Paying wallet: ${signer.address}`);
  console.log("(the key stays in this process; only the address is printed)");
  console.log(`GET ${endpoint}`);

  const client = new x402Client();
  registerExactEvmScheme(client, { signer });
  const paidFetch = wrapFetchWithPayment(fetch, client);

  const res = await paidFetch(endpoint);
  const text = await res.text();

  console.log(`HTTP ${res.status}`);

  if (res.status === 402) {
    // The server refused the payment (typically an empty wallet) or the call
    // failed before answering. Either way nothing was charged.
    const detail = text.trim();
    if (/insufficient_funds|insufficient funds/i.test(detail)) {
      console.log("Payment refused: insufficient_funds - this wallet has no USDC on Base to pay with.");
      console.log(`server said: ${detail.slice(0, 300)}`);
      console.log("");
      console.log("Nothing was charged: an unpaid or refused call never moves funds.");
      return;
    }
    console.log(`Payment refused with HTTP 402, nothing was charged.`);
    console.log(`server said: ${detail.slice(0, 300)}`);
    return;
  }

  if (!res.ok) {
    console.log(`Call failed, nothing was charged. server said: ${text.slice(0, 300)}`);
    return;
  }

  const verdict = JSON.parse(text);
  console.log("");
  console.log(`grade        ${verdict.grade}  (${verdict.label})`);
  console.log(`safetyScore  ${verdict.safetyScore}`);
  console.log(`verdict      ${verdict.verdict}`);
  console.log(`take         ${verdict.take}`);
  console.log(`shareUrl     ${verdict.shareUrl}`);
  console.log(`cardUrl      ${verdict.cardUrl}`);
  if (Array.isArray(verdict.redFlags) && verdict.redFlags.length) {
    console.log(`redFlags     ${verdict.redFlags.join("; ")}`);
  }
  console.log("");
  console.log("full response:");
  console.log(JSON.stringify(verdict, null, 2));
}

try {
  if (key) {
    await buyVerdict();
  } else {
    await showQuote();
  }
} catch (err) {
  console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
