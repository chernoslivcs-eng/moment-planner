// TEST TOOLING (not product code). Builds a reproducible dataset of geo test-points from a
// one-shot forward Nominatim search per settlement, so Block A's reverse probe can be re-run
// after any future change without re-hunting coordinates. Output: test/fixtures/geo-points.json.
//
// For ★ (outskirts:true) cities we add a second point ~2–3 km off-centre, kept inside the
// settlement bbox. For Славутич we add a third point ~1 km BEYOND the bbox edge, to see what
// reverse returns just past the border. Rate limit: ≥1 s between all Nominatim requests.

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const UA = "moment-planner-geo-test/1.0 (chernosliv.cs@gmail.com)";
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../../test/fixtures/geo-points.json");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// class / representative / flags. outskirts → add an in-bbox off-centre point; beyond → add a
// ~1 km past-bbox point (Славутич only).
const SETTLEMENTS = [
  { name: "Київ", cls: "megapolis", outskirts: true },
  { name: "Харків", cls: "megapolis" },
  { name: "Одеса", cls: "megapolis" },
  // Bare "Дніпро" resolves to the river; qualify it to the city.
  { name: "Дніпро", cls: "megapolis", query: "Дніпро, Дніпропетровська область" },
  { name: "Львів", cls: "megapolis", outskirts: true },
  { name: "Ірпінь", cls: "satellite" },
  { name: "Бровари", cls: "satellite" },
  { name: "Вишневе", cls: "satellite" },
  { name: "Славутич", cls: "small-problem", outskirts: true, beyond: true },
  { name: "Трускавець", cls: "small-no-city" },
  { name: "Моршин", cls: "small-no-city" },
  { name: "Гадяч", cls: "small-no-city" },
  { name: "Балта", cls: "small-no-city" },
  { name: "Ворзель", cls: "smt" },
  { name: "Слобожанське", cls: "smt" },
  { name: "Кам'янець-Подільський", cls: "hyphen-apostrophe" },
  { name: "Кривий Ріг", cls: "hyphen-apostrophe", outskirts: true },
  { name: "Слов'янськ", cls: "hyphen-apostrophe" },
  { name: "Звягель", cls: "renamed" },
];

async function forward(name) {
  const url =
    `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1` +
    `&countrycodes=ua&accept-language=uk&q=${encodeURIComponent(name)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`forward ${name}: HTTP ${res.status}`);
  const arr = await res.json();
  if (!Array.isArray(arr) || arr.length === 0) throw new Error(`forward ${name}: no result`);
  return arr[0];
}

// bbox = [south, north, west, east] (strings). Off-centre point kept inside with a margin.
function insidePoint(lat, lon, bbox) {
  const [s, n, w, e] = bbox.map(Number);
  // Prefer shifting north; if too close to the north edge, shift south. ~0.025° ≈ 2.7 km.
  const room = 0.9; // stay within 90% of the way to the edge
  const north = n - lat;
  const south = lat - s;
  const dLat = north >= south ? Math.min(0.025, north * room) : -Math.min(0.025, south * room);
  return { lat: +(lat + dLat).toFixed(6), lon, dLatDeg: +dLat.toFixed(6) };
}

// ~1 km (0.009°) north of the northern bbox edge.
function beyondPoint(lon, bbox) {
  const north = Number(bbox[1]);
  return { lat: +(north + 0.009).toFixed(6), lon, note: "≈1km north of bbox north edge" };
}

const points = [];
for (const s of SETTLEMENTS) {
  const r = await forward(s.query ?? s.name);
  const lat = +Number(r.lat).toFixed(6);
  const lon = +Number(r.lon).toFixed(6);
  const bbox = r.boundingbox;
  points.push({
    settlement: s.name,
    class: s.cls,
    role: "center",
    lat,
    lon,
    source: {
      nominatim_addresstype: r.addresstype ?? r.type,
      display_name: r.display_name,
      bbox,
    },
  });
  if (s.outskirts) {
    const p = insidePoint(lat, lon, bbox);
    points.push({
      settlement: s.name,
      class: s.cls,
      role: "outskirts",
      lat: p.lat,
      lon: p.lon,
      source: { derived: `center lat ${p.dLatDeg >= 0 ? "+" : ""}${p.dLatDeg}° (in bbox)`, bbox },
    });
  }
  if (s.beyond) {
    const p = beyondPoint(lon, bbox);
    points.push({
      settlement: s.name,
      class: s.cls,
      role: "beyond-border",
      lat: p.lat,
      lon: p.lon,
      source: { derived: p.note, bbox },
    });
  }
  console.error(`ok ${s.name} (${r.addresstype ?? r.type}) ${lat},${lon}`);
  await sleep(1100);
}

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify({ generatedBy: "scripts/geo/build-fixture.mjs", points }, null, 2) + "\n");
console.error(`\nwrote ${points.length} points → ${OUT}`);
