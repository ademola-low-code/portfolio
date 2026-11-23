/* ===========================================================
   Automated post generator
   ---------------------------------------------------------
   1. Tops up content/topics.md from live question sources
   2. Picks the next unwritten topic
   3. Writes the article with an LLM (Gemini by default)
   4. Saves it to content/posts/ and ticks the topic off

   Run:  node scripts/generate-post.js
   Env:  GEMINI_API_KEY      (required unless PROVIDER=anthropic)
         ANTHROPIC_API_KEY   (required when PROVIDER=anthropic)
         PROVIDER            gemini | anthropic      (default gemini)
         MODEL               override the model name (optional)
         DRY_RUN             1 = print, don't write files
   =========================================================== */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const POSTS_DIR = path.join(ROOT, 'content', 'posts');
const TOPICS_FILE = path.join(ROOT, 'content', 'topics.md');
const PROVIDER = (process.env.PROVIDER || 'gemini').toLowerCase();
const DRY = process.env.DRY_RUN === '1';

/* ---------------- helpers ---------------- */

const slugify = (s) =>
  s.toLowerCase().trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 70)
    .replace(/-$/, '');

const log = (...a) => console.log(...a);

function readTopics() {
  const raw = fs.readFileSync(TOPICS_FILE, 'utf8');
  const lines = raw.split('\n');
  const open = [];
  const done = [];
  lines.forEach((l, i) => {
    const m = l.match(/^- \[( |x)\] (.+)$/);
    if (!m) return;
    (m[1] === 'x' ? done : open).push({ line: i, text: m[2].trim() });
  });
  return { raw, lines, open, done };
}

function existingPostTitles() {
  if (!fs.existsSync(POSTS_DIR)) return [];
  return fs.readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const t = fs.readFileSync(path.join(POSTS_DIR, f), 'utf8').match(/^title:\s*(.+)$/m);
      return { file: f, title: t ? t[1].replace(/^["']|["']$/g, '') : f };
    });
}

/* ---------------- topic refill ---------------- */

const NICHE = [
  'automat', 'workflow', 'n8n', 'zapier', 'make.com', 'integrat', 'webhook', 'api',
  'crm', 'hubspot', 'gohighlevel', 'pipeline', 'lead', 'invoice', 'booking', 'appointment',
  'whatsapp', 'telegram', 'twilio', 'sms', 'google sheet', 'airtable', 'spreadsheet',
  'chatbot', 'ai agent', 'no-code', 'nocode', 'low-code', 'sync', 'crm', 'notion'
];

const isQuestionish = (t) =>
  /^(how|can|what|why|is there|does|should|best way)\b/i.test(t.trim()) || t.trim().endsWith('?');

const inNiche = (t) => {
  const low = t.toLowerCase();
  return NICHE.some((k) => low.includes(k));
};

async function safeJson(url, opts = {}) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'ganiyu-portfolio-blog/1.0', ...(opts.headers || {}) },
      signal: AbortSignal.timeout(20000)
    });
    if (!r.ok) { log(`  source ${new URL(url).hostname} -> HTTP ${r.status}`); return null; }
    return await r.json();
  } catch (e) {
    log(`  source ${new URL(url).hostname} -> ${e.message}`);
    return null;
  }
}

async function fetchN8nForum() {
  const out = [];
  for (const feed of ['latest', 'top']) {
    const j = await safeJson(`https://community.n8n.io/${feed}.json`);
    const topics = j?.topic_list?.topics || [];
    for (const t of topics) if (t.title) out.push(t.title);
  }
  return out;
}

async function fetchStackExchange() {
  const out = [];
  const sites = ['webapps', 'softwarerecs', 'serverfault'];
  for (const site of sites) {
    const j = await safeJson(
      `https://api.stackexchange.com/2.3/questions?order=desc&sort=creation&pagesize=50&site=${site}&filter=!nKzQUR3Egv`
    );
    for (const q of j?.items || []) if (q.title) out.push(q.title);
  }
  return out;
}

function cleanTitle(t) {
  return t
    .replace(/\s+/g, ' ')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .trim();
}

async function refillTopics(state) {
  log('Topping up the topic bank…');
  let found = [];
  try {
    const [a, b] = await Promise.all([fetchN8nForum(), fetchStackExchange()]);
    found = [...a, ...b];
  } catch (e) {
    log('  refill failed:', e.message);
  }

  const have = new Set([...state.open, ...state.done].map((t) => t.text.toLowerCase()));
  const fresh = [];
  for (const raw of found) {
    const t = cleanTitle(raw);
    if (t.length < 20 || t.length > 110) continue;
    if (!isQuestionish(t) || !inNiche(t)) continue;
    const key = t.toLowerCase();
    if (have.has(key)) continue;
    have.add(key);
    fresh.push(t.endsWith('?') ? t : t + '?');
    if (fresh.length >= 8) break;
  }

  if (!fresh.length) { log('  nothing new to add'); return state; }

  log(`  adding ${fresh.length} new topic(s)`);
  const lines = state.raw.trimEnd().split('\n');
  fresh.forEach((t) => lines.push(`- [ ] ${t}`));
  const raw = lines.join('\n') + '\n';
  if (!DRY) fs.writeFileSync(TOPICS_FILE, raw);
  return readTopicsFrom(raw);
}

function readTopicsFrom(raw) {
  const lines = raw.split('\n');
  const open = [], done = [];
  lines.forEach((l, i) => {
    const m = l.match(/^- \[( |x)\] (.+)$/);
    if (!m) return;
    (m[1] === 'x' ? done : open).push({ line: i, text: m[2].trim() });
  });
  return { raw, lines, open, done };
}

/* ---------------- the prompt ---------------- */

const SYSTEM = `You are writing a blog article for Ganiyu Usman Ademola, an AI & Automation Engineer based in Ibadan, Nigeria.

WHO HE IS — use this for credibility, naturally, never as a brag list:
- Builds production automation in n8n, Make.com and Zapier for real clients
- Technical partner to Cortexa (Greece): built a multilingual AI hotel booking agent across WhatsApp, Viber and Telegram with Vision AI payment-receipt verification, delivered to production in under 24 hours
- Built ELARA, a WhatsApp spa concierge with live capacity control and overbooking prevention
- Built PE-RAS, a clinic system with 24h/2h reminders across email, SMS and WhatsApp that frees 12+ staff hours a week
- Built StayEase, a hotel guest-request system on a QR code: 6 n8n workflows, one Google Sheet, zero API cost
- Built an invoice system with branded PDFs and automatic reminders: zero late invoices in 5 months
- Built a Twilio MMS-to-email pipeline for an Australian marketing agency, rated 5.0 on Upwork

HOW HE WRITES:
- Plain, direct British English. Short sentences. No hype, no "unlock", no "game-changer", no "in today's fast-paced world".
- Opens with the reader's actual problem in concrete terms, not a definition.
- Specific over general: real node names, real field names, real numbers, real failure modes.
- Teaches the thing properly, including the parts that go wrong. He always includes the mistakes that break it.
- Honest about limits and costs. If something has a catch, he says so.
- Never pretends to have built something he hasn't. Reference his real projects only where they genuinely fit.
- Writes for a business owner who is technical enough to follow, not a developer.

STRUCTURE:
- Open with the problem, 2–3 short paragraphs, no heading
- Then ## headings for the walkthrough
- Include a "## What usually goes wrong" style section with 2–4 concrete failure modes
- Include concrete steps, and a fenced code block only where code genuinely helps
- End with a short honest caveat or a "where this goes next" section
- 900–1400 words. Markdown only. No H1 — the title is added separately.
- Do not add a call-to-action or sign-off; one is appended automatically.`;

const userPrompt = (topic, recent) => `Write the article answering this question:

"${topic}"

Already published (do not repeat these angles): ${recent.length ? recent.join(' | ') : 'none yet'}

Return STRICT JSON, nothing else, in this exact shape:
{
  "title": "A clear specific title, under 70 characters, phrased the way someone would search for it",
  "description": "One sentence for Google, 120-158 characters, says what the reader will be able to do",
  "category": "one of: n8n & Integrations, AI Agents, CRM & Sales, Business Operations, Customer Support, Hospitality, Healthcare",
  "tags": ["3-5", "lowercase", "tags"],
  "body": "the full markdown article"
}`;

/* ---------------- model calls ---------------- */

async function listGeminiModels(key) {
  const j = await safeJson(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
  return (j?.models || [])
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''));
}

/* Rank the models this key can actually use, newest first.
   Hardcoding names does not survive: Google retires them without warning and
   ListModels keeps advertising ones that 404 for new keys. So score instead. */
function rankGeminiModels(available) {
  const unwanted = /(vision|image|audio|tts|live|embedding|aqa|learnlm|gemma)/;
  return available
    .filter((m) => m.startsWith('gemini') && !unwanted.test(m))
    .map((m) => {
      const v = m.match(/gemini-(\d+)(?:\.(\d+))?/);
      return {
        name: m,
        score:
          // flash first, always: the big models have no free-tier quota and 429
          (m.includes('flash') ? 10000 : 0) +
          (v ? Number(v[1]) * 100 + Number(v[2] || 0) : 0) +   // then newest generation
          (/latest/.test(m) ? 10 : 0) -
          (/(lite|preview|exp|thinking|\d{3,})/.test(m) ? 30 : 0)
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((m) => m.name);
}

async function callGemini(topic, recent) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set');

  let queue = process.env.MODEL ? [process.env.MODEL] : [];
  if (!queue.length) {
    const available = await listGeminiModels(key);
    queue = rankGeminiModels(available).slice(0, 5);
    log(`  ${available.length} models available, trying: ${queue.join(', ') || '(none)'}`);
  }
  if (!queue.length) throw new Error('No usable Gemini model found for this API key');

  const tried = new Set();
  let lastErr;

  // One attempt. noThink asks the model to skip its reasoning pass, which is
  // what pushes a long article past the timeout; not every model accepts the
  // field, so a rejection is reported and the caller retries without it.
  async function attempt(model, noThink) {
    const generationConfig = {
      temperature: 0.7,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json'
    };
    if (noThink) generationConfig.thinkingConfig = { thinkingBudget: 0 };

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(150000),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt(topic, recent) }] }],
          generationConfig
        })
      }
    );
    const j = await r.json();
    if (!r.ok) {
      const err = new Error(`HTTP ${r.status}: ${JSON.stringify(j).slice(0, 220)}`);
      err.status = r.status;
      err.body = JSON.stringify(j);
      throw err;
    }
    const text = j?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
    if (!text) throw new Error(`empty response (finish: ${j?.candidates?.[0]?.finishReason || '?'})`);
    return text;
  }

  while (queue.length) {
    const model = queue.shift();
    if (tried.has(model)) continue;
    tried.add(model);
    log(`  trying model: ${model}`);
    try {
      try {
        const text = await attempt(model, true);
        log(`  wrote with ${model}`);
        return text;
      } catch (e) {
        if (e.status !== 400) throw e;
        log('  model rejected thinkingConfig, retrying without it');
        const text = await attempt(model, false);
        log(`  wrote with ${model}`);
        return text;
      }
    } catch (e) {
      lastErr = e;
      log(`  ${model} failed: ${e.message}`);
      // Google names the replacement in a 404 body — take it and jump the queue
      const hint = (e.body || '').match(/models\/([a-z0-9.\-]+) for the latest/i);
      if (hint && !tried.has(hint[1])) {
        log(`  → Google suggests ${hint[1]}, trying that next`);
        queue.unshift(hint[1]);
      }
    }
  }
  throw lastErr;
}

async function callAnthropic(topic, recent) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set');
  const model = process.env.MODEL || 'claude-sonnet-4-5';
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01'
    },
    signal: AbortSignal.timeout(180000),
    body: JSON.stringify({
      model,
      max_tokens: 8000,
      system: SYSTEM,
      messages: [{ role: 'user', content: userPrompt(topic, recent) }]
    })
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return (j.content || []).map((c) => c.text).join('');
}

/* The article body is markdown, so the model routinely emits real newlines
   and tabs inside the JSON string rather than \n and \t. That is invalid
   JSON and JSON.parse rejects it. Walk the text and escape any control
   character that appears inside a string literal. */
function escapeControlCharsInStrings(s) {
  let out = '';
  let inStr = false;
  let esc = false;
  for (const ch of s) {
    if (esc) { out += ch; esc = false; continue; }
    if (ch === '\\' && inStr) { out += ch; esc = true; continue; }
    if (ch === '"') { inStr = !inStr; out += ch; continue; }
    if (inStr && ch < ' ') {
      out += ch === '\n' ? '\\n' : ch === '\r' ? '\\r' : ch === '\t' ? '\\t'
           : '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0');
      continue;
    }
    out += ch;
  }
  return out;
}

function parseModelJson(text) {
  let t = text.trim();
  // strip code fences if the model added them
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();

  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  const candidates = [t];
  if (first !== -1 && last > first) candidates.push(t.slice(first, last + 1));

  for (const c of candidates) {
    for (const attempt of [c, escapeControlCharsInStrings(c)]) {
      try { return JSON.parse(attempt); } catch (_) { /* try the next shape */ }
    }
  }
  throw new Error('Model did not return valid JSON: ' + t.slice(0, 200));
}

/* ---------------- main ---------------- */

(async () => {
  let state = readTopics();
  log(`Topic bank: ${state.open.length} open, ${state.done.length} done`);

  state = await refillTopics(state);

  if (!state.open.length) {
    log('No unwritten topics left — skipping today.');
    process.exit(0);
  }

  const topic = state.open[0];
  log(`\nWriting: ${topic.text}`);

  const recent = existingPostTitles().map((p) => p.title).slice(-12);

  const raw = PROVIDER === 'anthropic'
    ? await callAnthropic(topic.text, recent)
    : await callGemini(topic.text, recent);

  const post = parseModelJson(raw);

  for (const f of ['title', 'description', 'body']) {
    if (!post[f] || String(post[f]).trim().length < 10) throw new Error(`Model returned no usable "${f}"`);
  }

  const slug = slugify(post.title);
  const file = path.join(POSTS_DIR, `${slug}.md`);
  if (fs.existsSync(file)) {
    log(`A post already exists at ${slug}.md — ticking the topic off and skipping.`);
    state.lines[topic.line] = state.lines[topic.line].replace('- [ ]', '- [x]');
    if (!DRY) fs.writeFileSync(TOPICS_FILE, state.lines.join('\n'));
    process.exit(0);
  }

  const today = new Date().toISOString().slice(0, 10);
  const tags = Array.isArray(post.tags) ? post.tags.slice(0, 5) : [];
  const md = `---
title: ${JSON.stringify(post.title)}
description: ${JSON.stringify(post.description)}
date: ${today}
category: ${JSON.stringify(post.category || 'Business Operations')}
tags: [${tags.map((t) => JSON.stringify(String(t).toLowerCase())).join(', ')}]
---

${String(post.body).trim()}
`;

  if (DRY) {
    log('\n--- DRY RUN ---\n');
    log(md.slice(0, 1500));
    process.exit(0);
  }

  fs.mkdirSync(POSTS_DIR, { recursive: true });
  fs.writeFileSync(file, md);
  state.lines[topic.line] = state.lines[topic.line].replace('- [ ]', '- [x]');
  fs.writeFileSync(TOPICS_FILE, state.lines.join('\n'));

  log(`\nWrote content/posts/${slug}.md  (${String(post.body).split(/\s+/).length} words)`);
  // expose for the workflow commit message
  fs.writeFileSync(path.join(ROOT, '.new-post-title'), post.title);
})().catch((e) => {
  console.error('\nFAILED:', e.message);
  process.exit(1);
});
