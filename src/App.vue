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
  activeStep = ref(0),
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
  { id: "how-it-works", label: "Field guide", icon: BookOpen, number: "03" },
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
    body: "Choose YES or NO, set your confidence, and confirm with your wallet. One call per question, permanently recorded on testnet.",
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
        "button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),[tabindex='0']",
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
function changeStep(value) {
  activeStep.value = (value + 3) % 3;
  nextTick(() => document.getElementById(`step-${activeStep.value}`)?.focus());
}
function syncHash() {
  const id = location.hash.slice(1);
  activeSection.value = navigation.some((n) => n.id === id) ? id : "forecasts";
}
function fulfillDeepLink() {
  if (deepLinkHandled || chainState.value !== "ready") return;
  deepLinkHandled = true;
  const id = Number(new URLSearchParams(location.search).get("market"));
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
    <aside class="sidebar">
      <a href="#main" class="wordmark" :aria-label="`${BRAND.name} home`"
        ><img src="/brand/mark.svg" alt="" />{{ BRAND.name.toLowerCase() }}</a
      >
      <p class="sidebar-caption">A FIELD FOR FORESIGHT</p>
      <nav class="side-nav" aria-label="Main navigation">
        <a
          v-for="item in navigation"
          :key="item.id"
          :href="`#${item.id}`"
          :class="{ active: activeSection === item.id }"
          :aria-current="activeSection === item.id ? 'location' : undefined"
          @click="navigate(item.id)"
          ><component :is="item.icon" :size="18" /><span>{{ item.label }}</span
          ><small>{{ item.number }}</small></a
        >
      </nav>
      <div class="sidebar-note">
        <span class="note-cross">+</span>
        <p>The future is open.<br /><strong>Have a point of view.</strong></p>
        <a href="/docs/litepaper.html"
          >Read the manifesto <ArrowUpRight :size="15"
        /></a>
      </div>
      <div class="sidebar-bottom">
        <a href="/docs/privacy.html">Privacy <ArrowUpRight :size="12" /></a
        ><a href="/docs/litepaper.html#roadmap"
          >What comes next <ArrowUpRight :size="12"
        /></a>
        <div class="network-label">
          <span
            class="status-dot"
            :class="{ connected: chainState === 'ready' }"
          ></span
          ><span>ROBINHOOD CHAIN<small>Public testnet · 46630</small></span>
        </div>
        <span class="pilot-label">INDEPENDENT EXPERIMENT / V.01</span>
      </div>
    </aside>
    <div class="workspace">
      <header class="topbar">
        <a href="#main" class="wordmark mobile-wordmark"
          ><img src="/brand/mark.svg" alt="" />{{ BRAND.name.toLowerCase() }}</a
        >
        <div class="breadcrumb">
          The observatory <span>/</span
          ><strong>{{
            navigation.find((item) => item.id === activeSection)?.label ||
            "Discover"
          }}</strong>
        </div>
        <div class="topbar-actions">
          <span class="testnet-badge"
            ><span class="status-dot connected"></span> TESTNET PILOT</span
          ><button
            class="wallet-button"
            @click="verified ? (modal = 'account') : openWallet()"
          >
            <Wallet :size="16" />{{ verified ? shortAddress : "Connect wallet"
            }}<ArrowUpRight :size="15" />
          </button>
        </div>
      </header>
      <main id="main">
        <section class="hero" aria-labelledby="hero-title">
          <div class="hero-copy">
            <p class="eyebrow">
              <span class="mini-cross">✳</span> INDEPENDENT THINKING. PUBLIC
              RECORD.
            </p>
            <h1 id="hero-title">
              A point of view.<br /><span>A proof of thought.</span>
            </h1>
            <p>Turn what you think comes next into a record that lasts.</p>
            <a
              href="#forecasts"
              class="hero-link"
              @click="navigate('forecasts')"
              >Find your question <ArrowDown :size="16"
            /></a>
          </div>
          <div class="signal-art" aria-hidden="true">
            <svg viewBox="0 0 360 290" fill="none">
              <path
                class="signal-grid"
                d="M0 145H360M180 0V290M38 3L322 287M38 287L322 3"
              />
              <circle cx="180" cy="145" r="114" class="signal-ring" />
              <circle cx="180" cy="145" r="77" class="signal-ring faint" />
              <ellipse
                cx="180"
                cy="145"
                rx="42"
                ry="114"
                class="signal-ring"
                transform="rotate(40 180 145)"
              />
              <ellipse
                cx="180"
                cy="145"
                rx="42"
                ry="114"
                class="signal-ring"
                transform="rotate(-40 180 145)"
              />
              <path class="signal-axis" d="M69 232 292 57" />
              <circle cx="269" cy="75" r="12" fill="var(--accent)" />
              <circle cx="91" cy="215" r="5" fill="var(--paper)" />
              <circle cx="180" cy="145" r="10" fill="var(--accent)" />
              <path d="M180 125V165M160 145H200" stroke="var(--accent)" />
              <circle
                cx="180"
                cy="145"
                r="133"
                stroke="var(--line-dark)"
                stroke-dasharray="1 9"
              /></svg
            ><span class="signal-coordinate">UNWRITTEN / 00.01</span
            ><span class="signal-caption"
              >MANY POSSIBLE FUTURES.<br />ONE PERSPECTIVE OF YOUR OWN.</span
            >
          </div>
        </section>
        <div class="observatory-strip">
          <span
            ><Radio :size="14" /><strong>{{
              chainState === "ready"
                ? "Signal is live"
                : chainState === "loading"
                  ? "Finding the signal"
                  : "Preview mode"
            }}</strong></span
          ><span
            ><b>{{
              chainState === "ready" ? String(openCount).padStart(2, "0") : "—"
            }}</b>
            open questions</span
          ><span
            ><b>{{ chainState === "ready" ? totalCalls : "—" }}</b> recorded
            calls</span
          ><span class="strip-end"
            >NO STAKES. JUST PERSPECTIVE. <ArrowUpRight :size="13"
          /></span>
        </div>
        <section id="forecasts" class="board-section">
          <div class="section-heading">
            <div>
              <p class="eyebrow">01 / DISCOVER</p>
              <h2>Forecast board<span class="heading-dot">.</span></h2>
            </div>
            <div class="board-status">
              <span
                class="status-dot"
                :class="{ connected: chainState === 'ready' }"
              ></span
              >{{
                chainState === "ready"
                  ? "Synced with testnet"
                  : chainState === "loading"
                    ? "Connecting to testnet…"
                    : "Live data unavailable"
              }}<button
                class="icon-button"
                aria-label="Refresh forecasts"
                :disabled="chainState === 'loading'"
                @click="loadChain()"
              >
                <RefreshCw
                  :size="15"
                  :class="{ spin: chainState === 'loading' }"
                />
              </button>
            </div>
          </div>
          <div class="board-layout">
            <div class="forecast-board">
              <div class="board-tools">
                <label class="search-field"
                  ><Search :size="17" /><input
                    v-model="search"
                    type="search"
                    aria-label="Search forecasts"
                    placeholder="Find a question, asset, or idea…" /></label
                ><label class="sort-field"
                  ><SlidersHorizontal :size="15" /><select
                    v-model="sort"
                    aria-label="Sort forecasts"
                  >
                    <option value="closing">Closing soon</option>
                    <option value="newest">Newest first</option>
                    <option value="participation">Most calls</option>
                  </select></label
                >
              </div>
              <div class="category-tabs" aria-label="Filter forecasts">
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
              <div class="result-context">
                <span
                  >{{
                    chainState === "loading"
                      ? "Loading questions"
                      : `${displayMarkets.length} ${displayMarkets.length === 1 ? "question" : "questions"}`
                  }}
                  <span v-if="chainState === 'unavailable'"
                    >· ILLUSTRATIVE PREVIEW</span
                  ></span
                ><button v-if="hasFilters" @click="resetFilters">
                  Clear filters <X :size="12" /></button
                ><span v-else class="context-right"
                  >YOUR NEXT CALL STARTS HERE</span
                >
              </div>
              <div
                v-if="chainState === 'unavailable'"
                class="offline-notice"
                role="status"
              >
                <Radio :size="16" />
                <p>
                  You're viewing examples. Live forecasts are temporarily
                  unavailable.
                </p>
                <button @click="loadChain()">
                  Retry <RefreshCw :size="13" />
                </button>
              </div>
              <div
                v-if="chainState === 'loading'"
                class="loading-list"
                role="status"
                aria-label="Loading live forecasts"
              >
                <div v-for="n in 3" :key="n" class="skeleton-row">
                  <span></span>
                  <div><i></i><i></i></div>
                  <b></b>
                </div>
                <p>Reading the public testnet. This may take a moment.</p>
              </div>
              <div class="market-list" v-else-if="displayMarkets.length">
                <article
                  v-for="(m, index) in displayMarkets"
                  :key="m.id"
                  class="market-row"
                >
                  <div class="market-index">
                    {{ String(index + 1).padStart(2, "0") }}
                  </div>
                  <div class="market-content">
                    <div class="market-top">
                      <span class="asset-icon">{{ m.icon }}</span
                      ><span class="asset-ticker">{{ m.ticker }}</span
                      ><span class="market-category">{{ m.category }}</span
                      ><span
                        class="market-status"
                        :class="{
                          resolved: m.outcome,
                          closed: !m.outcome && m.closesAt * 1000 <= now,
                        }"
                        ><i></i
                        >{{
                          chainState === "ready" ? status(m) : "Example"
                        }}</span
                      >
                    </div>
                    <h3>
                      <button @click="openForecast(m)">{{ m.question }}</button>
                    </h3>
                    <p class="market-meta">
                      {{
                        chainState === "ready"
                          ? `Closes ${dateLabel(m.closesAt)} · UTC`
                          : "Illustrative scenario · not live data"
                      }}<span
                        v-if="forecasts[m.id]?.exists"
                        class="recorded-label"
                        ><Check :size="12" />Your call recorded</span
                      >
                    </p>
                  </div>
                  <div class="market-signal">
                    <strong
                      >{{ m.probability === null ? "—" : m.probability
                      }}<small v-if="m.probability !== null">%</small></strong
                    ><span>{{
                      m.probability === null
                        ? "No calls yet"
                        : chainState === "ready"
                          ? "of calls say YES"
                          : "example YES view"
                    }}</span>
                    <div class="sentiment-bar">
                      <span :style="{ width: `${m.probability ?? 0}%` }"></span>
                    </div>
                  </div>
                  <div class="market-action">
                    <button class="call-button" @click="openForecast(m)">
                      {{
                        chainState !== "ready"
                          ? "View example"
                          : m.outcome
                            ? "View result"
                            : forecasts[m.id]?.exists
                              ? "View call"
                              : m.closesAt * 1000 <= now
                                ? "View question"
                                : "Make a call"
                      }}<ArrowUpRight :size="16" /></button
                    ><small>{{
                      chainState === "ready"
                        ? `${m.totalForecasts} recorded calls`
                        : "Read-only preview"
                    }}</small>
                  </div>
                </article>
              </div>
              <div v-else class="empty-state">
                <component
                  :is="category === 'My calls' ? Fingerprint : Search"
                  :size="32"
                />
                <h3>
                  {{
                    category === "My calls" && !verified
                      ? "Your perspective belongs here."
                      : search
                        ? "No questions match your search."
                        : category === "My calls"
                          ? "A record starts with one call."
                          : "No questions in this view yet."
                  }}
                </h3>
                <p>
                  {{
                    category === "My calls" && !verified
                      ? "Connect your wallet to see your onchain calls."
                      : "Explore another category or clear your filters to find your next question."
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
                      : "Explore all forecasts"
                  }}<ArrowRight :size="16" />
                </button>
              </div>
              <div class="board-footnote">
                <ShieldCheck :size="15" />
                <p>
                  Opinions, recorded on testnet. No deposits. No payouts. Only
                  testnet gas.
                </p>
                <span>PUBLIC BY DESIGN</span>
              </div>
            </div>
            <aside class="field-notes" id="record">
              <div class="notes-heading">
                <span>YOUR FIELD NOTES</span><Fingerprint :size="18" />
              </div>
              <template v-if="verified"
                ><p class="notes-kicker">CONNECTED AS {{ shortAddress }}</p>
                <h3>Your thinking.<br />On the record.</h3>
                <div class="record-stats">
                  <div>
                    <strong>{{ record?.total ?? "—" }}</strong
                    ><span>Calls</span>
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
                <button class="button accent full-width" @click="showMyCalls">
                  Explore my calls <ArrowUpRight :size="16" /></button
                ><button class="notes-account" @click="modal = 'account'">
                  View wallet & details
                  <ChevronRight :size="14" /></button></template
              ><template v-else
                ><div class="empty-record-art" aria-hidden="true">
                  <span></span><span></span
                  ><Fingerprint :size="37" stroke-width="1" />
                </div>
                <h3>Good thinking<br />leaves a trace.</h3>
                <p>
                  Connect your wallet. Make a call.<br />Build a perspective you
                  can revisit.
                </p>
                <button class="button accent full-width" @click="openWallet()">
                  Start your record <ArrowUpRight :size="16" /></button
                ><small class="notes-small"
                  >A signature to sign in. No funds moved.</small
                ></template
              >
              <div class="notes-divider"></div>
              <div class="field-tip">
                <span class="tip-number">A NOTE TO YOUR FUTURE SELF</span>
                <p>
                  Being right is one thing.<br /><em
                    >Knowing why is everything.</em
                  >
                </p>
                <a href="#how-it-works" @click="navigate('how-it-works')"
                  >Read the field guide <ArrowRight :size="15"
                /></a>
              </div>
            </aside>
          </div>
        </section>
        <section class="guide-section" id="how-it-works">
          <div class="section-heading">
            <div>
              <p class="eyebrow">02 / FIELD GUIDE</p>
              <h2>From a hunch.<br />To a history.</h2>
            </div>
            <p>Three small steps.<br />A more deliberate way to think ahead.</p>
          </div>
          <div class="guide-layout">
            <div
              class="guide-steps"
              role="tablist"
              aria-label="How forecasting works"
            >
              <button
                v-for="(step, index) in steps"
                :id="`step-${index}`"
                :key="step.label"
                role="tab"
                :aria-selected="activeStep === index"
                :tabindex="activeStep === index ? 0 : -1"
                aria-controls="step-panel"
                :class="{ active: activeStep === index }"
                @click="activeStep = index"
                @keydown.right.prevent="changeStep(activeStep + 1)"
                @keydown.left.prevent="changeStep(activeStep - 1)"
                @keydown.down.prevent="changeStep(activeStep + 1)"
                @keydown.up.prevent="changeStep(activeStep - 1)"
              >
                <span class="step-number">0{{ index + 1 }}</span
                ><span
                  ><strong>{{ step.label }}</strong
                  ><small>{{ step.title }}</small></span
                ><ArrowUpRight :size="20" />
              </button>
            </div>
            <div
              class="guide-panel"
              id="step-panel"
              role="tabpanel"
              :aria-labelledby="`step-${activeStep}`"
              tabindex="0"
            >
              <div class="guide-panel-top">
                <span>THE PRACTICE OF PERSPECTIVE</span
                ><span>0{{ activeStep + 1 }} / 03</span>
              </div>
              <h3>{{ steps[activeStep].title }}</h3>
              <p>{{ steps[activeStep].body }}</p>
              <div v-if="activeStep === 1" class="demo-choices">
                <button
                  :class="{ selected: demoSide }"
                  :aria-pressed="demoSide"
                  @click="demoSide = true"
                >
                  YES <Check v-if="demoSide" :size="16" /><ArrowUpRight
                    v-else
                    :size="16"
                  /></button
                ><button
                  :class="{ selected: !demoSide }"
                  :aria-pressed="!demoSide"
                  @click="demoSide = false"
                >
                  NO <Check v-if="!demoSide" :size="16" /><ArrowUpRight
                    v-else
                    :size="16"
                  /></button
                ><span>Interactive example · no transaction</span>
              </div>
              <div v-else-if="activeStep === 2" class="guide-principle">
                <Fingerprint :size="27" /><span
                  >One wallet. One call.<br /><strong
                    >A history that cannot be rewritten.</strong
                  ></span
                >
              </div>
              <div v-else class="guide-principle">
                <Compass :size="27" /><span
                  >A clear question. A public source.<br /><strong
                    >An outcome everyone can check.</strong
                  ></span
                >
              </div>
              <div class="guide-panel-bottom">
                <span>{{ steps[activeStep].detail }}</span
                ><a href="#forecasts" aria-label="Explore forecast board"
                  ><ArrowUpRight :size="21"
                /></a>
              </div>
            </div>
          </div>
        </section>
        <section class="community-section" id="communities">
          <div class="community-symbol" aria-hidden="true">
            <span>↗</span><span>↖</span><span>↘</span><span>↙</span><i></i>
          </div>
          <div class="community-copy">
            <p class="eyebrow">03 / A SHARED HORIZON</p>
            <h2>Different minds.<br /><span>Better questions.</span></h2>
            <p>
              Bring a question to your group chat. Share a forecast, compare
              perspectives, and give good thinking a public record.
            </p>
            <div class="community-links">
              <a class="button primary" href="#forecasts"
                >Find a question to share <ArrowUpRight :size="16" /></a
              ><a class="text-link" href="/docs/litepaper.html#roadmap"
                >What's next <ArrowRight :size="15"
              /></a>
            </div>
            <p class="roadmap-note">
              <span class="status-dot"></span>Community spaces & chat
              integrations are on the roadmap.
            </p>
          </div>
        </section>
        <section class="faq-section" id="questions">
          <div>
            <p class="eyebrow">BEFORE YOUR FIRST CALL</p>
            <h2>Clear ground.<br />Open questions.</h2>
            <a class="text-link" href="/docs/litepaper.html"
              >Read the manifesto <ArrowUpRight :size="16"
            /></a>
          </div>
          <div class="faq-list">
            <details v-for="(faq, i) in faqs" :key="faq[0]">
              <summary>
                <span>{{ String(i + 1).padStart(2, "0") }}</span
                >{{ faq[0] }}<Plus :size="17" />
              </summary>
              <p>{{ faq[1] }}</p>
            </details>
          </div>
        </section>
      </main>
      <footer class="footer">
        <div>
          <a href="#main" class="footer-brand"
            >{{ BRAND.name.toLowerCase() }}<span>↗</span></a
          >
          <p>The future is still an open question.</p>
        </div>
        <div class="footer-links">
          <a href="/docs/litepaper.html"
            >Manifesto <ArrowUpRight :size="13" /></a
          ><a
            href="/docs/business-plan.pdf"
            target="_blank"
            rel="noopener noreferrer"
            >Business plan <ArrowUpRight :size="13" /></a
          ><a
            v-if="deployment"
            :href="`${NETWORK.explorer}/address/${deployment.address}`"
            target="_blank"
            rel="noopener noreferrer"
            >Contract <ArrowUpRight :size="13" /></a
          ><a href="/docs/privacy.html">Privacy</a
          ><a
            :href="`https://x.com/${BRAND.handle}`"
            target="_blank"
            rel="noopener noreferrer"
            >X / Twitter <ArrowUpRight :size="13"
          /></a>
        </div>
        <div class="footer-bottom">
          <span>© {{ new Date().getFullYear() }} {{ BRAND.name }}.</span>
          <p>
            Independent project. Not affiliated with Robinhood.<br />Testnet
            pilot · No real-money trading · No token announced.
          </p>
          <span class="footer-edition">PERSPECTIVE / V.01</span>
        </div>
      </footer>
    </div>
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
        class="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        tabindex="-1"
        ref="dialogRef"
      >
        <button
          class="modal-close icon-button"
          aria-label="Close dialog"
          :disabled="pending || walletBusy"
          @click="closeModal"
        >
          <X :size="21" />
        </button>
        <template v-if="modal === 'wallet'"
          ><span class="dialog-icon"><Wallet :size="26" /></span>
          <p class="eyebrow">YOUR WALLET. YOUR PERSPECTIVE.</p>
          <h2 id="dialog-title">Make yourself known.</h2>
          <p>
            Connect an Ethereum-compatible wallet and sign a free message to
            verify ownership in this browser session.
          </p>
          <div v-if="wallets.length" class="wallet-options">
            <button
              v-for="w in wallets"
              :key="w.info.uuid"
              :disabled="walletBusy"
              @click="connect(w)"
            >
              <Wallet :size="21" /><span>{{ w.info.name }}</span
              ><LoaderCircle
                v-if="walletBusy"
                class="spin"
                :size="18"
              /><ArrowUpRight v-else :size="18" />
            </button>
          </div>
          <div v-else class="no-wallet">
            <p>
              <strong>No browser wallet detected.</strong><br />Install a
              wallet, then return to start your record.
            </p>
            <a
              class="button primary"
              href="https://metamask.io/download/"
              target="_blank"
              rel="noopener noreferrer"
              >Get MetaMask <ArrowUpRight :size="17" /></a
            ><button class="text-link-button" @click="discoverWallets">
              Check again <RefreshCw :size="14" />
            </button>
          </div>
          <p v-if="walletError" class="error-message" role="alert">
            {{ walletError }}
          </p>
          <p class="dialog-note">
            We'll request Robinhood Chain Testnet (46630). Signing in moves no
            funds. Onchain calls need testnet ETH for gas.
          </p>
          <button
            v-if="walletReturn && chosen"
            class="text-link-button"
            :disabled="walletBusy"
            @click="modal = 'forecast'"
          >
            ← Back to your question
          </button></template
        >
        <template v-else-if="modal === 'account'"
          ><span class="dialog-icon"><Fingerprint :size="27" /></span>
          <p class="eyebrow">YOUR FIELD NOTES</p>
          <h2 id="dialog-title">A record of your own.</h2>
          <a
            class="account-address"
            :href="`${NETWORK.explorer}/address/${address}`"
            target="_blank"
            rel="noopener noreferrer"
            >{{ shortAddress }} <ExternalLink :size="14"
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
            Your record counts all calls in this pilot contract. Cancelled:
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
            >View my calls <ArrowRight :size="17" /></a
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
                ? `ONCHAIN QUESTION / ${String(chosen.id).padStart(2, "0")}`
                : "READ-ONLY EXAMPLE"
            }}
          </p>
          <h2 id="dialog-title" class="forecast-title">
            {{ chosen.question }}
          </h2>
          <template v-if="typeof chosen.id !== 'number'"
            ><div class="preview-message">
              <Radio :size="22" />
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
              Retry live forecasts <RefreshCw :size="16" /></button></template
          ><template v-else
            ><div class="resolution-info">
              <div>
                <span>Closes</span
                ><strong
                  >{{ dateLabel(chosen.closesAt) }} ·
                  {{
                    new Date(chosen.closesAt * 1000).toISOString().slice(11, 16)
                  }}
                  UTC</strong
                >
              </div>
              <div>
                <span>Resolution</span
                ><strong>Public source · Pilot operator</strong>
              </div>
              <a
                v-if="/^https:\/\//.test(sourceUrl)"
                :href="sourceUrl"
                target="_blank"
                rel="noopener noreferrer"
                >Read resolution source <ArrowUpRight :size="14"
              /></a>
              <p class="source-rules">{{ sourceRules }}</p>
              <p v-if="!chosenClosed" class="source-timing">
                Outcome data is checked after the deadline. Future-dated source
                queries may return no data yet.
              </p>
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
              <Check :size="28" />
              <h3>Your call is on the record.</h3>
              <p>
                {{ side ? "YES" : "NO" }} · {{ confidence }}% confidence. Your
                transaction is confirmed.
              </p>
            </div>
            <div v-else-if="currentForecast?.exists" class="success-box">
              <Fingerprint :size="26" />
              <h3>You've already made your call.</h3>
              <p>
                {{ currentForecast.yes ? "YES" : "NO" }} ·
                {{ Number(currentForecast.confidence) }}% confidence. Confirmed
                calls cannot be changed.
              </p>
            </div>
            <div v-else-if="chosenClosed" class="success-box">
              <h3>
                {{
                  chosen.outcome
                    ? status(chosen)
                    : "Closed · awaiting resolution"
                }}
              </h3>
              <p>This question is no longer accepting calls.</p>
            </div>
            <template v-else
              ><div class="forecast-choices">
                <button
                  :class="{ selected: side }"
                  :aria-pressed="side"
                  :disabled="pending"
                  @click="side = true"
                >
                  YES <Check v-if="side" :size="19" /><ArrowUpRight
                    v-else
                    :size="19"
                  /></button
                ><button
                  :class="{ selected: !side }"
                  :aria-pressed="!side"
                  :disabled="pending"
                  @click="side = false"
                >
                  NO <Check v-if="!side" :size="19" /><ArrowUpRight
                    v-else
                    :size="19"
                  />
                </button>
              </div>
              <label class="confidence-label" for="confidence"
                >How confident are you?<strong>{{ confidence }}%</strong></label
              ><input
                id="confidence"
                type="range"
                min="50"
                max="100"
                v-model.number="confidence"
                :disabled="pending"
              />
              <div class="range-labels">
                <span>Leaning this way</span><span>Very confident</span>
              </div>
              <button
                v-if="!verified"
                class="button primary full-width"
                @click="openWallet()"
              >
                Connect wallet to make your call <Wallet :size="17" /></button
              ><button
                v-else
                class="button primary full-width"
                :disabled="pending"
                @click="submit"
              >
                <LoaderCircle v-if="pending" class="spin" :size="18" />{{
                  pending
                    ? txHash
                      ? "Confirming onchain…"
                      : "Confirm in your wallet…"
                    : "Record my " + (side ? "YES" : "NO") + " call"
                }}<ArrowUpRight v-if="!pending" :size="17" />
              </button>
              <p class="dialog-note">
                One call per wallet. Immutable after confirmation. No stake or
                payout; only testnet gas.
              </p></template
            >
            <p v-if="txError || walletError" class="error-message" role="alert">
              {{ txError || walletError }}
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
              }}<ExternalLink :size="14"
            /></a>
            <div class="dialog-footer">
              <button @click="share(chosen)">
                <Copy :size="14" />{{
                  copied ? "Copied!" : "Share this question"
                }}</button
              ><a
                href="https://faucet.testnet.chain.robinhood.com"
                target="_blank"
                rel="noopener noreferrer"
                >Get testnet ETH <ArrowUpRight :size="14"
              /></a></div></template
        ></template>
      </section></div
  ></Transition>
</template>
