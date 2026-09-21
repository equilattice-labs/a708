import { ref, computed, markRaw } from "vue";
import {
  BrowserProvider,
  JsonRpcProvider,
  FetchRequest,
  Contract,
  getAddress,
  verifyMessage,
} from "ethers";

export const NETWORK = {
  chainId: 46630,
  chainHex: "0xb626",
  name: "Robinhood Chain Testnet",
  rpc: "https://rpc.testnet.chain.robinhood.com",
  explorer: "https://explorer.testnet.chain.robinhood.com",
};
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
  address.value
    ? `${address.value.slice(0, 6)}…${address.value.slice(-4)}`
    : "",
);

const RPC_TIMEOUT = 20_000,
  WALLET_TIMEOUT = 120_000,
  SESSION_DURATION = 5 * 60_000;
let injected,
  provider,
  readContract,
  readProvider,
  listenerProvider,
  sessionTimer;
let sessionEpoch = 0,
  recordEpoch = 0,
  loadEpoch = 0,
  expiresAt = 0,
  discovered = false;

function timeout(promise, milliseconds, message) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), milliseconds);
    }),
  ]).finally(() => clearTimeout(timer));
}
const walletRequest = (wallet, request) =>
  timeout(
    wallet.request(request),
    WALLET_TIMEOUT,
    "Wallet request timed out. Check your wallet before trying again.",
  );
const rpcRequest = (promise) =>
  timeout(
    promise,
    RPC_TIMEOUT,
    "The testnet RPC is not responding. Please try again.",
  );
function createReadProvider() {
  const request = new FetchRequest(NETWORK.rpc);
  request.timeout = 15_000;
  return new JsonRpcProvider(request, NETWORK.chainId, {
    staticNetwork: true,
    cacheTimeout: -1,
  });
}
function detachListeners() {
  listenerProvider?.removeListener?.("accountsChanged", onAccountsChanged);
  listenerProvider?.removeListener?.("chainChanged", onChainChanged);
  listenerProvider?.removeListener?.("disconnect", onDisconnect);
  listenerProvider = undefined;
}
function reset(reason = "") {
  ++sessionEpoch;
  ++recordEpoch;
  clearTimeout(sessionTimer);
  expiresAt = 0;
  detachListeners();
  provider?.destroy();
  provider = undefined;
  injected = undefined;
  address.value = "";
  verified.value = false;
  record.value = null;
  recordState.value = "idle";
  forecasts.value = {};
  walletBusy.value = false;
  walletError.value = reason;
}
const onAccountsChanged = () =>
  reset("Your wallet account changed. Connect and verify it again.");
const onChainChanged = () =>
  reset("Your wallet network changed. Reconnect to Robinhood Chain Testnet.");
const onDisconnect = () =>
  reset("Your wallet disconnected. Connect again to continue.");
const cleanError = (e) => {
  const code = e?.code ?? e?.info?.error?.code;
  if (code === 4001 || code === "ACTION_REJECTED")
    return "Request declined. Nothing was submitted.";
  if (code === -32002)
    return "A request is already open in your wallet. Please check it.";
  const message = e?.shortMessage || e?.reason || e?.message || "";
  if (/insufficient funds/i.test(message))
    return "You need testnet ETH for gas. Use the official faucet below.";
  if (/AlreadyForecast/.test(message))
    return "This wallet already has a confirmed call on that question.";
  if (/ForecastLimitReached/.test(message))
    return "This wallet has reached the pilot limit of 256 calls.";
  if (/MarketClosed/.test(message))
    return "This question is closed and no longer accepts calls.";
  return message.slice(0, 220) || "Connection failed. Please try again.";
};

export function discoverWallets() {
  if (!discovered) {
    window.addEventListener("eip6963:announceProvider", (e) => {
      const detail = e.detail;
      if (
        !detail?.info?.uuid ||
        typeof detail?.provider?.request !== "function"
      )
        return;
      if (
        !wallets.value.some(
          (w) =>
            w.info.uuid === detail.info.uuid || w.provider === detail.provider,
        )
      ) {
        wallets.value.push({
          info: {
            name: String(detail.info.name || "Browser wallet"),
            uuid: String(detail.info.uuid),
          },
          provider: markRaw(detail.provider),
        });
      }
    });
    discovered = true;
  }
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  if (
    window.ethereum &&
    !wallets.value.some((w) => w.provider === window.ethereum)
  ) {
    wallets.value.push({
      info: { name: "Browser wallet", uuid: "injected" },
      provider: markRaw(window.ethereum),
    });
  }
}

export async function connectWallet(wallet) {
  if (walletBusy.value) return false;
  reset();
  walletBusy.value = true;
  const attempt = sessionEpoch;
  const assertCurrent = () => {
    if (attempt !== sessionEpoch)
      throw new Error("Wallet session changed. Please reconnect.");
  };
  try {
    const next =
      wallet?.provider || wallets.value[0]?.provider || window.ethereum;
    if (typeof next?.request !== "function")
      throw new Error(
        "No wallet detected. Install MetaMask or another Ethereum-compatible browser wallet, then reload.",
      );
    const accounts = await walletRequest(next, {
      method: "eth_requestAccounts",
    });
    assertCurrent();
    if (!accounts?.[0])
      throw new Error("Your wallet did not return an account.");
    const expectedAddress = getAddress(accounts[0]);
    try {
      await walletRequest(next, {
        method: "wallet_switchEthereumChain",
        params: [{ chainId: NETWORK.chainHex }],
      });
    } catch (error) {
      if (error.code !== 4902 && error.data?.originalError?.code !== 4902)
        throw error;
      await walletRequest(next, {
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: NETWORK.chainHex,
            chainName: NETWORK.name,
            rpcUrls: [NETWORK.rpc],
            nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
            blockExplorerUrls: [NETWORK.explorer],
          },
        ],
      });
      await walletRequest(next, {
        method: "wallet_switchEthereumChain",
        params: [{ chainId: NETWORK.chainHex }],
      });
    }
    assertCurrent();
    const [chainId, currentAccounts] = await Promise.all([
      walletRequest(next, { method: "eth_chainId" }),
      walletRequest(next, { method: "eth_accounts" }),
    ]);
    assertCurrent();
    if (Number(chainId) !== NETWORK.chainId)
      throw new Error("Switch your wallet to Robinhood Chain Testnet.");
    if (currentAccounts?.[0]?.toLowerCase() !== expectedAddress.toLowerCase())
      throw new Error("Your wallet account changed. Connect again.");

    // Listen before signing so account/chain events invalidate a pending signature.
    injected = next;
    listenerProvider = next;
    next.on?.("accountsChanged", onAccountsChanged);
    next.on?.("chainChanged", onChainChanged);
    next.on?.("disconnect", onDisconnect);
    provider = new BrowserProvider(next, "any", { cacheTimeout: -1 });
    const signer = await provider.getSigner(expectedAddress);
    assertCurrent();
    const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    const issuedAt = Date.now(),
      signatureExpiresAt = issuedAt + SESSION_DURATION;
    const message = `${location.host} wants you to sign in with your Ethereum account:\n${expectedAddress}\n\nVerify wallet ownership for this browser session. No assets or token approvals are requested.\n\nURI: ${location.origin}\nVersion: 1\nChain ID: ${NETWORK.chainId}\nNonce: ${nonce}\nIssued At: ${new Date(issuedAt).toISOString()}\nExpiration Time: ${new Date(signatureExpiresAt).toISOString()}`;
    const signature = await timeout(
      signer.signMessage(message),
      WALLET_TIMEOUT,
      "Signature request timed out. Check your wallet before reconnecting.",
    );
    assertCurrent();
    if (
      Date.now() >= signatureExpiresAt ||
      verifyMessage(message, signature).toLowerCase() !==
        expectedAddress.toLowerCase()
    )
      throw new Error("Wallet signature could not be verified.");
    const [finalAccounts, finalChain] = await Promise.all([
      walletRequest(next, { method: "eth_accounts" }),
      walletRequest(next, { method: "eth_chainId" }),
    ]);
    assertCurrent();
    if (
      finalAccounts?.[0]?.toLowerCase() !== expectedAddress.toLowerCase() ||
      Number(finalChain) !== NETWORK.chainId
    )
      throw new Error(
        "Wallet account or network changed during verification. Reconnect.",
      );
    address.value = expectedAddress;
    verified.value = true;
    expiresAt = signatureExpiresAt;
    sessionTimer = setTimeout(
      () => {
        if (attempt === sessionEpoch)
          reset(
            "Your verification session expired. Sign in again to continue.",
          );
      },
      Math.max(0, expiresAt - Date.now()),
    );
    void refreshRecord();
    return true;
  } catch (e) {
    if (attempt === sessionEpoch) reset(cleanError(e));
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
  let rpc;
  try {
    const response = await fetch("/deployment.json", {
      cache: "no-store",
      signal: AbortSignal.timeout(RPC_TIMEOUT),
    });
    if (!response.ok) throw new Error("Deployment metadata not available");
    const data = await response.json();
    if (
      !data.address ||
      !Array.isArray(data.abi) ||
      data.chainId !== NETWORK.chainId
    )
      throw new Error("Deployment configuration invalid");
    const normalized = { ...data, address: getAddress(data.address) };
    rpc = createReadProvider();
    if (
      Number(await rpcRequest(rpc.send("eth_chainId", []))) !== NETWORK.chainId
    )
      throw new Error("Unexpected RPC network");
    const contract = new Contract(normalized.address, normalized.abi, rpc);
    const count = Number(await rpcRequest(contract.marketCount()));
    const ids = Array.from({ length: Math.min(count, 24) }, (_, i) => i + 1);
    const markets = await rpcRequest(
      Promise.all(
        ids.map(async (id) => {
          const m = await contract.getMarket(id);
          return {
            id,
            question: m.question,
            source: m.source,
            closesAt: Number(m.closesAt),
            outcome: Number(m.outcome),
            totalForecasts: Number(m.yesCount) + Number(m.noCount),
            yesCount: Number(m.yesCount),
            noCount: Number(m.noCount),
          };
        }),
      ),
    );
    if (attempt !== loadEpoch) {
      rpc.destroy();
      return false;
    }
    readProvider?.destroy();
    readProvider = rpc;
    readContract = contract;
    deployment.value = normalized;
    chainMarkets.value = markets;
    chainState.value = "ready";
    if (address.value) void refreshRecord();
    return true;
  } catch {
    rpc?.destroy();
    if (attempt === loadEpoch) {
      readProvider?.destroy();
      readProvider = undefined;
      readContract = undefined;
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
  if (!readContract) {
    recordState.value = chainState.value === "loading" ? "loading" : "error";
    return;
  }
  recordState.value = "loading";
  const account = address.value,
    session = sessionEpoch,
    request = ++recordEpoch,
    contract = readContract;
  const current = () =>
    request === recordEpoch &&
    session === sessionEpoch &&
    account === address.value &&
    contract === readContract;
  try {
    const [data, entries] = await rpcRequest(
      Promise.all([
        contract.getTrackRecord(account),
        Promise.all(
          chainMarkets.value.map(async (m) => [
            m.id,
            await contract.getForecast(m.id, account),
          ]),
        ),
      ]),
    );
    if (!current()) return;
    record.value = {
      resolved: Number(data.resolved ?? data[0]),
      correct: Number(data.correct ?? data[1]),
      cancelled: Number(data.cancelled ?? data[2]),
      total: Number(data.totalForecasts ?? data[3]),
    };
    forecasts.value = Object.fromEntries(entries);
    recordState.value = "ready";
  } catch {
    if (current()) {
      record.value = null;
      forecasts.value = {};
      recordState.value = "error";
    }
  }
}

export async function commitCall(marketId, yes, confidence, onHash) {
  if (
    !verified.value ||
    !provider ||
    !injected ||
    !deployment.value ||
    Date.now() >= expiresAt
  )
    throw new Error("Connect and verify your wallet first.");
  if (chainState.value !== "ready")
    throw new Error(
      "Live forecasts are unavailable. Retry the testnet connection before submitting.",
    );
  if (
    !Number.isSafeInteger(marketId) ||
    marketId < 1 ||
    typeof yes !== "boolean" ||
    !Number.isInteger(Number(confidence)) ||
    Number(confidence) < 50 ||
    Number(confidence) > 100
  )
    throw new Error("Choose a valid forecast, side and 50–100% confidence.");
  const session = sessionEpoch,
    account = address.value,
    activeProvider = provider,
    activeWallet = injected;
  const assertCurrent = () => {
    if (session !== sessionEpoch || !verified.value || Date.now() >= expiresAt)
      throw new Error("Wallet session changed. Reconnect before submitting.");
  };
  let confirmationProvider, submittedHash;
  try {
    const [chainId, accounts] = await Promise.all([
      walletRequest(activeWallet, { method: "eth_chainId" }),
      walletRequest(activeWallet, { method: "eth_accounts" }),
    ]);
    assertCurrent();
    if (
      Number(chainId) !== NETWORK.chainId ||
      accounts?.[0]?.toLowerCase() !== account.toLowerCase()
    ) {
      reset("Wallet account or network changed. Reconnect before submitting.");
      throw new Error(walletError.value);
    }
    const signer = await activeProvider.getSigner(account);
    assertCurrent();
    const contract = new Contract(
      deployment.value.address,
      deployment.value.abi,
      signer,
    );
    // Pin the chain while the wallet confirmation dialog is open.
    const tx = await timeout(
      contract.commitForecast(marketId, yes, Number(confidence), {
        chainId: NETWORK.chainId,
      }),
      WALLET_TIMEOUT,
      "Wallet confirmation timed out. Check wallet activity before retrying.",
    );
    submittedHash = tx.hash;
    onHash?.(tx.hash);
    // Follow the fixed testnet RPC even if the wallet changes networks after submission.
    confirmationProvider = createReadProvider();
    confirmationProvider.pollingInterval = 1500;
    const receipt = await confirmationProvider.waitForTransaction(
      tx.hash,
      1,
      90_000,
    );
    if (!receipt || receipt.status !== 1)
      throw new Error("Transaction failed onchain.");
    await loadChain();
    return tx.hash;
  } catch (e) {
    if (
      submittedHash &&
      (e?.code === "TIMEOUT" ||
        /timeout|timed out|not responding|network/i.test(e?.message || ""))
    )
      throw new Error(
        "Transaction submitted; confirmation is still pending. Track the transaction before trying again.",
      );
    throw new Error(cleanError(e));
  } finally {
    confirmationProvider?.destroy();
  }
}
