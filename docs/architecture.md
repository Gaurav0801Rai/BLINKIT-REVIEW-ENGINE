# System Architecture — AI-Powered Discovery Engine

This document details the architecture for the **Blinkit Growth Insights Discovery Engine**. It outlines how we ingest user feedback, analyze it at scale, and serve insights via an always-on, zero-cost query interface.

---

## 1. Core Architectural Decision: decoupled Systems

To satisfy the **zero-cost** and **link durability** constraints, the system is split into two independent parts:

```mermaid
graph TD
    subgraph Offline / Local Pipeline (Python)
        A[Data Sources: Play Store, App Store, Reddit, Forums, Social, Product Reviews] -->|pipeline/collect.py| B[data/raw/raw_data.json]
        B -->|pipeline/clean.py| C[data/clean/clean_data.json]
        C -->|pipeline/enrich.py: LLM structured tags| D[Enriched Dataset]
        D -->|pipeline/cluster.py: Sentence-Transformers + KMeans| E[Clustered Themes]
        E -->|pipeline/synthesise.py| F[data/insights.json]
        F -.->|pipeline/validate.py: Traceability & Human check| F
    end

    subgraph Static Always-On Host (Vercel / GitHub Pages)
        F -->|Git Commit & Push| G[Deployed Static Web App]
        H[User Query] -->|In-browser RAG & Cosine Similarity| G
        G -->|Cites Grounded Reviews| I[Insight Answer]
    end
```

### 1.1 The Offline/Local Processing Pipeline
Runs locally (or in GitHub Actions). It is heavy, slow, handles external API rate-limiting/throttling, runs CPU/GPU intensive embedding models, and outputs a static file: `insights.json`.
* **Why offline?** Running heavy models, clustering algorithms, and Reddit scrapers online requires paid servers or services that sleep/expire. By running offline, we can use local resources (like an Apple M2 Pro, local Ollama, and CPU-based embeddings) at zero cost.

### 1.2 The Always-On Static Web Application
Exposed as the graded deliverable. It reads the committed `insights.json` directly from the bundle.
* **Why static?** Free static hosting (GitHub Pages, Cloudflare Pages, Vercel) does not spin down, has no cold starts, never pauses due to inactivity, and never runs out of credits.
* **No Vector DB:** Since the filtered, high-signal dataset contains ~1,200–5,000 items, we run in-browser cosine similarity over the embedded search queries. This is faster than network round-trips and keeps the host completely static and zero-cost.

---

## 2. Technical Stack Selection

| Layer | Choice | Details & Rationale |
|---|---|---|
| **Collection** | `google-play-scraper`, `app-store-scraper`, `praw`, Seed Fallback | Live scraping of store reviews, fallback seed files for App Store & Reddit to prevent pipeline failure due to API blocks/throttling. |
| **Cleaning** | Python / Pandas | Standardizing schemas, deduplication, length-filtering, and Hinglish phrase detection. |
| **Enrichment** | Gemini API Free Tier (Flash) / Ollama | Flash family for fast, free-tier structured JSON tag generation. Ollama as a local fallback. |
| **Embeddings** | `sentence-transformers` (all-MiniLM-L6-v2) | Local, runs on CPU/GPU, fast, and free. |
| **Clustering** | `scikit-learn` (K-Means) | To identify emergent themes without forcing pre-defined labels. |
| **Storage** | Git-Committed JSON | Serving `insights.json` directly. No Vector VDB needed. |
| **Serving** | Static Single Page App (HTML/CSS/JS) | Zero-cost hosting on Vercel or GitHub Pages. Static files will never sleep or expire. |

---

## 3. Addressing Key Constraints

### 3.1 The Absence Problem
The research question asks *why users don't explore*. Because users never review products they *didn't* buy, we cannot find direct complaints about category exploration. 
The architecture addresses this by tagging and searching for **oblique indicators**:
* **Friction on first attempts**: Negative reviews on niche items.
* **Surprise markers**: Phrases like *"didn't know they sold this"*.
* **Trust barriers**: Expiry, freshness, or warehouse quality concerns (e.g., *"would not trust baby food/fresh meat from an app"*).
* **Habit loops**: Muscle-memory shopping indicators (*"I just tap Buy Again and checkout"*).

### 3.2 The Hinglish Challenge
Reviews in Indian metros contain mixed English, Hindi, and Hinglish (Hindi words written in Latin script, e.g. `"bohot fast delivery"`). Standard sentiment and NLP libraries fail here.
* The pipeline flags Hinglish text during the **Clean** stage.
* The **Enrichment** LLM prompt is specially tuned to translate, extract topic tags, and process Hinglish comments correctly.
