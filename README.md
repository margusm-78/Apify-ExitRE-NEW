# ExitRealty Jacksonville Scraper (Apify Actor)

Scrapes all **EXIT Realty** agents for **Jacksonville, FL** across 8 pages and outputs **Name, Phone, Email**.
Works on Apify with Puppeteer + system Chrome.

## Files
- `Dockerfile` — uses `apify/actor-node-puppeteer-chrome:20` (Chrome preinstalled).
- `package.json` — Apify SDK v3 + Puppeteer v24.
- `main.js` — scraper (configurable pages, de-duplication, optional Brevo CSV output).
- `INPUT_SCHEMA.json` — UI inputs in Apify console.
- `agents.csv` — placeholder file so the repo shows a CSV example.

## Why this image?
Using `apify/actor-node-puppeteer-chrome:20` avoids the **ENOENT** error where Puppeteer
couldn’t find a Chrome binary. We also set `PUPPETEER_SKIP_DOWNLOAD=true` so Puppeteer won’t
try to download Chromium during install.

## Inputs (via Apify UI)
- `startUrl` (default: Jacksonville agents URL)
- `totalPages` (default: 8)
- `emitBrevoCsv` (boolean; if true, writes `brevo.csv` to the key‑value store)

## Output
- Items are pushed to the default **Dataset** with fields: `Name`, `Phone`, `Email`, `SourcePage`.
- If `emitBrevoCsv` is true, a Brevo‑ready CSV is saved in the **Key‑Value Store** as `brevo.csv`
  with columns: `EMAIL, FIRSTNAME, LASTNAME, SMS`.

## Run (Apify)
1. Create an actor from this repo.
2. Build — the Dockerfile will be used automatically.
3. Run with (optionally):
```json
{
  "totalPages": 8,
  "emitBrevoCsv": true
}
```

## Notes
- Phone numbers are normalized to **E.164** (`+1XXXXXXXXXX`) when possible.
- The scraper looks for each card’s **“View Details”** button, then extracts name/phone/email from that card’s text.
- Basic de‑duplication is done on `(email|phone|name)`.
