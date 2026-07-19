# Phase-Wise Implementation Plan — Blinkit Growth Insights

This document outlines the step-by-step implementation phases for building the Blinkit Growth Insights Discovery Engine.

---

## Phase 1: Setup and Data Collection (Completed)
*   **Goal**: Gather raw user feedback across all 7 required channels.
*   **Tasks**:
    *   Initialize project structure and create dependency file `requirements.txt`.
    *   Create `pipeline/seed_data.py` to store pre-curated discussions and act as a reliable fallback for throttled/blocked APIs (App Store, Reddit, social, forums).
    *   Build `pipeline/collect.py` using `google-play-scraper` and `app-store-scraper` to pull store reviews.
    *   Merge all records into a single unified raw data file `data/raw/raw_data.json` containing 1,525 entries.

---

## Phase 2: Cleaning and Hinglish Detection
*   **Goal**: Deduplicate, filter out noise, and prepare data for LLM analysis.
*   **Tasks**:
    *   Create `pipeline/clean.py`.
    *   Implement deduplication based on review content and metadata IDs.
    *   Implement length filter (exclude reviews under 25 characters, as 71% of Play Store reviews are very short like "nice" or "good" and carry zero discovery signal).
    *   Add a script to detect and flag **Hinglish** (code-mixed Hindi/English) text patterns.
    *   Write an exclusion log to report funnel statistics (`Raw count` -> `Deduplicated` -> `Substantive` -> `Cleaned`).
    *   Output cleaned dataset to `data/clean/clean_data.json`.

---

## Phase 3: LLM Enrichment
*   **Goal**: Convert unstructured text into a structured, easily-queryable schema.
*   **Tasks**:
    *   Create `pipeline/enrich.py`.
    *   Integrate Gemini API (using the free-tier `gemini-2.5-flash` model via the official `google-genai` SDK) or local Ollama.
    *   Define LLM system prompts instructing it to translate Hinglish phrases and output a strict structured JSON payload for each review:
        *   `topic`: (e.g. delivery, fresh-produce, app-ux, discovery, pricing, trust, other)
        *   `sentiment`: (positive, negative, neutral, mixed)
        *   `categories_mentioned`: list (groceries, pet-care, baby-care, personal-care, electronics, other)
        *   `is_discovery_related`: boolean (does it reference finding new products or category exploration?)
        *   `is_trust_related`: boolean (does it express safety, expiry, or freshness concern?)
        *   `language`: (en, hi, hinglish, other)
    *   Implement file-based caching for LLM calls to prevent quota exhaustions on re-runs.
    *   Export enriched dataset to `data/clean/enriched_data.json`.

---

## Phase 4: Embedding and Clustering
*   **Goal**: Find emergent themes in user discussions that were not pre-defined.
*   **Tasks**:
    *   Create `pipeline/cluster.py`.
    *   Load local `sentence-transformers` model to embed the text of cleaned/enriched reviews.
    *   Apply `scikit-learn`'s `KMeans` or `HDBSCAN` clustering over the generated vector space.
    *   Pass the top representative reviews of each cluster to the LLM to generate descriptive, human-readable labels for each cluster.
    *   Output cluster mapping coordinates and labels.

---

## Phase 5: Synthesis and Validation
*   **Goal**: Convert clusters into quantified insights and run mandatory verification checks.
*   **Tasks**:
    *   Create `pipeline/synthesise.py` to organize findings into a list of specific insights mapped against the 8 core discovery questions.
    *   Ensure each insight reports **quantifiable statistics** (counts and percentages of the corpus) and references **representative verbatim quotes** and **source row IDs** (traceability).
    *   Create `pipeline/validate.py` to execute verification checks:
        *   Produce a human vs. machine comparison sheet (`validation/spot_check.csv`) based on a sample of 50 reviews to compute the accuracy/agreement rate.
        *   Triangulate findings across multiple sources to isolate single-source bias.
        *   Document the findings, agreement rates, and limits (such as the Absence Problem) in `validation/validation_report.md`.
    *   Output final database file `data/insights.json`.

---

## Phase 6: Web Application Frontend
*   **Goal**: Expose an always-on, interactive query interface over the synthesized insights.
*   **Tasks**:
    *   Build a responsive, single-page web app in the `app/` folder using HTML, CSS, and vanilla JS.
    *   Implement browser-side search using in-memory cosine similarity (over embedded search strings) to query relevant parts of `insights.json`.
    *   Design a conversational prompt box where users can ask questions (the 8 core questions should be predefined shortcuts).
    *   Embed citations linking each answer back to the raw source reviews/posts.
    *   Implement responsive design (fully operational on mobile phones) with high premium visual aesthetics.

---

## Phase 7: Deployment
*   **Goal**: Share the final interactive link with the reviewer.
*   **Tasks**:
    *   Commit all files (including code, seed data, and synthesized `insights.json`) to GitHub.
    *   Deploy the `app/` directory as a static site using free, always-on hosting services (such as GitHub Pages, Vercel, or Cloudflare Pages).
    *   Test the final link signed out from a mobile phone to confirm it requires no login/setup and starts instantly.
