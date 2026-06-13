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

### Affiliate_Hugo_Publisher

- Validate the article against Hugo and PaperMod rules.
- Confirm front matter, formatting, link integrity, disclosure, and image path.
- Act as a QA gate before anything is published.
- Return a deploy package only after validation passes.

### Affiliate_Pinterest_Growth

- Build the Pinterest publishing pack.
- Only run after the article URL exists in the Hugo site.
- Create pin metadata and creative briefs, not direct Amazon destination links.

## Correct Workflow

1. Strategist selects the topic and product candidates.
2. Content Producer writes raw Markdown only.
3. Hugo Publisher validates the Markdown and fixes issues.
4. Hugo Publisher places the final post in `content/posts/`.
5. Publish a featured image into `static/images/posts/`.
6. Run `hugo --gc --minify` and fix build errors.
7. If build passes, hand off a deploy package.
8. Pinterest Growth creates 3 pins that point to the article URL.
9. Commit, push, and record the live URL for the sprint log.

## Known Issues Found

- The Content Producer previously reported that a file was saved even when the post was only present in a temporary Multica workspace.
- The producer output used product claims that should be reviewed carefully for evidence and compliance.
- The publisher step was skipped, so the repo never got the article file.
- Pinterest planning should not begin until the Hugo URL exists.

## Exact Instruction Changes Recommended

- Change `Affiliate_Strategist` to output product candidates, not final ASINs.
- Change `Affiliate_Content_Producer` to output raw Markdown plus a clear `UNSAVED` or `SAVED` status based on actual filesystem write.
- Change `Affiliate_Hugo_Publisher` to reject drafts missing `draft: false`, valid cover image, or valid affiliate tag usage.
- Change `Affiliate_Hugo_Publisher` to check `hugo --gc --minify` before declaring completion.
- Change `Affiliate_Pinterest_Growth` to wait on the published article URL before generating pin assets.

## How to Run Sprint #002

1. Pick the next keyword and confirm product candidates.
2. Generate one raw Markdown post with compliant affiliate links.
3. Validate in the publisher gate.
4. Publish to Hugo and confirm the build.
5. Create a matching Pinterest pack after the URL is live.
6. Commit and push the content bundle.
7. Log the outcome and choose the next article topic from performance feedback.

## Pinterest Live Standard

Use this exact path when creating live pins in the browser:

1. Publish the article to Hugo first and verify the live URL.
2. Ensure the post cover image is a Pinterest-safe portrait asset, or add a portrait pin image at the top of the article so Pinterest can scrape it.
3. Open Pinterest `pin-builder/?tab=save_from_url`.
4. Enter the MomBabyPicks article URL, not an Amazon URL.
5. Wait for Pinterest to finish loading preview images from the page.
6. Select the portrait-style image first. If only one image appears, treat that as the live fallback creative.
7. Click `Add 1 Pin` or `Add N Pins` only after the correct image is selected.
8. Fill title, description, board, and destination URL if Pinterest leaves any field editable.
9. Publish immediately.

Operational note:
- If Pinterest only exposes the landscape cover, update the article cover to a portrait Pinterest creative and republish before retrying.
- If the browser UI refuses to advance, do not keep re-trying random clicks. Refresh the page and restart from step 3 with the same live article URL.
- For repeatability, use one portrait cover asset per post and keep the article URL stable so future pins can be recreated without manual copying.
