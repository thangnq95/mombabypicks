# MomBabyPicks — Amazon Affiliate Content Site

## Stack
- Hugo static site
- Hosted on GitHub Pages
- Amazon affiliate (tag: mombabypick00-20)
- Content pipeline v2 (fully automated)

## Pipeline Workflow (4 agents)
1. **Hermes (Orchestrator)** — Topic selection, content brief, Hugo build, git push, cron scheduling
2. **Claude Code (Producer)** — Article writing (via `claude -p`)
3. **Claude Code (Reviewer)** — Article scoring (via `claude -p` with JSON schema)
4. **Hermes (Publisher)** — QA checks → Hugo build → commit → push

## Image & Pinterest Requirements (MANDATORY)
The canonical rule set lives in [docs/visual-asset-standard.md](docs/visual-asset-standard.md). If any document conflicts, follow that file first.

Every new article MUST follow these image rules:

### Cover Image
- Every article MUST have `cover.image` in frontmatter
- Path: `/images/posts/{slug}.webp`
- Size: **1200×630px** landscape
- Generated via **`python3 scripts/generate-covers.py {slug}`**
- Design: clean full-bleed visual asset with no baked-in text
- **NEVER use photos of real people or faces** (no faces, bodies, hands)

#### Image sources (priority order)
1. **AI-generated image** (preferred) — save to `static/images/raw/{slug}.png` or `.jpg` before running script
2. **Abstract fallback** — used when no local AI image exists

#### Codex image generation workflow
- Each article in `scripts/generate-covers.py` has an `ai_prompt` field
- **Codex reads** `scripts/generate-covers.py` → finds `ai_prompt` for the target slug
- **Codex generates** image matching that prompt (landscape, product photography, no people)
- **Codex saves** result to `static/images/raw/{slug}.png` or `.jpg`
- Then run: `python3 scripts/generate-covers.py {slug}` to composite into final cover
- Cover images are visual-only. Do not add baked-in title text to cover art.

#### Adding a new article
- Add entry to `ARTICLES` list in `scripts/generate-covers.py` with: `slug`, `headline`, `subtitle`, `query`, `palette`, `ai_prompt`
- Palette choices: 0=peach-coral, 1=rose-pink, 2=warm-amber, 3=sage-mint, 4=soft-lilac

### Pinterest Pins
- Every article MUST have **3 Pinterest pin images**
- Path: `static/images/pins/{slug}-pin-{N}.png` (N = 1, 2, 3...)
- Generated from the same base visual language as the cover image
- Pin destination URLs must be the canonical article URL only, with no `utm_*` query params or other tracking strings
- Pin copy, titles, and descriptions must stay in the site/article language for that post; do not mix English and Vietnamese in the same pack
- Style:
  - Soft lifestyle photo background (warm, beige/cream, shallow DOF)
  - White overlay card at bottom 1/3 with rounded corners
  - "Mom Baby Picks" at top in warm brown
  - Headline in large bold dark font
  - Subtitle in grey
  - Dark navy "Read the guide" button
  - `mombabypicks.com` URL at bottom
- Each pin should use a slightly different crop/variant of the same base scene

### Social Share Images
- Every article MUST have `images:` frontmatter array
- First entry = primary Pinterest pin: `/images/pins/{slug}-pin-1.png`
- This ensures Pinterest/OG scrapers pick up the right image

### Pinterest Board
- Pins should be uploaded to Pinterest board: "Baby Gear & New Mom Essentials"
- Pinterest account: pinterest.com/mombabypicks

## Human Role
- Approves keyword strategy (topic queue)
- Monitors Search Console
- Reviews pipeline quality metrics only
- Does NOT review individual articles

## Automated QA Gates (pre-publish)
- [x] Affiliate disclosure present
- [x] Meta title and description
- [x] Minimum 3 Amazon product links
- [x] Unique ASINs (10-char format)
- [x] Affiliate tag (mombabypick00-20)
- [x] FAQ section present (4-5 questions)
- [x] Internal links to other posts (>= 2)
- [x] Pinterest pin published
- [x] Word count >= 800
- [x] Comparison table present (with Price column)
- [x] Reviewer score >= 85
- [x] Cover image present (`cover.image` in frontmatter)
- [x] Pinterest pin images exist (>= 1 in `static/images/pins/`)
- [x] Social share `images:` frontmatter set
- [x] Visual asset standard validator passed
- [x] Price range / pricing info in comparison table

## Article Template (MANDATORY)
Every new article MUST follow this exact format structure:

```markdown
## How We Selected These Products
(Explain criteria: safety, features, price, parent feedback)

## Comparison Table
| Product | Price | Key Feature 1 | Key Feature 2 | Key Feature 3 | Best For |
|---|---|---|---|---|---|
| Product A | $XX-$YY | ✅ | ⭐ 9/10 | 5 modes | Best value |
| Product B | $XX-$YY | ❌ | ⭐ 8/10 | 3 modes | Premium pick |

*Prices based on [source] as of [month/year].*

## Product Deep Dives
### 1. Product Name — [Badge: Best Value / Premium Pick / etc.]
**Specs:** Weight X lbs, Material Y, Warranty Z
**Price:** $XX-$YY
**Pros:**
- ...
**Cons:**
- ...
**Who it's for:** ...
{{< amazon url="..." text="Check Price on Amazon →" >}}
*(paid link) As an Amazon Associate I earn from qualifying purchases.*

(Repeat for products 2-5)

## Comparison (text summary)
(1-2 paragraphs summarizing key differences and recommendations)

## FAQ
### Q1?
...
### Q2?
...
(4-5 questions)

## Related Articles
- [Internal link 1](/posts/slug/)
- [Internal link 2](/posts/slug/)
```

## Article Standards
- **800-1200 words** (minimum 800)
- **5 products per article** (minimum 4)
- **Comparison table with Price column** — always include approximate price or price range
- **Product deep dives** — each product gets: Specs, Price, Pros/Cons, Who it's for
- **FAQ** (4-5 questions, real parent concerns, not generic)
- **Affiliate disclosure** at end: `(paid link) As an Amazon Associate I earn from qualifying purchases.`
- **At least 1 Pinterest pin** published before publish; 3-pin packs preferred
- **Warm, practical parent-to-parent tone** — "We tested this" language, not "I tried this"
- **Relative internal links**: `/posts/slug/` (minimum 2 per article)
- **Cover image** in frontmatter (`cover.image`)
- **Pinterest pin images** (3 per article)
- **Social share `images:` frontmatter** (points to pin-1)

## Key Paths
- Content: `content/posts/`
- Topic queue: `pipeline/topic-queue.json`
- Sprint log: `pipeline/sprint-log.json`
- QA script: `scripts/qa-check.sh`
- Pipeline runner: `pipeline/run.sh`
- Content briefs: `content/agents/content-briefs/`
- Drafts: `content/agents/drafts/`
- Revisions: `content/agents/revisions/`
- Cover images: `static/images/posts/`
- Pinterest pins: `static/images/pins/`

## Rules
- **No deep Amazon research** — Hermes only proposes topics/keywords, not ASINs or pricing
- Claude writes with placeholder ASINs — these need manual or script-based verification before final publish
- Every article must pass all QA gates (15 gates)
- Every article must score >= 85 from Reviewer
- Topic queue priority system: 1 = hottest, 4 = evergreen filler

## Mandatory Pre-Commit Verification

🚫 **Codex: TRƯỚC KHI COMMIT, chạy lệnh này:**

```bash
cd /Users/thangnguyen/GIT/PP/mombabypicks && bash scripts/verify.sh
```
- Nếu FAIL → sửa lỗi, chạy lại đến khi PASS
- Nếu FAIL do thiếu file → `git checkout HEAD -- <file>` để restore
- Nếu FAIL do sai ASIN → sửa ASIN trong content/

### 🚫 CẤM XÓA các file sau (nếu thiếu → UI vỡ ngay):
```
assets/css/extended/mombabypicks.css    ← 1017 dòng custom CSS
layouts/_partials/home_info.html        ← Hero section + mobile menu "Start with guides"
layouts/index.html                      ← Homepage template
hugo.toml                               ← Site config (nav, params)
static/images/posts/*.webp              ← Cover images (24 files)
```
Codex chỉ được sửa: `content/posts/*.md`, `static/images/pins/*.png`, `data/pinterest/*.json`

### Cách deploy an toàn (không vỡ UI):
```bash
bash scripts/deploy.sh     # 1 lệnh duy nhất
```
- Nếu fake ASINs → thay B0DFLT* bằng ASIN thật
- 🚫 KHÔNG commit khi verify.sh báo lỗi
- 🚫 KHÔNG sửa layouts/, assets/css/extended/, hugo.toml
- ✅ Chỉ sửa: content/posts/, static/images/, data/pinterest/
