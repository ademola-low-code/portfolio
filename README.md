# ganiyuusman.netlify.app

Portfolio site and automated blog for **Ganiyu Usman Ademola** — AI & Automation Engineer.

## Structure

```
index.html            homepage
assets/css/site.css   all styles (site + blog)
assets/js/site.js     reveal animations, nav, rotating headline
assets/img/           photos and workflow screenshots
content/posts/*.md    blog posts (markdown + frontmatter)
scripts/build.js      generates blog/ and sitemap.xml from content/posts
blog/                 GENERATED — do not edit by hand
sitemap.xml           GENERATED
```

## Writing a post

Create `content/posts/my-post.md`:

```markdown
---
title: How to connect WhatsApp enquiries to Google Sheets with n8n
description: One sentence for Google and the article card.
date: 2026-11-23
category: n8n & Integrations
tags: [n8n, whatsapp, google sheets]
---

Body in markdown.
```

Optional frontmatter: `slug`, `updated`, `draft: true` (skips the post).
Files starting with `_` are ignored.

## Build

```bash
npm install
npm run build
```

Netlify runs this automatically on every push to `main`.

## Automated posting

`.github/workflows/publish-post.yml` runs 4× a week (Mon, Wed, Fri, Sun at 08:12 Lagos)
and can also be run by hand from the **Actions** tab.

Each run:

1. Tops up `content/topics.md` from the n8n community forum and Stack Exchange
2. Takes the top unwritten topic
3. Writes the article with an LLM
4. Saves it to `content/posts/`, ticks the topic off, rebuilds and pushes
5. Netlify deploys automatically

### Switching the AI provider

Default is Gemini. To use Claude instead:

1. Add repository secret `ANTHROPIC_API_KEY`
2. Add repository **variable** `PROVIDER` = `anthropic`

Optional variable `MODEL` overrides the model name for either provider.

### Running it manually

Actions → **Publish blog post** → **Run workflow**.
