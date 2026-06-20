# Week 1 Audit Report

Audit date: 2026-06-20

Source files reviewed:
- `pipeline/mombabypicks-roadmap.yaml`
- `content/posts/*.md`
- local repository files matching analytics/click/export patterns

## Executive Summary

No local GA4 or Amazon Associates export was found in the repository, so the "top 10 by Amazon clicks" task falls back to commercial-intent ranking as allowed by the roadmap task.

The strongest commercial pages are the 10 roadmap `priority_pages`, led by infant car seats, breast pumps, baby swings, high chairs, and baby bottles. These combine high buying intent, comparison-table format, product-card CTAs, and meaningful purchase value.

Amazon image-link curl checks were attempted for every unique article/ASIN image reference. The sandbox cannot resolve `images-na.ssl-images-amazon.com`, so no live HTTP 404 confirmation is possible from this environment. Result: 0 confirmed 404s, 119 unverified article/ASIN image checks.

## 1. Top 10 Pages

GA4 data status: unavailable in repo. Fallback used: pages ranked by commercial intent.

| Rank | Page | Reason | Priority score |
|---:|---|---|---:|
| 1 | `/posts/best-infant-car-seats-2026/` | High-value safety purchase, strong "best" intent, 5 product CTAs | 100 |
| 2 | `/posts/best-breast-pumps/` | High-value purchase, urgent postpartum need, 5 product CTAs | 100 |
| 3 | `/posts/best-baby-swings-2026/` | High AOV, parent problem/soothing intent, 5 product CTAs | 100 |
| 4 | `/posts/best-high-chairs-for-babies-2026/` | Durable gear purchase, comparison intent, 5 product CTAs | 100 |
| 5 | `/posts/best-baby-bottles-for-newborns-2026/` | Immediate newborn feeding purchase, strong Amazon fit, 5 product CTAs | 100 |
| 6 | `/posts/best-baby-sleep-sacks-for-2026/` | Safety-adjacent repeat purchase, 5 product CTAs | 96 |
| 7 | `/posts/best-baby-bath-tubs-2026/` | Specific product category, clear price comparison, 5 product CTAs | 94 |
| 8 | `/posts/best-bottle-warmers/` | Clear buying query, feeding pain point, 4 product CTAs | 92 |
| 9 | `/posts/best-diapers-for-newborns-2026/` | Recurring purchase category, high conversion potential, 5 product CTAs | 90 |
| 10 | `/posts/best-baby-play-mats-2026/` | Specific comparison query, lower urgency/AOV than top gear pages | 88 |

## 2. Amazon Image Link Audit

Scope:
- 27 articles reviewed.
- 140 total Amazon image references found in top-pick/product-card shortcodes.
- 119 unique article/ASIN image checks attempted.
- 96 globally unique ASINs found.

Curl method attempted:

```bash
curl -I -L --max-time 6 -A 'Mozilla/5.0' "https://images-na.ssl-images-amazon.com/images/P/{ASIN}.01.L.jpg"
```

Result:
- Confirmed live 404 Amazon image links: 0
- Confirmed live OK Amazon image links: 0
- Unverified due network/DNS failure: 119

Observed curl failure:

```text
curl: (6) Could not resolve host: images-na.ssl-images-amazon.com
```

Dead links to fix now: none confirmed from this environment.

Follow-up needed: rerun the same image HEAD check from a network-enabled shell before treating this gate as fully passed.

## 3. Page Intent Groups

### High Commercial Intent

These pages have explicit "best", comparison, product review, or high-value buying intent.

- `/posts/best-infant-car-seats-2026/`
- `/posts/best-breast-pumps/`
- `/posts/best-baby-swings-2026/`
- `/posts/best-high-chairs-for-babies-2026/`
- `/posts/best-baby-bottles-for-newborns-2026/`
- `/posts/best-baby-sleep-sacks-for-2026/`
- `/posts/best-baby-bath-tubs-2026/`
- `/posts/best-bottle-warmers/`
- `/posts/best-diapers-for-newborns-2026/`
- `/posts/best-baby-play-mats-2026/`
- `/posts/best-baby-bouncers-for-2026/`
- `/posts/best-baby-carriers-for-2026/`
- `/posts/best-baby-monitors-long-battery-life/`
- `/posts/best-hands-free-wearable-breast-pumps/`
- `/posts/momcozy-m5-review/`

### Moderate Commercial Intent

These pages include product recommendations but the primary search intent is broader, exploratory, or setup-oriented.

- `/posts/breastfeeding-essentials/`
- `/posts/newborn-feeding-essentials/`
- `/posts/newborn-essentials-checklist/`
- `/posts/silicone-baby-feeding-products/`
- `/posts/eco-friendly-baby-gear-guide/`
- `/posts/how-to-choose-breast-pump/`
- `/posts/newborn-feeding-station/`
- `/posts/bottle-refusal-breastfed-babies/`
- `/posts/what-not-to-buy-newborn/`

### Informational Only

These pages are primarily education/safety/how-to content. Product CTAs are secondary.

- `/posts/bottle-warmer-safety-guide/`
- `/posts/breast-pump-cleaning-guide/`
- `/posts/pace-bottle-feeding-guide/`

## 4. Strongest 5 Pages From `priority_pages`

| Rank | Priority page | Why it is strongest |
|---:|---|---|
| 1 | `best-infant-car-seats-2026` | High-value, safety-driven purchase with strong comparison intent. |
| 2 | `best-breast-pumps` | High-value postpartum purchase with urgent need and clear product tradeoffs. |
| 3 | `best-baby-swings-2026` | High AOV, strong parent pain point, and clear "best" query intent. |
| 4 | `best-high-chairs-for-babies-2026` | Durable gear purchase with strong comparison and long-use value. |
| 5 | `best-baby-bottles-for-newborns-2026` | Immediate newborn feeding need and highly Amazon-friendly product set. |

## 5. Tracking CSV

Analytics columns use `N/A` because no GA4/Amazon click export is present locally. `dead_links` is the confirmed 404 count from this audit; live checks remain unverified due DNS/network failure.

```csv
page,clicks,commission,CTR,dead_links,priority_score
/posts/best-infant-car-seats-2026/,N/A,N/A,N/A,0_confirmed,100
/posts/best-breast-pumps/,N/A,N/A,N/A,0_confirmed,100
/posts/best-baby-swings-2026/,N/A,N/A,N/A,0_confirmed,100
/posts/best-high-chairs-for-babies-2026/,N/A,N/A,N/A,0_confirmed,100
/posts/best-baby-bottles-for-newborns-2026/,N/A,N/A,N/A,0_confirmed,100
/posts/best-baby-sleep-sacks-for-2026/,N/A,N/A,N/A,0_confirmed,96
/posts/best-baby-bath-tubs-2026/,N/A,N/A,N/A,0_confirmed,94
/posts/best-bottle-warmers/,N/A,N/A,N/A,0_confirmed,92
/posts/best-diapers-for-newborns-2026/,N/A,N/A,N/A,0_confirmed,90
/posts/best-baby-play-mats-2026/,N/A,N/A,N/A,0_confirmed,88
/posts/best-hands-free-wearable-breast-pumps/,N/A,N/A,N/A,0_confirmed,86
/posts/best-baby-monitors-long-battery-life/,N/A,N/A,N/A,0_confirmed,84
/posts/best-baby-bouncers-for-2026/,N/A,N/A,N/A,0_confirmed,82
/posts/best-baby-carriers-for-2026/,N/A,N/A,N/A,0_confirmed,82
/posts/momcozy-m5-review/,N/A,N/A,N/A,0_confirmed,78
/posts/breastfeeding-essentials/,N/A,N/A,N/A,0_confirmed,68
/posts/newborn-feeding-essentials/,N/A,N/A,N/A,0_confirmed,66
/posts/silicone-baby-feeding-products/,N/A,N/A,N/A,0_confirmed,64
/posts/newborn-essentials-checklist/,N/A,N/A,N/A,0_confirmed,60
/posts/how-to-choose-breast-pump/,N/A,N/A,N/A,0_confirmed,58
/posts/eco-friendly-baby-gear-guide/,N/A,N/A,N/A,0_confirmed,56
/posts/newborn-feeding-station/,N/A,N/A,N/A,0_confirmed,52
/posts/bottle-refusal-breastfed-babies/,N/A,N/A,N/A,0_confirmed,48
/posts/what-not-to-buy-newborn/,N/A,N/A,N/A,0_confirmed,46
/posts/bottle-warmer-safety-guide/,N/A,N/A,N/A,0_confirmed,34
/posts/breast-pump-cleaning-guide/,N/A,N/A,N/A,0_confirmed,32
/posts/pace-bottle-feeding-guide/,N/A,N/A,N/A,0_confirmed,30
```

## 6. Recommended Next Actions

1. Export GA4 `affiliate_click` events by `page_path` and merge actual clicks/CTR into the CSV.
2. Export Amazon Associates earnings by tracking ID/date and map commissions back to pages where possible.
3. Rerun the Amazon image HEAD check from a network-enabled environment.
4. Start Week 2 optimization with the strongest five priority pages listed above.
