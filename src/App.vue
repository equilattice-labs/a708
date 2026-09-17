<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from "vue";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  X,
  Plus,
  ExternalLink,
  Wallet,
  Fingerprint,
  Radio,
  ShieldCheck,
  ChevronRight,
  ArrowLeft,
  Clock3,
  Sparkles,
  LoaderCircle,
  Compass,
  Copy,
  Search,
  SlidersHorizontal,
  BookOpen,
  LayoutGrid,
  ArrowDown,
  RefreshCw,
  Users,
} from "lucide-vue-next";
import { BRAND } from "./brand";
import {
  NETWORK,
  address,
  verified,
  walletBusy,
  walletError,
  wallets,
  deployment,
  chainMarkets,
  chainState,
  record,
  forecasts,
  shortAddress,
  discoverWallets,
  connectWallet,
  disconnectWallet,
  loadChain,
  commitCall,
} from "./useWallet";
const modal = ref(null),
  chosen = ref(null),
  category = ref("All forecasts"),
  side = ref(true),
  confidence = ref(65),
  pending = ref(false),
  txHash = ref(""),
  txSuccess = ref(false),
  txError = ref(""),
  copied = ref(false),
  shareFallback = ref(false),
  search = ref(""),
  sort = ref("closing"),
  activeSection = ref("forecasts"),
  walletReturn = ref(false),
  reviewCall = ref(false),
  demoSide = ref(true);
const dialogRef = ref(null),
  lastFocus = ref(null),
  now = ref(Date.now());
let nowTimer,
  copyTimer,
  deepLinkHandled = false;
const forecastShareUrl = computed(() =>
  chosen.value ? `${location.origin}/?market=${chosen.value.id}#forecasts` : "",
);
const categories = [
  "All forecasts",
  "Crypto",
  "Ecosystem",
  "Resolved",
  "My calls",
];
const navigation = [
  { id: "forecasts", label: "Discover", icon: LayoutGrid, number: "01" },
  { id: "record", label: "My record", icon: Fingerprint, number: "02" },
  { id: "how-it-works", label: "How it works", icon: BookOpen, number: "03" },
  { id: "communities", label: "Community", icon: Users, number: "04" },
];
const examples = [
  {
    id: "btc",
    question: "Will Bitcoin finish the year above $120,000?",
    ticker: "BTC",
    category: "Crypto",
    icon: "₿",
    probability: 64,
    source: "CoinGecko BTC/USD daily close",
  },
  {
    id: "eth",
    question: "Will Ethereum outperform Bitcoin this quarter?",
    ticker: "ETH",
    category: "Crypto",
    icon: "Ξ",
    probability: 58,
    source: "Relative quarterly USD returns",
  },
  {
    id: "chain",
    question: "What comes next for the onchain economy?",
    ticker: "CHAIN",
    category: "Ecosystem",
    icon: "✳",
    probability: 72,
    source: "Explore the Robinhood Chain ecosystem",
  },
];
const allMarkets = computed(() =>
  chainState.value === "ready"
    ? chainMarkets.value.map((m) => ({
        ...m,
        ticker: /bitcoin|btc/i.test(m.question)
          ? "BTC"
          : /ethereum|eth/i.test(m.question)
            ? "ETH"
            : "CHAIN",
        category: /bitcoin|btc|ethereum|eth/i.test(m.question)
          ? "Crypto"
          : "Ecosystem",
        icon: /bitcoin|btc/i.test(m.question)
          ? "₿"
          : /ethereum|eth/i.test(m.question)
            ? "Ξ"
            : "✳",
        probability: m.totalForecasts
          ? Math.round((m.yesCount / m.totalForecasts) * 100)
          : null,
      }))
    : examples,
);
const displayMarkets = computed(() => {
  let items = allMarkets.value;
  if (category.value === "My calls")
    items = items.filter((m) => forecasts.value[m.id]?.exists);
  else if (category.value === "Resolved")
    items = items.filter((m) => m.outcome > 0);
  else {
    items = items.filter((m) => !m.outcome);
    if (category.value !== "All forecasts")
      items = items.filter((m) => m.category === category.value);
  }
  const query = search.value.trim().toLowerCase();
  if (query)
    items = items.filter((m) =>
      `${m.question} ${m.ticker} ${m.category}`.toLowerCase().includes(query),
    );
  return [...items].sort((a, b) =>
    sort.value === "participation"
      ? (b.totalForecasts || 0) - (a.totalForecasts || 0)
      : sort.value === "newest"
        ? (Number(b.id) || 0) - (Number(a.id) || 0)
        : (a.closesAt || Infinity) - (b.closesAt || Infinity),
  );
});
const openCount = computed(
  () =>
    chainMarkets.value.filter(
      (m) => !m.outcome && m.closesAt * 1000 > now.value,
    ).length,
);
const totalCalls = computed(() =>
  chainMarkets.value.reduce(
    (total, m) => total + Number(m.totalForecasts || 0),
    0,
  ),
);
const hasFilters = computed(
  () =>
    search.value ||
    category.value !== "All forecasts" ||
    sort.value !== "closing",
);
const currentForecast = computed(
  () => chosen.value && forecasts.value[chosen.value.id],
);
const chosenClosed = computed(
  () =>
    chosen.value &&
    (chosen.value.outcome > 0 || chosen.value.closesAt * 1000 <= now.value),
);
const sourceUrl = computed(() => chosen.value?.source?.split(" | ")[0] || "");
const sourceRules = computed(
  () =>
    chosen.value?.source?.split(" | ").slice(1).join(" | ") ||
    chosen.value?.source ||
    "",
);
const steps = [
  {
    title: "Start with a question.",
    body: "Explore the board. Read the deadline, resolution rules, and public source. A good forecast starts with a clear question.",
    label: "Observe",
    detail: "Check the evidence before you choose a side.",
  },
  {
    title: "Give your view a record.",
    body: "Choose YES or NO, set your confidence, and confirm with your wallet. One call per question, recorded on testnet.",
    label: "Commit",
    detail: "A call is an opinion. Only testnet gas is used.",
  },
  {
    title: "Return to the result.",
    body: "Once the pilot operator resolves the question, compare the outcome with your call. Build a record of how you think over time.",
    label: "Reflect",
    detail: "Public outcomes make your thinking checkable.",
  },
];
const faqs = computed(() => [
  [
    `What is ${BRAND.name}?`,
    `${BRAND.name} is a social forecasting experiment on Robinhood Chain. Make a market call, put it onchain, and build a track record that can be checked. The current release is a public testnet pilot.`,
  ],
  [
    "Am I risking real money?",
    "No. This pilot records opinions, not financial positions. There are no deposits, wagers, payouts, or token approvals. Calls cost only Robinhood testnet ETH gas. Testnet ETH has no monetary value.",
  ],
  [
    "Who resolves the questions?",
    "Each question has a public source and closing time. The pilot operator resolves YES, NO, or CANCELLED after the deadline. This is centralized resolution, not an oracle guarantee. Ambiguous or unverifiable questions should be cancelled.",
  ],
  [
    "Can I change or delete a call?",
    "Confirmed calls are immutable, with one call per wallet per question and up to 256 calls per wallet. Wallet addresses and forecast activity are publicly visible on the blockchain.",
  ],
  [
    "Is there a token or an airdrop?",
    "No token, airdrop, or financial rewards are announced. Participation builds a testnet record and helps evaluate the product. There is no promise of future eligibility or value.",
  ],
  [
    `Is ${BRAND.name} affiliated with Robinhood?`,
    `${BRAND.name} is an independent project. It is not affiliated with, sponsored by, or endorsed by Robinhood. Community spaces, chat integrations, and paid analytics are roadmap features.`,
  ],
]);
function resetFilters() {
  search.value = "";
  category.value = "All forecasts";
  sort.value = "closing";
}
function navigate(id) {
  activeSection.value = id;
}
function showMyCalls() {
  category.value = "My calls";
  search.value = "";
  activeSection.value = "forecasts";
  location.hash = "forecasts";
}
function openWallet() {
  walletReturn.value = modal.value === "forecast";
  modal.value = "wallet";
  walletError.value = "";
}
function openForecast(m) {
  chosen.value = m;
  side.value = true;
  confidence.value = 65;
  txHash.value = "";
  txSuccess.value = false;
  txError.value = "";
  copied.value = false;
  shareFallback.value = false;
  reviewCall.value = false;
  walletError.value = "";
  modal.value = "forecast";
}
function closeModal() {
  if (!pending.value && !walletBusy.value) modal.value = null;
}
function dateLabel(timestamp) {
  return timestamp
    ? new Date(timestamp * 1000).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : "Illustrative scenario";
}
function status(m) {
  return !m.outcome && m.closesAt * 1000 <= now.value
    ? "Closed · pending"
    : ["Open", "Resolved · YES", "Resolved · NO", "Cancelled"][m.outcome || 0];
}
async function connect(w) {
  if (await connectWallet(w)) {
    txError.value = "";
    if (modal.value === "wallet")
      modal.value = walletReturn.value && chosen.value ? "forecast" : "account";
  }
}
async function submit() {
  if (
    pending.value ||
    typeof chosen.value?.id !== "number" ||
    !verified.value ||
    chosenClosed.value ||
    currentForecast.value?.exists
  )
    return;
  pending.value = true;
  txError.value = "";
  try {
    await commitCall(
      chosen.value.id,
      side.value,
      Number(confidence.value),
      (hash) => (txHash.value = hash),
    );
    txSuccess.value = true;
  } catch (e) {
    txError.value = e.message;
  } finally {
    pending.value = false;
  }
}
async function share(m) {
  const text = `${m.question}\nMake your own call on ${BRAND.name}: ${location.origin}/?market=${m.id}#forecasts\nRobinhood Chain testnet · No real-money stakes`;
  try {
    await navigator.clipboard.writeText(text);
    copied.value = true;
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => (copied.value = false), 2500);
  } catch {
    shareFallback.value = true;
    txError.value = "Clipboard unavailable. Copy the question link below.";
  }
}
function keyboard(e) {
  if (!modal.value) return;
  if (e.key === "Escape") closeModal();
  if (e.key === "Tab" && dialogRef.value) {
    const focusable = [
      ...dialogRef.value.querySelectorAll(
        "button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),summary,[tabindex='0']",
      ),
    ].filter((el) => el.offsetParent !== null);
    const first = focusable[0],
      last = focusable.at(-1);
    if (!first) {
      e.preventDefault();
      return;
    }
    if (
      e.shiftKey &&
      (document.activeElement === first ||
        document.activeElement === dialogRef.value)
    ) {
      e.preventDefault();
      last.focus();
    } else if (
      !e.shiftKey &&
      (document.activeElement === last ||
        !dialogRef.value.contains(document.activeElement))
    ) {
      e.preventDefault();
      first.focus();
    }
  }
}
function setReview(value) {
  reviewCall.value = value;
  nextTick(() =>
    document
      .getElementById(value ? "review-heading" : "choice-heading")
      ?.focus(),
  );
}
function syncHash() {
  const id = location.hash.slice(1);
  activeSection.value = navigation.some((n) => n.id === id) ? id : "forecasts";
}
function fulfillDeepLink() {
  if (deepLinkHandled || chainState.value !== "ready") return;
  const requested = new URLSearchParams(location.search).get("market");
  if (requested === null || requested.trim() === "") return;
  deepLinkHandled = true;
  const id = Number(requested);
  const market = allMarkets.value.find((m) => m.id === id);
  if (market) openForecast(market);
}
watch(chainState, (value) => {
  if (value === "ready") fulfillDeepLink();
});
watch(modal, async (value, previous) => {
  if (value) {
    if (!previous) lastFocus.value = document.activeElement;
    document.body.style.overflow = "hidden";
    await nextTick();
    dialogRef.value?.focus();
  } else {
    document.body.style.overflow = "";
    await nextTick();
    lastFocus.value?.focus?.();
  }
});
watch(chainMarkets, (markets) => {
  if (typeof chosen.value?.id === "number")
    chosen.value =
      markets.find((m) => m.id === chosen.value.id) || chosen.value;
});
watch(verified, (value) => {
  if (!value && modal.value === "account") modal.value = "wallet";
});
onMounted(async () => {
  discoverWallets();
  nowTimer = setInterval(() => (now.value = Date.now()), 1000);
  document.addEventListener("keydown", keyboard);
  window.addEventListener("hashchange", syncHash);
  syncHash();
  await loadChain();
  fulfillDeepLink();
});
onUnmounted(() => {
  clearInterval(nowTimer);
  clearTimeout(copyTimer);
  document.removeEventListener("keydown", keyboard);
  window.removeEventListener("hashchange", syncHash);
  document.body.style.overflow = "";
});
</script>

<template>
  <div class="app-shell" :inert="modal ? true : undefined">
    <a href="#main" class="skip-link">Skip to content</a>
    <header class="site-header">
      <a href="#main" class="wordmark" :aria-label="`${BRAND.name} home`">
        <img src="/brand/mark.svg" alt="" width="36" height="36" />{{
          BRAND.name.toLowerCase()
        }}
      </a>
      <nav class="desktop-nav" aria-label="Main navigation">
        <a
          v-for="item in navigation"
          :key="item.id"
          :href="`#${item.id}`"
          :class="{ active: activeSection === item.id }"
          :aria-current="activeSection === item.id ? 'location' : undefined"
          @click="navigate(item.id)"
          >{{ item.label }}</a
        >
      </nav>
      <button
        class="button wallet-button"
        @click="verified ? (modal = 'account') : openWallet()"
      >
        <Wallet :size="17" /><span>{{
          verified ? shortAddress : "Connect wallet"
        }}</span>
      </button>
    </header>

    <main id="main">
      <section class="hero page-width" aria-labelledby="hero-title">
        <div class="hero-copy">
          <div class="pilot-pill">
            <span class="status-dot"></span> A SOCIAL FORECASTING EXPERIMENT
          </div>
          <h1 id="hero-title">
            Think ahead.<br /><span
              >Leave your<br class="desktop-break" />
              mark.</span
            >
          </h1>
          <p>
            Your take on what comes next deserves more than a disappearing post.
            Make a call. Build a record. See how you think.
          </p>
          <div class="hero-actions">
            <a
              class="button primary"
              href="#forecasts"
              @click="navigate('forecasts')"
              >Explore questions <ArrowUpRight :size="19" /></a
            ><a
              class="text-link"
              href="#how-it-works"
              @click="navigate('how-it-works')"
              >How it works <ArrowRight :size="16"
            /></a>
          </div>
          <p class="hero-note">
            <ShieldCheck :size="15" /> Testnet only. No deposits. No payouts.
          </p>
        </div>
        <div class="perspective-art" aria-hidden="true">
          <div class="art-orbit orbit-back"></div>
          <div class="art-sphere"></div>
          <div class="art-tile tile-back">
            <span>A DIFFERENT PERSPECTIVE</span
            ><strong>NO<span>↗</span></strong>
            <div class="tile-rule"></div>
            <small>There is room for another view.</small>
          </div>
          <div class="art-tile tile-front">
            <div class="tile-top">
              <span>YOUR POINT OF VIEW</span><span class="tile-star">✳</span>
            </div>
            <strong>YES<span>↗</span></strong>
            <div class="tile-confidence">
              <span>Conviction</span><b>78<small>%</small></b>
            </div>
            <div class="tile-progress"><i></i></div>
            <div class="tile-bottom">
              <span>THINK IT. RECORD IT.</span><Check :size="15" />
            </div>
          </div>
          <div class="art-orbit orbit-front"></div>
          <div class="art-sticker">
            <Check :size="18" /><span
              >A view worth<br /><strong>recording.</strong></span
            >
          </div>
          <span class="art-footnote"
            >ILLUSTRATIVE CALL · YOUR VIEW IS YOUR OWN</span
          >
        </div>
      </section>
      <div class="network-strip page-width">
        <div class="network-identity">
          <span class="network-symbol">↗</span
          ><span>Built on<strong>Robinhood Chain</strong></span
          ><span class="testnet-label">TESTNET</span>
        </div>
        <div class="network-stat">
          <b>{{ chainState === "ready" ? openCount : "—" }}</b
          ><span>open questions</span>
        </div>
        <div class="network-stat">
          <b>{{ chainState === "ready" ? totalCalls : "—" }}</b
          ><span>recorded opinions</span>
        </div>
        <a href="/docs/litepaper.html" class="network-manifesto"
          >Independent minds.<br /><strong
            >One public record. <ArrowUpRight :size="15" /></strong
        ></a>
      </div>

      <section id="forecasts" class="board-section page-width">
        <div class="section-heading">
          <div>
            <p class="eyebrow">THE QUESTION IS OPEN</p>
            <h2>What's your take?</h2>
            <p class="section-intro">
              Explore an idea. Weigh the evidence. Put your perspective on
              record.
            </p>
          </div>
          <div class="board-status" role="status">
            <span
              class="status-dot"
              :class="{ connected: chainState === 'ready' }"
            ></span
            ><span>{{
              chainState === "ready"
                ? "Live on testnet"
                : chainState === "loading"
                  ? "Connecting to testnet…"
                  : "Preview mode"
            }}</span
            ><button
              class="icon-button"
              aria-label="Refresh forecasts"
              :disabled="chainState === 'loading'"
              @click="loadChain()"
            >
              <RefreshCw
                :size="16"
                :class="{ spin: chainState === 'loading' }"
              />
            </button>
          </div>
        </div>
        <div class="board-controls">
          <div class="category-tabs" role="group" aria-label="Filter forecasts">
            <button
              v-for="tab in categories"
              :key="tab"
              :class="{ active: category === tab }"
              :aria-pressed="category === tab"
              @click="category = tab"
            >
              {{ tab
              }}<span v-if="tab === 'My calls' && record">{{
                record.total
              }}</span>
            </button>
          </div>
          <div class="board-tools">
            <label class="search-field"
              ><Search :size="18" /><input
                v-model="search"
                type="search"
                aria-label="Search forecasts"
                placeholder="Find a question…" /></label
            ><label class="sort-field"
              ><SlidersHorizontal :size="17" /><select
                v-model="sort"
                aria-label="Sort forecasts"
              >
                <option value="closing">Closing soon</option>
                <option value="newest">Newest first</option>
                <option value="participation">Most calls</option>
              </select></label
            >
          </div>
        </div>
        <div class="result-context">
          <span
            >{{
              chainState === "loading"
                ? "Loading questions…"
                : `${displayMarkets.length} ${displayMarkets.length === 1 ? "question" : "questions"} to explore`
            }}<span v-if="chainState === 'unavailable'">
              · Illustrative examples</span
            ></span
          ><button v-if="hasFilters" @click="resetFilters">
            Reset filters <X :size="13" />
          </button>
        </div>
        <div
          v-if="chainState === 'unavailable'"
          class="offline-notice"
          role="status"
        >
          <Radio :size="19" />
          <p>
            Live forecasts are temporarily unavailable. These examples give you
            a feel for the experience.
          </p>
          <button @click="loadChain()">
            Try again <RefreshCw :size="15" />
          </button>
        </div>
        <div
          v-if="chainState === 'loading'"
          class="loading-grid"
          role="status"
          aria-label="Loading live forecasts"
        >
          <div v-for="n in 3" :key="n" class="skeleton-card">
            <span></span><i></i><i></i><b></b>
          </div>
          <p>Reading the public testnet. This may take a moment.</p>
        </div>
        <div v-else-if="displayMarkets.length" class="market-grid">
          <article
            v-for="m in displayMarkets"
            :key="m.id"
            class="market-card"
            :class="`asset-${m.ticker.toLowerCase()}`"
          >
            <div class="market-top">
              <div class="asset-identity">
                <span class="asset-icon">{{ m.icon }}</span>
                <div>
                  <strong>{{ m.ticker }}</strong
                  ><small>{{ m.category }}</small>
                </div>
              </div>
              <span
                class="market-status"
                :class="{
                  resolved: m.outcome,
                  closed: !m.outcome && m.closesAt * 1000 <= now,
                }"
                ><i></i
                >{{ chainState === "ready" ? status(m) : "Example" }}</span
              >
            </div>
            <h3>
              <button @click="openForecast(m)">{{ m.question }}</button>
            </h3>
            <p class="market-deadline">
              <Clock3 :size="14" />{{
                chainState === "ready"
                  ? `Closes ${dateLabel(m.closesAt)} · UTC`
                  : "Illustrative scenario · not live data"
              }}
            </p>
            <div class="market-sentiment">
              <div class="sentiment-heading">
                <span>{{
                  m.probability === null
                    ? "Be the first to take a side"
                    : chainState === "ready"
                      ? "The crowd leans"
                      : "An example perspective"
                }}</span
                ><strong
                  >{{ m.probability === null ? "—" : `${m.probability}%`
                  }}<small v-if="m.probability !== null">YES</small></strong
                >
              </div>
              <div class="sentiment-bar">
                <span :style="{ width: `${m.probability ?? 0}%` }"></span>
              </div>
              <div class="sentiment-caption">
                <span>{{
                  chainState === "ready"
                    ? `${m.totalForecasts} recorded calls`
                    : "Read-only preview"
                }}</span
                ><span v-if="forecasts[m.id]?.exists" class="recorded-label"
                  ><Check :size="13" />Your call recorded</span
                ><span v-else>Every view counts</span>
              </div>
            </div>
            <button class="card-action" @click="openForecast(m)">
              <span>{{
                chainState !== "ready"
                  ? "Explore this example"
                  : m.outcome
                    ? "See the outcome"
                    : forecasts[m.id]?.exists
                      ? "View your call"
                      : m.closesAt * 1000 <= now
                        ? "View question"
                        : "Make your call"
              }}</span
              ><ArrowUpRight :size="19" />
            </button>
          </article>
        </div>
        <div v-else class="empty-state">
          <span class="empty-icon"
            ><component
              :is="category === 'My calls' ? Fingerprint : Search"
              :size="29"
          /></span>
          <h3>
            {{
              category === "My calls" && !verified
                ? "Your story starts with a wallet."
                : search
                  ? "No questions match that search."
                  : category === "My calls"
                    ? "Your first call is still ahead."
                    : "No questions here just yet."
            }}
          </h3>
          <p>
            {{
              category === "My calls" && !verified
                ? "Connect your wallet to find your public forecasting record."
                : "Try another category or reset your filters to explore the board."
            }}
          </p>
          <button
            class="button primary"
            @click="
              category === 'My calls' && !verified
                ? openWallet()
                : resetFilters()
            "
          >
            {{
              category === "My calls" && !verified
                ? "Connect wallet"
                : "Explore all questions"
            }}<ArrowRight :size="17" />
          </button>
        </div>
        <div class="board-footnote">
          <ShieldCheck :size="16" />
          <p>
            Real opinions. Testnet records. Calls use testnet gas; there are no
            stakes or financial rewards.
          </p>
          <a href="/docs/litepaper.html"
            >Understand the pilot <ArrowUpRight :size="14"
          /></a>
        </div>
      </section>

      <section id="record" class="record-section page-width">
        <div class="record-copy">
          <p class="eyebrow">YOUR PERSPECTIVE, OVER TIME</p>
          <h2>A little conviction.<br />A lasting record.</h2>
          <p>
            Good thinking is a practice. Keep a public history of your calls,
            revisit the outcomes, and get to know your own judgment.
          </p>
          <button
            class="button light"
            @click="verified ? showMyCalls() : openWallet()"
          >
            {{ verified ? "Explore my calls" : "Start your record"
            }}<ArrowUpRight :size="18" /></button
          ><span class="record-assurance"
            ><ShieldCheck :size="15" />A signature to sign in. No funds
            moved.</span
          >
        </div>
        <div class="record-passport">
          <div class="passport-top">
            <span class="passport-icon"><Fingerprint :size="27" /></span
            ><span
              >THE PERSPECTIVE RECORD<small>{{
                verified ? shortAddress : "Yours to begin"
              }}</small></span
            ><span class="passport-dots">•••</span>
          </div>
          <div class="passport-title">
            Every call<br />says something.<span
              >About how you see the world.</span
            >
          </div>
          <div class="record-stats">
            <div>
              <strong>{{ verified ? (record?.total ?? "—") : "—" }}</strong
              ><span>Calls made</span>
            </div>
            <div>
              <strong>{{ verified ? (record?.resolved ?? "—") : "—" }}</strong
              ><span>Resolved</span>
            </div>
            <div>
              <strong>{{ verified ? (record?.correct ?? "—") : "—" }}</strong
              ><span>Correct</span>
            </div>
          </div>
          <div class="passport-bottom">
            <span
              ><i></i
              >{{
                verified
                  ? "Connected & verified"
                  : "One wallet. Your own history."
              }}</span
            ><button v-if="verified" @click="modal = 'account'">
              Wallet details <ArrowUpRight :size="15" /></button
            ><Fingerprint v-else :size="17" />
          </div>
        </div>
      </section>

      <section id="how-it-works" class="journey-section page-width">
        <div class="section-heading">
          <div>
            <p class="eyebrow">FROM A THOUGHT TO A TRACK RECORD</p>
            <h2>Three steps. All you.</h2>
          </div>
          <a class="text-link" href="/docs/litepaper.html"
            >Read the full story <ArrowUpRight :size="17"
          /></a>
        </div>
        <div class="journey-grid">
          <article class="journey-card">
            <div class="journey-top">
              <span>01 / EXPLORE</span><Compass :size="22" />
            </div>
            <div class="journey-visual question-visual" aria-hidden="true">
              <span class="question-shape">?</span
              ><span class="tiny-card"
                ><span>THE NEXT BIG THING</span><i></i><i></i
                ><b>What's your take? ↗</b></span
              >
            </div>
            <h3>Find your question.</h3>
            <p>{{ steps[0].body }}</p>
            <a href="#forecasts" class="text-link"
              >Explore the board <ArrowRight :size="15"
            /></a>
          </article>
          <article class="journey-card">
            <div class="journey-top">
              <span>02 / MAKE A CALL</span><Wallet :size="22" />
            </div>
            <div class="journey-visual demo-choices">
              <button
                :class="{ selected: demoSide }"
                :aria-pressed="demoSide"
                @click="demoSide = true"
              >
                YES<Check v-if="demoSide" :size="18" /><ArrowUpRight
                  v-else
                  :size="18"
                /></button
              ><button
                :class="{ selected: !demoSide }"
                :aria-pressed="!demoSide"
                @click="demoSide = false"
              >
                NO<Check v-if="!demoSide" :size="18" /><ArrowUpRight
                  v-else
                  :size="18"
                /></button
              ><span>Try a side · example only</span>
            </div>
            <h3>Give it conviction.</h3>
            <p>{{ steps[1].body }}</p>
            <span class="journey-note">No stake. Only testnet gas.</span>
          </article>
          <article class="journey-card">
            <div class="journey-top">
              <span>03 / LOOK BACK</span><Fingerprint :size="22" />
            </div>
            <div class="journey-visual outcome-visual" aria-hidden="true">
              <div>
                <Check :size="28" /><span
                  >AN OUTCOME.<br /><strong
                    >A little more perspective.</strong
                  ></span
                >
              </div>
              <span class="outcome-stamp">RECORDED ↗</span>
            </div>
            <h3>Meet your future self.</h3>
            <p>{{ steps[2].body }}</p>
            <a href="#record" class="text-link"
              >Your record awaits <ArrowRight :size="15"
            /></a>
          </article>
        </div>
      </section>

      <section id="communities" class="community-section page-width">
        <div class="community-copy">
          <p class="eyebrow">BETTER WITH OTHER PERSPECTIVES</p>
          <h2>Big questions.<br />Different minds.</h2>
          <p>
            Send a question to your group chat. Compare your thinking. Sometimes
            the most interesting part is seeing who disagrees.
          </p>
          <div class="community-actions">
            <a class="button dark" href="#forecasts"
              >Find a question to share <ArrowUpRight :size="18" /></a
            ><a
              class="text-link"
              :href="`https://x.com/${BRAND.handle}`"
              target="_blank"
              rel="noopener noreferrer"
              >Find us on X <ArrowUpRight :size="16"
            /></a>
          </div>
          <p class="roadmap-note">
            Community spaces and chat integrations are on the roadmap.
            <a href="/docs/litepaper.html#roadmap"
              >See what's next <ArrowRight :size="13"
            /></a>
          </p>
        </div>
        <div class="conversation-art" aria-hidden="true">
          <div class="conversation-bubble bubble-one">
            I see it<br /><strong>differently.</strong><span>↗</span>
          </div>
          <div class="conversation-bubble bubble-two">
            That's what<br /><strong>makes it interesting.</strong
            ><span>✳</span>
          </div>
          <span class="conversation-star">✳</span>
        </div>
      </section>

      <section id="questions" class="faq-section page-width">
        <div class="faq-heading">
          <p class="eyebrow">A LITTLE CLARITY</p>
          <h2>Before you<br />make a call.</h2>
          <p>The things you should know, out in the open.</p>
          <a class="text-link" href="/docs/litepaper.html"
            >Read the manifesto <ArrowUpRight :size="16"
          /></a>
        </div>
        <div class="faq-list">
          <details v-for="faq in faqs" :key="faq[0]">
            <summary>{{ faq[0] }}<Plus :size="20" /></summary>
            <p>{{ faq[1] }}</p>
          </details>
        </div>
      </section>
    </main>

    <footer class="site-footer">
      <div class="footer-main page-width">
        <div>
          <a href="#main" class="wordmark"
            ><img src="/brand/mark.svg" alt="" width="36" height="36" />{{
              BRAND.name.toLowerCase()
            }}</a
          >
          <p>{{ BRAND.tagline }}</p>
          <span>Independent thinking. Public by design.</span>
        </div>
        <div class="footer-links">
          <a href="/docs/litepaper.html"
            >Manifesto <ArrowUpRight :size="14" /></a
          ><a
            href="/docs/business-plan.pdf"
            target="_blank"
            rel="noopener noreferrer"
            >Business plan <ArrowUpRight :size="14" /></a
          ><a
            v-if="deployment"
            :href="`${NETWORK.explorer}/address/${deployment.address}`"
            target="_blank"
            rel="noopener noreferrer"
            >Pilot contract <ArrowUpRight :size="14" /></a
          ><a href="/docs/privacy.html">Privacy <ArrowUpRight :size="14" /></a
          ><a
            :href="`https://x.com/${BRAND.handle}`"
            target="_blank"
            rel="noopener noreferrer"
            >X / Twitter <ArrowUpRight :size="14"
          /></a>
        </div>
      </div>
      <div class="footer-bottom page-width">
        <span>© {{ new Date().getFullYear() }} {{ BRAND.name }}</span>
        <p>
          Independent project. Not affiliated with Robinhood.<br />Public
          testnet pilot · No real-money trading · No token announced.
        </p>
        <span class="footer-signoff">THE FUTURE IS OPEN. ↗</span>
      </div>
    </footer>
    <nav class="mobile-navigation" aria-label="Mobile navigation">
      <a
        v-for="item in navigation"
        :key="item.id"
        :href="`#${item.id}`"
        :class="{ active: activeSection === item.id }"
        :aria-current="activeSection === item.id ? 'location' : undefined"
        @click="navigate(item.id)"
        ><component :is="item.icon" :size="19" /><span>{{
          item.label
        }}</span></a
      >
    </nav>
  </div>
  <Transition name="modal"
    ><div v-if="modal" class="modal-backdrop" @mousedown.self="closeModal">
      <section
        ref="dialogRef"
        class="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        tabindex="-1"
        :aria-busy="pending || walletBusy"
      >
        <button
          class="modal-close icon-button"
          aria-label="Close dialog"
          :disabled="pending || walletBusy"
          @click="closeModal"
        >
          <X :size="22" />
        </button>
        <template v-if="modal === 'wallet'"
          ><span class="dialog-icon"><Wallet :size="27" /></span>
          <p class="eyebrow">YOUR RECORD STARTS HERE</p>
          <h2 id="dialog-title">Bring your perspective.</h2>
          <p>
            Connect your Ethereum-compatible wallet, then sign a free message to
            verify it's yours. No funds move when you sign in.
          </p>
          <div v-if="wallets.length" class="wallet-options">
            <button
              v-for="w in wallets"
              :key="w.info.uuid"
              :disabled="walletBusy"
              @click="connect(w)"
            >
              <Wallet :size="22" /><span>{{ w.info.name }}</span
              ><LoaderCircle
                v-if="walletBusy"
                class="spin"
                :size="19"
              /><ArrowUpRight v-else :size="19" />
            </button>
          </div>
          <div v-else class="no-wallet">
            <strong>No browser wallet detected.</strong>
            <p>Install a wallet, then come back to start your record.</p>
            <a
              class="button primary"
              href="https://metamask.io/download/"
              target="_blank"
              rel="noopener noreferrer"
              >Get MetaMask <ArrowUpRight :size="17" /></a
            ><button class="text-link-button" @click="discoverWallets">
              Check again <RefreshCw :size="15" />
            </button>
          </div>
          <p v-if="walletBusy" class="wallet-progress" role="status">
            <LoaderCircle class="spin" :size="16" />Check your wallet to
            continue…
          </p>
          <p v-if="walletError" class="error-message" role="alert">
            {{ walletError }}
          </p>
          <p class="dialog-note">
            We'll request Robinhood Chain Testnet (46630). Onchain calls need
            testnet ETH for gas.
          </p>
          <button
            v-if="walletReturn && chosen"
            class="text-link-button"
            :disabled="walletBusy"
            @click="modal = 'forecast'"
          >
            <ArrowLeft :size="16" />Back to your question
          </button></template
        >

        <template v-else-if="modal === 'account'"
          ><span class="dialog-icon"><Fingerprint :size="28" /></span>
          <p class="eyebrow">YOUR PERSPECTIVE RECORD</p>
          <h2 id="dialog-title">A history that's yours.</h2>
          <a
            class="account-address"
            :href="`${NETWORK.explorer}/address/${address}`"
            target="_blank"
            rel="noopener noreferrer"
            >{{ shortAddress }}<ExternalLink :size="15"
          /></a>
          <div class="account-stats">
            <div>
              <strong>{{ record?.total ?? "—" }}</strong
              ><span>Total calls</span>
            </div>
            <div>
              <strong>{{ record?.resolved ?? "—" }}</strong
              ><span>Resolved</span>
            </div>
            <div>
              <strong>{{ record?.correct ?? "—" }}</strong
              ><span>Correct</span>
            </div>
          </div>
          <p>
            Your record covers all calls in this pilot contract. Cancelled:
            {{ record?.cancelled ?? "—" }}. Each wallet can make up to 256
            calls.
          </p>
          <a
            class="button primary full-width"
            href="#forecasts"
            @click="
              modal = null;
              showMyCalls();
            "
            >View my calls <ArrowRight :size="18" /></a
          ><button
            class="text-link-button"
            @click="
              disconnectWallet();
              modal = null;
            "
          >
            Disconnect this session
          </button></template
        >

        <template v-else-if="modal === 'forecast' && chosen"
          ><p class="eyebrow">
            {{
              typeof chosen.id === "number"
                ? `QUESTION ${String(chosen.id).padStart(2, "0")} / YOUR PERSPECTIVE`
                : "A PREVIEW OF THE EXPERIENCE"
            }}
          </p>
          <h2 id="dialog-title" class="forecast-title">
            {{ chosen.question }}
          </h2>
          <template v-if="typeof chosen.id !== 'number'"
            ><div class="preview-message">
              <Radio :size="25" />
              <p>
                This is an illustrative scenario. Live testnet data is
                unavailable, so no transaction can be submitted here.
              </p>
            </div>
            <button
              class="button primary full-width"
              @click="
                loadChain();
                modal = null;
              "
            >
              Retry live forecasts <RefreshCw :size="17" />
            </button>
            <p class="dialog-note">
              You'll be able to choose a side and set your confidence when live
              questions are available.
            </p></template
          >
          <template v-else>
            <div class="resolution-info">
              <div>
                <span><Clock3 :size="14" />Closing time</span
                ><strong
                  >{{ dateLabel(chosen.closesAt) }} ·
                  {{
                    new Date(chosen.closesAt * 1000).toISOString().slice(11, 16)
                  }}
                  UTC</strong
                >
              </div>
              <details>
                <summary>Resolution source & rules <Plus :size="16" /></summary>
                <p>Resolved by the pilot operator using a public source.</p>
                <a
                  v-if="/^https:\/\//.test(sourceUrl)"
                  :href="sourceUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  >Read resolution source <ArrowUpRight :size="14"
                /></a>
                <p class="source-rules">{{ sourceRules }}</p>
                <p v-if="!chosenClosed" class="source-timing">
                  Outcome data is checked after the deadline. Future-dated
                  source queries may return no data yet.
                </p>
              </details>
            </div>
            <div v-if="chosen.outcome > 0" class="resolved-outcome">
              <strong>{{ status(chosen) }}</strong
              ><span v-if="currentForecast?.exists && chosen.outcome !== 3">{{
                (chosen.outcome === 1) === currentForecast.yes
                  ? "Your call matched the outcome."
                  : "Your call did not match the outcome."
              }}</span>
            </div>
            <div v-if="txSuccess" class="success-box" role="status">
              <span class="success-icon"><Check :size="27" /></span>
              <h3>Your perspective is on record.</h3>
              <p>
                {{ side ? "YES" : "NO" }} · {{ confidence }}% confidence.<br />Your
                transaction is confirmed.
              </p>
              <button
                class="text-link-button"
                @click="
                  modal = null;
                  showMyCalls();
                "
              >
                See your record <ArrowRight :size="16" />
              </button>
            </div>
            <div v-else-if="currentForecast?.exists" class="success-box">
              <span class="success-icon"><Fingerprint :size="27" /></span>
              <h3>You've already made your call.</h3>
              <p>
                {{ currentForecast.yes ? "YES" : "NO" }} ·
                {{ Number(currentForecast.confidence) }}% confidence.<br />Confirmed
                calls cannot be changed.
              </p>
            </div>
            <div v-else-if="chosenClosed" class="success-box">
              <Clock3 :size="27" />
              <h3>
                {{
                  chosen.outcome
                    ? status(chosen)
                    : "Closed · awaiting resolution"
                }}
              </h3>
              <p>This question is no longer accepting calls.</p>
            </div>
            <template v-else>
              <div class="call-progress" aria-label="Forecast progress">
                <span :class="{ current: !reviewCall }"><i>1</i>Your view</span>
                <div></div>
                <span :class="{ current: reviewCall }"
                  ><i>2</i>Review & record</span
                >
              </div>
              <template v-if="!reviewCall"
                ><h3 id="choice-heading" class="choice-heading" tabindex="-1">
                  Which way do you see it?
                </h3>
                <div class="forecast-choices">
                  <button
                    :class="{ selected: side }"
                    :aria-pressed="side"
                    @click="side = true"
                  >
                    <span>YES<small>I think it will</small></span
                    ><Check v-if="side" :size="22" /><ArrowUpRight
                      v-else
                      :size="22"
                    /></button
                  ><button
                    :class="{ selected: !side }"
                    :aria-pressed="!side"
                    @click="side = false"
                  >
                    <span>NO<small>I don't think so</small></span
                    ><Check v-if="!side" :size="22" /><ArrowUpRight
                      v-else
                      :size="22"
                    />
                  </button>
                </div>
                <label class="confidence-label" for="confidence"
                  >How confident are you?<strong
                    >{{ confidence }}<small>%</small></strong
                  ></label
                ><input
                  id="confidence"
                  type="range"
                  min="50"
                  max="100"
                  v-model.number="confidence"
                  :style="{ '--range-progress': `${(confidence - 50) * 2}%` }"
                />
                <div class="range-labels">
                  <span>Leaning this way</span><span>Very confident</span>
                </div>
                <button
                  class="button primary full-width"
                  @click="setReview(true)"
                >
                  Review my {{ side ? "YES" : "NO" }} call
                  <ArrowRight :size="18" />
                </button>
                <p class="dialog-note">
                  Choose your view now. You'll review it before anything is
                  recorded.
                </p></template
              >
              <template v-else
                ><h3 id="review-heading" class="choice-heading" tabindex="-1">
                  Make this your point of view?
                </h3>
                <div class="call-review">
                  <div>
                    <span>Your answer</span
                    ><strong
                      >{{ side ? "YES" : "NO" }} <ArrowUpRight :size="28"
                    /></strong>
                  </div>
                  <div>
                    <span>Your confidence</span
                    ><strong>{{ confidence }}<small>%</small></strong>
                  </div>
                </div>
                <ul class="review-notes">
                  <li>
                    <Check :size="15" />One call per wallet. It can't be edited
                    or deleted.
                  </li>
                  <li>
                    <Check :size="15" />Your address and call are publicly
                    visible.
                  </li>
                  <li>
                    <Check :size="15" />No stake or payout. Only testnet ETH
                    gas.
                  </li>
                </ul>
                <button
                  v-if="!verified"
                  class="button primary full-width"
                  @click="openWallet()"
                >
                  Connect wallet to continue <Wallet :size="18" /></button
                ><button
                  v-else
                  class="button primary full-width"
                  :disabled="pending"
                  @click="submit"
                >
                  <LoaderCircle v-if="pending" class="spin" :size="19" />{{
                    pending
                      ? txHash
                        ? "Confirming onchain…"
                        : "Confirm in your wallet…"
                      : `Record my ${side ? "YES" : "NO"} call`
                  }}<ArrowUpRight v-if="!pending" :size="18" /></button
                ><button
                  class="text-link-button"
                  :disabled="pending"
                  @click="setReview(false)"
                >
                  <ArrowLeft :size="15" />Edit my view
                </button>
                <p v-if="pending" class="dialog-note" role="status">
                  {{
                    txHash
                      ? "Transaction submitted. Waiting for the testnet receipt."
                      : "Your wallet will ask you to confirm the transaction."
                  }}
                </p></template
              >
            </template>
            <p v-if="txError || walletError" class="error-message" role="alert">
              {{ walletError || txError }}
            </p>
            <label v-if="shareFallback" class="share-fallback"
              >Question link<input
                :value="forecastShareUrl"
                readonly
                @focus="$event.target.select()" /></label
            ><a
              v-if="txHash"
              class="transaction-link"
              :href="`${NETWORK.explorer}/tx/${txHash}`"
              target="_blank"
              rel="noopener noreferrer"
              >{{
                txSuccess ? "View confirmed transaction" : "Track transaction"
              }}<ExternalLink :size="15"
            /></a>
            <div class="dialog-footer">
              <button @click="share(chosen)">
                <Check v-if="copied" :size="15" /><Copy v-else :size="15" />{{
                  copied ? "Link copied!" : "Share question"
                }}</button
              ><a
                href="https://faucet.testnet.chain.robinhood.com"
                target="_blank"
                rel="noopener noreferrer"
                >Get testnet ETH <ArrowUpRight :size="14"
              /></a>
            </div>
          </template>
        </template>
      </section></div
  ></Transition>
</template>
