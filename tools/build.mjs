#!/usr/bin/env node
/**
 * Atlas build.
 *   node tools/build.mjs                         rebuild everything from src/pins.json
 *   node tools/build.mjs --add src/issues/X.json merge a new issue (and X.editorial.json if present), then rebuild
 *
 * src/pins.json is the single source of truth (site config, issues, patterns, links, every pin).
 * The build validates (closed tag list, wording rules, point-in-polygon) and refuses to write on any error.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { geoContains } = await import(require.resolve('d3-geo'));
const topo = require('topojson-client');

const rel = (...p) => path.join(ROOT, ...p);
const read = (p) => fs.readFileSync(rel(p), 'utf8');
const write = (p, s) => { fs.mkdirSync(path.dirname(rel(p)), { recursive: true }); fs.writeFileSync(rel(p), s); };

/* ---- Load shared constants from the browser core (single source for tags/families/glyphs) ---- */
function loadCore() {
  const noop = () => {};
  const el = { setAttribute: noop, removeAttribute: noop, getAttribute: () => null };
  const ctx = { window: {}, document: { addEventListener: noop, querySelectorAll: () => [], documentElement: el }, localStorage: { getItem: () => null, setItem: noop }, location: {} };
  ctx.window.addEventListener = noop;
  ctx.addEventListener = noop;
  vm.createContext(ctx);
  vm.runInContext(read('assets/js/core.js').replace(/\bwindow\.addEventListener/g, 'addEventListener'), ctx);
  return ctx.window.Atlas;
}
const A = loadCore();

/* ---- Args ---- */
const args = process.argv.slice(2);
const addIdx = args.indexOf('--add');
const db = JSON.parse(read('src/pins.json'));

const MONTHS = ['בינואר', 'בפברואר', 'במרץ', 'באפריל', 'במאי', 'ביוני', 'ביולי', 'באוגוסט', 'בספטמבר', 'באוקטובר', 'בנובמבר', 'בדצמבר'];
const dateHe = (iso) => { const [y, m, d] = iso.split('-'); return `${+d} ${MONTHS[+m - 1]} ${y}`; };

if (addIdx >= 0) {
  const file = args[addIdx + 1];
  const batch = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  const issue = batch.issue;
  if (db.issues.some((i) => i.issue === issue)) {
    console.log(`issue ${issue} already present — replacing its pins`);
    db.pins = db.pins.filter((p) => p.issue_date !== issue);
    db.issues = db.issues.filter((i) => i.issue !== issue);
  }
  db.issues.push({ issue, label: batch.label || dateHe(issue) });
  for (const p of batch.pins) {
    db.pins.push({
      ...p,
      issue_date: issue,
      related: p.related || [],
      full_item: p.full_item || null,
      source: `מבוסס על דיווח ב-The Economist, ${dateHe(issue)}`,
    });
  }
  const edFile = file.replace(/\.json$/, '.editorial.json');
  if (fs.existsSync(edFile)) {
    const ed = JSON.parse(fs.readFileSync(edFile, 'utf8'));
    for (const pt of ed.patterns || []) {
      const ex = db.patterns.find((x) => x.id === pt.id);
      if (ex) { Object.assign(ex, { ...pt, members: [...new Set([...ex.members, ...pt.members])], first_seen: ex.first_seen }); }
      else db.patterns.push(pt);
    }
    for (const l of ed.links || []) db.links.push(l);
  }
}

/* ---- Normalise: related in both directions, pattern co-members, explicit links ---- */
const byId = Object.fromEntries(db.pins.map((p) => [p.id, p]));
const relSets = Object.fromEntries(db.pins.map((p) => [p.id, new Set(p.related || [])]));
const link = (a, b) => { if (a !== b && relSets[a] && relSets[b]) { relSets[a].add(b); relSets[b].add(a); } };
for (const p of db.pins) for (const r of p.related || []) link(p.id, r);
for (const [a, b] of db.links || []) link(a, b);
for (const pt of db.patterns) for (const a of pt.members) for (const b of pt.members) link(a, b);
for (const p of db.pins) p.related = [...relSets[p.id]].sort();
db.links = [...new Map((db.links || []).map((l) => { const k = [...l].sort(); return [k.join('|'), k]; })).values()];

db.issues.sort((a, b) => (a.issue < b.issue ? -1 : 1));
db.pins.sort((a, b) => (a.id < b.id ? -1 : 1));

/* ---- Validate ---- */
const errors = [], warnings = [];
const world = JSON.parse(read('data/world.js').replace(/^[\s\S]*?window\.ATLAS_WORLD=/, '').replace(/;\s*$/, ''));
const countries = topo.feature(world, world.objects.countries).features;
const SCALES = ['local', 'national', 'regional', 'global'];
const REQUIRED = ['id', 'issue_date', 'scale', 'title_he', 'problem_he', 'who_hurts', 'who_gains', 'why_now', 'idea_he', 'must_be_true', 'priority', 'source'];
const TEXT = ['title_he', 'problem_he', 'who_hurts', 'who_gains', 'why_now', 'idea_he', 'must_be_true', 'indirect_note', 'diff_reason'];
// private word list (gitignored): one word per line
const FORBIDDEN = fs.existsSync(rel('.atlas-forbidden.txt')) ? read('.atlas-forbidden.txt').split('\n').map((w) => w.trim()).filter(Boolean) : [];
const seen = new Set();
const quotesByIssue = {};
for (const p of db.pins) {
  const at = `[${p.id}]`;
  if (seen.has(p.id)) errors.push(`${at} duplicate id`); seen.add(p.id);
  for (const f of REQUIRED) if (!p[f] && p[f] !== 0) errors.push(`${at} missing ${f}`);
  if (!/^\d{4}-\d{2}-\d{2}-\d{2}$/.test(p.id)) errors.push(`${at} bad id format`);
  if (!SCALES.includes(p.scale)) errors.push(`${at} bad scale ${p.scale}`);
  if (!['A', 'B', 'C'].includes(p.priority)) errors.push(`${at} bad priority`);
  if (!Array.isArray(p.tags) || p.tags.length < 1 || p.tags.length > 3) errors.push(`${at} needs 1–3 tags`);
  for (const t of p.tags || []) if (!A.TAGS.includes(t)) errors.push(`${at} tag not in closed list: ${t}`);
  if (p.indirect && !p.indirect_note) errors.push(`${at} indirect pin needs indirect_note`);
  if (p.diff_candidate && !p.diff_reason) errors.push(`${at} DIFF candidate needs diff_reason`);
  const words = p.title_he.trim().split(/\s+/).length;
  if (words > 8) errors.push(`${at} title is ${words} words (max 8)`);
  const all = TEXT.map((f) => p[f] || '').join(' \n ') + ' ' + (p.terms || []).map((t) => t.d).join(' ');
  if (/(^|[^א-ת])(ה?כתב(ה|ות|תו|תה))(?![א-ת])/.test(all)) errors.push(`${at} uses the word "כתבה" — use "הסיפור" / "הדיווח"`);
  for (const w of FORBIDDEN) if (all.includes(w)) errors.push(`${at} contains a word from .atlas-forbidden.txt: ${w}`);
  const q = (all.match(/[“”"]/g) || []).length / 2;
  quotesByIssue[p.issue_date] = (quotesByIssue[p.issue_date] || 0) + q;
  const cardText = TEXT.map((f) => p[f] || '').join(' ');
  for (const t of p.terms || []) if (!cardText.includes(t.t)) errors.push(`${at} term "${t.t}" does not appear in the card text`);
  for (const r of p.related) if (!byId[r]) errors.push(`${at} related id not found: ${r}`);
  // point-in-polygon against Natural Earth 50m
  const pl = p.place || {};
  if (typeof pl.lat !== 'number' || typeof pl.lng !== 'number') errors.push(`${at} missing coordinates`);
  else {
    const feat = countries.find((f) => f.id === pl.iso_n3);
    if (!feat) errors.push(`${at} iso_n3 ${pl.iso_n3} not found in world file`);
    else if (!geoContains(feat, [pl.lng, pl.lat])) {
      const actual = countries.find((f) => geoContains(f, [pl.lng, pl.lat]));
      errors.push(`${at} PIN OUTSIDE ITS COUNTRY: (${pl.lat}, ${pl.lng}) is not in ${pl.country_en}${actual ? ' — it falls in ' + actual.properties.name : ' — it falls in the sea'}`);
    }
  }
  if (!pl.city && !pl.region && p.scale !== 'national') warnings.push(`${at} no city/region and scale is not national`);
}
for (const [iss, q] of Object.entries(quotesByIssue)) if (q > 1) errors.push(`issue ${iss}: ${q} quotes (max 1 per batch)`);
for (const pt of db.patterns) {
  for (const m of pt.members) if (!byId[m]) errors.push(`pattern ${pt.id}: member not found ${m}`);
  const n = new Set(pt.members.map((m) => byId[m] && byId[m].place.country_en)).size;
  if (n < 3) errors.push(`pattern ${pt.id}: only ${n} places (a pattern needs 3+)`);
}
warnings.forEach((w) => console.warn('warn ' + w));
if (errors.length) {
  console.error(`\n✗ ${errors.length} error(s) — nothing written:\n  ` + errors.join('\n  '));
  process.exit(1);
}

/* ---- Write source of truth ---- */
write('src/pins.json', JSON.stringify(db, null, 2) + '\n');

/* ---- Data files (JS, not JSON: the site must open over file://) ---- */
const issuesOut = db.issues.map((i) => {
  const ps = db.pins.filter((p) => p.issue_date === i.issue);
  return { issue: i.issue, label: i.label, file: `pins-${i.issue}.js`, count: ps.length, countries: new Set(ps.map((p) => p.place.country_en)).size };
});
for (const i of issuesOut) {
  const ps = db.pins.filter((p) => p.issue_date === i.issue);
  write(`data/${i.file}`, `/* Atlas pins — issue ${i.issue}. Generated by tools/build.mjs from src/pins.json. */\nwindow.ATLAS_PINS=window.ATLAS_PINS||{};\nwindow.ATLAS_PINS[${JSON.stringify(i.issue)}]=${JSON.stringify(ps, null, 1)};\n`);
}
const built = new Date().toISOString();
write('data/index.js', `/* Atlas index. Generated by tools/build.mjs. */\nwindow.ATLAS_INDEX=${JSON.stringify({ built, site: db.site, issues: issuesOut, patterns: db.patterns }, null, 1)};\n`);

/* ---- Pages ---- */
const site = db.site;
const legend = A.FAMILIES.map((f) => `<li>${A.swatch(f.id)}<span><b>${A.esc(f.name)}</b><br>${f.tags.map(A.esc).join(' · ')}</span></li>`).join('') +
  `<li><span class="fam-swatch" style="--fam:var(--fam-1);background:var(--pin-ring);border:2.5px solid var(--fam-1);outline:1px dashed var(--pin-edge);outline-offset:1px"></span><span><b>נעץ חלול</b> = קשר עקיף</span></li>` +
  `<li><span class="fam-swatch" style="--fam:var(--ink-1);font-size:13px;color:var(--page)">★</span><span><b>כוכב</b> = מועמד ל-DIFF</span></li>` +
  `<li><span class="fam-swatch" style="--fam:var(--ink-1);color:var(--page);font-size:10px;font-weight:700">3</span><span><b>עיגול עם מספר</b> = כמה נעצים קרובים</span></li>`;

function header(active, base) {
  const nav = [['map', 'index.html', 'מפה'], ['patterns', 'index.html#patterns', 'דפוסים'], ['issues', 'index.html#issues', 'גיליונות'], ['about', 'about.html', 'אודות']];
  return `<header class="site-header"><div class="site-header__in">
  <a class="brand" href="${base}index.html"><span class="brand__mark">${A.esc(site.name)}</span><span class="brand__tag">${A.esc(site.tagline)}</span></a>
  <nav class="site-nav" aria-label="ניווט ראשי">${nav.map(([k, h, t]) => `<a href="${base}${h}"${k === active ? ' aria-current="page"' : ''}>${t}</a>`).join('')}</nav>
  <button type="button" class="btn btn--icon theme-toggle" aria-label="החלפת מצב תצוגה"><svg class="i-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="currentColor"/></svg><svg class="i-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="currentColor"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>
</div></header>`;
}
function footer(base) {
  return `<footer class="site-footer"><div class="site-footer__in">
  <span>${A.esc(site.name)} · הסיכומים מבוססים על דיווח ב-The Economist ונכתבו מחדש בעברית.</span>
  <span><a href="${base}about.html">איך קוראים נעץ</a> · עודכן ${dateHe(db.issues.length ? db.issues[db.issues.length - 1].issue : built.slice(0, 10))}</span>
</div></footer>`;
}
const FAVICON = `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="#1a1a19"/><path d="M16 6c-4 0-7 3-7 7 0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z" fill="#f0916a"/><circle cx="16" cy="13" r="2.6" fill="#1a1a19"/></svg>')}">`;
function fill(tpl, vars, base) {
  const url = site.url ? site.url.replace(/\/?$/, '/') : '';
  let out = tpl
    .replace(/\{\{HEADER:(\w+)\}\}/g, (_, k) => header(k, base))
    .replace(/\{\{FOOTER\}\}/g, footer(base))
    .replace(/\{\{LEGEND\}\}/g, legend)
    .replace(/\{\{META_COMMON\}\}/g, `<meta name="theme-color" content="#f6f5f1" media="(prefers-color-scheme: light)">\n<meta name="theme-color" content="#0d0d0d" media="(prefers-color-scheme: dark)">\n<meta property="og:type" content="website">\n<meta property="og:locale" content="he_IL">\n<meta property="og:site_name" content="${A.esc(site.name)}">\n<meta name="twitter:card" content="summary_large_image">\n${FAVICON}`)
    .replace(/\{\{SITE_URL\}\}/g, url || base)
    .replace(/\{\{SITE_NAME\}\}/g, A.esc(site.name))
    .replace(/\{\{SITE_TAGLINE\}\}/g, A.esc(site.tagline))
    .replace(/\{\{SITE_DESC\}\}/g, A.esc(site.description));
  for (const [k, v] of Object.entries(vars || {})) out = out.split(`{{${k}}}`).join(v);
  if (!url) out = out.replace(/<meta property="og:url"[^>]*>\n?/g, '');
  return out;
}
write('index.html', fill(read('templates/index.html'), {}, ''));
write('about.html', fill(read('templates/about.html'), {}, ''));
for (const i of issuesOut) {
  const ps = db.pins.filter((p) => p.issue_date === i.issue);
  const nDiff = ps.filter((p) => p.diff_candidate).length;
  const desc = `${i.count} נעצים מ-${i.countries} מדינות${nDiff ? `, ${nDiff} מועמדים ל-DIFF` : ''}. כל בעיה במקומה, ומה אפשר לבנות.`;
  write(`issue/${i.issue}.html`, fill(read('templates/issue.html'), { ISSUE: i.issue, ISSUE_LABEL: A.esc(i.label), ISSUE_DESC: A.esc(desc) }, '../'));
}

console.log(`✓ ${db.pins.length} pins · ${db.issues.length} issue(s) · ${db.patterns.length} pattern(s) · ${new Set(db.pins.map((p) => p.place.country_en)).size} countries — all inside their borders`);
