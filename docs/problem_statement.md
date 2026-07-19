# Part 1 — AI-Powered Review Analysis Workflow (Discovery Engine)

**Project requirements document · Single source of truth**
**Scope: Part 1 only. Do not build Part 2, 3, or 4.**

---

## 0. How to use this document

This is the complete specification for building an AI-powered discovery engine that analyses quick-commerce user feedback at scale. It is written to be handed directly to an agentic coding environment (Antigravity, Claude Code, or equivalent) as the requirements document.

**Read Section 3 (Critical Constraints) before writing any code.** It contains a verified empirical finding that invalidates the obvious architecture. Building without it will produce a technically correct system that answers the wrong question.

---

## 1. Context

### 1.1 The company

**Blinkit** — an Indian quick-commerce platform. 10-minute delivery of groceries, snacks, beverages, household essentials, and a long tail of other categories (pet supplies, baby care, personal care, pharmacy, electronics accessories).

- Google Play package ID: `com.grofers.customerapp`
  *(Blinkit was formerly Grofers; the legacy package ID persists. This is verified working.)*
- Primary market: Indian metros. Reviews are in English, Hindi, and code-mixed **Hinglish** (Hindi written in Latin script).

### 1.2 The business problem

Quick commerce has succeeded at becoming habitual. Users place recurring orders weekly without deliberation. That success created the problem:

> Shopping behaviour becomes highly repetitive. Users purchase the same set of products repeatedly and rarely explore new categories available on the platform.

### 1.3 The strategic goal

> **Increase the percentage of Monthly Active Customers who purchase products from at least one new category every month.**

Examples of the target behaviour change:
- A user who buys groceries starts buying pet supplies.
- A user who buys snacks starts buying personal care products.
- A user who buys household essentials starts buying baby products.

### 1.4 Why this matters commercially

- **Retention** — multi-category buyers churn materially less. Each additional category is another reason to open the app and another habit a competitor must break.
- **Margin mix** — groceries are thin-margin and price-compared. Pet supplies, cosmetics, and baby care carry better margins. Category expansion improves mix without changing prices.
- **Defensibility** — a single-category user leaves for a ₹100 discount. A user who buys groceries, dog food, and diapers from one platform has too much re-learning to do.
- **Incremental margin** — the platform *already stocks* these categories. Shelf space is paid for. Every existing customer who discovers pet supplies is close to pure incremental margin: no acquisition cost, no new warehouse.

---

## 2. What Part 1 requires

### 2.1 The assignment's own words

> Before proposing any solution, you must build an AI-powered system that analyzes user feedback at scale.

Permitted tools (explicitly listed): Claude, GPTs, Agents, Workflows, RAG systems, n8n, Zapier, Perplexity, **any AI-native stack of your choice**.

Sources to analyse (explicitly listed):
- App Store reviews
- Play Store reviews
- Reddit discussions
- Community forums
- Social media conversations
- Product reviews
- Quick-commerce discussions

### 2.2 Questions the engine must help answer

1. Why do users repeatedly buy from the same categories?
2. What prevents users from exploring new categories?
3. How do users discover products today?
4. What role do habits play in shopping behaviour?
5. What information do users need before trying a new category?
6. What frustrations emerge repeatedly?
7. Which user segments are more likely to experiment?
8. What unmet needs emerge consistently across discussions?

### 2.3 What must be demonstrated

- How the workflow **gathers and analyses** data
- How **themes** are identified
- How **insights** are generated
- How the **quality of insights was validated**

### 2.4 Deliverables (Part 1 only)

| Deliverable | Requirement | Acceptance test |
|---|---|---|
| **Workflow link** | A link to *test out* the workflow | A stranger opens the URL on a phone, with no login and no setup, and can query the system and get a grounded answer. Must still work weeks after submission. |
| **1-slider** | One slide (inside the final deck) outlining how it works | A busy reviewer understands the system in 30 seconds. It is a **diagram**, not prose. |

**"Test out" is literal.** A Loom video is a demo, not a test. A PDF is a report. A Google Sheet is homework. A GitHub repo with a README is an assignment for the reviewer. The link must be *interactive*.

---

## 3. Critical constraints — read before designing

### 3.1 The corpus finding (verified empirically, July 2026)

A live scrape of **1,200 Blinkit Play Store reviews** produced:

| Measurement | Result |
|---|---|
| Median review length | **12 characters** |
| Reviews under 25 chars (analytically worthless) | 848 (**71%**) |
| Substantive reviews (>120 chars) | 92 (**8%**) |
| Mentions of pet / dog / cat | **0** |
| Mentions of baby / diaper / infant | **0** |
| Mentions of personal care / cosmetics | **0** |
| Mentions of discovery / "didn't know" | **1** |
| Mentions of trust / freshness / quality | 30 (2.5%) |

Representative reviews, verbatim: `"nice"` · `"Most helpful aap"` · `"Happy with fastest delivery 🚚😃"`

**Implication — this is the single most important constraint in this document:**

Play Store reviews are a **delivery-and-bugs corpus**. They are excellent evidence about riders, app crashes, and refunds. They are near-silent on category discovery. A pipeline that treats Play Store as its primary source will produce a well-validated, reproducible, *irrelevant* report concluding that users want faster delivery.

### 3.2 The absence problem

The research question is about **absence** — why users *don't* explore. Every available source captures **presence** — things users did and then had feelings about.

**Nobody has ever written a review saying "I never considered buying pet food here."**

The engine must therefore reach the answer **obliquely**. Valid oblique signals:

- **Friction on the one attempt** — users who tried a new category once and hit a problem
- **Surprise markers** — "I didn't even know they sold this!" (proves discovery failure by exception)
- **Trust language** — "would never order meat from an app", freshness/expiry concerns
- **Substitution/comparison** — where users go instead, and why
- **Habit language** — "I just reorder the same thing", "muscle memory"
- **Information gaps** — what users say they'd need to know before trying

**The system must explicitly acknowledge this limitation and document how it triangulates around it.** Naming this problem is a required output, not an optional flourish.

### 3.3 Source strategy (mandatory)

Source priority is **inverted** from the convenient ordering:

| Priority | Source | Rationale | Access method |
|---|---|---|---|
| **Primary** | Reddit | Long-form, discursive, unprompted. People explain *why* they still buy dog food at the local shop. This is where the answer lives. | **PRAW** with free registered app credentials. **Must run from a residential IP** — Reddit blocks datacenter IPs (verified: public `.json` endpoint returns `403 Blocked`). |
| **Secondary** | Play Store | Volume, dates, ratings, version metadata. Good for trust/freshness signal and frustration baseline. | `google-play-scraper` (verified working, no API key) |
| **Secondary** | App Store | Cross-platform validation; iOS users skew differently | `app-store-scraper` |
| **Tertiary** | Forums / quick-commerce discussion | Niche depth (pet owners, new parents) | Manual collection acceptable at low volume |

Each source has a documented bias. **The pipeline must record `source` as metadata on every row** so themes can be checked for single-source artefacts.

### 3.4 Cost constraint — absolute

**Zero spend. No exceptions.**

- No paid APIs
- No paid AI models
- No paid databases
- No paid deployment platforms
- No paid automation tools
- No credit card required where avoidable
- No trial clocks that expire before or shortly after submission

### 3.5 Link durability constraint

The workflow link is a graded deliverable that will be opened at an unknown future date. Therefore:

**Disqualified hosting (verified July 2026):**

| Service | Problem |
|---|---|
| Render free Postgres | **Expires 30 days after creation** |
| Qdrant Cloud free | Reportedly suspended after ~1 week idle, **deleted after ~4 weeks** |
| Supabase free | **Pauses after 7 days inactivity**, manual unpause required |
| Railway | $5 one-time trial, then $1/mo non-rolling — containers stop |
| Fly.io | Free tier discontinued for new customers |

A link that *sleeps* (Render web services: 15-min spin-down, ~60s cold start) is survivable but unimpressive. A link that **expires** is fatal and fails silently after you have stopped checking.

**Design requirement: the served artefact must not depend on any service that can pause, expire, or exhaust credit.**

---

## 4. Architecture

### 4.1 The key architectural decision

**The pipeline and the link are separate systems.**

The deliverable says *"link to test out your workflow"*. Nothing requires the heavy pipeline to run online. Therefore:

```
┌─────────────────────────────────────────────────────┐
│  PIPELINE  (offline — laptop or GitHub Actions)     │
│  Slow · occasionally breaks · needs residential IP  │
│  needs Python · runs weekly, not per-request        │
│                                                      │
│  scrape → clean → enrich → embed → cluster →        │
│  synthesise → validate                              │
│                          ↓                          │
│              produces: insights.json                │
└──────────────────────────┬──────────────────────────┘
                           │  committed to git
                           ↓
┌─────────────────────────────────────────────────────┐
│  LINK  (always-on — static host)                    │
│  Small · fast · cannot sleep, expire, or run out    │
│                                                      │
│  RAG query interface over insights.json             │
│  → this is the graded deliverable                   │
└─────────────────────────────────────────────────────┘
```

**Rationale:** the expensive, fragile part does not need to be online. The part that must never break is small. The constraints (Reddit needs residential IP; clustering needs Python; link cannot sleep) force this shape.

### 4.2 Verified-free stack

| Layer | Choice | Status |
|---|---|---|
| **Collection** | `google-play-scraper`, `app-store-scraper`, `praw` | Verified available: 1.2.7 / 0.3.5 / 8.0.2 |
| **Cleaning** | Python (pandas / stdlib) | Free |
| **Enrichment (LLM)** | **Gemini API free tier** (Flash family) — primary<br>**Ollama local** — fallback / unlimited | Gemini: free, no card, no expiry. **Only free while billing is disabled.** Limits are per-project, not per-key. Free-tier data trains Google's products.<br>Ollama: verified installed locally (v0.12.9; server needs starting) |
| **Embeddings** | `sentence-transformers` (local) | **Verified installing and importing on target machine** (v5.6.0). Free, unlimited, offline. |
| **Clustering** | `scikit-learn` (KMeans / HDBSCAN) | Verified installed. Three lines of code. |
| **Storage** | **JSON/CSV committed to git** | Free. Cannot sleep, expire, or pause. **At ~1,200–5,000 rows a vector database is unnecessary** — in-memory cosine similarity over a NumPy array is faster than a network round-trip. |
| **Scheduling** | **GitHub Actions** | Free, **unlimited minutes on public repos**. Note: cannot scrape Reddit (datacenter IP). |
| **Serving** | Static host — **GitHub Pages / Cloudflare Pages / Vercel** | Always-on, no sleep, no expiry |

**Do not add a vector database.** Explicitly justifying its *absence* at this scale demonstrates better judgment than adding Pinecone for appearances. If a hosted vector DB is added anyway, it must not be one that expires (§3.5).

**Target hardware:** Apple M2 Pro, 16 GB RAM, 10 cores — comfortably runs 7B-class local models and sentence-transformers.

### 4.3 Pipeline stages

Order is causal. You cannot cluster before you embed, or validate before you have something to validate.

#### Stage 1 — Scope
Fix the company (Blinkit) and the research question. Everything downstream inherits this. Skipping it is why pipelines produce true, useless findings about delivery speed.

#### Stage 2 — Collect
Pull reviews and posts into one place.

**Mandatory: preserve all metadata.** `source`, `date`, `rating`, `app_version`, `thumbs_up_count`, `author_hash`, `permalink`. You will want to slice by these later and cannot recover them afterwards.

Available fields from `google-play-scraper` (verified): `reviewId`, `userName`, `userImage`, `content`, `score`, `thumbsUpCount`, `reviewCreatedVersion`, `at`, `replyContent`, `repliedAt`, `appVersion`.

Target volume: enough to justify the words "at scale" — low thousands minimum. **Note the 71% noise rate**: 5,000 raw Play Store reviews yields roughly 400 substantive ones.

#### Stage 3 — Clean
- Deduplicate
- Drop rows under a length threshold (the "nice" / "good app" 71%)
- Remove bot/spam patterns
- **Detect and flag Hinglish / code-mixed text** — real, not hypothetical. Verified example from the corpus: `"bohot fast delivery h iska time badha kr 35 min kr na chahiye"`. Standard sentiment tools score this as neutral gibberish.
- Filter to rows plausibly relevant to the research question

**Mandatory: log every exclusion and its reason.** This log is evidence of rigour and reviewers look for it. Report the funnel: `N raw → N deduped → N above length threshold → N relevant`.

#### Stage 4 — Enrich
Run each surviving row through an LLM to produce **structured tags**:

- `topic` (delivery / product-quality / app-ux / pricing / discovery / trust / other)
- `sentiment` (positive / negative / neutral / mixed)
- `categories_mentioned` (list: groceries, pet, baby, personal-care, pharmacy, …)
- `is_discovery_related` (boolean — does this touch category exploration at all?)
- `is_trust_related` (boolean)
- `user_type_signals` (any segment hints: pet owner, parent, bulk buyer, …)
- `language` (en / hi / hinglish / other)

This converts unstructured text into an analysable table. **Force structured JSON output** — do not parse prose.

Rate limits: Gemini free tier is roughly 10–15 RPM / ~1,500 RPD (unverified exact figures — check your own project in AI Studio). Batch multiple reviews per call. Implement retry with backoff. Cache responses so a re-run does not re-spend quota.

#### Stage 5 — Embed & cluster
- Embed cleaned text with `sentence-transformers` (local, unlimited, free)
- Cluster with KMeans or HDBSCAN
- **Themes emerge rather than being imposed** — this is the point. Stage 4 tags confirm what you suspected; Stage 5 clusters reveal what you didn't.
- Label each cluster by passing its representative members to the LLM

#### Stage 6 — Synthesise
Convert clusters into **insights**, not themes.

- A **theme** is: `"trust in fresh produce"`
- An **insight** is: `"312 reviews (6% of corpus) express hesitation about produce freshness; this concentrates in first-time category buyers and is near-absent in repeat buyers — they need proof, not discounts."`

Every insight requires: a **count**, a **percentage**, **representative verbatim quotes**, and **source row IDs**.

Insights must be organised against the eight questions in §2.2. Where the corpus cannot answer a question, **say so explicitly** — that is a finding, not a gap.

#### Stage 7 — Validate
**This stage decides the grade. It is explicitly named in the assignment and most candidates skip it.**

An LLM will produce a fluent, confident, well-structured theme that is **simply not in the data**. It pattern-matches on what reviews *usually* say rather than what yours *do* say. Validation is how you find out before a hiring panel does.

Required checks:

1. **Human spot-check** — sample ≥50 rows, label them by hand, compare to machine labels. **Report the agreement rate including disagreements.** An honest 82% beats a claimed 100%, which only proves you didn't check.
2. **Traceability** — every insight links to its source row IDs. An insight with no rows behind it is fiction. Cheapest and strongest check available.
3. **Cross-source triangulation** — does the theme appear in Reddit *and* Play Store *and* forums? A theme in one source may be that source's bias. A theme in three is probably real.
4. **Consistency** — run the same batch twice. Divergent themes mean an unstable prompt and noisy output.
5. **Stated limitations** — sample bias, language coverage, date range, and the absence problem (§3.2). Confidence about what you *don't* know is the most senior thing on the page.

Validation results are a **required output artefact**, not an appendix.

#### Stage 8 — Serve
Expose the engine so a reviewer can **use** it.

RAG interface requirements:
- A query box accepting natural-language questions (the eight in §2.2 must work well)
- Retrieves relevant reviews/insights from `insights.json`, then answers **grounded in retrieved text only**
- **Every answer cites its sources** — shows the actual reviews behind the claim
- Displays corpus stats (volumes, sources, date range) so scale is visible
- Must not hallucinate: if the corpus cannot answer, it says so
- Works on mobile, no login, no setup

---

## 5. Required outputs

### 5.1 Code artefacts

```
/
├── problem_statement.md          # this file
├── README.md                     # what it is, how to run, what it found
├── requirements.txt
├── pipeline/
│   ├── collect.py                # scrapers, metadata preservation
│   ├── clean.py                  # dedupe, filter, Hinglish flag, exclusion log
│   ├── enrich.py                 # LLM tagging, structured output, caching
│   ├── cluster.py                # embeddings + clustering
│   ├── synthesise.py             # clusters → insights with counts + quotes
│   └── validate.py               # spot-check, triangulation, consistency
├── data/
│   ├── raw/                      # scraped, untouched
│   ├── clean/
│   └── insights.json             # the served artefact
├── validation/
│   ├── spot_check.csv            # human vs machine labels
│   └── validation_report.md      # agreement rate, disagreements, limitations
└── app/                          # RAG query interface (deployed)
```

### 5.2 The workflow link
Deployed, always-on, mobile-friendly, no login. Must satisfy the acceptance test in §2.4.

### 5.3 The 1-slider
A **diagram** showing:
- **In** — sources and volumes
- **Through** — the stages and tools, visually
- **Out** — themes and insights
- **Trust** — the validation line (agreement rate, triangulation)

If it reads as a wall of text, it has failed.

---

## 6. Definition of done

- [ ] Corpus collected from **≥2 sources**, with Reddit included (§3.3)
- [ ] Volume justifies "at scale" — low thousands raw minimum
- [ ] All metadata preserved on every row
- [ ] Cleaning funnel logged with counts and exclusion reasons
- [ ] Every row enriched with structured tags
- [ ] Clusters produced and labelled
- [ ] Insights carry counts, percentages, verbatim quotes, and source IDs
- [ ] Insights mapped against the eight questions in §2.2, with gaps named
- [ ] **Human spot-check of ≥50 rows completed, agreement rate reported honestly**
- [ ] Cross-source triangulation performed
- [ ] Limitations documented, including the absence problem (§3.2)
- [ ] RAG interface deployed, always-on, cites sources, works on mobile
- [ ] Link tested cold, signed out, from a phone
- [ ] Link depends on nothing that can expire or pause (§3.5)
- [ ] 1-slider diagram produced
- [ ] Total spend: **₹0**

---

## 7. Failure modes

| Failure | Why it happens | Guard |
|---|---|---|
| **Engine answers the wrong question** | Play Store treated as primary source | §3.1, §3.3 — Reddit is primary |
| **"Users want faster delivery"** | Corpus is a delivery-complaints corpus | Filter for discovery/trust signal; report the absence honestly |
| **Fabricated themes** | LLM pattern-matches on generic reviews | Stage 7 traceability — no source rows, no insight |
| **Link is dead at grading** | Chose a service that expires or pauses | §3.5 — static artefact, no expiring dependency |
| **Link needs setup** | Shipped a repo instead of an interface | §2.4 — interactive, no login, no install |
| **Sentiment pie chart as analysis** | Sentiment is shallow | "Ordered dog food, took 40 min" and "would never trust an app with my dog's food" are both negative; only one is about the problem |
| **Tool maximalism** | Using every listed tool to look sophisticated | Pick a few, justify each in a line. Restraint with a reason is a senior signal. |
| **Hinglish scored as noise** | Standard NLP assumes monolingual input | Stage 3 flags it; Stage 4 prompt handles it |
| **Unjustified vector DB** | Bolted on for appearances | ~1,200 rows fit in memory. Say so. |

---

## 8. Design principles

1. **Source strategy outranks tool choice.** A perfect pipeline over the wrong corpus produces confident, irrelevant findings.
2. **Quantify everything.** "Many users say delivery is slow" is an anecdote in a suit. "6% of reviews, rising to 14% among first-time category buyers" is actionable.
3. **Traceability over volume.** An insight without source rows is fiction.
4. **Honest limitations are a feature.** Naming the absence problem demonstrates the judgment being tested.
5. **Restraint is a senior signal.** "I skipped the vector DB because 1,200 rows don't need one" beats bolting on components.
6. **The link must survive.** Weeks after submission, on a phone, cold, signed out.

---

## 9. Notes on the build environment

This spec is intended to be handed to an agentic coding environment (Antigravity, Claude Code, or equivalent).

**Important — scope of the tool:** Antigravity is an agentic *IDE*. It writes and runs code locally and drives a local browser to verify it. **It has no hosting or deployment component.** It cannot host the workflow link.

Deployment is therefore a **separate step** to a static host (GitHub Pages / Cloudflare Pages / Vercel — see §4.2). Do not expect the build environment to produce a live URL. It produces the code; you deploy it.

**Verified environment facts (July 2026):**
- Python 3.14.5 available
- `sentence-transformers` 5.6.0, `scikit-learn` — install and import successfully
- `google-play-scraper` 1.2.7 — **verified fetching live Blinkit reviews**
- `praw` 8.0.2 available
- Ollama v0.12.9 installed; **server not currently running** (`ollama serve` to start)
- Hardware: Apple M2 Pro, 16 GB RAM, 10 cores
- Reddit public `.json` endpoint returns **403 from datacenter IPs** — PRAW + residential IP required

**Unverified — confirm before relying on:**
- Gemini free-tier exact rate limits (Google no longer publishes them; check your project in AI Studio)
- Antigravity's current free-tier quota (reportedly reduced; unconfirmed)

---

**Scope reminder: this document covers Part 1 only. Do not build Parts 2, 3, or 4.**
