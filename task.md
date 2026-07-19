# Task Tracker — Unified Blinkit Discovery Dashboard & RAG

- `[x]` Component 1: Pipeline & Data Ingestion
    - `[x]` Delete deprecated files (`blinkit_research_data.json` & `blinkit_themes.csv`)
    - `[x]` Modify `pipeline/collect.py` to replace `collect_research_data` with `collect_web_search_data_only` parsing the new JSON dataset
    - `[x]` Execute the offline pipeline (`collect.py` -> `clean.py` -> `enrich.py` -> `cluster.py` -> `synthesise.py` -> `validate.py`) to generate the cleaned corpus
- `[x]` Component 2: Frontend RAG & Analytics Dashboard
    - `[x]` Remove `app/dashboard.html` and `app/dashboard.js`
    - `[x]` Modify `app/index.html` to build the Spotify-style sidebar layout (Ask panel & Dashboard panel)
    - `[x]` Create `app/app.js` containing chatbot RAG search, Chart.js metrics, and view controls
    - `[x]` Modify `app/style.css` to add sidebar grids, pain point progress bars, and responsive styling
