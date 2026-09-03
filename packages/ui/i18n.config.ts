// vue-i18n runtime options (auto-scanned by @nuxtjs/i18n when `vueI18n` is
// left unset in nuxt.config).
//
// Message fallback: locales other than en/zh resolve missing keys to English
// instead of rendering the raw key. The fork-only preferred-ip surface (ADR
// 0001) ships complete en+zh copy; fr/ja/ko/ru/fa are intentionally not
// translated for it and lean on this fallback.
export default defineI18nConfig(() => ({
  fallbackLocale: 'en',
}))
