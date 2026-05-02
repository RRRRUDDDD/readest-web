import { getAPIBaseUrl } from '@/services/environment';
import { stubTranslation as _ } from '@/utils/misc';
import { TranslationProvider } from '../types';
import { normalizeToShortLang } from '@/utils/lang';
import { saveDailyUsage } from '../utils';

const DEEPL_API_ENDPOINT = getAPIBaseUrl() + '/deepl/translate';

export const deeplProvider: TranslationProvider = {
  name: 'deepl',
  label: _('DeepL'),
  authRequired: true,
  quotaExceeded: false,
  translate: async (
    text: string[],
    sourceLang: string,
    targetLang: string,
    token?: string | null,
    useCache: boolean = false,
  ): Promise<string[]> => {
    const authRequired = deeplProvider.authRequired;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (authRequired && !token) {
      throw new Error('Authentication token is required for DeepL translation');
    }

    const normalizedSourceLang = normalizeToShortLang(sourceLang).toUpperCase();
    const body = JSON.stringify({
      text: text,
      ...(normalizedSourceLang !== 'AUTO' ? { source_lang: normalizedSourceLang } : {}),
      target_lang: normalizeToShortLang(targetLang).toUpperCase(),
      use_cache: useCache,
    });

    try {
      const response = await fetch(DEEPL_API_ENDPOINT, { method: 'POST', headers, body });

      if (!response.ok) {
        throw new Error(`Translation failed with status ${response.status}`);
      }

      const data = await response.json();
      if (!data || !data.translations) {
        throw new Error('Invalid response from translation service');
      }

      return text.map((line, i) => {
        if (!line?.trim().length) {
          return line;
        }
        const translation = data.translations?.[i];
        if (translation?.daily_usage) {
          saveDailyUsage(translation.daily_usage);
        }
        return translation?.text || line;
      });
    } catch (error) {
      throw error;
    }
  },
};
