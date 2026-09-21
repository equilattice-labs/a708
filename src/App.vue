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
  recordState,
  refreshRecord,
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
  demoSide = ref(true),
  inspectedId = ref(null);
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
  { id: "forecasts", label: "The board", icon: Compass, number: "01" },
  { id: "record", label: "My record", icon: Fingerprint, number: "02" },
  { id: "how-it-works", label: "The method", icon: BookOpen, number: "03" },
  { id: "communities", label: "Common ground", icon: Users, number: "04" },
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
const inspectedMarket = computed(
  () =>
    displayMarkets.value.find((m) => m.id === inspectedId.value) ||
    displayMarkets.value[0],
);
const myMarkets = computed(() =>
  allMarkets.value.filter((m) => forecasts.value[m.id]?.exists),
);
function inspectMarket(m) {
  inspectedId.value = m.id;
  if (window.matchMedia("(max-width: 800px)").matches) {
    nextTick(() => {
      const panel = document.getElementById("question-dossier");
      panel?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
      panel?.focus({ preventScroll: true });
    });
  }
}
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
  if (location.hash !== `#${id}`) location.hash = id;
  nextTick(() => {
    document.getElementById("main")?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  });
}
function browseQuestions() {
  resetFilters();
  navigate("forecasts");
}
function retryRecord() {
  return chainState.value === "ready" ? refreshRecord() : loadChain();
}
function showMyCalls() {
  category.value = "My calls";
  search.value = "";
  navigate("forecasts");
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
  if (id === "main") return;
  if (id === "question-board") {
    activeSection.value = "forecasts";
    nextTick(() => document.getElementById(id)?.scrollIntoView());
    return;
  }
  activeSection.value =
    id === "questions"
      ? "how-it-works"
      : navigation.some((n) => n.id === id)
        ? id
        : "forecasts";
  nextTick(() => {
    if (modal.value) return;
    const target = document.getElementById(
      id === "questions" ? "questions" : "main",
    );
    target?.focus({ preventScroll: true });
    if (id === "questions") target?.scrollIntoView();
    else window.scrollTo({ top: 0, behavior: "instant" });
  });
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
    <aside class="side-rail">
      <a
        href="#forecasts"
        class="rail-brand"
        :aria-label="BRAND.name + ' home'"
        @click.prevent="navigate('forecasts')"
      >
        <img src="/brand/mark.svg?v=opiquill" alt="" width="42" height="42" />
        <span>{{ BRAND.name }}</span>
      </a>
      <span class="rail-caption">A PUBLIC THINKING ROOM</span>
      <nav class="desktop-nav" aria-label="Main navigation">
        <a
          v-for="item in navigation"
          :key="item.id" :aria-label="item.label"
          :href="'#' + item.id"
          :class="{ active: activeSection === item.id }"
          :aria-current="activeSection === item.id ? 'page' : undefined"
          @click.prevent="navigate(item.id)"
        >
          <span class="nav-number">{{ item.number }}</span>
          <component :is="item.icon" :size="18" /><span>{{ item.label }}</span>
          <ArrowUpRight
            v-if="activeSection === item.id"
            class="nav-arrow"
            :size="15"
          />
        </a>
      </nav>
      <div class="rail-bottom">
        <span class="rail-seal" aria-hidden="true">O / Q</span>
        <p>Independent minds.<br />A public record.</p>
        <a href="/docs/litepaper.html"
          >Read the field notes <ArrowUpRight :size="14"
        /></a>
        <span class="rail-edition">ROBINHOOD CHAIN / TESTNET</span>
      </div>
    </aside>

    <div class="workspace">
      <header class="masthead">
        <a
          href="#forecasts"
          class="mobile-brand"
          @click.prevent="navigate('forecasts')"
        >
          <img
            src="/brand/mark.svg?v=opiquill"
            alt=""
            width="30"
            height="30"
          />{{ BRAND.name }}
        </a>
        <div class="edition-label">
          <span
            class="status-dot"
            :class="{ connected: chainState === 'ready' }"
          ></span>
          <span>THE FORECASTING EXPERIMENT</span
          ><span class="edition-divider">/</span><span>VOL. 001</span>
        </div>
        <button
          class="button wallet-button"
          @click="verified ? (modal = 'account') : openWallet()"
        >
          <Wallet :size="16" /><span>{{
            verified ? shortAddress : "Connect wallet"
          }}</span
          ><ArrowUpRight :size="15" />
        </button>
      </header>

      <main id="main" tabindex="-1">
        <template v-if="activeSection === 'forecasts'">
          <section class="editorial-hero" aria-labelledby="hero-title">
            <div class="hero-copy">
              <p class="eyebrow">
                <span class="section-index">01</span> OPINIONS, WITH A PAPER
                TRAIL.
              </p>
              <h1 id="hero-title">The future<br />is <em>unwritten.</em></h1>
              <div class="hero-bottom">
                <p>
                  Have a view on what comes next?<br />Put it on record. Let
                  time do the talking.
                </p>
                <a
                  class="round-link"
                  href="#question-board"
                  aria-label="Explore the question board"
                  ><ArrowDown :size="24"
                /></a>
              </div>
            </div>
            <div class="editorial-art" aria-hidden="true">
              <div class="art-header">
                <span>A LITTLE CONVICTION</span><span>↗</span>
              </div>
              <div class="type-yes">YES<span>?</span></div>
              <div class="art-divider">
                <span>ROOM FOR ANOTHER VIEW</span><i></i>
              </div>
              <div class="type-no">NO<span>.</span></div>
              <div class="art-footer">
                <span>THINK IT.<br />WRITE IT INTO THE RECORD.</span
                ><span class="art-asterisk">✳</span>
              </div>
              <div class="editorial-stamp">YOUR VIEW<br /><b>COUNTS.</b></div>
            </div>
          </section>
          <div class="ticker-strip">
            <span
              ><ShieldCheck :size="16" /> OPINIONS ONLY. NO REAL-MONEY
              STAKES.</span
            >
            <span
              ><b>{{ chainState === "ready" ? openCount : "—" }}</b> OPEN
              QUESTIONS</span
            >
            <span
              ><b>{{ chainState === "ready" ? totalCalls : "—" }}</b> RECORDED
              CALLS</span
            >
            <a href="/docs/litepaper.html"
              >THE PILOT, EXPLAINED <ArrowUpRight :size="14"
            /></a>
          </div>

          <section
            id="forecasts"
            class="board-section"
            aria-labelledby="board-title"
          >
            <div id="question-board" class="section-heading">
              <div>
                <p class="eyebrow">THE OPEN QUESTION DESK</p>
                <h2 id="board-title">Make up your mind.</h2>
              </div>
              <div class="board-status" role="status">
                <span
                  class="status-dot"
                  :class="{ connected: chainState === 'ready' }"
                ></span>
                <span>{{
                  chainState === "ready"
                    ? "Live on testnet"
                    : chainState === "loading"
                      ? "Reading testnet…"
                      : "Preview edition"
                }}</span>
                <button
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
              <div
                class="category-tabs"
                role="group"
                aria-label="Filter forecasts"
              >
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
                  ><Search :size="17" /><input
                    v-model="search"
                    type="search"
                    aria-label="Search forecasts"
                    placeholder="Search the board…"
                /></label>
                <label class="sort-field"
                  ><SlidersHorizontal :size="16" /><select
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
            <div class="result-context" aria-live="polite">
              <span
                >{{
                  chainState === "loading"
                    ? "Loading questions…"
                    : displayMarkets.length +
                      (displayMarkets.length === 1
                        ? " question"
                        : " questions")
                }}<span v-if="chainState === 'unavailable'">
                  / ILLUSTRATIVE EXAMPLES</span
                ></span
              >
              <button v-if="hasFilters" @click="resetFilters">
                Clear filters <X :size="14" />
              </button>
            </div>
            <div
              v-if="chainState === 'unavailable'"
              class="offline-notice"
              role="status"
            >
              <Radio :size="18" />
              <p>
                Live data is temporarily unavailable. Browse these read-only
                examples while we reconnect.
              </p>
              <button @click="loadChain()">
                Try again <RefreshCw :size="15" />
              </button>
            </div>
            <div
              v-if="chainState === 'loading'"
              class="loading-desk"
              role="status"
              aria-label="Loading live forecasts"
            >
              <div v-for="n in 3" :key="n" class="skeleton-row">
                <span></span><i></i><b></b>
              </div>
              <p>Reading the public testnet. This may take a moment.</p>
            </div>
            <div v-else-if="displayMarkets.length" class="question-desk">
              <div class="question-list" aria-label="Questions">
                <div class="list-caption">
                  <span>QUESTION / CLOSING DATE</span><span>YES VIEWS</span>
                </div>
                <button
                  v-for="(m, index) in displayMarkets"
                  :key="m.id"
                  class="question-row"
                  :class="{ selected: inspectedMarket?.id === m.id }"
                  :aria-pressed="inspectedMarket?.id === m.id"
                  :aria-label="'Read question: ' + m.question"
                  @click="inspectMarket(m)"
                >
                  <span class="question-number">{{
                    String(index + 1).padStart(2, "0")
                  }}</span>
                  <span class="question-row-main">
                    <span class="question-row-meta"
                      >{{ m.ticker }} <i>•</i>
                      {{ chainState === "ready" ? status(m) : "EXAMPLE" }}</span
                    >
                    <strong>{{ m.question }}</strong>
                    <span class="question-row-date"
                      ><Clock3 :size="13" />{{ dateLabel(m.closesAt)
                      }}<span
                        v-if="forecasts[m.id]?.exists"
                        class="recorded-label"
                        ><Check :size="12" /> Your call recorded</span
                      ></span
                    >
                  </span>
                  <span class="question-row-score"
                    >{{ m.probability === null ? "—" : m.probability
                    }}<small v-if="m.probability !== null">%</small
                    ><ArrowUpRight :size="20"
                  /></span>
                </button>
              </div>
              <section
                v-if="inspectedMarket"
                id="question-dossier"
                class="question-dossier"
                tabindex="-1"
                aria-labelledby="dossier-title"
              >
                <div class="dossier-top">
                  <span>UNDER CONSIDERATION</span
                  ><span class="dossier-asset">{{ inspectedMarket.icon }}</span>
                </div>
                <div class="dossier-category">
                  <span>{{ inspectedMarket.category }}</span
                  ><span>{{
                    chainState === "ready"
                      ? status(inspectedMarket)
                      : "READ-ONLY EXAMPLE"
                  }}</span>
                </div>
                <h3 id="dossier-title">{{ inspectedMarket.question }}</h3>
                <div class="dossier-consensus">
                  <div>
                    <span>{{
                      chainState === "ready"
                        ? "The public view"
                        : "Illustrative view"
                    }}</span
                    ><strong
                      >{{
                        inspectedMarket.probability === null
                          ? "—"
                          : inspectedMarket.probability + "%"
                      }}<small>YES</small></strong
                    >
                  </div>
                  <div class="sentiment-bar">
                    <span
                      :style="{
                        width: (inspectedMarket.probability ?? 0) + '%',
                      }"
                    ></span>
                  </div>
                  <p>
                    {{
                      chainState === "ready"
                        ? inspectedMarket.totalForecasts +
                          " recorded calls · opinions, not odds"
                        : "Example data · no live transaction"
                    }}
                  </p>
                </div>
                <dl class="dossier-facts">
                  <div>
                    <dt>Closing date</dt>
                    <dd>
                      {{ dateLabel(inspectedMarket.closesAt)
                      }}<span v-if="inspectedMarket.closesAt"> · UTC</span>
                    </dd>
                  </div>
                  <div>
                    <dt>Resolution</dt>
                    <dd>Public source / pilot operator</dd>
                  </div>
                </dl>
                <button
                  class="button primary dossier-action"
                  @click="openForecast(inspectedMarket)"
                >
                  {{
                    chainState !== "ready"
                      ? "Explore this example"
                      : inspectedMarket.outcome
                        ? "See the outcome"
                        : forecasts[inspectedMarket.id]?.exists
                          ? "View your call"
                          : inspectedMarket.closesAt * 1000 <= now
                            ? "View question"
                            : "Make your call"
                  }}<ArrowUpRight :size="19" />
                </button>
                <p class="dossier-note">
                  Read the source. Choose a side. Record your conviction.
                </p>
              </section>
            </div>
            <div v-else class="empty-state">
              <component
                :is="category === 'My calls' ? Fingerprint : Search"
                :size="34"
              />
              <h3>
                {{
                  category === "My calls" && !verified
                    ? "A record starts with you."
                    : search
                      ? "No questions match that search."
                      : category === "My calls"
                        ? "Your first call is still unwritten."
                        : "Nothing on this desk. Yet."
                }}
              </h3>
              <p>
                {{
                  category === "My calls" && !verified
                    ? "Connect your wallet to find your public forecasting record."
                    : "Try another category or clear your filters to return to the board."
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
                Each call uses testnet ETH for gas. No deposits, payouts, or
                financial rewards.
              </p>
              <a href="#how-it-works" @click.prevent="navigate('how-it-works')"
                >Before your first call <ArrowUpRight :size="14"
              /></a>
            </div>
          </section>
          <section class="closing-note">
            <span>THE LONG VIEW</span>
            <h2>
              Being right is a moment.<br /><em
                >Thinking well is a practice.</em
              >
            </h2>
            <a href="#record" @click.prevent="navigate('record')"
              >Your record starts here <ArrowUpRight :size="20"
            /></a>
          </section>
        </template>

        <section
          v-else-if="activeSection === 'record'"
          id="record"
          class="inner-page record-page"
        >
          <div class="page-heading">
            <p class="eyebrow">
              <span class="section-index">02</span> YOUR THINKING, OVER TIME
            </p>
            <h1>A record.<br /><em>Not a highlight reel.</em></h1>
            <p>
              Every call stays on the page. Revisit the outcomes and get to know
              your own judgment.
            </p>
          </div>
          <div class="record-ledger">
            <div class="ledger-identity">
              <Fingerprint :size="40" />
              <div>
                <span>FORECASTER'S RECORD</span
                ><strong>{{
                  verified ? shortAddress : "Yours to begin."
                }}</strong>
              </div>
              <span class="ledger-status"
                ><span
                  class="status-dot"
                  :class="{ connected: verified }"
                ></span
                >{{
                  verified ? "Verified wallet" : "Wallet not connected"
                }}</span
              >
            </div>
            <div class="ledger-stat-grid">
              <div>
                <span>01 / CALLS MADE</span
                ><strong>{{ verified ? (record?.total ?? "—") : "—" }}</strong>
              </div>
              <div>
                <span>02 / RESOLVED</span
                ><strong>{{
                  verified ? (record?.resolved ?? "—") : "—"
                }}</strong>
              </div>
              <div>
                <span>03 / CORRECT</span
                ><strong>{{
                  verified ? (record?.correct ?? "—") : "—"
                }}</strong>
              </div>
              <div>
                <span>04 / CANCELLED</span
                ><strong>{{
                  verified ? (record?.cancelled ?? "—") : "—"
                }}</strong>
              </div>
            </div>
            <div class="ledger-actions">
              <p>
                <ShieldCheck :size="16" />Sign in with a free message. Your
                calls are public and permanent.
              </p>
              <button
                class="button primary"
                @click="verified ? (modal = 'account') : openWallet()"
              >
                {{ verified ? "Wallet details" : "Start your record"
                }}<ArrowUpRight :size="17" />
              </button>
            </div>
          </div>
          <div class="section-heading record-heading">
            <div>
              <p class="eyebrow">THE ENTRIES</p>
              <h2>Your calls, in ink.</h2>
            </div>
            <a
              href="#forecasts"
              class="text-link"
              @click.prevent="navigate('forecasts')"
              >Back to the board <ArrowUpRight :size="17"
            /></a>
          </div>
          <div
            v-if="verified && recordState === 'loading'"
            class="record-empty"
            role="status"
          >
            <LoaderCircle class="spin" :size="30" />
            <h3>Reading your record.</h3>
            <p>Checking the public testnet for your calls and outcomes.</p>
          </div>
          <div
            v-else-if="verified && recordState === 'error'"
            class="record-empty"
            role="alert"
          >
            <Radio :size="30" />
            <h3>Your record could not be loaded.</h3>
            <p>
              The testnet did not return your history. Try again to check your
              calls.
            </p>
            <button class="button primary" @click="retryRecord">
              Retry record <RefreshCw :size="17" />
            </button>
          </div>
          <div
            v-else-if="verified && myMarkets.length"
            class="personal-call-list"
          >
            <button v-for="m in myMarkets" :key="m.id" @click="openForecast(m)">
              <span
                ><small>{{ status(m) }} / {{ dateLabel(m.closesAt) }}</small
                ><strong>{{ m.question }}</strong></span
              ><b
                >{{ forecasts[m.id].yes ? "YES" : "NO"
                }}<small
                  >{{ Number(forecasts[m.id].confidence) }}% confidence</small
                ></b
              ><ArrowUpRight :size="22" />
            </button>
          </div>
          <div v-else class="record-empty">
            <span aria-hidden="true">—</span>
            <h3>
              {{
                verified
                  ? "A blank page is a good beginning."
                  : "Your history follows your wallet."
              }}
            </h3>
            <p>
              {{
                verified
                  ? "Find a question worth thinking about. Your first confirmed call will appear here."
                  : "Connect to see your calls, their outcomes, and your public track record."
              }}
            </p>
            <button
              class="text-link-button"
              @click="verified ? browseQuestions() : openWallet()"
            >
              {{ verified ? "Find your first question" : "Connect wallet"
              }}<ArrowRight :size="17" />
            </button>
          </div>
        </section>

        <section
          v-else-if="activeSection === 'how-it-works'"
          id="how-it-works"
          class="inner-page method-page"
        >
          <div class="page-heading">
            <p class="eyebrow">
              <span class="section-index">03</span> A PRACTICE, NOT A PREDICTION
              MACHINE
            </p>
            <h1>Think it through.<br /><em>Write it down.</em></h1>
            <p>
              A good question. An honest opinion. A record you can come back to.
            </p>
          </div>
          <div class="method-list">
            <article
              v-for="(step, index) in steps"
              :key="step.label"
              class="method-step"
            >
              <span class="step-number">0{{ index + 1 }}</span>
              <div>
                <p class="eyebrow">{{ step.label }}</p>
                <h2>{{ step.title }}</h2>
                <p>{{ step.body }}</p>
                <span class="step-detail">{{ step.detail }}</span>
              </div>
              <div class="step-visual">
                <template v-if="index === 0"
                  ><Search :size="44" /><span
                    >READ THE QUESTION.<br />CHECK THE SOURCE.</span
                  ></template
                >
                <template v-else-if="index === 1"
                  ><div class="demo-choices">
                    <button
                      :class="{ selected: demoSide }"
                      :aria-pressed="demoSide"
                      @click="demoSide = true"
                    >
                      YES<Check v-if="demoSide" :size="16" /></button
                    ><button
                      :class="{ selected: !demoSide }"
                      :aria-pressed="!demoSide"
                      @click="demoSide = false"
                    >
                      NO<Check v-if="!demoSide" :size="16" />
                    </button>
                  </div>
                  <span>TRY A SIDE / EXAMPLE ONLY</span></template
                >
                <template v-else
                  ><Fingerprint :size="48" /><span
                    >ONE WALLET.<br />YOUR OWN HISTORY.</span
                  ></template
                >
              </div>
            </article>
          </div>
          <section id="questions" class="faq-section" tabindex="-1">
            <div class="faq-heading">
              <p class="eyebrow">IN THE MARGINS</p>
              <h2>A little<br /><em>clarity.</em></h2>
              <a class="text-link" href="/docs/litepaper.html"
                >Read the field notes <ArrowUpRight :size="16"
              /></a>
            </div>
            <div class="faq-list">
              <details v-for="faq in faqs" :key="faq[0]">
                <summary>{{ faq[0] }}<Plus :size="20" /></summary>
                <p>{{ faq[1] }}</p>
              </details>
            </div>
          </section>
          <a
            class="button primary method-cta"
            href="#forecasts"
            @click.prevent="navigate('forecasts')"
            >Find your first question <ArrowUpRight :size="18"
          /></a>
        </section>

        <section v-else id="communities" class="inner-page community-page">
          <div class="page-heading">
            <p class="eyebrow">
              <span class="section-index">04</span> A PLACE FOR DIFFERENT MINDS
            </p>
            <h1>Disagreement.<br /><em>Good company.</em></h1>
            <p>
              The most interesting view in the room might be the one that isn't
              yours.
            </p>
          </div>
          <div class="community-spread">
            <div class="community-statement">
              <span>THE CONVERSATION STARTER</span>
              <h2>“I see it<br /><em>differently.”</em></h2>
              <p>
                Send a question to your group chat. Compare your answers. Come
                back when the outcome is known.
              </p>
              <a
                class="button primary"
                href="#forecasts"
                @click.prevent="navigate('forecasts')"
                >Find a question to share <ArrowUpRight :size="18"
              /></a>
            </div>
            <div class="community-instructions">
              <p class="eyebrow">TAKE THE QUESTION WITH YOU</p>
              <ol>
                <li>
                  <b>01</b
                  ><span
                    >Open a live question.<small
                      >Find a question on the board that deserves a second
                      opinion.</small
                    ></span
                  >
                </li>
                <li>
                  <b>02</b
                  ><span
                    >Copy its link.<small
                      >Use “Share question” in the question's detail
                      panel.</small
                    ></span
                  >
                </li>
                <li>
                  <b>03</b
                  ><span
                    >Compare perspectives.<small
                      >Send it to your own group and see where you agree.</small
                    ></span
                  >
                </li>
              </ol>
              <a
                class="social-link"
                :href="'https://x.com/' + BRAND.handle"
                target="_blank"
                rel="noopener noreferrer"
                ><span
                  >X / FOLLOW THE EXPERIMENT<strong
                    >@{{ BRAND.handle }}</strong
                  ></span
                ><ArrowUpRight :size="26"
              /></a>
            </div>
          </div>
          <div class="roadmap-line">
            <span>ON THE HORIZON</span>
            <p>
              Dedicated community spaces and chat integrations are on the
              roadmap.
            </p>
            <a href="/docs/litepaper.html#roadmap"
              >See what's next <ArrowUpRight :size="16"
            /></a>
          </div>
        </section>
      </main>

      <footer class="site-footer">
        <div class="footer-top">
          <a
            class="footer-brand"
            href="#forecasts"
            @click.prevent="navigate('forecasts')"
            >{{ BRAND.name }}<span>{{ BRAND.tagline }}</span></a
          >
          <div class="footer-links">
            <a href="/docs/litepaper.html"
              >Field notes <ArrowUpRight :size="13" /></a
            ><a
              href="/docs/business-plan.pdf"
              target="_blank"
              rel="noopener noreferrer"
              >Business plan <ArrowUpRight :size="13" /></a
            ><a
              v-if="deployment"
              :href="NETWORK.explorer + '/address/' + deployment.address"
              target="_blank"
              rel="noopener noreferrer"
              >Pilot contract <ArrowUpRight :size="13" /></a
            ><a href="/docs/privacy.html">Privacy <ArrowUpRight :size="13" /></a
            ><a
              :href="'https://x.com/' + BRAND.handle"
              target="_blank"
              rel="noopener noreferrer"
              >X / Twitter <ArrowUpRight :size="13"
            /></a>
          </div>
        </div>
        <div class="footer-bottom">
          <span>© {{ new Date().getFullYear() }} {{ BRAND.name }}</span>
          <p>
            Independent project. Not affiliated with Robinhood.<br />Public
            testnet pilot · No real-money trading · No token announced.
          </p>
          <span>LEAVE A RECORD. ↗</span>
        </div>
      </footer>
    </div>
    <nav class="mobile-navigation" aria-label="Mobile navigation">
      <a
        v-for="item in navigation"
        :key="item.id" :aria-label="item.label"
        :href="'#' + item.id"
        :class="{ active: activeSection === item.id }"
        :aria-current="activeSection === item.id ? 'page' : undefined"
        @click.prevent="navigate(item.id)"
        ><component :is="item.icon" :size="20" /><span>{{
          item.label
        }}</span></a
      >
    </nav>
  </div>
  <Transition name="modal"
    ><div
      v-if="modal"
      class="modal-backdrop"
      :class="{ 'forecast-backdrop': modal === 'forecast' }"
      @mousedown.self="closeModal"
    >
      <section
        ref="dialogRef"
        class="modal-panel"
        :class="{ 'forecast-panel': modal === 'forecast' }"
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
          <p v-if="recordState === 'loading'" role="status">
            Reading your public record…
          </p>
          <div
            v-else-if="recordState === 'error'"
            role="alert"
            class="error-message"
          >
            <p>
              Your record could not be loaded. This does not mean you have no
              calls.
            </p>
            <button class="button" @click="retryRecord">
              Retry record <RefreshCw :size="16" />
            </button>
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
