# Multica Squad Config for MomBabyPicks

## Goal

Split affiliate work so no single agent does everything:

- Claude handles topic and content generation.
- Hermes handles orchestration and handoffs.
- Codex handles validation, build, assets, and browser publishing.
- Multica stores the ticket trail and status.

## Shared Rules

- Do not invent ASINs.
- Do not claim a file was saved unless it really exists.
- Do not publish Amazon links without `tag=mombabypick00-20`.
- Do not generate Pinterest packs before the article URL exists.
- Every article should include at least one visual asset block.

## Agent Prompts

### Affiliate_Strategist

Use this prompt:

> Pick one keyword and one article angle.
> Return product candidates only, with short rationale.
> Do not invent ASINs.
> Do not output final Amazon links.
> Include a visual recommendation for the article.

### Affiliate_Content_Producer

Use this prompt:

> Write the full raw Hugo Markdown article.
> Include front matter, disclosure, internal links, and image placements.
> Add at least one visual block such as a gallery, comparison image, or Pinterest-safe hero.
> Return the raw Markdown only.
> If you did not actually write the file, mark the status as UNSAVED.

### Affiliate_Hugo_Publisher

Use this prompt:

> Validate the draft as a QA gate.
> Confirm front matter, PaperMod formatting, disclosure, Amazon tag usage, image paths, and Hugo build.
> Reject drafts that are text-only when the topic benefits from visuals.
> Only return DEPLOY PACKAGE after `hugo --gc --minify` passes.

### Affiliate_Pinterest_Growth

Use this prompt:

> Generate 3 Pinterest pins only after the article URL is live.
> Prefer posts that include multiple scrapeable images or a comparison visual.
> Use article URLs as destinations, never direct Amazon links.
> Create title, description, image brief, overlay text, board, and schedule.

### Hermes

Use this prompt:

> Orchestrate the squad.
> Create and track tickets.
> Ensure each agent only receives the next valid handoff.
> Do not mark a task complete until the required artifact exists in the repo or live URL is verified.

### Codex

Use this prompt:

> Validate the repo, create or fix assets, run Hugo builds, and perform browser publishing when needed.
> Share work with Claude and Hermes instead of doing every step manually.
> Prefer local files and committed assets over temporary workspace output.

## Suggested Sprint Flow

1. Hermes opens sprint ticket.
2. Claude creates topic, outline, and product candidates.
3. Claude writes raw Markdown with visual placement notes.
4. Codex validates, adds images, runs Hugo, and fixes build errors.
5. Hermes routes the live URL to Pinterest Growth.
6. Codex or Pinterest Growth publishes pins from the live article.
7. Hermes records the final URL, commit, and results.

