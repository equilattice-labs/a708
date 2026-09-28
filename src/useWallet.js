import { ref, computed, markRaw } from "vue";

// Solana is the active target. The program is intentionally unset until the
// owner supplies a deployed program ID and a funded devnet wallet.
export const NETWORK = {
  chain: "solana",
  cluster: "devnet",
  chainId: "solana:devnet",
  name: "Solana Devnet",
  rpc: "https://api.devnet.solana.com",
  explorer: "https://explorer.solana.com",
  faucet: "https://faucet.solana.com",
  nativeCurrency: { name: "Solana", symbol: "SOL", decimals: 9 },
  commitment: "confirmed",
};
export const explorerAddress = (value) =>
  `${NETWORK.explorer}/address/${encodeURIComponent(value)}?cluster=${NETWORK.cluster}`;
export const explorerTransaction = (value) =>
  `${NETWORK.explorer}/tx/${encodeURIComponent(value)}?cluster=${NETWORK.cluster}`;

export const address = ref("");
export const verified = ref(false);
export const walletBusy = ref(false);
export const walletError = ref("");
export const wallets = ref([]);
export const deployment = ref(null);
export const chainMarkets = ref([]);
export const chainState = ref("loading");
export const record = ref(null);
export const recordState = ref("idle");
export const forecasts = ref({});
export const shortAddress = computed(() =>
  address.value ? `${address.value.slice(0, 5)}...${address.value.slice(-4)}` : "",
);

const RPC_TIMEOUT = 20_000;
const WALLET_TIMEOUT = 120_000;
const SESSION_DURATION = 5 * 60_000;
let injected;
let sessionTimer;
let sessionEpoch = 0;
let recordEpoch = 0;
let loadEpoch = 0;
let expiresAt = 0;
let discovered = false;

function timeout(promise, milliseconds, message) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), milliseconds);
    }),
  ]).finally(() => clearTimeout(timer));
}

function walletRequest(wallet, method, params) {
  const request = method === "connect" ? wallet.connect(params) : wallet[method](params);
  return timeout(
    request,
    WALLET_TIMEOUT,
    "Wallet request timed out. Check your Solana wallet before trying again.",
  );
}

function providerName(provider) {
  if (provider?.isPhantom) return "Phantom";
  if (provider?.isSolflare) return "Solflare";
  return provider?.name || "Solana wallet";
}

function reset(reason = "") {
  ++sessionEpoch;
  ++recordEpoch;
  clearTimeout(sessionTimer);
  expiresAt = 0;
  const currentWallet = injected;
  injected = undefined;
  try {
    currentWallet?.off?.("accountChanged", onAccountsChanged);
    currentWallet?.off?.("disconnect", onDisconnect);
    currentWallet?.disconnect?.();
  } catch {
    // Wallet disconnect is best effort; local session state is authoritative.
  }
  address.value = "";
  verified.value = false;
  record.value = null;
  recordState.value = "idle";
  forecasts.value = {};
  walletBusy.value = false;
  walletError.value = reason;
}

const onAccountsChanged = () => reset("Your Solana wallet account changed. Connect and verify it again.");
const onDisconnect = () => reset("Your Solana wallet disconnected. Connect again to continue.");

function cleanError(error) {
  const code = error?.code;
  if (code === 4001 || code === "USER_REJECTED") return "Request declined. Nothing was submitted.";
  if (code === -32002) return "A request is already open in your wallet. Please check it.";
  const message = error?.message || error?.toString?.() || "";
  if (/insufficient|balance|lamport/i.test(message)) return "You need devnet SOL for fees. Use the official Solana faucet.";
  if (/not deployed|program id|deployment/i.test(message)) return "Solana program deployment is pending. No transaction was submitted.";
  return message.slice(0, 220) || "Solana wallet connection failed. Please try again.";
}

export function discoverWallets() {
  if (typeof window === "undefined") return;
  const candidates = [
    [window.phantom?.solana, "Phantom"],
    [window.solflare, "Solflare"],
    [window.solana, "Solana wallet"],
  ];
  for (const [provider, name] of candidates) {
    if (!provider || typeof provider.connect !== "function") continue;
    if (wallets.value.some((entry) => entry.provider === provider)) continue;
    wallets.value.push({
      info: { name: providerName(provider) || name, uuid: `${name.toLowerCase()}-injected` },
      provider: markRaw(provider),
    });
  }
  discovered = true;
}

export async function connectWallet(wallet) {
  if (walletBusy.value) return false;
  reset();
  walletBusy.value = true;
  const attempt = sessionEpoch;
  const assertCurrent = () => {
    if (attempt !== sessionEpoch) throw new Error("Wallet session changed. Please reconnect.");
  };
  try {
    if (!discovered) discoverWallets();
    const next = wallet?.provider || wallets.value[0]?.provider;
    if (!next) throw new Error("No Solana wallet detected. Install Phantom or Solflare, then reload.");
    const response = await walletRequest(next, "connect");
    assertCurrent();
    const publicKey = response?.publicKey || next.publicKey;
    const expectedAddress = publicKey?.toString?.() || String(publicKey || "");
    if (!expectedAddress) throw new Error("Your Solana wallet did not return an address.");
    injected = next;
    next.on?.("accountChanged", onAccountsChanged);
    next.on?.("disconnect", onDisconnect);

    const issuedAt = Date.now();
    const signatureExpiresAt = issuedAt + SESSION_DURATION;
    const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    const message = `${location.host} wants you to sign in with your Solana account:\n${expectedAddress}\n\nVerify wallet ownership for this browser session. No assets or token approvals are requested.\n\nURI: ${location.origin}\nVersion: 1\nChain: Solana ${NETWORK.cluster}\nNonce: ${nonce}\nIssued At: ${new Date(issuedAt).toISOString()}\nExpiration Time: ${new Date(signatureExpiresAt).toISOString()}`;
    if (typeof next.signMessage !== "function") throw new Error("This wallet does not support message signing.");
    const signed = await timeout(
      next.signMessage(new TextEncoder().encode(message), "utf8"),
      WALLET_TIMEOUT,
      "Signature request timed out. Check your wallet before reconnecting.",
    );
    if (!signed) throw new Error("Wallet signature could not be verified.");
    assertCurrent();
    address.value = expectedAddress;
    verified.value = true;
    expiresAt = signatureExpiresAt;
    sessionTimer = setTimeout(() => {
      if (attempt === sessionEpoch) reset("Your verification session expired. Sign in again to continue.");
    }, Math.max(0, expiresAt - Date.now()));
    void refreshRecord();
    return true;
  } catch (error) {
    if (attempt === sessionEpoch) reset(cleanError(error));
    return false;
  } finally {
    if (attempt === sessionEpoch) walletBusy.value = false;
  }
}

export function disconnectWallet() {
  reset();
}

export async function loadChain() {
  const attempt = ++loadEpoch;
  ++recordEpoch;
  chainState.value = "loading";
  if (verified.value) recordState.value = "loading";
  try {
    const response = await fetch("/deployment.json", {
      cache: "no-store",
      signal: AbortSignal.timeout(RPC_TIMEOUT),
    });
    if (!response.ok) throw new Error("Solana deployment metadata not available");
    const data = await response.json();
    if (data.chain !== "solana" || data.cluster !== NETWORK.cluster) throw new Error("Deployment configuration is not Solana devnet");
    // Until a program is supplied, keep examples in the UI but never present
    // them as live onchain markets or attempt a transaction.
    if (attempt !== loadEpoch) return false;
    deployment.value = data.deployed && data.programId ? data : null;
    chainMarkets.value = [];
    chainState.value = "unavailable";
    record.value = null;
    forecasts.value = {};
    recordState.value = verified.value ? "error" : "idle";
    return false;
  } catch {
    if (attempt === loadEpoch) {
      deployment.value = null;
      chainMarkets.value = [];
      record.value = null;
      forecasts.value = {};
      chainState.value = "unavailable";
      recordState.value = verified.value ? "error" : "idle";
    }
    return false;
  }
}

export async function refreshRecord() {
  if (!verified.value || !address.value) return;
  recordState.value = "error";
  record.value = null;
  forecasts.value = {};
}

export async function commitCall() {
  if (!verified.value || Date.now() >= expiresAt) throw new Error("Connect and verify your Solana wallet first.");
  throw new Error("Solana program deployment is pending. No transaction was submitted.");
}
