# Implementation Plan — Blinkit Discovery Dashboard & Automated Pipeline

This plan details the design and implementation of a premium, responsive analytics dashboard (`dashboard.html`) to visualize current-state quick-commerce user insights. It also establishes a fully automated, dynamic data pipeline that calculates these insights from reviews and schedules monthly updates.

## User Review Required

> [!IMPORTANT]
> **API Key for Automation**: The monthly automated update via GitHub Actions will run the LLM enrichment stage. This requires the `GEMINI_API_KEY` to be configured as a GitHub Repository Secret.
>
> **Interactive Navigation**: We will add a persistent navigation bar at the top of both the AI Search Assistant (`index.html`) and the new Analytics Dashboard (`dashboard.html`) to allow the user to toggle between option views smoothly.

---

## Proposed Changes

### Component 1: Pipeline & Data Ingestion

#### [MODIFY] [collect.py](file:///c:/Users/Gaurav%20Kumar/Desktop/blinkit_growth_insights/pipeline/collect.py)
*   Update `main()` to load and parse the `blinkit_research_data.json` file.
*   Extract `sample_quotes` and theme descriptions from `blinkit_research_data.json` and convert them into raw review records (with unique IDs and correct metadata).
*   Add a new batch of raw reviews (`SEED_WEB_RESEARCH`) to `seed_data.py` representing our web search findings (e.g., degraded cosmetics from warehouse heat, FSSAI quality inspections, customer support chatbot complaints, and missing warranty cards).
*   Merge all these sources into `data/raw/raw_data.json`.

#### [MODIFY] [synthesise.py](file:///c:/Users/Gaurav%20Kumar/Desktop/blinkit_growth_insights/pipeline/synthesise.py)
*   Modify the script to read `data/clean/enriched_data.json` and calculate statistics dynamically instead of writing hardcoded placeholders:
    *   **Category Breakdown**: Count reviews matching each category tag (`groceries-fresh`, `personal-care`, etc.) and multi-category combinations (e.g., Groceries + Snacks).
    *   **Shopping Habits**: Identify search, browse, and reorder mentions to estimate proportions.
    *   **Discovery Friction**: Group reviews by their main barriers (Speed, Trust, Invisible Shelf, Mental Model, Returns).
    *   **Trust Signals**: Calculate the exact sentiment ratio (Positive, Negative, Neutral) and count the top complaint categories.
    *   **Competitive Context**: Count mentions of alternate platforms (Amazon, Nykaa, FirstCry, Supertails) vs. exclusive Blinkit mentions.
*   Load survey statistics (`key_statistics`) from `blinkit_research_data.json` and embed them into the final JSON payload.
*   Output the consolidated payload to `data/insights.json` and write it as a javascript bundle to `app/data.js` (`window.BLINKIT_INSIGHTS = ...`).

---

### Component 2: Dashboard Frontend

#### [NEW] [dashboard.html](file:///c:/Users/Gaurav%20Kumar/Desktop/blinkit_growth_insights/app/dashboard.html)
*   Create a single-page HTML layout containing the following 7 sections:
    1.  **User Behavior Overview**: Metric cards showing daily activity, grocery-only skew, impulse buy rates, and Zepto usage.
    2.  **Category Breakdown**: Donut chart illustrating actual category purchase overlap.
    3.  **Shopping Habits**: Bar chart comparing search-first vs. reorder-history vs. deal-browsing frequency.
    4.  **Discovery Friction**: Horizontal bar chart detailing why users fail to browse.
    5.  **Trust Signals**: Split-view showing review sentiment distribution and a top complaint list.
    6.  **Competitive Context**: Exclusive vs. multi-app metric, and a bar chart showing what users buy elsewhere.
    7.  **Key Insight Cards**: 4-5 cards outlining title, description, supporting stats, and source citations.
*   Import Chart.js via CDN for responsive, hardware-accelerated rendering.
*   Include the global navigation header linking back to `index.html`.

#### [NEW] [dashboard.js](file:///c:/Users/Gaurav%20Kumar/Desktop/blinkit_growth_insights/app/dashboard.js)
*   Read dashboard data dynamically from `window.BLINKIT_INSIGHTS`.
*   Initialize and configure the Chart.js instances with custom responsive layouts:
    *   Apply gradients (e.g., Brand Yellow to Amber, Deep Slate to Indigo) to make charts look extremely premium.
    *   Configure custom tooltip formats to display counts and percentages.
*   Populate the metric cards and the key insights grid dynamically.

#### [MODIFY] [index.html](file:///c:/Users/Gaurav%20Kumar/Desktop/blinkit_growth_insights/app/index.html)
*   Add the global navigation header (tab layout) to allow users to switch to the "Discovery Analytics Dashboard".

#### [MODIFY] [style.css](file:///c:/Users/Gaurav%20Kumar/Desktop/blinkit_growth_insights/app/style.css)
*   Add layout styles for the dashboard grid (responsive layout: 3-column metrics row, 2-column chart grid, 1-column insights).
*   Define dark glassmorphic card tokens, custom grid structures, and hover animations.

---

### Component 3: Automation

#### [NEW] [monthly_update.yml](file:///c:/Users/Gaurav%20Kumar/Desktop/blinkit_growth_insights/.github/workflows/monthly_update.yml)
*   Set up a GitHub Actions workflow running on a monthly cron schedule (`0 0 1 * *`).
*   Check out the codebase, install Python dependencies, and run the pipeline sequence:
    1.  `python pipeline/collect.py`
    2.  `python pipeline/clean.py`
    3.  `python pipeline/enrich.py`
    4.  `python pipeline/cluster.py`
    5.  `python pipeline/synthesise.py`
    6.  `python pipeline/validate.py`
*   Pass the `GEMINI_API_KEY` from repository secrets during the enrichment step.
*   Automatically commit and push the updated `data.js`, `insights.json`, and validation reports back to the repository (triggering automatic redeployment on static hosts like GitHub Pages or Vercel).

---

## Verification Plan

### Automated Verification
*   Run the pipeline locally to confirm end-to-end execution:
    ```powershell
    python pipeline/collect.py
    python pipeline/clean.py
    python pipeline/enrich.py
    python pipeline/cluster.py
    python pipeline/synthesise.py
    python pipeline/validate.py
    ```
*   Verify that `app/data.js` and `data/insights.json` are successfully updated with the dynamically aggregated statistics.

### Manual Verification
*   Serve the app locally (e.g., using `python -m http.server`) and open `dashboard.html`.
*   Inspect the Chart.js visual renders, ensure responsiveness on simulated mobile screens, and test navigation links between the dashboard and search portal.
