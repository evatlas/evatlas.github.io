// Precomputes the HexGlobe tile positions so the browser never runs
// point-in-polygon tests. Run manually when tuning density:
//   node scripts/generate-globe-tiles.mjs
// Writes src/data/globe-tiles.json: unit vectors scaled by 1000,
// packed as flat [x,y,z,...] arrays for land and (subsampled) ocean.
import { readFile, writeFile, mkdir } from "fs/promises";
import { geoContains } from "d3-geo";
import { feature } from "topojson-client";

const POINT_COUNT = 34000;
const OCEAN_KEEP_EVERY = 80; // sparse ocean points for the mesh layer

const topo = JSON.parse(
  await readFile("node_modules/world-atlas/land-50m.json", "utf8")
);
const land = feature(topo, topo.objects.land);

const landPts = [];
const oceanPts = [];
let oceanSeen = 0;
const golden = Math.PI * (3 - Math.sqrt(5));

for (let i = 0; i < POINT_COUNT; i++) {
  const y = 1 - (i / (POINT_COUNT - 1)) * 2;
  const r = Math.sqrt(1 - y * y);
  const th = golden * i;
  const x = Math.cos(th) * r;
  const z = Math.sin(th) * r;
  const lat = (Math.asin(y) * 180) / Math.PI;
  const lon = (Math.atan2(z, x) * 180) / Math.PI;
  const p = [Math.round(x * 1000), Math.round(y * 1000), Math.round(z * 1000)];
  if (geoContains(land, [lon, lat])) {
    landPts.push(...p);
  } else if (oceanSeen++ % OCEAN_KEEP_EVERY === 0) {
    oceanPts.push(...p);
  }
}

await mkdir("src/data", { recursive: true });
const out = { scale: 1000, land: landPts, ocean: oceanPts };
await writeFile("src/data/globe-tiles.json", JSON.stringify(out));
console.log(
  `land tiles: ${landPts.length / 3}, ocean tiles: ${oceanPts.length / 3}, ` +
    `bytes: ${JSON.stringify(out).length}`
);


