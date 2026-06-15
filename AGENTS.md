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
Every new article MUST follow these image rules:

### Cover Image
- Every article MUST have `cover.image` in frontmatter
- Path: `/images/posts/{slug}.webp`
- Generated via `image_generate` tool with `aspect_ratio=landscape`
- Style: Soft lifestyle photo matching the article topic, warm beige/cream tones

### Pinterest Pins
- Every article MUST have **at least 3 Pinterest pin images**
- Path: `static/images/pins/{slug}-pin-{N}.png` (N = 1, 2, 3...)
- Generated via `image_generate` tool with `aspect_ratio=portrait` (2:3 vertical)
- Style:
  - Soft lifestyle photo background (warm, beige/cream, shallow DOF)
  - White overlay card at bottom 1/3 with rounded corners
  - "Mom Baby Picks" at top in warm brown
  - Headline in large bold dark font
  - Subtitle in grey
  - Dark navy "Read the guide" button
  - `mombabypicks.com` URL at bottom
- Each pin should use a DIFFERENT background image/variant

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
- [x] FAQ section present
- [x] Internal links to other posts
- [x] Pinterest pin published
- [x] Word count >= 500
- [x] Comparison section present
- [x] Reviewer score >= 85
- [x] Cover image present (`cover.image` in frontmatter)
- [x] Pinterest pin images exist (>= 1 in `static/images/pins/`)
- [x] Social share `images:` frontmatter set

## Article Standards
- 800-1000 words
- 4-5 products per article
- Comparison table
- FAQ (4-5 questions)
- Affiliate disclosure at end
- At least 1 Pinterest pin published before publish; 3-pin packs are preferred
- Warm, practical parent-to-parent tone
- Relative internal links: `/posts/slug/`
- Cover image in frontmatter (`cover.image`)
- Pinterest pin images (3 per article)
- Social share `images:` frontmatter (points to pin-1)

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
- Every article must pass all 11 QA gates
- Every article must score >= 85 from Reviewer
- Topic queue priority system: 1 = hottest, 4 = evergreen filler
