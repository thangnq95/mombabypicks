# mombabypicks.com

Hugo site for mombabypicks.com — Amazon affiliate site for mom & baby products.

## Setup (One Time)

```bash
# 1. Clone this repo
git clone https://github.com/YOUR_USERNAME/mombabypicks.git
cd mombabypicks

# 2. Add PaperMod theme
git submodule add https://github.com/adityatelange/hugo-PaperMod themes/PaperMod

# 3. Run locally to preview
hugo server -D
# Open http://localhost:1313
```

## Deploy

Push to `main` branch → GitHub Actions auto-deploys to GitHub Pages.

```bash
git add .
git commit -m "update content"
git push origin main
```

## Add New Article

```bash
hugo new content posts/your-article-title.md
```

Then edit the file in `content/posts/`.

## Connect Custom Domain (mombabypicks.com)

1. In GitHub repo → Settings → Pages → Custom domain → enter `mombabypicks.com`
2. In Cloudflare DNS → add these records:
   - A record: `@` → `185.199.108.153`
   - A record: `@` → `185.199.109.153`
   - A record: `@` → `185.199.110.153`
   - A record: `@` → `185.199.111.153`
   - CNAME: `www` → `YOUR_USERNAME.github.io`

## Structure

```
content/
  posts/
    best-breast-pumps.md
    best-bottle-warmers.md
    newborn-essentials-checklist.md
    momcozy-m5-review.md
    breastfeeding-essentials.md
  about.md
```
