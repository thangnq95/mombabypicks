#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const repoDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const pinsDir = path.join(repoDir, "static", "images", "pins");
const postsDir = path.join(repoDir, "static", "images", "posts");
const rawDir = path.join(repoDir, "static", "images", "raw");

const PIN_WIDTH = 1000;
const PIN_HEIGHT = 1500;

const palettes = [
  {
    bg: "#f7efe7",
    panel: "#fffaf6",
    accent: "#bc7462",
    accentSoft: "#efd4cb",
    ink: "#2f2624",
    sub: "#6f5f58",
  },
  {
    bg: "#f6f1e8",
    panel: "#fffdf9",
    accent: "#8a9b78",
    accentSoft: "#d9e0cf",
    ink: "#2f2d29",
    sub: "#6a655d",
  },
  {
    bg: "#f4efe9",
    panel: "#fffbf7",
    accent: "#c88f6a",
    accentSoft: "#f1dccd",
    ink: "#352922",
    sub: "#7a665a",
  },
];

const articles = [
  {
    slug: "best-bottle-warmers",
    headline: "Best Bottle Warmers for Newborns",
    subtitle: "Fast, safe picks for 2026",
  },
  {
    slug: "best-baby-bouncers-for-2026",
    headline: "Best Baby Bouncers 2026",
    subtitle: "5 picks from budget to app-controlled",
  },
  {
    slug: "best-breast-pumps",
    headline: "Best Breast Pumps of 2026",
    subtitle: "Wearable and electric picks compared honestly",
  },
  {
    slug: "bottle-warmer-safety-guide",
    headline: "Bottle Warmer Safety",
    subtitle: "What new parents should know",
  },
  {
    slug: "breast-pump-cleaning-guide",
    headline: "Breast Pump Cleaning Guide",
    subtitle: "A realistic cleaning routine for busy moms",
  },
  {
    slug: "best-baby-sleep-sacks-for-2026",
    headline: "Best Baby Sleep Sacks 2026",
    subtitle: "Safe sleep picks by TOG, fabric and fit",
  },
  {
    slug: "best-baby-bottles-for-newborns-2026",
    headline: "Best Baby Bottles for Newborns",
    subtitle: "Anti-colic venting and breast-like nipples",
  },
  {
    slug: "best-baby-carriers-for-2026",
    headline: "Best Baby Carriers 2026",
    subtitle: "From wraps to structured, find your fit",
  },
  {
    slug: "how-to-choose-breast-pump",
    headline: "How to Choose a Breast Pump",
    subtitle: "Wearable vs electric, explained simply",
  },
  {
    slug: "best-diapers-for-newborns-2026",
    headline: "Best Newborn Diapers 2026",
    subtitle: "Softness, fit and sensitive skin compared",
  },
  {
    slug: "best-high-chairs-for-babies-2026",
    headline: "Best High Chairs 2026",
    subtitle: "From budget to grows-with-your-child picks",
  },
  {
    slug: "best-baby-monitors-long-battery-life",
    headline: "Best Baby Monitors for Battery Life",
    subtitle: "Non-WiFi picks that last through the night",
  },
  {
    slug: "best-hands-free-wearable-breast-pumps",
    headline: "Best Wearable Breast Pumps",
    subtitle: "Hands-free pumping for real daily life",
  },
  {
    slug: "breastfeeding-essentials",
    headline: "Breastfeeding Essentials 2026",
    subtitle: "What you actually need from day one",
  },
  {
    slug: "newborn-essentials-checklist",
    headline: "Newborn Essentials Checklist",
    subtitle: "Skip the noise and buy what matters",
  },
  {
    slug: "newborn-feeding-station",
    headline: "How to Set Up a Newborn Feeding Station",
    subtitle: "Keep every feeding essential within reach",
  },
  {
    slug: "newborn-feeding-essentials",
    headline: "Newborn Feeding Essentials",
    subtitle: "Bottles, burp cloths and nursing gear",
  },
  {
    slug: "bottle-refusal-breastfed-babies",
    headline: "Bottle Refusal: What Works",
    subtitle: "Why breastfed babies refuse and how to fix it",
  },
  {
    slug: "eco-friendly-baby-gear-guide",
    headline: "Eco-Friendly Baby Gear",
    subtitle: "Sustainable picks worth buying in 2026",
  },
  {
    slug: "pace-bottle-feeding-guide",
    headline: "Pace Bottle Feeding Guide",
    subtitle: "The technique every breastfed baby needs",
  },
  {
    slug: "silicone-baby-feeding-products",
    headline: "Best Silicone Baby Products",
    subtitle: "Safe, non-toxic gear for feeding time",
  },
  {
    slug: "momcozy-m5-review",
    headline: "Momcozy M5 Review 2026",
    subtitle: "Is it really worth the hype?",
  },
  {
    slug: "what-not-to-buy-newborn",
    headline: "What Not to Buy for a Newborn",
    subtitle: "Skip the stuff that gathers dust",
  },
];

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}

async function getBaseImageUrl(slug) {
  const candidates = [
    path.join(rawDir, `${slug}.png`),
    path.join(rawDir, `${slug}.jpg`),
    path.join(rawDir, `${slug}.jpeg`),
    path.join(rawDir, `${slug}.webp`),
    path.join(postsDir, `${slug}.webp`),
  ];

  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      const bytes = await fs.readFile(candidate);
      return `data:${getMimeType(candidate)};base64,${bytes.toString("base64")}`;
    }
  }

  return null;
}

function makeGradient(palette, variant) {
  if (variant === 2) {
    return `radial-gradient(circle at 18% 18%, ${palette.accentSoft} 0, rgba(255,255,255,0) 40%),
      radial-gradient(circle at 82% 12%, rgba(255,255,255,0.92) 0, rgba(255,255,255,0) 28%),
      linear-gradient(145deg, ${palette.bg} 0%, #ffffff 100%)`;
  }

  if (variant === 3) {
    return `radial-gradient(circle at 78% 26%, ${palette.accentSoft} 0, rgba(255,255,255,0) 28%),
      radial-gradient(circle at 20% 80%, rgba(255,255,255,0.95) 0, rgba(255,255,255,0) 32%),
      linear-gradient(160deg, #ffffff 0%, ${palette.bg} 100%)`;
  }

  return `radial-gradient(circle at 78% 16%, rgba(255,255,255,0.78) 0, rgba(255,255,255,0) 30%),
    linear-gradient(180deg, #ffffff 0%, ${palette.bg} 100%)`;
}

function renderLayout({ article, imageUrl, variant }) {
  const palette = palettes[(articles.findIndex((entry) => entry.slug === article.slug) + variant - 1) % palettes.length];
  const headline = escapeHtml(article.headline);
  const subtitle = escapeHtml(article.subtitle);
  const imageBlock = imageUrl
    ? `<img class="hero-media" src="${imageUrl}" alt="">`
    : `<div class="hero-fallback" aria-hidden="true"></div>`;

  const shared = `
    :root {
      --bg: ${palette.bg};
      --panel: ${palette.panel};
      --accent: ${palette.accent};
      --accent-soft: ${palette.accentSoft};
      --ink: ${palette.ink};
      --sub: ${palette.sub};
      --shadow: 0 24px 70px rgba(79, 49, 35, 0.13);
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      width: ${PIN_WIDTH}px;
      height: ${PIN_HEIGHT}px;
      overflow: hidden;
      font-family: "Avenir Next", "Helvetica Neue", Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--ink);
    }
    body {
      position: relative;
      background: ${makeGradient(palette, variant)};
    }
    .pin {
      width: 100%;
      height: 100%;
      position: relative;
      overflow: hidden;
    }
    .brand-chip {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      width: fit-content;
      max-width: 100%;
      padding: 12px 18px;
      border-radius: 999px;
      background: rgba(255,255,255,0.88);
      border: 1px solid rgba(188, 116, 98, 0.18);
      font-size: 20px;
      line-height: 1;
      letter-spacing: 0.08em;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--accent);
      backdrop-filter: blur(8px);
    }
    .headline {
      margin: 0;
      font-size: 72px;
      line-height: 0.98;
      letter-spacing: -0.04em;
      font-weight: 700;
      text-wrap: balance;
    }
    .subtitle {
      margin: 0;
      font-size: 28px;
      line-height: 1.35;
      color: var(--sub);
      max-width: 86%;
      text-wrap: balance;
    }
    .footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      font-size: 18px;
      line-height: 1;
      color: rgba(111, 95, 88, 0.92);
      letter-spacing: 0.03em;
      text-transform: lowercase;
    }
    .footer strong {
      font-weight: 700;
      color: var(--accent);
      text-transform: none;
      letter-spacing: 0;
    }
    .hero-frame,
    .hero-media,
    .hero-fallback {
      width: 100%;
      height: 100%;
      border-radius: inherit;
    }
    .hero-frame {
      position: relative;
      overflow: hidden;
      background: linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.02));
    }
    .hero-media {
      display: block;
      object-fit: cover;
      object-position: center;
      filter: saturate(0.92) contrast(0.96) brightness(1.02);
      transform: scale(1.01);
    }
    .hero-fallback {
      background:
        radial-gradient(circle at 20% 24%, rgba(255,255,255,0.92) 0, rgba(255,255,255,0) 28%),
        radial-gradient(circle at 78% 28%, var(--accent-soft) 0, rgba(255,255,255,0) 34%),
        linear-gradient(145deg, #ffffff 0%, var(--bg) 100%);
    }
    .soft-shadow {
      box-shadow: var(--shadow);
    }
  `;

  if (variant === 1) {
    return `
      <!doctype html>
      <html>
        <head><meta charset="utf-8"><style>${shared}
          .pin { padding: 34px; }
          .hero-shell {
            position: absolute;
            inset: 34px 34px 470px 34px;
            border-radius: 42px;
            overflow: hidden;
          }
          .hero-shell::after {
            content: "";
            position: absolute;
            inset: auto 0 0 0;
            height: 34%;
            background: linear-gradient(180deg, rgba(29,18,13,0) 0%, rgba(29,18,13,0.18) 100%);
          }
          .content {
            position: absolute;
            left: 34px;
            right: 34px;
            bottom: 34px;
            border-radius: 42px;
            background: rgba(255, 251, 247, 0.96);
            padding: 34px 36px 30px;
            min-height: 504px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            box-shadow: var(--shadow);
          }
          .copy { display: grid; gap: 22px; }
          .footer {
            padding-top: 18px;
            border-top: 1px solid rgba(188, 116, 98, 0.16);
          }
        </style></head>
        <body>
          <main class="pin">
            <section class="hero-shell soft-shadow"><div class="hero-frame">${imageBlock}</div></section>
            <section class="content">
              <div class="copy">
                <div class="brand-chip">Mom Baby Picks</div>
                <h1 class="headline">${headline}</h1>
                <p class="subtitle">${subtitle}</p>
              </div>
              <div class="footer"><strong>mombabypicks.com</strong><span>2026</span></div>
            </section>
          </main>
        </body>
      </html>
    `;
  }

  if (variant === 2) {
    return `
      <!doctype html>
      <html>
        <head><meta charset="utf-8"><style>${shared}
          .hero-bleed {
            position: absolute;
            inset: 0;
          }
          .hero-bleed::after {
            content: "";
            position: absolute;
            inset: 0;
            background:
              linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 24%),
              linear-gradient(180deg, rgba(31, 21, 18, 0) 42%, rgba(31, 21, 18, 0.72) 100%);
          }
          .copy {
            position: absolute;
            inset: 34px 34px 34px 34px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .topbar {
            display: flex;
            justify-content: flex-start;
          }
          .stack {
            display: grid;
            gap: 22px;
            padding: 34px 34px 30px;
            border-radius: 38px;
            background: linear-gradient(180deg, rgba(255,251,247,0.96) 0%, rgba(255,251,247,0.88) 100%);
            backdrop-filter: blur(12px);
            box-shadow: var(--shadow);
          }
          .headline { font-size: 76px; max-width: 88%; }
          .subtitle { max-width: 82%; }
        </style></head>
        <body>
          <main class="pin">
            <section class="hero-bleed"><div class="hero-frame">${imageBlock}</div></section>
            <section class="copy">
              <div class="topbar"><div class="brand-chip">Mom Baby Picks</div></div>
              <div class="stack">
                <h1 class="headline">${headline}</h1>
                <p class="subtitle">${subtitle}</p>
                <div class="footer"><strong>mombabypicks.com</strong><span>2026</span></div>
              </div>
            </section>
          </main>
        </body>
      </html>
    `;
  }

  return `
    <!doctype html>
    <html>
      <head><meta charset="utf-8"><style>${shared}
        .pin { padding: 36px; }
        .panel {
          position: relative;
          width: 100%;
          height: 100%;
          border-radius: 46px;
          background: rgba(255, 251, 247, 0.96);
          box-shadow: var(--shadow);
          overflow: hidden;
        }
        .art {
          position: absolute;
          top: 34px;
          right: 34px;
          width: 63%;
          height: 52%;
          border-radius: 36px;
          overflow: hidden;
        }
        .art::after {
          content: "";
          position: absolute;
          inset: auto 0 0 0;
          height: 30%;
          background: linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(48, 28, 22, 0.12) 100%);
        }
        .copy {
          position: absolute;
          inset: 34px 34px 34px 34px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .content {
          max-width: 54%;
          padding-top: 6px;
          display: grid;
          gap: 22px;
        }
        .eyebrow {
          width: 120px;
          height: 8px;
          border-radius: 999px;
          background: var(--accent-soft);
        }
        .headline {
          font-size: 58px;
          max-width: 88%;
        }
        .subtitle {
          max-width: 90%;
          font-size: 24px;
        }
        .minimal {
          display: grid;
          gap: 16px;
          align-self: end;
          max-width: 58%;
          padding: 24px 26px 22px;
          border-radius: 32px;
          background: rgba(255, 251, 247, 0.84);
          backdrop-filter: blur(10px);
          box-shadow: 0 18px 50px rgba(79, 49, 35, 0.10);
        }
        .minimal .headline {
          font-size: 44px;
          line-height: 1.02;
          max-width: 100%;
        }
      </style></head>
      <body>
        <main class="pin">
          <section class="panel">
            <div class="art soft-shadow"><div class="hero-frame">${imageBlock}</div></div>
            <div class="copy">
              <div class="content">
                <div class="brand-chip">Mom Baby Picks</div>
              </div>
              <div class="minimal">
                <div class="eyebrow"></div>
                <h1 class="headline">${headline}</h1>
              </div>
              <div class="footer"><strong>mombabypicks.com</strong><span>pin-3 visual</span></div>
            </div>
          </section>
        </main>
      </body>
    </html>
  `;
}

async function renderPin(page, article, variant) {
  const imageUrl = await getBaseImageUrl(article.slug);
  const html = renderLayout({ article, imageUrl, variant });
  await page.setContent(html, { waitUntil: "load" });
  await page.screenshot({
    path: path.join(pinsDir, `${article.slug}-pin-${variant}.png`),
    type: "png",
  });
}

async function main() {
  await fs.mkdir(pinsDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: PIN_WIDTH, height: PIN_HEIGHT },
    deviceScaleFactor: 1,
  });

  try {
    const filterSlug = process.argv[2];
    const selected = filterSlug ? articles.filter((entry) => entry.slug === filterSlug) : articles;

    if (!selected.length) {
      console.error(`No article found for slug: ${filterSlug}`);
      process.exitCode = 1;
      return;
    }

    console.log("Generating Pinterest pins with HTML/CSS at 1000x1500\n");
    for (const article of selected) {
      console.log(`- ${article.slug}`);
      for (const variant of [1, 2, 3]) {
        await renderPin(page, article, variant);
        console.log(`  saved ${article.slug}-pin-${variant}.png`);
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
