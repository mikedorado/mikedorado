#!/usr/bin/env node
/**
 * Hand-built profile telemetry — no third-party stats services.
 * Queries the GitHub GraphQL API and renders two SVG cards in the
 * Neo-Atlantis palette: telemetry.svg (stats) and languages.svg (top langs).
 *
 * Env: GITHUB_TOKEN (required), OUT_DIR (default: dist), USER_LOGIN (default: mikedorado)
 */
import { mkdir, writeFile } from "node:fs/promises";

const TOKEN = process.env.GITHUB_TOKEN;
const LOGIN = process.env.USER_LOGIN ?? "mikedorado";
const OUT = process.env.OUT_DIR ?? "dist";
if (!TOKEN) { console.error("GITHUB_TOKEN is required"); process.exit(1); }

// ── palette ──────────────────────────────────────────────────────────
const P = {
  bg: "#0A1626", border: "#122A44", gold: "#FFD98A", goldDeep: "#E8B054",
  aqua: "#7FD4CE", aquaDim: "#2E6E75", text: "#BFE3E8", bright: "#EAFFFB",
  coral: "#FF9066", blue: "#6FA8FF",
};
const BAR_COLORS = [P.gold, P.aqua, P.goldDeep, P.blue, P.coral, P.aquaDim];

// ── data ─────────────────────────────────────────────────────────────
const query = `query($login: String!) {
  user(login: $login) {
    followers { totalCount }
    pullRequests { totalCount }
    issues { totalCount }
    contributionsCollection { contributionCalendar { totalContributions } }
    repositories(first: 100, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC) {
      totalCount
      nodes {
        stargazerCount
        languages(first: 10) { edges { size node { name } } }
      }
    }
  }
}`;

const res = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: { Authorization: `bearer ${TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query, variables: { login: LOGIN } }),
});
const json = await res.json();
if (json.errors) { console.error(JSON.stringify(json.errors, null, 2)); process.exit(1); }
const u = json.data.user;

const stars = u.repositories.nodes.reduce((s, r) => s + r.stargazerCount, 0);
const contributions = u.contributionsCollection.contributionCalendar.totalContributions;

const langBytes = new Map();
for (const repo of u.repositories.nodes)
  for (const e of repo.languages.edges)
    langBytes.set(e.node.name, (langBytes.get(e.node.name) ?? 0) + e.size);
const totalBytes = [...langBytes.values()].reduce((a, b) => a + b, 0) || 1;
const topLangs = [...langBytes.entries()]
  .sort((a, b) => b[1] - a[1]).slice(0, 6)
  .map(([name, size]) => ({ name, pct: (size / totalBytes) * 100 }));

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const num = (n) => n.toLocaleString("en-US");

// ── shared card chrome ───────────────────────────────────────────────
const MONO = "'Courier New',Courier,monospace";
const card = (title, body) => `<svg viewBox="0 0 420 195" width="420" height="195" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(title)}">
  <style>
    @keyframes sweep { from { transform: translateX(-160px); } to { transform: translateX(580px); } }
    .sweep { animation: sweep 6s linear infinite; }
    @keyframes dial { from { opacity: .55; } to { opacity: 1; } }
    .dial { animation: dial 3s ease-in-out infinite alternate; }
  </style>
  <defs>
    <linearGradient id="sweepG" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${P.aqua}" stop-opacity="0"/>
      <stop offset="50%" stop-color="${P.bright}" stop-opacity=".8"/>
      <stop offset="100%" stop-color="${P.aqua}" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="cardClip"><rect width="420" height="195" rx="10"/></clipPath>
  </defs>
  <g clip-path="url(#cardClip)">
    <rect width="420" height="195" rx="10" fill="${P.bg}"/>
    <text x="22" y="34" font-family="${MONO}" font-size="14" font-weight="bold" letter-spacing="3" fill="${P.gold}">◈ ${esc(title)}</text>
    <line x1="22" y1="46" x2="398" y2="46" stroke="${P.border}" stroke-width="1.4"/>
    <rect class="sweep" x="0" y="45.4" width="160" height="1.2" fill="url(#sweepG)"/>
    ${body}
    <rect width="420" height="195" rx="10" fill="none" stroke="${P.border}" stroke-width="1.5"/>
  </g>
</svg>`;

// ── telemetry card ───────────────────────────────────────────────────
const rows = [
  ["✦", "STARS COLLECTED", num(stars)],
  ["Ψ", "PUBLIC REPOS", num(u.repositories.totalCount)],
  ["Δ", "PULL REQUESTS", num(u.pullRequests.totalCount)],
  ["◍", "ISSUES RAISED", num(u.issues.totalCount)],
  ["⟡", "FOLLOWERS", num(u.followers.totalCount)],
];
const rowsSvg = rows.map(([glyph, label, value], i) => {
  const y = 72 + i * 24;
  return `<text x="26" y="${y}" font-family="${MONO}" font-size="13" fill="${P.aqua}">${glyph}</text>
    <text x="48" y="${y}" font-family="${MONO}" font-size="12" letter-spacing="1.5" fill="${P.text}">${label}</text>
    <text x="250" y="${y}" text-anchor="end" font-family="${MONO}" font-size="13" font-weight="bold" fill="${P.gold}">${value}</text>`;
}).join("\n");

// ring dial: contributions in the last year
const dial = `
  <g class="dial">
    <circle cx="338" cy="120" r="52" fill="none" stroke="${P.aquaDim}" stroke-width="1" opacity=".6" stroke-dasharray="3 6"/>
    <circle cx="338" cy="120" r="44" fill="none" stroke="${P.goldDeep}" stroke-width="1.2" opacity=".55"/>
    <circle cx="338" cy="120" r="36" fill="none" stroke="${P.aqua}" stroke-width="1" opacity=".4"/>
  </g>
  <text x="338" y="118" text-anchor="middle" font-family="${MONO}" font-size="19" font-weight="bold" fill="${P.bright}">${num(contributions)}</text>
  <text x="338" y="136" text-anchor="middle" font-family="${MONO}" font-size="8.5" letter-spacing="1" fill="${P.aqua}">CONTRIBUTIONS</text>
  <text x="338" y="147" text-anchor="middle" font-family="${MONO}" font-size="8.5" letter-spacing="1" fill="${P.aqua}">PAST YEAR</text>`;

const telemetrySvg = card("GRID TELEMETRY", rowsSvg + dial +
  `<text x="26" y="183" font-family="${MONO}" font-size="9" letter-spacing="1" fill="${P.aquaDim}">SRC: GITHUB GRAPHQL // RENDERED IN-HOUSE</text>`);

// ── languages card ───────────────────────────────────────────────────
const BAR_X = 26, BAR_W = 368;
let acc = 0;
const stacked = topLangs.map((l, i) => {
  const w = (l.pct / 100) * BAR_W;
  const seg = `<rect x="${(BAR_X + acc).toFixed(1)}" y="60" width="${Math.max(w, 2).toFixed(1)}" height="10" fill="${BAR_COLORS[i]}" rx="2"/>`;
  acc += w;
  return seg;
}).join("\n");
const short = (s) => (s.length > 12 ? s.slice(0, 11) + "…" : s);
const legend = topLangs.map((l, i) => {
  const col = i % 2, row = Math.floor(i / 2);
  const x = 26 + col * 196, y = 98 + row * 26;
  return `<rect x="${x}" y="${y - 9}" width="9" height="9" rx="2" fill="${BAR_COLORS[i]}"/>
    <text x="${x + 18}" y="${y}" font-family="${MONO}" font-size="12" letter-spacing="1" fill="${P.text}">${esc(short(l.name.toUpperCase()))}</text>
    <text x="${x + 178}" y="${y}" text-anchor="end" font-family="${MONO}" font-size="12" font-weight="bold" fill="${P.gold}">${l.pct < 0.1 ? "&lt;0.1" : l.pct.toFixed(1)}%</text>`;
}).join("\n");

const languagesSvg = card("SIGNAL COMPOSITION",
  stacked + "\n" + legend +
  `<text x="26" y="183" font-family="${MONO}" font-size="9" letter-spacing="1" fill="${P.aquaDim}">TOP LANGUAGES BY BYTES // PUBLIC SOURCE REPOS</text>`);

// ── write ────────────────────────────────────────────────────────────
await mkdir(OUT, { recursive: true });
await writeFile(`${OUT}/telemetry.svg`, telemetrySvg);
await writeFile(`${OUT}/languages.svg`, languagesSvg);
console.log(`wrote ${OUT}/telemetry.svg and ${OUT}/languages.svg`);
console.log({ stars, repos: u.repositories.totalCount, contributions, topLangs });
