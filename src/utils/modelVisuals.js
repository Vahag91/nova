// Shared helpers for presenting image model information.
import i18n from '../i18n';

const translate = (key, fallback) => i18n.t(key, { defaultValue: fallback });

export function hexToRgba(hex, alpha) {
  if (!hex) return `rgba(124,92,255,${alpha})`;
  let value = hex.trim().replace('#', '');
  if (value.length === 3) {
    value = value
      .split('')
      .map(ch => ch + ch)
      .join('');
  }
  if (value.length !== 6) return `rgba(124,92,255,${alpha})`;
  const num = parseInt(value, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export function formatModelProvider(provider) {
  if (!provider) return translate('studioCommon.models.custom', 'Custom');
  return provider
    .split(/[-_]/g)
    .map(part => (part ? part[0].toUpperCase() + part.slice(1) : ''))
    .join(' ');
}

export function getModelVisuals(provider, modelKey) {
  const key = (modelKey || '').toLowerCase();
  if ((provider || '').toLowerCase() === 'flux-kontent') {
    return {
      icon: 'flux-schnell',
      accent: '#5C6CFF',
      tagline: translate('studioCommon.modelTaglines.fluxKontent', 'Flux Kontent tuned for edits'),
    };
  }
  switch (key) {
    case 'runware-flux-schnell':
      return {
        icon: 'flux-schnell',
        accent: '#4B5BFF',
        tagline: translate('studioCommon.modelTaglines.runwareFluxSchnell', 'Fastest model'),
      };
    case 'runware-flux-krea':
      return {
        icon: 'krea',
        accent: '#FF7A9E',
        tagline: translate('studioCommon.modelTaglines.runwareFluxKrea', 'Creative, stylized results'),
      };
    case 'runware-qwen-image':
      return {
        icon: 'qwen-image',
        accent: '#665CEE',
        tagline: translate('studioCommon.modelTaglines.runwareQwenImage', 'Balanced, high-quality results'),
      };
    case 'google:4@1':
      return {
        icon: 'nano-banana',
        accent: '#F8C95F',
        tagline: translate('studioCommon.modelTaglines.google4', 'Best AI image model'),
      };
    default:
      break;
  }

  switch ((provider || '').toLowerCase()) {
    case 'runware':
      return {
        icon: 'layers',
        accent: '#7C5CFF',
        tagline: translate('studioCommon.modelTaglines.runwareProvider', 'Balanced quality with reliable diffusion.'),
      };
    case 'air':
      return {
        icon: 'banana',
        accent: '#F5B93E',
        tagline: translate('studioCommon.modelTaglines.airProvider', 'Nano Banana adds playful, vivid tone.'),
      };
    case 'google':
      return {
        icon: 'globe-grid',
        accent: '#3DA8FD',
        tagline: translate('studioCommon.modelTaglines.googleProvider', 'Google tuned for polished details.'),
      };
    case 'anthropic':
      return {
        icon: 'insights',
        accent: '#8895FF',
        tagline: translate('studioCommon.modelTaglines.anthropicProvider', 'Claude pipeline for nuanced moods.'),
      };
    default:
      return {
        icon: 'stars',
        accent: '#6F7AFF',
        tagline: translate('studioCommon.modelTaglines.default', 'Tap to explore available engines.'),
      };
  }
}
