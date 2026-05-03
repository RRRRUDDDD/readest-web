import type { Transformer } from './types';

const verticalQuotationsMapHans: Record<string, string> = {
  '“': '﹃',
  '”': '﹄',
  '‘': '﹁',
  '’': '﹂',
  '「': '﹁',
  '」': '﹂',
  '『': '﹃',
  '』': '﹄',
};

const verticalQuotationsMapHant: Record<string, string> = {
  '“': '﹁',
  '”': '﹂',
  '‘': '﹃',
  '’': '﹄',
  '「': '﹁',
  '」': '﹂',
  '『': '﹃',
  '』': '﹄',
};

const quotationsMapHans2Hant = {
  '“': '「',
  '”': '」',
  '‘': '『',
  '’': '』',
  '﹃': '﹁',
  '﹄': '﹂',
  '﹁': '﹃',
  '﹂': '﹄',
};

export const punctuationTransformer: Transformer = {
  name: 'punctuation',

  transform: (ctx) => {
    if (!ctx.viewSettings.replaceQuotationMarks) return ctx.content;

    let result = ctx.content;

    const convertChineseVariant = ctx.viewSettings.convertChineseVariant;
    const reversePunctuationTransform = ctx.reversePunctuationTransform || false;
    const shouldConvertChineseVariants = convertChineseVariant && convertChineseVariant !== 'none';
    if (shouldConvertChineseVariants) {
      for (const [s, t] of Object.entries(quotationsMapHans2Hant)) {
        const shouldReverse = reversePunctuationTransform !== convertChineseVariant.includes('2s');
        const [from, to] = shouldReverse ? [t, s] : [s, t];
        result = result.replace(new RegExp(from, 'g'), to);
      }
    }

    const shouldTransformVertical = ctx.viewSettings.vertical;
    if (shouldTransformVertical) {
      const traditionalChineseLocales = ['zh-Hant', 'zh-TW', 'zh_TW'];
      let punctuationMap: Record<string, string> = verticalQuotationsMapHans;
      if (
        traditionalChineseLocales.includes(ctx.primaryLanguage || '') ||
        traditionalChineseLocales.includes(ctx.userLocale)
      ) {
        punctuationMap = verticalQuotationsMapHant;
      }
      for (const [original, vertical] of Object.entries(punctuationMap)) {
        if (ctx.reversePunctuationTransform) {
          result = result.replace(new RegExp(vertical, 'g'), original);
        } else {
          result = result.replace(new RegExp(original, 'g'), vertical);
        }
      }
    }

    return result;
  },
};
