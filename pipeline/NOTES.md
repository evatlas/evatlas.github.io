# Pipeline notes — learning log

Running notes while building the pipeline: what I built, decisions made,
things that surprised me. Raw material for a future methodology write-up.

## Session 1 — 2026-07-10/11 — fetch stage done

What got built: 4 fetch notebooks in `fetch/`, all raw data landed in `data/raw/`.

- **StatCan (3 tables):** WDS two-step flow — `getFullTableDownloadCSV/{product_id}/en`
  returns a JSON with the zip URL, then download the zip. Tables: 20-10-0025
  (registrations, 71 MB zip), 20-10-0085 (monthly sales), 23-10-0308 (vehicle stock).
- **Kept the zips zipped.** The registrations CSV extracts to 1.3 GB; DuckDB reads
  `.zip` directly so the extracted copy was deleted. 95% disk saved.
- **Chargers (NLR, formerly NREL):** one GET with params (`fuel_type=ELEC`,
  `country=CA`, `limit=all`) → 15,877 stations saved as `chargers.json` (53 MB).
  API key lives in `fetch/.env` (gitignored), loaded with python-dotenv.
  Heads-up: NREL rebranded to NLR in May 2026 — old `developer.nrel.gov` URLs are dead.
- **Things to remember for staging:**
  - Chargers fetch didn't filter by `status` — raw includes planned stations;
    filter `status_code = 'E'` in the staging view instead (raw stays untouched).
  - Charger `state` field already holds the province code — no geo work needed
    for EVs-per-charger by province.
  - Chargers JSON is nested: stations live under the `fuel_stations` key →
    `read_json_auto` + `unnest()` in DuckDB.

## Session 2 — (date)

-
