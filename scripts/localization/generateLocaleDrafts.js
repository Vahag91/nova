/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const LOCALES_DIR = path.join(ROOT, 'src', 'i18n', 'locales');
const ENGLISH_PATH = path.join(LOCALES_DIR, 'en.json');

const TARGETS = {
  af: 'af',
  sq: 'sq',
  am: 'am',
  hy: 'hy',
  az: 'az',
  bn: 'bn',
  eu: 'eu',
  be: 'be',
  bg: 'bg',
  my: 'my',
  et: 'et',
  fil: 'fil',
  gl: 'gl',
  ka: 'ka',
  gu: 'gu',
  is: 'is',
  kn: 'kn',
  kk: 'kk',
  km: 'km',
  ky: 'ky',
  lo: 'lo',
  lv: 'lv',
  lt: 'lt',
  mk: 'mk',
  ml: 'ml',
  mr: 'mr',
  mn: 'mn',
  ne: 'ne',
  fa: 'fa',
  pa: 'pa',
  rm: 'rm',
  sr: 'sr',
  si: 'si',
  sl: 'sl',
  sw: 'sw',
  ta: 'ta',
  te: 'te',
  ur: 'ur',
  as: 'as',
  bs: 'bs',
  or: 'or',
  uz: 'uz',
  zu: 'zu',
  ha: 'ha',
  yo: 'yo',
  ig: 'ig',
  'sr-Latn': 'sr',
  'pt-BR': 'pt',
  'pt-PT': 'pt',
  'es-419': 'es',
  'fa-AF': 'fa',
};

const EXISTING_TARGETS = {
  ar: 'ar', ca: 'ca', cs: 'cs', da: 'da', de: 'de', el: 'el',
  'es-MX': 'es', es: 'es', fi: 'fi', 'fr-CA': 'fr', fr: 'fr', he: 'he',
  hi: 'hi', hr: 'hr', hu: 'hu', id: 'id', it: 'it', ja: 'ja', ko: 'ko',
  ms: 'ms', nb: 'no', nl: 'nl', pl: 'pl', pt: 'pt', ro: 'ro', ru: 'ru',
  sk: 'sk', sv: 'sv', th: 'th', tr: 'tr', uk: 'uk', vi: 'vi',
  'zh-Hans': 'zh-CN', 'zh-Hant': 'zh-TW',
};

const PROTECTED_TERMS = [
  'Chat Cloud',
  'ChatCloud',
  'Image Studio',
  'OpenAI',
  'ChatGPT',
  'GPT',
  'Claude',
  'Gemini',
  'DeepSeek',
  'Grok',
  'RevenueCat',
  'Google Play',
];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function normalizeDecimalDigits(value) {
  return String(value).replace(/[\u0660-\u0669\u06F0-\u06F9\u0966-\u096F\u09E6-\u09EF\u0A66-\u0A6F\u0AE6-\u0AEF\u0B66-\u0B6F\u0BE6-\u0BEF\u0C66-\u0C6F\u0CE6-\u0CEF\u0D66-\u0D6F\u0E50-\u0E59\u0ED0-\u0ED9\u1040-\u1049]/g, character => {
    const codePoint = character.codePointAt(0);
    const starts = [0x0660, 0x06F0, 0x0966, 0x09E6, 0x0A66, 0x0AE6, 0x0B66, 0x0BE6, 0x0C66, 0x0CE6, 0x0D66, 0x0E50, 0x0ED0, 0x1040];
    const start = starts.find(candidate => codePoint >= candidate && codePoint <= candidate + 9);
    return start == null ? character : String(codePoint - start);
  });
}

function flattenStrings(value, prefix = [], output = []) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => flattenStrings(entry, [...prefix, index], output));
  } else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, entry]) =>
      flattenStrings(entry, [...prefix, key], output),
    );
  } else if (typeof value === 'string') {
    output.push({ path: prefix, value });
  }
  return output;
}

function setAtPath(target, segments, value) {
  let node = target;
  for (let index = 0; index < segments.length - 1; index += 1) {
    node = node[segments[index]];
  }
  node[segments[segments.length - 1]] = value;
}

function getAtPath(target, segments) {
  let node = target;
  for (const segment of segments) {
    if (node == null || !Object.prototype.hasOwnProperty.call(node, segment)) {
      return undefined;
    }
    node = node[segment];
  }
  return node;
}

function protectText(value) {
  let protectedText = value;
  const replacements = [];
  const protect = match => {
    const token = `⟬P${String(replacements.length).padStart(3, '0')}⟭`;
    replacements.push([token, match]);
    return token;
  };

  protectedText = protectedText.replace(/\{\{[^{}]+\}\}/g, protect);
  protectedText = protectedText.replace(/https?:\/\/\S+/g, protect);
  for (const term of PROTECTED_TERMS) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    protectedText = protectedText.replace(new RegExp(escaped, 'gi'), protect);
  }
  return { protectedText, replacements };
}

function restoreText(value, replacements) {
  let restored = value;
  for (const [token, original] of replacements) {
    const number = token.match(/\d+/)?.[0];
    const flexibleToken = `⟬\\s*P\\s*${number}\\s*⟭`;
    restored = restored.replace(new RegExp(flexibleToken, 'g'), original);
  }
  return restored.trim();
}

const SERBIAN_LATIN_MAP = {
  А: 'A', а: 'a', Б: 'B', б: 'b', В: 'V', в: 'v', Г: 'G', г: 'g',
  Д: 'D', д: 'd', Ђ: 'Đ', ђ: 'đ', Е: 'E', е: 'e', Ж: 'Ž', ж: 'ž',
  З: 'Z', з: 'z', И: 'I', и: 'i', Ј: 'J', ј: 'j', К: 'K', к: 'k',
  Л: 'L', л: 'l', Љ: 'Lj', љ: 'lj', М: 'M', м: 'm', Н: 'N', н: 'n',
  Њ: 'Nj', њ: 'nj', О: 'O', о: 'o', П: 'P', п: 'p', Р: 'R', р: 'r',
  С: 'S', с: 's', Т: 'T', т: 't', Ћ: 'Ć', ћ: 'ć', У: 'U', у: 'u',
  Ф: 'F', ф: 'f', Х: 'H', х: 'h', Ц: 'C', ц: 'c', Ч: 'Č', ч: 'č',
  Џ: 'Dž', џ: 'dž', Ш: 'Š', ш: 'š',
};

function postprocessLocaleText(locale, value) {
  if (locale !== 'sr-Latn') return value;
  return [...value].map(character => SERBIAN_LATIN_MAP[character] || character).join('');
}

function makeBatches(entries, maxCharacters = 3600) {
  const batches = [];
  let current = [];
  let length = 0;
  for (const entry of entries) {
    const estimated = entry.protectedText.length + 24;
    if (current.length > 0 && length + estimated > maxCharacters) {
      batches.push(current);
      current = [];
      length = 0;
    }
    current.push(entry);
    length += estimated;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

async function requestTranslationDirection(
  text,
  sourceLanguage,
  targetLanguage,
  attempt = 0,
) {
  const query = new URLSearchParams({
    client: 'gtx',
    sl: sourceLanguage,
    tl: targetLanguage,
    dt: 't',
    q: text,
  });
  try {
    const response = await fetch(
      `https://translate.googleapis.com/translate_a/single?${query}`,
      { headers: { 'User-Agent': 'ChatCloud-localization-audit/1.0' } },
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    return (payload[0] || []).map(segment => segment[0] || '').join('');
  } catch (error) {
    if (attempt >= 4) throw error;
    await sleep(750 * 2 ** attempt);
    return requestTranslationDirection(
      text,
      sourceLanguage,
      targetLanguage,
      attempt + 1,
    );
  }
}

const requestTranslation = (text, targetLanguage) =>
  requestTranslationDirection(text, 'en', targetLanguage);

async function translateBatch(batch, targetLanguage) {
  const source = batch
    .map((entry, index) => `991234567${String(index).padStart(4, '0')}\n${entry.protectedText}`)
    .join('\n');
  const translated = await requestTranslation(source, targetLanguage);
  const marker = /991234567(\d{4})/g;
  const normalizedTranslation = normalizeDecimalDigits(translated);
  const matches = [...normalizedTranslation.matchAll(marker)];
  if (matches.length !== batch.length) {
    // Some translation engines rewrite or drop a marker when it is adjacent to
    // model/version syntax. Retry smaller groups to isolate that entry; a single
    // entry needs no marker at all.
    if (batch.length === 1) {
      const only = batch[0];
      const direct = await requestTranslation(only.protectedText, targetLanguage);
      return [restoreText(direct, only.replacements)];
    }
    const middle = Math.ceil(batch.length / 2);
    const first = await translateBatch(batch.slice(0, middle), targetLanguage);
    const second = await translateBatch(batch.slice(middle), targetLanguage);
    return [...first, ...second];
  }

  return batch.map((entry, index) => {
    const start = matches[index].index + matches[index][0].length;
    const end = matches[index + 1]?.index ?? normalizedTranslation.length;
    const value = normalizedTranslation.slice(start, end).trim();
    return restoreText(value, entry.replacements);
  });
}

async function generateLocale(locale, targetLanguage, english) {
  const outputPath = path.join(LOCALES_DIR, `${locale}.json`);
  const isSync = process.argv.includes('--sync-existing');
  if (fs.existsSync(outputPath) && !process.argv.includes('--overwrite') && !isSync) {
    console.log(`skip ${locale}: already exists`);
    return;
  }

  const output = structuredClone(english);
  const existing = fs.existsSync(outputPath)
    ? JSON.parse(fs.readFileSync(outputPath, 'utf8'))
    : null;
  const allEntries = flattenStrings(english);
  const entries = allEntries.filter(entry => {
    if (!isSync || !existing) return true;
    const existingValue = getAtPath(existing, entry.path);
    if (typeof existingValue !== 'string') return true;
    setAtPath(output, entry.path, existingValue);
    return false;
  }).map(entry => ({
    ...entry,
    ...protectText(entry.value),
  }));
  if (entries.length === 0) {
    fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
    console.log(`${locale}: already synchronized`);
    return;
  }
  const batches = makeBatches(entries);
  let completed = 0;
  for (const batch of batches) {
    const translations = await translateBatch(batch, targetLanguage);
    batch.forEach((entry, index) =>
      setAtPath(output, entry.path, postprocessLocaleText(locale, translations[index])),
    );
    completed += batch.length;
    console.log(`${locale}: ${completed}/${entries.length}`);
    await sleep(125);
  }

  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
}

async function main() {
  const requested = process.argv.filter(arg => !arg.startsWith('--')).slice(2);
  const targetMap = process.argv.includes('--sync-existing')
    ? { ...EXISTING_TARGETS, ...TARGETS }
    : TARGETS;
  const locales = requested.length > 0
    ? requested
    : process.argv.includes('--sync-existing')
      ? Object.keys(EXISTING_TARGETS)
      : Object.keys(TARGETS);
  const english = JSON.parse(fs.readFileSync(ENGLISH_PATH, 'utf8'));

  for (const locale of locales) {
    if (!targetMap[locale]) throw new Error(`Unknown target locale: ${locale}`);
    await generateLocale(locale, targetMap[locale], english);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  EXISTING_TARGETS,
  TARGETS,
  flattenStrings,
  getAtPath,
  makeBatches,
  protectText,
  requestTranslation,
  requestTranslationDirection,
  normalizeDecimalDigits,
  restoreText,
  setAtPath,
};
