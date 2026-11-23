/* ===========================================================
   Static blog builder
   ---------------------------------------------------------
   Reads  : content/posts/*.md   (frontmatter + markdown)
   Writes : blog/index.html
            blog/<slug>/index.html
            sitemap.xml
   Run    : npm run build
   =========================================================== */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');

const ROOT = path.join(__dirname, '..');
const POSTS_DIR = path.join(ROOT, 'content', 'posts');
const BLOG_DIR = path.join(ROOT, 'blog');
const SITE = 'https://ganiyuusman.netlify.app';
const CAL = 'https://calendly.com/usmanganiyu1596/30min';

marked.setOptions({ mangle: false, headerIds: false });

/* ---------- helpers ---------- */
const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const slugify = (s) =>
  String(s).toLowerCase().trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

const readMins = (md) => Math.max(1, Math.round(md.split(/\s+/).length / 220));

/* ---------- shared chrome ---------- */
const head = ({ title, description, url, date, mod }) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="${date ? 'article' : 'website'}">
<meta property="og:url" content="${url}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0C1618">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%230C1618'/%3E%3Ccircle cx='10' cy='16' r='4' fill='%2317A85E'/%3E%3Crect x='16' y='14.5' width='8' height='3' rx='1.5' fill='%2317A85E'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/site.css">
${date ? `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description,
    datePublished: new Date(date).toISOString(),
    dateModified: new Date(mod || date).toISOString(),
    author: { '@type': 'Person', name: 'Ganiyu Usman Ademola', url: SITE },
    publisher: { '@type': 'Person', name: 'Ganiyu Usman Ademola' },
    mainEntityOfPage: url
  })}</script>` : ''}
</head>
<body>
<div class="grain"></div>
<nav id="nav">
  <a href="/" class="logo"><span class="logo-dot"></span>Ganiyu</a>
  <ul class="nav-links" id="navlinks">
    <li><a href="/#work">Work</a></li>
    <li><a href="/#services">Services</a></li>
    <li><a href="/#about">About</a></li>
    <li><a href="/blog/">Blog</a></li>
  </ul>
  <a class="btn btn-sm btn-green" href="${CAL}" target="_blank" rel="noopener">Book a Call</a>
  <button class="menu-btn" id="menubtn" aria-label="Menu"><span></span><span></span><span></span></button>
</nav>`;

const foot = `
<footer>
  <div class="wrap">
    <div class="fgrid">
      <div>
        <a href="/" class="logo" style="margin:0"><span class="logo-dot"></span>Ganiyu Usman Ademola</a>
        <p>AI &amp; Automation Engineer building agents and workflows that remove manual work for good. Available worldwide, remote.</p>
        <div class="socials">
          <a class="soc" href="https://www.linkedin.com/in/usman-ademola-ganiyu-2867a422b" target="_blank" rel="noopener" aria-label="LinkedIn"><svg viewBox="0 0 24 24"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/></svg></a>
          <a class="soc" href="https://github.com/ademola-low-code" target="_blank" rel="noopener" aria-label="GitHub"><svg viewBox="0 0 24 24"><path d="M12 2A10 10 0 0 0 8.84 21.5c.5.08.66-.23.66-.5v-1.7C6.73 19.91 6.14 18 6.14 18A2.69 2.69 0 0 0 5 16.5c-.91-.62.07-.6.07-.6a2.1 2.1 0 0 1 1.53 1 2.15 2.15 0 0 0 2.91.83 2.16 2.16 0 0 1 .63-1.34c-2.14-.24-4.39-1.07-4.39-4.77a3.74 3.74 0 0 1 1-2.6 3.44 3.44 0 0 1 .09-2.56s.84-.27 2.75 1a9.63 9.63 0 0 1 5 0c1.91-1.29 2.75-1 2.75-1a3.44 3.44 0 0 1 .09 2.56 3.74 3.74 0 0 1 1 2.6c0 3.71-2.26 4.53-4.41 4.77a2.4 2.4 0 0 1 .69 1.87v2.77c0 .27.16.59.67.5A10 10 0 0 0 12 2z"/></svg></a>
          <a class="soc" href="mailto:usmanganiyu1596@gmail.com" aria-label="Email"><svg viewBox="0 0 24 24" style="fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg></a>
        </div>
      </div>
      <div>
        <h5>Navigate</h5>
        <a href="/#work">Featured Work</a>
        <a href="/#services">Services &amp; Pricing</a>
        <a href="/#about">About</a>
        <a href="/blog/">Blog</a>
      </div>
      <div>
        <h5>Get In Touch</h5>
        <a href="${CAL}" target="_blank" rel="noopener">Book a 30-min call</a>
        <a href="mailto:usmanganiyu1596@gmail.com?subject=Project%20Enquiry">usmanganiyu1596@gmail.com</a>
        <a href="https://www.linkedin.com/in/usman-ademola-ganiyu-2867a422b" target="_blank" rel="noopener">LinkedIn</a>
        <a href="https://www.upwork.com/freelancers/~01ed8a8588148146fe" target="_blank" rel="noopener">Upwork</a>
      </div>
    </div>
    <div class="fbot">
      <span>© ${new Date().getFullYear()} Ganiyu Usman Ademola</span>
      <span>Built and automated in Ibadan, Nigeria 🇳🇬</span>
    </div>
  </div>
</footer>
<script src="/assets/js/site.js" defer></script>
</body>
</html>`;

/* ---------- load posts ---------- */
function loadPosts() {
  if (!fs.existsSync(POSTS_DIR)) return [];
  return fs.readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    .map((f) => {
      const raw = fs.readFileSync(path.join(POSTS_DIR, f), 'utf8');
      const { data, content } = matter(raw);
      if (data.draft === true) return null;
      const title = data.title || path.basename(f, '.md');
      return {
        file: f,
        title,
        slug: data.slug || slugify(title),
        description: data.description || content.trim().split('\n')[0].slice(0, 160),
        date: data.date ? new Date(data.date) : fs.statSync(path.join(POSTS_DIR, f)).mtime,
        updated: data.updated ? new Date(data.updated) : null,
        category: data.category || 'Automation',
        tags: Array.isArray(data.tags) ? data.tags : [],
        body: content,
        mins: readMins(content)
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.date - a.date);
}

/* ---------- render one post ---------- */
function renderPost(p) {
  const url = `${SITE}/blog/${p.slug}/`;
  const html = `${head({ title: `${p.title} — Ganiyu Usman Ademola`, description: p.description, url, date: p.date, mod: p.updated })}
<article class="post">
  <div class="wrap-narrow">
    <div class="post-meta">
      <span class="post-cat">${esc(p.category)}</span>
      <span>${fmtDate(p.date)}</span>
      <span>·</span>
      <span>${p.mins} min read</span>
    </div>
    <h1>${esc(p.title)}</h1>
    <p class="excerpt">${esc(p.description)}</p>
    <div class="prose">
${marked.parse(p.body)}
    </div>
    <div class="post-cta">
      <h3>Want this built for your business?</h3>
      <p>I build AI agents and automation systems like the ones in this article — in production, not in theory. Book a free 30-minute call and I'll map out what it would take for you.</p>
      <a class="btn btn-lg btn-green" href="${CAL}" target="_blank" rel="noopener">Book a Free Call</a>
    </div>
    <a class="back-link" href="/blog/">← All articles</a>
  </div>
</article>
${foot}`;
  const dir = path.join(BLOG_DIR, p.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
}

/* ---------- render index ---------- */
function renderIndex(posts) {
  const cards = posts.length
    ? posts.map((p) => `      <a class="post-card rv" href="/blog/${p.slug}/">
        <div class="post-meta">
          <span class="post-cat">${esc(p.category)}</span>
          <span>${fmtDate(p.date)}</span>
          <span>·</span>
          <span>${p.mins} min read</span>
        </div>
        <h2>${esc(p.title)}</h2>
        <p>${esc(p.description)}</p>
      </a>`).join('\n')
    : `      <div class="empty rv">No articles published yet — the first one lands soon.</div>`;

  const html = `${head({
    title: 'Blog — Automation, AI Agents & Business Operations | Ganiyu Usman Ademola',
    description: 'Practical articles on AI agents, workflow automation, CRM and business operations — written from systems actually built and running in production.',
    url: `${SITE}/blog/`
  })}
<header class="blog-head">
  <div class="wrap-narrow">
    <div class="eyebrow">Blog</div>
    <h1>Automation, in practice.</h1>
    <p>Answers to the questions business owners actually ask about AI agents, workflow automation, CRM and operations — written from systems I've built and run in production.</p>
  </div>
</header>
<section>
  <div class="wrap-narrow">
    <div class="posts">
${cards}
    </div>
  </div>
</section>
${foot}`;

  fs.mkdirSync(BLOG_DIR, { recursive: true });
  fs.writeFileSync(path.join(BLOG_DIR, 'index.html'), html);
}

/* ---------- sitemap ---------- */
function renderSitemap(posts) {
  const urls = [
    { loc: `${SITE}/`, pri: '1.0' },
    { loc: `${SITE}/blog/`, pri: '0.8' },
    ...posts.map((p) => ({
      loc: `${SITE}/blog/${p.slug}/`,
      pri: '0.7',
      lastmod: (p.updated || p.date).toISOString().slice(0, 10)
    }))
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<priority>${u.pri}</priority></url>`).join('\n')}
</urlset>
`;
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml);
}

/* ---------- run ---------- */
const posts = loadPosts();

// clear previously generated post folders so deleted posts disappear
if (fs.existsSync(BLOG_DIR)) {
  for (const entry of fs.readdirSync(BLOG_DIR, { withFileTypes: true })) {
    if (entry.isDirectory()) fs.rmSync(path.join(BLOG_DIR, entry.name), { recursive: true, force: true });
  }
}

posts.forEach(renderPost);
renderIndex(posts);
renderSitemap(posts);

console.log(`Built ${posts.length} post(s):`);
posts.forEach((p) => console.log(`  /blog/${p.slug}/   ${p.title}`));
console.log('Wrote blog/index.html and sitemap.xml');
