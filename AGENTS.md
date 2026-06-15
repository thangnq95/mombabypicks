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
- [x] Word count >= 500
- [x] Comparison section present
- [x] Reviewer score >= 85

## Article Standards
- 800-1000 words
- 4-5 products per article
- Comparison table
- FAQ (4-5 questions)
- Affiliate disclosure at end
- Warm, practical parent-to-parent tone
- Relative internal links: `/posts/slug/`

## Key Paths
- Content: `content/posts/`
- Topic queue: `pipeline/topic-queue.json`
- Sprint log: `pipeline/sprint-log.json`
- QA script: `scripts/qa-check.sh`
- Pipeline runner: `pipeline/run.sh`
- Content briefs: `content/agents/content-briefs/`
- Drafts: `content/agents/drafts/`
- Revisions: `content/agents/revisions/`

## Rules
- **No deep Amazon research** — Hermes only proposes topics/keywords, not ASINs or pricing
- Claude writes with placeholder ASINs — these need manual or script-based verification before final publish
- Every article must pass all 10 QA gates
- Every article must score >= 85 from Reviewer
- Topic queue priority system: 1 = hottest, 4 = evergreen filler
