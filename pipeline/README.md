# EV Atlas data pipeline

Rebuilds every dataset the site's charts consume, from original sources.
Pattern: **ELT** — Python extracts and loads raw data, SQL (DuckDB) transforms it in layers.

```
 STATCAN API          NREL API
     │                    │
     ▼                    ▼
┌─────────────────────────────────┐
│ 1. FETCH (Python)               │   fetch/*.py
│    download → save untouched    │──▶ data/raw/*.json
└─────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│ 2. STAGING (SQL)                │   sql/staging/*.sql
│    clean, rename, type columns  │   one view per raw source
└─────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│ 3. MARTS (SQL)                  │   sql/marts/*.sql
│    aggregate, shares, YoY —     │   one table per chart dataset
│    exactly what each chart needs│
└─────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│ 4. EXPORT (Python)              │   export/export_marts.py
│    run SQL, sanity-check,       │──▶ ../public/data/*.csv|json
│    write files the site reads   │   (replaces placeholders 1-by-1)
└─────────────────────────────────┘
```

## Rules of the pipeline

1. **Raw is sacred.** Files in `data/raw/` are exactly what the API returned —
   never edited by hand, never transformed in place. Re-running a fetch script
   refreshes them; everything downstream is rebuilt from them.
2. **Each layer only reads from the layer above it.** Marts read staging,
   never raw. Export reads marts, never staging.
3. **One mart = one chart dataset.** When a mart is done, its export replaces
   one placeholder file in `public/data/` and one chart flips to real,
   self-made data.

## Sources

| Source | Table | Feeds |
|---|---|---|
| StatCan WDS API | 20-10-0025-01 — quarterly new registrations, BEV/PHEV split (2017+) | Section 1 trend, Section 2 provinces |
| StatCan WDS API | 20-10-0085-01 — monthly new sales, ZEV combined (2024+) | Section 1 recent months |
| StatCan WDS API | 23-10-0308-01 — annual vehicle stock, light-duty | Section 1 stock share |
| NREL API | EV charging stations (Canada) | Section 3 charger analysis |

## Status

- [ ] Stage 1 — fetch scripts
- [ ] Stage 2 — staging views
- [ ] Stage 3 — marts
- [ ] Stage 4 — exports replacing placeholders
- [ ] Later — monthly automation via GitHub Actions
