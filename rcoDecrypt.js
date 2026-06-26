import { fileURLToPath } from 'url';
import fs from "fs";
import path from "path";

const filePath = path.join(path.dirname(fileURLToPath(import.meta.url)), "sampleScriptText.js");
const _encryptedString = fs.readFileSync(filePath, "utf-8");
const _useServer2 = false;

// Code Start
const pageLinks = new Array();
const urlPattern = /^https?:\/\/(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+\b(?:[\/a-z0-9-._~:?#@!$&'()*+,;=%]*)$/i;
const reverseOrder = false;

// Detect obfuscation replacement pattern dynamically.
// The site replaces a token like /v6__7zK980_/g with a single char. That char used to be
// an inline string literal, but is now sometimes indirected through a variable
// (e.g. `var xyz = 'g'; l = l.replace(/v6__7zK980_/g, xyz);`), so handle both forms.
const replacePatternRegex = /\.replace\(\s*\/(\w+__\w+_)\/g\s*,\s*(?:['"](\w)['"]|(\w+))\s*\)/;
const replaceMatch = _encryptedString.match(replacePatternRegex);

let obfuscationPattern = /\w{2}__\w{6}_/g;
let replacementChar = 'e';

if (replaceMatch) {
  obfuscationPattern = new RegExp(replaceMatch[1], 'g');

  if (replaceMatch[2]) {
    // Inline literal: .replace(/token/g, "g")
    replacementChar = replaceMatch[2];
  } else {
    // Variable reference: resolve the last `varName = <rhs>;` assignment. The rhs is a
    // plain literal (`xyz = 'g'`) or, on newer pages, an obfuscated string concat
    // (`xyz = "" + "g" + ""`). Grab every quoted literal in the rhs and join them.
    const varName = replaceMatch[3];
    const assignRegex = new RegExp(varName + "\\s*=\\s*([^;]+);", 'g');
    const assignMatches = [..._encryptedString.matchAll(assignRegex)];
    if (assignMatches.length > 0) {
      const rhs = assignMatches[assignMatches.length - 1][1];
      const joined = [...rhs.matchAll(/['"]([^'"]*)['"]/g)].map(m => m[1]).join('');
      if (joined) {
        replacementChar = joined;
      }
    }
  }
}

// Identify the real image array: the one indexed by `currImage` in the page loader,
// e.g. cigvyur8Dm4(5, _InpV8PM7Z[currImage]) / cVd9rw1YdFS(5, _Q3mAIwbd[currImage]).
// `currImage` only ever appears in RCO's own loader, so anchoring on it stays correct
// even though _encryptedString is the WHOLE page (jQuery/libs contain many unrelated
// `fn(n, arr[..])` patterns that a generic regex would match first). This also skips
// the decoy arrays the site populates. Fall back to every `new Array()` var if absent.
const loaderArrayMatch = _encryptedString.match(/(\w+)\s*\[\s*currImage\s*\]/);
const arrayVars = loaderArrayMatch
  ? [loaderArrayMatch[1]]
  : [..._encryptedString.matchAll(/var\s+(\w+)\s*=\s*new\s+Array\(\)\s*;/g)].map(m => m[1]);

// Detect base URL from the site's decode function
const baseUrlMatch = _encryptedString.match(/baeu\(\w+,\s*["'](https?:\/\/[^"']+)["']\)/);
const detectedBaseUrl = baseUrlMatch ? baseUrlMatch[1] : null;

arrayVars.forEach(arrVar => {
  // Newer pages fill the array with direct pushes: _arr.push("<encrypted url>").
  const pushRegex = new RegExp(arrVar + '\\.push\\(\\s*["\']([^"\']{20,})["\']', 'g');
  let values = [..._encryptedString.matchAll(pushRegex)].map(m => m[1]);

  // Older pages fill it through a custom function call that passes the array var
  // alongside the encrypted URL, e.g. dTfnT(2,3,4,1,_arr,7,"<encrypted url>","<token>").
  // The array name never appears in a push there, so fall back to scanning those calls.
  if (values.length === 0) {
    const callRegex = new RegExp('\\w+\\s*\\([^)]*\\b' + arrVar + '\\b[^)]*\\)', 'g');
    values = [..._encryptedString.matchAll(callRegex)]
      .map(call => {
        // A call may carry decoy/token string args alongside the encrypted URL; the
        // encrypted URL is always the longest quoted string, so pick that one.
        const strings = [...call[0].matchAll(/["']([^"']{20,})["']/g)].map(s => s[1]);
        return strings.sort((a, b) => b.length - a.length)[0];
      })
      .filter(Boolean);
  }
  if (values.length === 0) return;

  const offset = findPrefixOffset(values);
  values.forEach(value => pageLinks.push(decryptLink(value, offset)));
});


function findPrefixOffset(array) {
  if (array.length === 0) return 0;

  const ref = array[0];

  let length = 0;
  for (let i = 0; i < ref.length; i++) {
    const char = ref[i];

    if (array.every(str => str[i] === char)) {
      length++;
      
      if (length >= 5 && ref.slice(length - 5, length) === "https") {
        return length - 5;
      }
    } else {
      break;
    }
  }

  return length;
}


function atob(input) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let str = String(input).replace(/=+$/, '');
    if (str.length % 4 === 1) {
        throw new Error("'atob' failed: The string to be decoded is not correctly encoded.");
    }
    let output = '';
    for (let bc = 0, bs, buffer, i = 0; (buffer = str.charAt(i++)); ~buffer &&
        (bs = bc % 4 ? bs * 64 + buffer : buffer,
        bc++ % 4) ? (output += String.fromCharCode(255 & bs >> (-2 * bc & 6))) : 0) {
        buffer = chars.indexOf(buffer);
    }
    return output;
}

function decryptLink(encryptedString, subStrAt = 0) {
  // First encryption
  let result = encryptedString
    .replace(obfuscationPattern, replacementChar)
    .replace(/pw_.g28x/g, "b")
    .replace(/d2pr.x_27/g, "h");

  if (subStrAt != 0) {
    result = result.substr(subStrAt, result.length - subStrAt);
  }

  if (result.endsWith("=s0") || result.endsWith("=s1600")) {
    result = result.replace("https://2.bp.blogspot.com/", "") + "?";
  }

  // Second encryption
  if (!result.startsWith("https")) {
    const queryIndex = result.indexOf("?");
    const firstStringSubS = result.substring(queryIndex);
    const isS0 = result.includes("=s0?");
    const splitIndex = isS0
      ? result.indexOf("=s0?")
      : result.indexOf("=s1600?");

    // Extract main part
    let mainPart = result.substring(0, splitIndex);

    // Step 1
    mainPart = mainPart.substring(15, 33) + mainPart.substring(50);

    // Step 2
    const len = mainPart.length;
    mainPart =
      mainPart.substring(0, len - 11) + mainPart[len - 2] + mainPart[len - 1];

    // Base64 decode and URL decode
    const decodedBytes = atob(mainPart);
    let decodedStr = decodeURIComponent(decodedBytes);

    // Reconstruct string
    decodedStr = decodedStr.substring(0, 13) + decodedStr.substring(17);
    decodedStr =
      decodedStr.substring(0, decodedStr.length - 2) +
      (isS0 ? "=s0" : "=s1600");

        const domain = detectedBaseUrl ?? (_useServer2 ? "https://ano1.rconet.biz/pic" : "https://2.bp.blogspot.com");

    result = `${domain}/${decodedStr}${firstStringSubS}${_useServer2 ? "&t=10" : ""}`;
  }

  return result;
}

const blocklist = [
  "https://2.bp.blogspot.com/pw/AP1GczP6zCVVfdmN6OoVnm7CLvEfmHMUawyEwJWouX9C6SHwsiuYfLkUr9FsM6Zo34qNzPKeQeahBx9ckBZJQckiJmX1UwKD7uh900yz5rKyG4zT2rfIrqFviEJIev1Pg_pGRuSG57rIH6BDwGCTmiE4MjA",
  "https://2.bp.blogspot.com/pw/AP1GczP48thKMga7cud0tjtHtYqsvZzhYY0HyAxVzM3O1D6tkLbi0fT9NDZFFFH69hNnoGsnqJSEIh4mmpEoU1BJSfNXIz1f5aLXl41RM9os7ePn7ipbrYbIuqiQxAV0hhJZrNLl7FmauwLQ01paCrP6KAE",
  "https://2.bp.blogspot.com/pw/AP1GczNXprTMfAP2AHFFWvCbKq6qReXrqSohz87KeBjV0nh6XoLsE1NpzL7Rp9llxoY208IPARiIDON_TO6dZB0ZMNeB8J7xzUzbS9h6To7aGpOZshFofw-wFQ0KJ3y3wolSwzLrduZZ_0w8_6gGuTEB-98",
  "https://2.bp.blogspot.com/pw/AP1GczMVY_zWeag2n981CRX7jaZ73Sr0NtidtJhnvJ3-Rmh2fIo-PoQRI0ZksQEbpTjDHgBeNYbQ2hQodsY-Dv0FXUhiU_mus5z5L5lMVAH82kXYqOd2IEw",
  "https://2.bp.blogspot.com/pw/AP1GczOKY-6EDGVvlQGB2wj0xxB5JgcyiujFJC3CHgwqBOLIidwmoP6DLiMpX__Fw6MMPvLezN6soeV0A8pKSHUrC4rxZyO5vov40g1g4ipZdkFlzUouAFA",
  "https://2.bp.blogspot.com/pw/AP1GczO8AETT3k19nhJwxHm0sHCSy0tXyhSOYxnq3EUrmlvgY5yPqDaxcd1XZ7reQKH-lKgpGK4o3sW_9Yu6feqii79riXN3Ghi8Xs1S5Z4wi-aeHrq5PzOX"
];

function getCleanedLinks() {
  const cleanLinks = pageLinks.filter((item, index) => {
    if (!item) {
      return false;
    }

    const cleanLink = item.split("?")[0].split("=")[0];
    const isUnique = pageLinks.findIndex(link => link.split("?")[0].split("=")[0] === cleanLink) === index;
    const isNotBlocked = blocklist.indexOf(cleanLink) === -1;
    const matchesPattern = urlPattern.test(cleanLink);
    
    return isUnique && isNotBlocked && matchesPattern;
  });

  return reverseOrder ? cleanLinks.reverse() : cleanLinks;
}

//JSON.stringify(pageLinks);
JSON.stringify(getCleanedLinks());
// Code End

console.log("Count: " + getCleanedLinks().length);

getCleanedLinks().forEach((it, index) => {
  console.log(`Page ${index + 1}: ${it}`)
});

//console.log("test area");
//console.log(decryptLink("-yDnVZDDnEKg/Vk2UbS2x-yI/AAAAAAAAU0o/k0GEC_c2SQ0/s0-Ic42/RCO001.jpg"));
//console.log("Jason: " + JSON.stringify(getCleanedLinks()));