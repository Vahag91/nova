// app/i18n/index.js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ICU from 'i18next-icu';
import * as RNLocalize from 'react-native-localize';

import en from './locales/en.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import es from './locales/es.json';
import pt from './locales/pt.json';
import it from './locales/it.json';
import ja from './locales/ja.json';  
import nl from './locales/nl.json'; 
import ar from './locales/ar.json';
import ca from './locales/ca.json';
import cs from './locales/cs.json';
import da from './locales/da.json';
import el from './locales/el.json';
import fi from './locales/fi.json';
import he from './locales/he.json';
import hi from './locales/hi.json';
import hr from './locales/hr.json';
import hu from './locales/hu.json';
import id from './locales/id.json';
import ko from './locales/ko.json';
import ms from './locales/ms.json';
import nb from './locales/nb.json';
import pl from './locales/pl.json';
import ro from './locales/ro.json';
import ru from './locales/ru.json';
import sk from './locales/sk.json';
import sv from './locales/sv.json';
import th from './locales/th.json';
import tr from './locales/tr.json';
import uk from './locales/uk.json';
import vi from './locales/vi.json';
import esMX from './locales/es-MX.json';
import frCA from './locales/fr-CA.json';
import zhHans from './locales/zh-Hans.json';
import zhHant from './locales/zh-Hant.json';

const SUPPORTED = [
  'en','de','fr','es','pt','it','ja','nl',
  'ar','ca','cs','da','el','fi','he','hi','hr','hu','id','ko','ms','nb','pl','ro','ru','sk','sv','th','tr','uk','vi',
  'es-MX','fr-CA','zh-Hans','zh-Hant'
];

const getDeviceLanguage = () => {
  // Prefer RNLocalize best match
  if (typeof RNLocalize.findBestAvailableLanguage === 'function') {
    const best = RNLocalize.findBestAvailableLanguage(SUPPORTED);
    if (best?.languageTag && SUPPORTED.includes(best.languageTag)) {
      return best.languageTag;
    }
  }

  // Fallback: iterate device locales and try full tag → script tag → base code
  const locales = typeof RNLocalize.getLocales === 'function' ? RNLocalize.getLocales() : [];
  for (const l of locales) {
    const full = String(l?.languageTag || ''); // e.g., 'es-MX', 'fr-CA', 'zh-Hans-CN'
    if (SUPPORTED.includes(full)) return full;

    // Map Chinese script variants if present in tag
    if (full.startsWith('zh-')) {
      if (full.toLowerCase().includes('hans') && SUPPORTED.includes('zh-Hans')) return 'zh-Hans';
      if (full.toLowerCase().includes('hant') && SUPPORTED.includes('zh-Hant')) return 'zh-Hant';
    }

    const base = String(l?.languageCode || '').toLowerCase(); // e.g., 'es', 'fr', 'zh'
    if (SUPPORTED.includes(base)) return base;
  }

  return 'en';
};

i18n
  .use(ICU) // works as-is; see note below if you want locale data per lang
  .use(initReactI18next)
  .init({
    resources: {
      en:{translation:en}, de:{translation:de}, fr:{translation:fr},
      es:{translation:es}, pt:{translation:pt}, it:{translation:it},
      ja:{translation:ja}, nl:{translation:nl}, ar:{translation:ar},
      ca:{translation:ca}, cs:{translation:cs}, da:{translation:da},
      el:{translation:el}, fi:{translation:fi}, he:{translation:he},
      hi:{translation:hi}, hr:{translation:hr}, hu:{translation:hu},
      id:{translation:id}, ko:{translation:ko}, ms:{translation:ms},
      nb:{translation:nb}, pl:{translation:pl}, ro:{translation:ro},
      ru:{translation:ru}, sk:{translation:sk}, sv:{translation:sv},
      th:{translation:th}, tr:{translation:tr}, uk:{translation:uk},
      vi:{translation:vi},
      "es-MX":{translation:esMX}, "fr-CA":{translation:frCA},
      "zh-Hans":{translation:zhHans}, "zh-Hant":{translation:zhHant},
    },
    lng: getDeviceLanguage(),
    fallbackLng: 'en',
    supportedLngs: SUPPORTED,
    nonExplicitSupportedLngs: true,
    lowerCaseLng: false, // keep case for script/region tags (e.g., es-MX, fr-CA, zh-Hans)
    debug: __DEV__,
    interpolation: { escapeValue: false },
    returnNull: false,
  });

export default i18n;
