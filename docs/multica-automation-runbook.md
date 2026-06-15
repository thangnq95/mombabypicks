# Multica Automation Runbook

This runbook makes Multica the source of truth for the MomBabyPicks affiliate pipeline.

## Principle

- Every sprint starts as a Multica ticket.
- Every agent response is attached to that ticket.
- Hermes owns ticket state transitions.
- Claude owns strategy and draft artifacts only.
- Codex owns repo, build, browser, and publish execution only.

## Ticket States

1. `Open`
2. `Strategizing`
3. `Draft Ready`
4. `AI QA Review`
5. `Publish Ready`
6. `Live`
7. `Pinterest Ready`
8. `Complete`

## Required Ticket Fields

- Sprint number
- Goal
- Owner
- Current state
- Live URL, once available
- Repo artifact paths
- Pinterest pack path
- Acceptance checklist

## Automation Rules

- Hermes creates the ticket first.
- Hermes posts the sprint brief and assigns `Affiliate_Strategist`.
- Claude replies with strategy, product candidates, and a draft package.
- Hermes updates the ticket to `Draft Ready` and assigns `Affiliate_Hugo_Publisher`.
- Codex validates the draft, writes or fixes repo files, and runs Hugo.
- `Affiliate_Hugo_Publisher` owns the review gate. Human review is not required for normal sprint flow.
- If every validation check passes, Hermes automatically moves the ticket from `AI QA Review` to `Live`.
- Hermes updates the ticket to `Live` only after the article URL exists.
- Hermes then assigns `Affiliate_Pinterest_Growth` or asks Codex to publish live pins when browser action is needed.
- The ticket can only move to `Complete` after live article, live pins, and commit hash are all recorded.
- At least one published pin must exist before the ticket can move to `Complete`.
- The bootstrap/dispatch helper lives at `scripts/multica-squad.mjs` and talks to Multica through the local Electron profile token.
- Use the helper to align Hermes, the squad, and the current sprint ticket without copying prompts by hand.

## Comment Format

Use short, machine-readable comments on the ticket:

```text
STATE: Draft Ready
ARTIFACT: content/posts/example.md
CHECK: hugo --gc --minify passed
URL: https://mombabypicks.com/posts/example/
NEXT: Affiliate_Pinterest_Growth
```

## Sprint Boot Sequence

1. Hermes opens the Multica ticket.
2. Claude produces the content package.
3. Codex saves files and verifies the build.
4. Hermes moves the ticket to `Live`.
5. Pinterest assets are created from the live article URL.
6. At least one live pin is published.
7. Hermes closes the ticket with links to the live article, pins, and commit.

## Failure Rules

- If a required file does not exist, the ticket stays open.
- If Hugo build fails, the ticket stays in `AI QA Review`.
- If the article URL is not live, do not create the Pinterest pack.
- If a pin destination becomes a raw image URL, cancel and retry with the create-button flow.
- If an agent claims completion without an artifact, treat the claim as unverified.
- If validation passes, no human approval step should block the ticket.
