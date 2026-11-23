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
