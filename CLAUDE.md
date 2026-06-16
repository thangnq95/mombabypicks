# MomBabyPicks — Claude Code Instructions

⚠️ **This project's complete rules are in `AGENTS.md` — read that file first.**
⚠️ **The visual asset source of truth is `docs/visual-asset-standard.md`.**

## Quick Reference

- **Repo:** `/Users/thangnguyen/GIT/PP/mombabypicks`
- **Stack:** Hugo + PaperMod, GitHub Pages, Amazon affiliates
- **All rules, pipeline, QA gates, and image/Pinterest requirements:** → see `AGENTS.md`

## Key Commands

```bash
hugo                          # Build site
bash scripts/qa-check.sh      # QA check a specific article
git add -A && git commit -m   # Commit changes
git push                      # Deploy to GitHub Pages
```

## When working on this project

1. Always check `AGENTS.md` for the full workflow, QA gates, and image/Pinterest requirements
2. Always check `docs/visual-asset-standard.md` for the canonical cover vs Pinterest image rule
3. Every new article MUST have cover images + Pinterest pins + images frontmatter
4. Run `hugo` to verify build before committing
