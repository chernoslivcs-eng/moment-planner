// TEST TOOLING (not product code). Reads test/fixtures/geo-points.json and runs every point
// through the SAME reverse call the product makes (zoom=12, accept-language=uk) + the SAME
// settlement selection as settlementFromAddress. Prints a table: point / raw Nominatim fields /
// what our chain chose. Optional arg: a zoom override (to inspect neighbouring zoom for a class
// that systematically fails) — e.g. `node reverse-probe.mjs 10`. Rate limit ≥1 s between calls.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const UA = "moment-planner-geo-test/1.0 (chernosliv.cs@gmail.com)";
const FIX = resolve(dirname(fileURLToPath(import.meta.url)), "../../test/fixtures/geo-points.json");
const zoom = process.argv[2] ? Number(process.argv[2]) : 12;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Mirror of settlementFromAddress (src/lib/geo/currentCity.ts): first NON-BLANK settlement field,
// admin unit only as last resort.
function settlementFromAddress(a) {
  for (const raw of [a.city, a.town, a.village, a.municipality, a.county]) {
    const name = raw?.trim();
    if (name) return name;
  }
  return null;
}

async function reverse(lat, lon) {
  // Byte-identical to reverseGeocodeCity() except the injected zoom + a required User-Agent.
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=${zoom}&addressdetails=1` +
    `&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&accept-language=uk`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`reverse ${lat},${lon}: HTTP ${res.status}`);
  const data = await res.json();
  return data.address ?? {};
}

const { points } = JSON.parse(await readFile(FIX, "utf8"));
const rows = [];
for (const p of points) {
  const a = await reverse(p.lat, p.lon);
  rows.push({
    settlement: p.settlement,
    class: p.class,
    role: p.role,
    city: a.city ?? "",
    town: a.town ?? "",
    village: a.village ?? "",
    municipality: a.municipality ?? "",
    county: a.county ?? "",
    chosen: settlementFromAddress(a) ?? "∅",
  });
  console.error(`ok ${p.settlement}/${p.role} → ${settlementFromAddress(a) ?? "∅"}`);
  await sleep(1100);
}

console.log(`\n=== reverse zoom=${zoom} ===`);
console.log(JSON.stringify(rows, null, 2));
