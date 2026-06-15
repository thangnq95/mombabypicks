# MomBabyPicks Affiliate Agent Workflow

## Current Agent Roles

### Affiliate_Strategist

- Choose the keyword, search intent, angle, and product candidates.
- Output product candidates and supporting rationale.
- Do not invent ASINs unless they are verified.
- Do not finalize purchase links.

### Affiliate_Content_Producer

- Write the full raw Markdown article.
- Include front matter, internal links, and affiliate disclosure placement.
- Do not claim a file was saved unless the file is actually created in the working directory.
- Do not summarize only; the raw Markdown is the deliverable.
- Include at least one visual block recommendation for every article, such as a gallery, comparison image, or Pinterest-safe hero.
- Include at least one Pinterest-ready pin asset or a matching pin plan so every post can be published to Pinterest.

### Affiliate_Hugo_Publisher

- Validate the article against Hugo and PaperMod rules.
- Confirm front matter, formatting, link integrity, disclosure, and image path.
- Act as a QA gate before anything is published.
- Own `In Review` as an AI-only validation state.
- Return a deploy package only after validation passes.
- Reject drafts that are text-only when the topic benefits from product imagery or comparison visuals.

### Affiliate_Pinterest_Growth

- Build the Pinterest publishing pack.
- Only run after the article URL exists in the Hugo site.
- Create pin metadata and creative briefs, not direct Amazon destination links.
- Record at least one published pin for every article; three pins remain the preferred default.
- Prefer article URLs that already contain a visual gallery or comparison image.

## Recommended Squad Split

- Claude: topic selection, product candidate research, and draft generation.
- Hermes: issue orchestration, status transitions, and handoff checks.
- Codex: Hugo validation, asset creation, build verification, and browser-based publishing.
- Multica: ticket tracking, audit trail, and squad coordination only.
- When possible, keep Codex on QA and execution tasks rather than first-draft content generation.
- Run `Affiliate_Strategist` in `claude.ai` chat as a content runtime, then hand the output to Hermes for Multica ticket creation.
- The Multica ticket should always be opened before any drafting starts.
- Hermes now exists as a real Multica agent backed by the local Hermes runtime.
- The working squad is `MomBabyPicks Affiliate Squad`; use it as the routing target instead of hand-copying prompts.

## Correct Workflow

1. Hermes opens the Multica sprint ticket.
2. Strategist selects the topic and product candidates.
3. Content Producer writes raw Markdown only.
4. Hugo Publisher validates the Markdown and fixes issues.
5. Hugo Publisher places the final post in `content/posts/`.
6. Add at least one visual guide image and a Pinterest-safe featured image into `static/images/posts/`.
7. Run `hugo --gc --minify` and fix build errors.
8. If AI QA and build both pass, Hermes updates the Multica ticket to `Live` automatically.
9. Pinterest Growth creates at least 1 published pin that points to the article URL.
10. Publish live pins only after the article URL and visual assets exist.
11. Commit, push, and record the live URL for the sprint log in Multica.

## Automation Surface

- Use `scripts/multica-squad.mjs bootstrap` to align Hermes and the affiliate squad from the local Multica profile.
- Use `scripts/multica-squad.mjs dispatch <issue-id-or-identifier>` to move a ticket into squad execution and create a live task run.
- The helper reads `multica_token` from the local Multica Electron profile, so no manual token copy is needed.
- The helper uses Multica's REST API directly, which keeps the squad tied to ticket state instead of the desktop UI.

## Codex Usage Limits

- Use Codex for repo operations, build checks, image generation, and browser publish verification.
- Do not route brainstorming, outline selection, or draft writing to Codex unless Claude is unavailable.
- Prefer Claude for first-pass article content so Codex quota stays available for execution and QA.

## Known Issues Found

- The Content Producer previously reported that a file was saved even when the post was only present in a temporary Multica workspace.
- The producer output used product claims that should be reviewed carefully for evidence and compliance.
- The publisher step was skipped, so the repo never got the article file.
- Pinterest planning should not begin until the Hugo URL exists.
- Text-only posts underperform on Pinterest and should be upgraded with a visual guide image or gallery before launch.
- Pinterest `save_from_url` may cache the article Open Graph image and ignore additional gallery images, so it is not reliable for publishing multiple creatives from the same article URL.

## Exact Instruction Changes Recommended

- Change `Affiliate_Strategist` to output product candidates, not final ASINs.
- Change `Affiliate_Content_Producer` to output raw Markdown plus a clear `UNSAVED` or `SAVED` status based on actual filesystem write.
- Change `Affiliate_Hugo_Publisher` to reject drafts missing `draft: false`, valid cover image, or valid affiliate tag usage.
- Change `Affiliate_Hugo_Publisher` to check `hugo --gc --minify` before declaring completion.
- Change `Affiliate_Hugo_Publisher` to emit a machine-readable PASS or FAIL checklist so Hermes can auto-transition ticket state.
- Change `Affiliate_Pinterest_Growth` to wait on the published article URL before generating pin assets.
- Change `Affiliate_Content_Producer` to include a visual block recommendation and at least one image placement per article.
- Change `Affiliate_Pinterest_Growth` to prefer posts that expose multiple scrapeable images, not only a single cover.
- Change Multica squad ownership so Claude and Hermes do planning and orchestration while Codex handles local build and publish work.

## How to Run Sprint #002

1. Pick the next keyword and confirm product candidates.
2. Generate one raw Markdown post with compliant affiliate links.
3. Add at least one visual guide or comparison image to the post.
4. Validate in the publisher gate.
5. Publish to Hugo and confirm the build.
6. Create a matching Pinterest pack after the URL is live.
7. Commit and push the content bundle.
8. Log the outcome and choose the next article topic from performance feedback.

## Pinterest Live Standard

Use this exact path when creating live pins in the browser:

1. Publish the article to Hugo first and verify the live URL.
2. Ensure each pin creative exists as a public asset under `static/images/pins/`.
3. Prefer Pinterest's create-button URL so media and destination can be controlled separately:

```text
https://www.pinterest.com/pin/create/button/?url=<encoded_article_url>&media=<encoded_public_pin_image_url>&description=<encoded_description>
```

4. Confirm the preview image matches the intended creative.
5. Save to the branded board, currently `Baby Gear & New Mom Essentials`.
6. Open the published pin and verify the `Visit site` link points to the MomBabyPicks article URL, not the image file and not Amazon.
7. Record the published pin URL in the Pinterest pack.

Operational note:
- Use `pin-builder/?tab=save_from_url` only as a fallback. If it returns only one cached Open Graph image, switch to the create-button URL instead of repeatedly resubmitting the same article URL.
- Do not publish direct image URLs as pin destinations. If Pinterest locks the destination to the image URL, cancel and use the create-button URL.
- Use UTM parameters per pin, for example `utm_source=pinterest&utm_medium=organic&utm_campaign=pin2`.
- For repeatability, create three portrait pin assets per post and keep the article URL stable.
- Never mark a post ready for publish until at least one pin is published and recorded.

## Review Policy

- Human review is optional, not required, for normal sprint throughput.
- `In Review` should be renamed or interpreted as `AI QA Review`.
- The only valid reasons to stop for manual input are failed validation, policy uncertainty, login or permission prompts, or a platform-side error that the agents cannot safely repair.
