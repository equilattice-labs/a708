<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from "vue";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowDown,
  Check,
  X,
  Menu,
  Plus,
  ExternalLink,
  Wallet,
  Fingerprint,
  Radio,
  Globe2,
  ShieldCheck,
  Link2,
  ChevronRight,
  LoaderCircle,
  Compass,
  Copy,
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

const mobileMenu = ref(false),
  modal = ref(null),
  chosen = ref(null),
  category = ref("All forecasts"),
  side = ref(true),
  confidence = ref(65),
  pending = ref(false),
  txHash = ref(""),
  txSuccess = ref(false),
  txError = ref(""),
  copied = ref(false);
const dialogRef = ref(null),
  lastFocus = ref(null),
  demoSide = ref(true),
  activeStep = ref(0);
const now = ref(Date.now());
const nowTimer = setInterval(() => (now.value = Date.now()), 1000);
const categories = [
  "All forecasts",
  "Crypto",
  "Ecosystem",
  "Resolved",
  "My calls",
];
const examples = [
  {
    id: "btc",
    question: "Will Bitcoin finish the year above $120,000?",
    ticker: "BTC",
    category: "Crypto",
    icon: "₿",
    tone: "orange",
    probability: 64,
    source: "CoinGecko BTC/USD daily close",
    yesCount: 0,
  },
  {
    id: "eth",
    question: "Will Ethereum outperform Bitcoin this quarter?",
    ticker: "ETH",
    category: "Crypto",
    icon: "Ξ",
    tone: "violet",
    probability: 58,
    source: "Relative quarterly USD returns",
    yesCount: 0,
  },
  {
    id: "chain",
    question: "What comes next for the onchain economy?",
    ticker: "CHAIN",
    category: "Ecosystem",
    icon: "✳",
    tone: "mint",
    probability: 72,
    source: "Explore the Robinhood Chain ecosystem",
    yesCount: 0,
  },
];
const displayMarkets = computed(() => {
  let items =
    chainState.value === "ready"
      ? chainMarkets.value.map((m, i) => ({
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
          tone: ["orange", "violet", "mint"][i % 3],
          probability: m.totalForecasts
            ? Math.round((m.yesCount / m.totalForecasts) * 100)
            : null,
        }))
      : examples;
  if (category.value === "My calls")
    return items.filter((m) => forecasts.value[m.id]?.exists);
  if (category.value === "Resolved") return items.filter((m) => m.outcome > 0);
  items = items.filter((m) => !m.outcome);
  if (category.value !== "All forecasts")
    items = items.filter((m) => m.category === category.value);
  return items;
});
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
    title: "Find your point of view.",
    body: "Start with a question worth asking. Read its deadline and source, then decide what you think will happen.",
    label: "Discover",
  },
  {
    title: "Make it a matter of record.",
    body: "Choose YES or NO and set your confidence. Your wallet records the call on Robinhood Chain testnet.",
    label: "Commit",
  },
  {
    title: "Let the outcome do the talking.",
    body: "Return after resolution. See what held up, what changed, and how your judgment develops over time.",
    label: "Reflect",
  },
];
const faqs = [
  [
    "What is Forevane?",
    "Forevane is a social forecasting experiment on Robinhood Chain. Make a market call, put it onchain, and build a track record that can be checked. The current release is a public testnet pilot.",
  ],
  [
    "Am I trading or risking real money?",
    "No. This pilot records opinions, not financial positions. It has no deposits, wagering, payouts, or token approvals. A submitted call costs only Robinhood testnet ETH gas. Testnet ETH has no monetary value.",
  ],
  [
    "How are forecasts resolved?",
    "Each onchain question includes a public source and a closing time. The pilot operator resolves YES, NO, or CANCELLED after the deadline. This is a centralized resolution process, not an oracle guarantee. Ambiguous or unverifiable questions should be cancelled.",
  ],
  [
    "Can I change or delete a call?",
    "A confirmed call is immutable, with one call per wallet per question. The pilot supports up to 256 calls per wallet. Public wallet addresses and forecast activity are visible on the blockchain.",
  ],
  [
    "Do you have a token or an airdrop?",
    "No token, airdrop, or financial rewards are announced. Participation builds a testnet record and helps evaluate the product. There is no promise of future eligibility or value.",
  ],
  [
    "Is Forevane affiliated with Robinhood?",
    "Forevane is an independent project built on Robinhood Chain testnet. It is not affiliated with, sponsored by, or endorsed by Robinhood. Community spaces, Telegram integrations, and paid analytics are roadmap features.",
  ],
];
function openWallet() {
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
    : "Illustrative forecast";
}
function status(m) {
  return !m.outcome && m.closesAt * 1000 <= now.value
    ? "Closed · pending"
    : ["Open forecast", "Resolved · YES", "Resolved · NO", "Cancelled"][
        m.outcome || 0
      ];
}
async function connect(w) {
  if (await connectWallet(w)) {
    if (modal.value === "wallet") modal.value = "account";
  }
}
async function submit() {
  pending.value = true;
  txError.value = "";
  try {
    await commitCall(
      chosen.value.id,
      side.value,
      confidence.value,
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
    setTimeout(() => (copied.value = false), 2500);
  } catch {
    txError.value =
      "Clipboard unavailable. Copy the page URL to share this forecast.";
  }
}
function keyboard(e) {
  if (e.key === "Escape") closeModal();
  if (e.key === "Tab" && modal.value && dialogRef.value) {
    const focusable = Array.from(
      dialogRef.value.querySelectorAll(
        "button:not(:disabled),a[href],input:not(:disabled),select",
      ),
    ).filter((el) => el.offsetParent !== null);
    const first = focusable[0],
      last = focusable.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  }
}
watch(modal, async (value) => {
  if (value) {
    lastFocus.value = document.activeElement;
    document.body.style.overflow = "hidden";
    await nextTick();
    dialogRef.value?.focus();
  } else {
    document.body.style.overflow = "";
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
  document.addEventListener("keydown", keyboard);
  await loadChain();
  const id = Number(new URLSearchParams(location.search).get("market"));
  if (id) {
    const m = displayMarkets.value.find((m) => m.id === id);
    if (m) openForecast(m);
  }
});
onUnmounted(() => {
  clearInterval(nowTimer);
  document.removeEventListener("keydown", keyboard);
  document.body.style.overflow = "";
});
</script>

<template>
  <a href="#main" class="skip-link">Skip to content</a>
  <div class="announcement">
    <span class="live-dot"></span> A new direction for your conviction.
    <a href="#forecasts">Explore the testnet <ArrowUpRight :size="13" /></a>
  </div>
  <header class="header wrap">
    <a href="#" class="wordmark" :aria-label="`${BRAND.name} home`"
      ><img src="/brand/mark.svg" alt="" />{{ BRAND.name.toLowerCase() }}</a
    >
    <nav class="desktop-nav" aria-label="Main navigation">
      <a href="#forecasts">Explore</a><a href="#how-it-works">How it works</a
      ><a href="#communities">For communities</a
      ><a href="/docs/litepaper.html" target="_blank"
        >Manifesto <ArrowUpRight :size="13"
      /></a>
    </nav>
    <div class="nav-actions">
      <button
        class="wallet-button"
        @click="verified ? (modal = 'account') : openWallet()"
      >
        <span class="connection-dot" v-if="verified"></span
        >{{ verified ? shortAddress : "Connect wallet"
        }}<Wallet :size="15" /></button
      ><button
        class="menu-button"
        :aria-expanded="mobileMenu"
        aria-controls="mobile-nav"
        aria-label="Toggle navigation"
        @click="mobileMenu = !mobileMenu"
      >
        <X v-if="mobileMenu" /><Menu v-else />
      </button>
    </div>
  </header>
  <nav
    id="mobile-nav"
    class="mobile-nav"
    v-if="mobileMenu"
    aria-label="Mobile navigation"
  >
    <a
      v-for="link in [
        ['Explore', '#forecasts'],
        ['How it works', '#how-it-works'],
        ['Communities', '#communities'],
        ['Manifesto', '/docs/litepaper.html'],
      ]"
      :href="link[1]"
      @click="mobileMenu = false"
      >{{ link[0] }}<ArrowUpRight :size="16"
    /></a>
  </nav>
  <main id="main">
    <section class="hero wrap">
      <div class="hero-copy">
        <div class="eyebrow">
          <span class="mini-star">✳</span> SOCIAL FORECASTING. REAL CONVICTION.
        </div>
        <h1>Your next take.<br /><span>On the record.</span></h1>
        <p>
          Big ideas deserve more than a group chat.<br class="desktop-break" />
          Make your call. Find your people.<br class="desktop-break" />
          Build a track record that speaks for itself.
        </p>
        <div class="hero-actions">
          <a class="button dark" href="#forecasts"
            >Find your forecast <ArrowUpRight :size="19" /></a
          ><a class="button text-button" href="#how-it-works"
            >Meet {{ BRAND.name }} <span class="play-icon">↗</span></a
          >
        </div>
        <div class="hero-note">
          <span class="network-symbol">⌁</span
          ><span>Built on Robinhood Chain <b>TESTNET</b></span>
        </div>
      </div>
      <div
        class="hero-visual"
        aria-label="A sculptural signal vane surrounded by orbital paths"
      >
        <div class="orbit-lines"><i></i><i></i><i></i></div>
        <img
          class="hero-art"
          src="/brand/hero-art.png"
          alt="Mint and silver sculptural vane, pointing toward new possibilities"
          @error="(e) => (e.target.style.visibility = 'hidden')"
        /><span class="art-coordinate">A SIGNAL.<br />NOT JUST NOISE.</span>
        <div class="floating-label">
          <span class="live-dot"></span> A point of view, made permanent.
        </div>
        <div class="hero-receipt">
          <div class="receipt-top">
            <span class="receipt-avatar">fv</span>
            <div>Your conviction.<small>Your signature.</small></div>
            <ShieldCheck :size="20" />
          </div>
          <div class="receipt-rule"></div>
          <div class="receipt-bottom">
            <span>YES, I see it.</span
            ><span class="receipt-confidence"
              >65% confident <ArrowUpRight :size="14"
            /></span>
          </div>
          <span class="receipt-foot"
            >ILLUSTRATIVE CALL · YOUR WALLET, YOUR VOICE</span
          >
        </div>
        <span class="art-caption">01 / THE SHAPE OF WHAT’S NEXT</span>
      </div>
    </section>
    <div class="principles wrap">
      <span
        >A little conviction.<br /><strong
          >A different kind of signal.</strong
        ></span
      >
      <div><Fingerprint :size="22" /><span>Signed by you</span></div>
      <div><Globe2 :size="22" /><span>Recorded onchain</span></div>
      <div><Compass :size="22" /><span>Measured by outcomes</span></div>
      <span class="principle-end"
        >LESS NOISE. MORE PERSPECTIVE. <ArrowDown :size="16"
      /></span>
    </div>
    <section class="market-section wrap" id="forecasts">
      <div class="section-heading">
        <div>
          <p class="eyebrow">THE FORECAST BOARD</p>
          <h2>
            The future has<br class="mobile-break" />
            a few open questions.
          </h2>
        </div>
        <p>
          Find the one you have a view on. <br />Then put your thinking to the
          test.
        </p>
      </div>
      <div class="board-toolbar">
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
        <div class="board-status">
          <span
            :class="['live-dot', { 'muted-dot': chainState !== 'ready' }]"
          ></span
          >{{
            chainState === "ready"
              ? "ONCHAIN TESTNET"
              : chainState === "loading"
                ? "CONNECTING TO CHAIN"
                : "PREVIEW MODE"
          }}<button v-if="chainState === 'unavailable'" @click="loadChain()">
            Retry
          </button>
        </div>
      </div>
      <div class="market-grid" v-if="displayMarkets.length">
        <article class="market-card" v-for="m in displayMarkets" :key="m.id">
          <div class="market-card-top">
            <span :class="['asset-icon', m.tone]">{{ m.icon }}</span
            ><span class="asset-ticker"
              >{{ m.ticker }}<small>{{ m.category }}</small></span
            ><span class="market-tag">{{
              chainState === "ready" ? status(m) : "EXAMPLE"
            }}</span>
          </div>
          <h3>{{ m.question }}</h3>
          <div class="market-metadata">
            <span>{{
              chainState === "ready"
                ? "Closes " + dateLabel(m.closesAt) + " UTC"
                : "Illustrative scenario · not live data"
            }}</span>
          </div>
          <div class="probability">
            <strong>{{
              m.probability === null ? "—" : m.probability + "%"
            }}</strong
            ><span>{{
              m.probability === null
                ? "Be the first to call it"
                : chainState === "ready"
                  ? "of recorded calls say YES"
                  : "example YES sentiment"
            }}</span
            ><svg
              v-if="chainState !== 'ready'"
              viewBox="0 0 96 32"
              aria-hidden="true"
            >
              <path
                d="M1 26 10 21 18 23 26 14 36 18 45 15 53 19 61 9 69 12 78 7 84 10 95 2"
              />
            </svg>
          </div>
          <div class="sentiment-bar">
            <span :style="{ width: (m.probability ?? 50) + '%' }"></span>
          </div>
          <div class="market-card-bottom">
            <span>{{
              chainState === "ready"
                ? `${m.totalForecasts} onchain calls`
                : "Make room for your view"
            }}</span
            ><button @click="openForecast(m)">
              {{ m.outcome ? "View outcome" : "Make a call"
              }}<ArrowUpRight :size="16" />
            </button>
          </div>
        </article>
      </div>
      <div class="empty-state" v-else>
        <Fingerprint :size="34" />
        <h3>
          {{
            category === "My calls"
              ? "Your record starts with your first call."
              : "No forecasts in this category yet."
          }}
        </h3>
        <p>
          {{
            category !== "My calls"
              ? "Try another filter to find an open question."
              : verified
                ? "Explore an open question and record your point of view."
                : "Connect your wallet to see your onchain calls."
          }}
        </p>
        <button
          class="button dark"
          @click="verified ? (category = 'All forecasts') : openWallet()"
        >
          {{ verified ? "Explore forecasts" : "Connect wallet"
          }}<ArrowUpRight :size="17" />
        </button>
      </div>
      <p class="board-footnote">
        <ShieldCheck :size="14" /> Testnet opinions, not financial positions. No
        deposits. No payouts. Just your point of view.
      </p>
    </section>
    <section class="how-section" id="how-it-works">
      <div class="wrap how-layout">
        <div class="how-intro">
          <p class="eyebrow">FROM “I THINK” TO “I CALLED IT”</p>
          <h2>A good take<br />goes a long way.</h2>
          <p>
            Your next chapter starts with a simple question.<br />The record
            takes care of the rest.
          </p>
          <div class="step-buttons">
            <button
              v-for="(step, i) in steps"
              :key="step.label"
              :class="{ active: activeStep === i }"
              @click="activeStep = i"
            >
              <span>0{{ i + 1 }}</span
              >{{ step.label }}<ArrowUpRight :size="17" />
            </button>
          </div>
          <div class="step-description" aria-live="polite">
            <h3>{{ steps[activeStep].title }}</h3>
            <p>{{ steps[activeStep].body }}</p>
          </div>
        </div>
        <div class="walkthrough">
          <div class="demo-top">
            <span><img src="/brand/mark.svg" alt="" /> A LITTLE PREVIEW</span
            ><span class="demo-dots">•••</span>
          </div>
          <template v-if="activeStep === 0"
            ><div class="demo-kicker">01 / DISCOVER YOUR EDGE</div>
            <h3>Every good call<br />starts with a question.</h3>
            <div
              class="discovery-row"
              v-for="m in examples.slice(0, 2)"
              :key="m.id"
            >
              <span :class="['asset-icon', m.tone]">{{ m.icon }}</span
              ><span>{{ m.question }}</span
              ><ArrowUpRight :size="18" />
            </div>
            <p class="demo-small">
              A clear question. A clear deadline. A source you can check.
            </p></template
          ><template v-else-if="activeStep === 1"
            ><div class="demo-kicker">02 / YOUR CALL, YOUR CHOICE</div>
            <h3>Will ETH outperform<br />BTC this quarter?</h3>
            <div class="demo-options">
              <button :class="{ selected: demoSide }" @click="demoSide = true">
                <span>YES <ArrowUpRight :size="18" /></span>I see it
                happening.<Check
                  v-if="demoSide"
                  class="choice-check"
                  :size="17"
                /></button
              ><button
                :class="{ selected: !demoSide }"
                @click="demoSide = false"
              >
                <span>NO <ArrowUpRight :size="18" /></span>I see it
                differently.<Check
                  v-if="!demoSide"
                  class="choice-check"
                  :size="17"
                />
              </button>
            </div>
            <div class="demo-reaction">
              <Fingerprint :size="22" /><span
                >Your perspective is the signal.<small
                  >Choose it. Sign it. Stand behind it.</small
                ></span
              >
            </div></template
          ><template v-else
            ><div class="demo-kicker">03 / A RECORD YOU CAN REFLECT ON</div>
            <h3>The outcome matters.<br />So does the learning.</h3>
            <div class="record-example">
              <span class="outcome-pill"
                ><Check :size="14" /> RESOLVED · YES</span
              >
              <div>
                <span>Your call<strong>YES</strong></span
                ><span>Confidence<strong>65%</strong></span
                ><span>Result<strong>Correct ↗</strong></span>
              </div>
            </div>
            <p class="demo-small">
              Example result. Your real record comes from resolved onchain
              questions.
            </p></template
          >
          <div class="demo-footer">
            <span>INTERACTIVE EXAMPLE · NO TRANSACTIONS</span
            ><span>0{{ activeStep + 1 }} / 03</span>
          </div>
        </div>
      </div>
    </section>
    <section class="community-section wrap" id="communities">
      <div class="community-art">
        <div class="community-orbit ring-1"></div>
        <div class="community-orbit ring-2"></div>
        <div class="community-orbit ring-3"></div>
        <div class="community-center">
          <img src="/brand/mark.svg" alt="Forevane signal" />
        </div>
        <span class="community-person person-1">A<span>“I see it.”</span></span
        ><span class="community-person person-2"
          >M<span>“Here's why.”</span></span
        ><span class="community-person person-3"
          >J<span>“Different take.”</span></span
        ><span class="community-person person-4">K</span
        ><span class="tiny-orbit-dot"></span
        ><span class="community-art-label"
          >MANY PERSPECTIVES. ONE OPEN RECORD.</span
        >
      </div>
      <div class="community-copy">
        <p class="eyebrow">GOOD THINKING FINDS COMPANY</p>
        <h2>Independent minds.<br />Collective perspective.</h2>
        <p>
          The next great idea is already in someone's group chat. Give it a
          place to be challenged, shared, and remembered.
        </p>
        <div class="community-features">
          <div>
            <span>01</span>
            <p>
              <strong>A call worth sharing.</strong>Copy a forecast link. Let
              your community make up its own mind.
            </p>
          </div>
          <div>
            <span>02</span>
            <p>
              <strong>Reputation with receipts.</strong>Look beyond the loudest
              voice. Follow a record you can actually check.
            </p>
          </div>
          <div>
            <span>03</span>
            <p>
              <strong>More room to grow.</strong>Community spaces and chat
              integrations are next on our roadmap.
            </p>
          </div>
        </div>
        <a href="/docs/litepaper.html#roadmap" class="underlined-link"
          >See where we're headed <ArrowUpRight :size="17"
        /></a>
      </div>
    </section>
    <section class="conviction-section">
      <div class="wrap conviction-layout">
        <div>
          <p class="eyebrow">BUILT WITH A CLEAR POINT OF VIEW</p>
          <h2>Less “trust me.”<br />More “check for yourself.”</h2>
        </div>
        <div class="trust-list">
          <article>
            <Fingerprint :size="25" />
            <h3>Your wallet. Your voice.</h3>
            <p>
              Sign in with your own wallet. Calls are submitted by you, directly
              to the testnet contract.
            </p>
          </article>
          <article>
            <Link2 :size="25" />
            <h3>A record that stays.</h3>
            <p>
              One wallet, one call per question. Confirmed calls cannot be
              edited when the narrative changes.
            </p>
          </article>
          <article>
            <Compass :size="25" />
            <h3>Know what settles it.</h3>
            <p>
              Read the source and deadline first. Pilot outcomes are resolved by
              the operator, visibly onchain.
            </p>
          </article>
        </div>
      </div>
    </section>
    <section class="faq-section wrap" id="questions">
      <div>
        <p class="eyebrow">A FEW THINGS, UP FRONT</p>
        <h2>Curious?<br />Good instinct.</h2>
        <a href="/docs/litepaper.html" class="underlined-link"
          >Read the manifesto <ArrowUpRight :size="17"
        /></a>
      </div>
      <div class="faq-list">
        <details v-for="(faq, i) in faqs" :key="faq[0]">
          <summary>
            <span class="faq-number">0{{ i + 1 }}</span
            >{{ faq[0] }}<Plus :size="19" />
          </summary>
          <p>{{ faq[1] }}</p>
        </details>
      </div>
    </section>
    <section class="closing-section wrap">
      <div class="closing-star" aria-hidden="true">✳</div>
      <p class="eyebrow">THE FUTURE IS STILL AN OPEN QUESTION.</p>
      <h2>Have a point of view?<br />Give it a direction.</h2>
      <a class="button dark" href="#forecasts"
        >Make your first call <ArrowUpRight :size="18" /></a
      ><span class="closing-caption">YOUR MIND. YOUR CALL. YOUR RECORD.</span>
    </section>
  </main>
  <footer class="footer wrap">
    <div class="footer-top">
      <a href="#" class="wordmark"
        ><img src="/brand/mark.svg" alt="" />{{ BRAND.name.toLowerCase() }}</a
      >
      <p>A new direction for your conviction.</p>
      <div>
        <a href="/docs/litepaper.html">Manifesto <ArrowUpRight :size="13" /></a
        ><a href="/docs/business-plan.pdf" target="_blank"
          >Business plan <ArrowUpRight :size="13" /></a
        ><a
          v-if="deployment"
          :href="`${NETWORK.explorer}/address/${deployment.address}`"
          target="_blank"
          rel="noopener noreferrer"
          >Contract <ArrowUpRight :size="13" /></a
        ><a href="/docs/privacy.html">Privacy</a>
      </div>
    </div>
    <div class="footer-bottom">
      <span
        >© {{ new Date().getFullYear() }} {{ BRAND.name }}. A perspective of
        your own.</span
      >
      <p>
        Independent project. Not affiliated with Robinhood.<br />Testnet pilot ·
        No real-money trading · No token announced.
      </p>
      <span class="footer-network"
        ><span class="live-dot"></span> ROBINHOOD CHAIN TESTNET</span
      >
    </div>
  </footer>

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
          class="modal-close"
          aria-label="Close dialog"
          :disabled="pending || walletBusy"
          @click="closeModal"
        >
          <X :size="21" />
        </button>
        <template v-if="modal === 'wallet'"
          ><span class="dialog-icon"><Wallet :size="27" /></span>
          <p class="eyebrow">YOUR WALLET. YOUR VOICE.</p>
          <h2 id="dialog-title">Make yourself known.</h2>
          <p>
            Connect an Ethereum-compatible wallet and sign a free message to
            verify ownership in this browser session.
          </p>
          <div class="wallet-options" v-if="wallets.length">
            <button
              v-for="w in wallets"
              :key="w.info.uuid"
              :disabled="walletBusy"
              @click="connect(w)"
            >
              <Wallet :size="22" />{{ w.info.name
              }}<LoaderCircle
                v-if="walletBusy"
                class="spin"
                :size="18"
              /><ArrowUpRight v-else :size="18" />
            </button>
          </div>
          <div v-else class="no-wallet">
            <p>No browser wallet detected.</p>
            <a
              class="button dark"
              href="https://metamask.io/download/"
              target="_blank"
              rel="noopener noreferrer"
              >Get MetaMask <ArrowUpRight :size="17" /></a
            ><button class="text-link-button" @click="discoverWallets">
              Check again
            </button>
          </div>
          <p class="error-message" v-if="walletError" role="alert">
            {{ walletError }}
          </p>
          <p class="dialog-note">
            We'll request Robinhood Chain Testnet (46630). Signing in moves no
            funds. Onchain calls need testnet ETH for gas.
          </p></template
        >
        <template v-else-if="modal === 'account'"
          ><span class="dialog-icon"><Fingerprint :size="27" /></span>
          <p class="eyebrow">A PERSPECTIVE OF YOUR OWN</p>
          <h2 id="dialog-title">Your onchain record.</h2>
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
            Your record counts all your calls in this pilot contract. Cancelled:
            {{ record?.cancelled ?? "—" }}. Each wallet can make up to 256
            calls.
          </p>
          <button
            class="button dark full-width"
            @click="
              modal = null;
              category = 'My calls';
            "
          >
            View my calls <ArrowRight :size="17" /></button
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
                ? "ONCHAIN QUESTION #" + chosen.id
                : "INTERACTIVE PREVIEW"
            }}
          </p>
          <h2 id="dialog-title" class="forecast-title">
            {{ chosen.question }}
          </h2>
          <template v-if="typeof chosen.id !== 'number'"
            ><p>
              This is an illustrative scenario. The public RPC is currently
              unavailable, so no transaction can be submitted here.
            </p>
            <button
              class="button dark full-width"
              @click="
                loadChain();
                modal = null;
              "
            >
              Retry live forecasts <ArrowRight :size="17" /></button
          ></template>
          <template v-else
            ><div class="resolution-info">
              <span
                >Closes
                <strong
                  >{{ dateLabel(chosen.closesAt) }} ·
                  {{
                    new Date(chosen.closesAt * 1000).toISOString().slice(11, 16)
                  }}
                  UTC</strong
                ></span
              ><span
                >Resolution
                <strong>Public source · Pilot operator</strong></span
              ><a
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
            <div v-if="txSuccess" class="success-box">
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
                  YES <Check v-if="side" :size="17" /><ArrowUpRight
                    v-else
                    :size="17"
                  /></button
                ><button
                  :class="{ selected: !side }"
                  :aria-pressed="!side"
                  :disabled="pending"
                  @click="side = false"
                >
                  NO <Check v-if="!side" :size="17" /><ArrowUpRight
                    v-else
                    :size="17"
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
                v-model="confidence"
                :disabled="pending"
              />
              <div class="range-labels">
                <span>Leaning this way</span><span>Very confident</span>
              </div>
              <button
                v-if="!verified"
                class="button dark full-width"
                :disabled="walletBusy || !wallets.length"
                @click="connect(wallets[0])"
              >
                <LoaderCircle v-if="walletBusy" class="spin" :size="18" />{{
                  walletBusy
                    ? "Check your wallet"
                    : wallets.length
                      ? "Connect wallet to make your call"
                      : "Install a browser wallet to continue"
                }}<Wallet :size="17" /></button
              ><a
                v-if="!wallets.length"
                class="text-link-button"
                href="https://metamask.io/download/"
                target="_blank"
                rel="noopener noreferrer"
                >Get MetaMask ↗</a
              ><button
                v-if="verified"
                class="button dark full-width"
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
            <a
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
              /></a></div
          ></template>
        </template>
      </section></div
  ></Transition>
</template>
