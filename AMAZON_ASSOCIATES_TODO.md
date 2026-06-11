# Amazon Associates TODO

## Before Registering

- Wait until `https://mombabypicks.com` is fully working with a valid GitHub Pages SSL certificate.
- Add enough original content for Amazon review. Amazon's application review guidance says a good rule of thumb is at least 10 posts.
- Keep the Amazon disclosure visible on the site and near affiliate links where appropriate.

## Register

1. Go to `https://affiliate-program.amazon.com/`.
2. Sign in or create an Amazon Associates account.
3. Enter the website URL: `https://mombabypicks.com`.
4. Use a traffic description like: `Organic search and social traffic from new moms and parents researching baby gear, breastfeeding products, bottle warmers, and newborn essentials.`
5. Use a content category related to baby products, parenting, family, or product reviews.
6. Complete the profile and wait for Amazon to issue the tracking ID.

## Update Tracking ID

Update the tag in one place:

```toml
# hugo.toml
[params]
  amazonTag = "mombabypicks-20"
```

Replace `mombabypicks-20` with the exact tracking ID Amazon provides.

## Verify Links After Approval

1. Rebuild the Hugo site.
2. Open posts that use the Amazon shortcode.
3. Click each `Check Price on Amazon ->` button.
4. Confirm the resulting Amazon URL includes `tag=YOUR_APPROVED_TAG`.
5. Confirm links open in a new tab and include `rel="nofollow noopener"` in the rendered HTML.
