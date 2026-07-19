import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import nl from './nl.json'
import en from './en.json'
import srn from './srn.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      nl: { translation: nl },
      en: { translation: en },
      // Sranantongo — draft translation, native-speaker review pending.
      // Speakers read Dutch, so missing keys fall back nl → en.
      srn: { translation: srn },
    },
    fallbackLng: {
      srn: ['nl', 'en'],
      default: ['nl'],
    },
    supportedLngs: ['nl', 'en', 'srn'],
    interpolation: {
      escapeValue: false, // React handles XSS escaping
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'josbin_pos_locale',
    },
  })

export default i18n

// Instant language switch without reload — called from settings screen
export function switchLanguage(locale: 'nl' | 'en') {
  i18n.changeLanguage(locale)
  localStorage.setItem('josbin_pos_locale', locale)
}
