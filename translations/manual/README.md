# Manual translation handoff

Each locale in `pending/` contains **only the messages that still need translation**.

1. Open `reference/<locale>.en.json` for the matching English source text.
2. Replace every empty string in `pending/<locale>.json` with the translation.
3. Do not rename, remove, or add keys; preserve placeholders such as `{{name}}`, URLs, and product/model names.
4. When a locale file has no empty values, run `npm run i18n:apply-manual -- --locale <locale>`, for example `npm run i18n:apply-manual -- --locale nl`. The command validates placeholders, merges the text into the actual app catalog, and removes obsolete keys. Run `npm run i18n:apply-manual` only when every pending locale is complete.

Existing translated values in `src/i18n/locales/` are intentionally left untouched until their matching pending file is complete.
