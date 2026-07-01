// Decrypt test.
//
// Runs the BUILT artifact (jsonDecrypt.json -> imageDecryptEval, the exact minified code
// the extension's QuickJS actually executes) against one local capture, sampleScriptText.js,
// and checks the decoded pages against the known-good image paths pinned in pages.json.
//
// - sampleScriptText.js is a real capture and stays LOCAL (gitignored) — it embeds session
//   PII (your IP / user-agent). Refresh it whenever RCO changes their format.
// - pages.json is also LOCAL (gitignored). It maps page numbers to the expected image path.
//   Add as few or as many as you like: open the comic in a browser, copy an image address,
//   and paste it against its page number. Any query string is ignored when comparing. See
//   the README for the format.
//
// Run `npm run gen` first (to rebuild jsonDecrypt.json), then `npm test`.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const dir = path.dirname(fileURLToPath(import.meta.url));

// The exact code the extension runs (NOT the rcoDecrypt.js source).
const { imageDecryptEval } = JSON.parse(
  fs.readFileSync(path.join(dir, "jsonDecrypt.json"), "utf-8"),
);

// Run the production artifact. Direct eval returns the completion value of the last
// expression (`JSON.stringify(getCleanedLinks())`), exactly like QuickJs.evaluate().
function decode(input, useServer2 = false) {
  const _encryptedString = input;
  const _useServer2 = useServer2;
  return JSON.parse(eval(imageDecryptEval));
}

const urlPattern = /^https?:\/\/(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+\b/i;
const pathOf = (u) => u.split("?")[0];

let failures = 0;
function fail(msg) {
  failures++;
  console.log(`FAIL  ${msg}`);
}

// --- Decode the single sample fixture ---
const samplePath = path.join(dir, "sampleScriptText.js");
if (!fs.existsSync(samplePath)) {
  console.log("⚠  sampleScriptText.js not found — capture one from the app to run tests. Skipping.");
  process.exit(0);
}

const links = decode(fs.readFileSync(samplePath, "utf-8"));

links.forEach((link, i) => console.log(`Page ${i + 1}: ${link}`));
console.log("");

if (links.length === 0) fail("decode produced 0 links");
if (links.some((u) => !urlPattern.test(u))) fail("some decoded links are not valid URLs");

// --- Check decoded pages against the known-good paths in pages.json (local, optional) ---
const pagesFile = path.join(dir, "pages.json");
const pages = fs.existsSync(pagesFile)
  ? JSON.parse(fs.readFileSync(pagesFile, "utf-8")).pages ?? []
  : [];

let passed = 0;
for (const { page, path: expected } of pages) {
  // Compare paths only; strip any query string so a pasted full browser URL still matches.
  const expectedPath = pathOf(expected);
  const actual = links[Number(page) - 1];
  if (!actual) {
    fail(`page ${page}: no decoded link at this position (only ${links.length} generated)`);
  } else if (pathOf(actual) === expectedPath) {
    passed++;
  } else {
    fail(`page ${page}: path mismatch\n        expected ${expectedPath}\n        got      ${pathOf(actual)}`);
  }
}

console.log(`${links.length} page links generated, ${passed}/${pages.length} page check(s) passed`);

console.log("");
if (failures > 0) {
  console.log(`${failures} check(s) FAILED`);
  process.exit(1);
}
console.log("All checks passed");
