// Reads sources.json, fetches each podcast feed, tags every episode with the
// liturgical day it belongs to, and writes episodes.json for index.html.
// Run with: node scripts/build.js   (Node 18+, no dependencies)

const fs = require('fs');
const path = require('path');
const L = require('../liturgy.js');

const ROOT = path.join(__dirname, '..');
const sources = JSON.parse(fs.readFileSync(path.join(ROOT, 'sources.json'), 'utf8'));

/* ---------- tiny RSS parsing ---------- */
const unCdata = s => (s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").trim();
const tag = (xml, name) => { const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i')); return m ? unCdata(m[1]) : ''; };
const attr = (xml, name, a) => { const m = xml.match(new RegExp(`<${name}[^>]*\\s${a}="([^"]+)"`, 'i')); return m ? m[1] : ''; };

function parseFeed(xml) {
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  return items.map(it => ({
    title: tag(it, 'title'),
    link: tag(it, 'link') || attr(it, 'enclosure', 'url') || tag(it, 'guid'),
    audio: attr(it, 'enclosure', 'url'),
    pub: new Date(tag(it, 'pubDate')),
    desc: tag(it, 'itunes:summary') || tag(it, 'description'),
  })).filter(e => e.title && !isNaN(e.pub));
}

async function resolveFeed(src) {
  if (src.feed) return src.feed;
  const r = await fetch(`https://itunes.apple.com/lookup?id=${src.appleId}`);
  const j = await r.json();
  const url = j.results && j.results[0] && j.results[0].feedUrl;
  if (!url) throw new Error(`No feed found for Apple ID ${src.appleId}`);
  return url;
}

/* ---------- match an episode to a liturgical id ---------- */
const ORD = { first:1, second:2, third:3, fourth:4, fifth:5, sixth:6, seventh:7, eighth:8, ninth:9, tenth:10,
  eleventh:11, twelfth:12, thirteenth:13, fourteenth:14, fifteenth:15, sixteenth:16, seventeenth:17, eighteenth:18,
  nineteenth:19, twentieth:20, 'twenty-first':21, 'twenty-second':22, 'twenty-third':23, 'twenty-fourth':24,
  'twenty-fifth':25, 'twenty-sixth':26, 'twenty-seventh':27, 'twenty-eighth':28, 'twenty-ninth':29, thirtieth:30,
  'thirty-first':31, 'thirty-second':32, 'thirty-third':33, 'thirty-fourth':34 };
const ordNum = s => { s = s.toLowerCase().replace(/\s+/g, '-'); if (ORD[s]) return ORD[s]; const last = s.split('-').pop(); if (ORD[last]) return ORD[last]; const m = s.match(/(\d+)(?:st|nd|rd|th)?$/); return m ? +m[1] : null; };

const FEASTS = [
  [/palm sunday|passion sunday/i, 'PalmSun'], [/pentecost/i, 'Pentecost'], [/trinity/i, 'Trinity'],
  [/corpus christi|body and blood/i, 'CorpusChristi'], [/christ the king|king of the universe/i, 'ChristKing'],
  [/holy family/i, 'HolyFamily'], [/epiphany/i, 'Epiphany'], [/baptism of (the|our) lord/i, 'Baptism'],
  [/divine mercy/i, 'Easter-2'], [/easter sunday|resurrection of the lord|easter day/i, 'Easter'],
  [/easter vigil|holy saturday/i, 'HolySat'], [/good friday/i, 'GoodFri'], [/holy thursday|lord'?s supper/i, 'HolyThu'],
  [/ascension/i, 'Easter-7'], [/assumption/i, 'F-8-15'], [/all saints/i, 'F-11-1'], [/all souls/i, 'F-11-2'],
  [/christmas|nativity of the lord/i, 'F-12-25'], [/mother of god/i, 'F-1-1'], [/immaculate conception/i, 'F-12-8'],
  [/transfiguration/i, 'F-8-6'], [/exaltation|holy cross/i, 'F-9-14'], [/presentation of the lord/i, 'F-2-2'],
  [/lateran/i, 'F-11-9'], [/peter and paul/i, 'F-6-29'], [/john the baptist/i, 'F-6-24'], [/ash wednesday/i, 'AshWed'],
];

function idFromText(text) {
  const t = text.replace(/\s+/g, ' ');
  let m = t.match(/(\d+(?:st|nd|rd|th)|[A-Za-z]+(?:[\s-][A-Za-z]+)?)\s+Sunday\s+(?:in|of)\s+(Ordinary Time|Lent|Easter|Advent)/i);
  if (m) {
    const n = ordNum(m[1]); if (n) return { OT:'OT-', Lent:'Lent-', Easter:'Easter-', Advent:'Advent-' }[m[2].replace('Ordinary Time','OT').replace(/^\w/, c=>c.toUpperCase())] + n;
  }
  m = t.match(/Sunday\s+(\d+)\s+(?:in|of)\s+(Ordinary Time|Lent|Easter|Advent)/i);
  if (m) return { 'ordinary time':'OT-', lent:'Lent-', easter:'Easter-', advent:'Advent-' }[m[2].toLowerCase()] + m[1];
  for (const [re, id] of FEASTS) if (re.test(t)) return id;
  return null;
}

// The occurrence of `id` closest after (or within a few days before) pubDate.
function dateForId(id, pub) {
  const y = pub.getUTCFullYear();
  const cands = [L.findInYear(id, y), L.findInYear(id, y + 1), L.findInYear(id, y - 1)].filter(Boolean);
  const pubDay = L.D(y, pub.getUTCMonth() + 1, pub.getUTCDate());
  let best = null;
  for (const c of cands) { const diff = (c - pubDay) / 864e5; if (diff >= -3 && diff <= 60 && (!best || c < best)) best = c; }
  return best;
}

function assign(ep, src) {
  const pubDay = L.D(ep.pub.getUTCFullYear(), ep.pub.getUTCMonth() + 1, ep.pub.getUTCDate());
  if (src.kind === 'daily') {
    const d = L.addD(pubDay, src.dayOffset || 0);
    return { date: d, lit: L.liturgy(d), how: 'date' };
  }
  const id = idFromText(ep.title) || idFromText(ep.desc.slice(0, 400));
  if (id) { const d = dateForId(id, ep.pub); if (d) return { date: d, lit: L.liturgy(d), how: 'title' }; }
  const d = L.sundayOnOrAfter(pubDay);           // fallback: the Sunday this episode precedes
  return { date: d, lit: L.liturgy(d), how: 'nextSunday' };
}

/* ---------- main ---------- */
(async () => {
  const out = { generated: new Date().toISOString(), sources: [], byId: {} };
  for (const src of sources) {
    let eps = [];
    try {
      const url = await resolveFeed(src);
      const xml = await (await fetch(url, { headers: { 'user-agent': 'homily-finder/1.0' } })).text();
      eps = parseFeed(xml);
      console.log(`${src.name}: ${eps.length} episodes`);
    } catch (e) { console.error(`${src.name}: FAILED — ${e.message}`); }
    const idx = out.sources.length;
    out.sources.push({ id: src.id, name: src.name, kind: src.kind, count: eps.length });
    for (const ep of eps) {
      const a = assign(ep, src);
      const yr = a.date.getUTCFullYear();
      const bucket = ((out.byId[a.lit.id] ||= {})[yr] ||= []);
      bucket.push({ s: idx, t: ep.title, u: ep.link, a: ep.audio || undefined, d: L.iso(a.date), p: L.iso(ep.pub), h: a.how });
    }
  }
  // keep old data for any source that failed this run
  const prev = path.join(ROOT, 'episodes.json');
  if (fs.existsSync(prev)) {
    const old = JSON.parse(fs.readFileSync(prev, 'utf8'));
    out.sources.forEach((s, i) => {
      if (s.count) return;
      const oi = old.sources.findIndex(o => o.id === s.id); if (oi < 0) return;
      for (const [id, years] of Object.entries(old.byId)) for (const [yr, list] of Object.entries(years))
        for (const e of list) if (e.s === oi) ((out.byId[id] ||= {})[yr] ||= []).push({ ...e, s: i });
      s.count = old.sources[oi].count; s.stale = true;
    });
  }
  fs.writeFileSync(prev, JSON.stringify(out));
  console.log('wrote episodes.json');
})();
