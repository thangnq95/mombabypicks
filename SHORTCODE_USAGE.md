# Amazon Shortcode Usage

Use the Amazon shortcode for every Amazon product link in Markdown content:

```md
{{< amazon url="https://www.amazon.com/dp/PRODUCT_ID" >}}
```

The shortcode renders a button labeled `Check Price on Amazon ->` and automatically appends the affiliate tag from `hugo.toml`:

```toml
[params]
  amazonTag = "PLACEHOLDER-20"
```

After Amazon Associates approval, replace `PLACEHOLDER-20` in `hugo.toml` with the approved tracking ID.

If a URL already has query parameters, the shortcode appends the tag with `&tag=...`; otherwise it appends `?tag=...`.
