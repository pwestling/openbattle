/**
 * Text helpers. The app has one language for now (English): these fill
 * `{name}` placeholders and pick a plural, so code can keep writing
 * `t("Send to {name}", { name })` and `tn(n, "{n} model", "{n} models")`.
 * Translation catalogs were dropped with the old UI; bring a lookup back here
 * when there is a UI worth translating.
 */
type Params = Record<string, string | number>;

const fill = (text: string, params?: Params): string =>
  params ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m)) : text;

/** A UI string. `{name}` placeholders are filled from `params`. */
export function t(text: string, params?: Params): string {
  return fill(text, params);
}
