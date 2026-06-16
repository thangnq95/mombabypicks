# Multica Squad Config for MomBabyPicks

For the ticket-driven automation flow, use [multica-automation-runbook.md](./multica-automation-runbook.md).
For copy-paste ready prompts, use [multica-agent-prompt-pack.md](./multica-agent-prompt-pack.md).
For the canonical visual rule, use [visual-asset-standard.md](./visual-asset-standard.md).

## Goal

Split affiliate work so no single agent does everything:

- Claude handles topic and content generation.
- Hermes handles orchestration and handoffs.
- Codex handles validation, build, assets, and browser publishing.
- Multica stores the ticket trail and status.
- The sprint ticket is the source of truth and automation trigger.

## Runtime Contract

- `Affiliate_Strategist` should run in `claude.ai` chat, not in the Multica UI.
- `Affiliate_Strategist` output is a content package, not a ticket update.
- Hermes creates the Multica ticket first, then attaches strategist output as a ticket comment or task payload.
- Codex should stay on repo, build, asset, and browser execution.
- Multica should be treated as the coordination layer, not the work surface for drafting.
- No sprint should begin outside a Multica ticket.

## Resource Policy

- Use Claude for the first draft of ideas, outlines, and article copy whenever possible.
- Use Hermes for routing, state changes, and final handoff checks.
- Use Codex only for tasks that require local repo access, Hugo builds, asset creation, or browser-side publishing that cannot be delegated.
- Do not ask Codex to rewrite content that Claude can produce cleanly unless QA or compliance needs it.
- Prefer artifact-based handoffs over conversation-based handoffs so each agent gets one clean task.

## Shared Rules

- Do not invent ASINs.
- Do not claim a file was saved unless it really exists.
- Do not publish Amazon links without `tag=mombabypick00-20`.
- Do not generate Pinterest packs before the article URL exists.
- Do not mark a sprint complete unless at least one Pinterest pin is published and recorded.
- Every article should include at least one visual asset block.
- For live Pinterest publishing, prefer create-button URLs with separate article `url=` and image `media=` parameters.
- Do not publish pins whose destination is a raw image URL.
- Do not send the same task to multiple agents at the same time unless the task is explicitly parallel.
- `In Review` should mean AI review by `Affiliate_Hugo_Publisher`, not waiting for the user.
- Only escalate to a human when a validation rule fails and the system cannot repair it safely.

## Agent Prompts

### Affiliate_Strategist

Use this prompt:

> Pick one keyword and one article angle.
> Return product candidates only, with short rationale.
> Do not invent ASINs.
> Do not output final Amazon links.
> Include a visual recommendation for the article.
> Run this in claude.ai chat and return a content package only.

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
> Treat `In Review` as an autonomous AI gate, not a request for user approval.
> If validation passes, return `DEPLOY PACKAGE` and a machine-readable checklist result so Hermes can move the ticket forward automatically.
> Only return DEPLOY PACKAGE after `hugo --gc --minify` passes.

### Affiliate_Pinterest_Growth

Use this prompt:

> Generate 3 Pinterest pins only after the article URL is live.
> At minimum, publish and record 1 pin for every article; 3 pins remains the preferred default.
> Prefer posts that include multiple scrapeable images or a comparison visual.
> Follow the canonical image rule: cover images are visual-only; Pinterest pins use text overlays.
> Use article URLs as destinations, never direct Amazon links.
> For live publishing, use Pinterest create-button URLs with separate `url=` and `media=` parameters when the browser supports it.
> Never publish a pin if Pinterest locks the destination to a raw image URL.
> Create title, description, image brief, overlay text, board, and schedule.

### Hermes

Use this prompt:

> Orchestrate the squad.
> Create and track tickets in Multica.
> Ensure each agent only receives the next valid handoff.
> Do not mark a task complete until the required artifact exists in the repo or live URL is verified.
> Use the Multica ticket as the source of truth for state.
> Copy strategist output into Multica when opening the sprint issue.
> Keep Codex out of early ideation tasks unless a local file, build, or browser publish is required.
> Never wait for human review during normal sprint execution.
> When `Affiliate_Hugo_Publisher` returns a passing checklist, automatically move the ticket from `In Review` to the next state.

### Codex

Use this prompt:

> Validate the repo, create or fix assets, run Hugo builds, and perform browser publishing when needed.
> Share work with Claude and Hermes instead of doing every step manually.
> Prefer local files and committed assets over temporary workspace output.
> Do not own the whole sprint; only take the parts that require repo or browser execution.

## Suggested Sprint Flow

1. Hermes opens the Multica sprint ticket.
2. Claude creates topic, outline, product candidates, and image plan.
3. Claude writes raw Markdown with visual placement notes.
4. Hermes attaches the draft package to the ticket and routes it to Codex.
5. Codex validates, adds or checks images, runs Hugo, and fixes build errors.
6. Hermes updates the ticket to `Live` and routes the live URL to Pinterest Growth.
7. Codex or Pinterest Growth publishes pins from the live article when browser action is required.
8. Hermes records the final URL, commit, and results in Multica.
