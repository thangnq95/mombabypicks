# mombabypicks.com

Hugo site for mombabypicks.com — Amazon affiliate site for mom & baby products.

## Setup (One Time)

```bash
# 1. Clone this repo
git clone https://github.com/YOUR_USERNAME/mombabypicks.git
cd mombabypicks

# 2. Add PaperMod theme
git submodule add https://github.com/adityatelange/hugo-PaperMod themes/PaperMod

# 3. Run locally to preview
hugo server -D
# Open http://localhost:1313
```

## Deploy

Push to `main` branch → GitHub Actions auto-deploys to GitHub Pages.

```bash
git add .
git commit -m "update content"
git push origin main
```

## Add New Article

```bash
hugo new content posts/your-article-title.md
```

Then edit the file in `content/posts/`.

## Read GA4 Affiliate Clicks

Use the service account JSON key you downloaded from Google Cloud and the GA4 property ID:

```bash
python3 scripts/ga4-report.py \
  --key secrets/mombabypicks-ga4-service-account.json \
  --property 542288344 \
  --days 7 \
  --limit 20 \
  --report affiliate-clicks
```

Optional environment variables:

```bash
export GA4_SERVICE_ACCOUNT_KEY=secrets/mombabypicks-ga4-service-account.json
export GA4_PROPERTY_ID=542288344
```

The script can also write raw JSON with `--output pipeline/data/ga4/affiliate-clicks.json`.

## Wire GA4 into the daily pipeline

If you set the two environment variables below, `pipeline/run.sh` will save a daily GA4 affiliate-click snapshot under `pipeline/data/ga4/` and commit it with the rest of the run output:

```bash
export GA4_SERVICE_ACCOUNT_KEY=secrets/mombabypicks-ga4-service-account.json
export GA4_PROPERTY_ID=542288344
```

The snapshot includes both a machine-readable JSON file and a short markdown summary for Hermess to read.

## Connect Custom Domain (mombabypicks.com)

1. In GitHub repo → Settings → Pages → Custom domain → enter `mombabypicks.com`
2. In Cloudflare DNS → add these records:
   - A record: `@` → `185.199.108.153`
   - A record: `@` → `185.199.109.153`
   - A record: `@` → `185.199.110.153`
   - A record: `@` → `185.199.111.153`
   - CNAME: `www` → `YOUR_USERNAME.github.io`

## Structure

```
content/
  posts/
    best-breast-pumps.md
    best-bottle-warmers.md
    newborn-essentials-checklist.md
    momcozy-m5-review.md
    breastfeeding-essentials.md
  about.md
```
