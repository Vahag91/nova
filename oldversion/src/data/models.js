import { LightColors } from '../styles/colors.js';

export const AI_MODELS = [
  {
    id: 'starlight-pro',
    name: 'Starlight Pro',
    description: 'Advanced reasoning and complex tasks',
    icon: 'auto_awesome',
    color: LightColors.primary,
    gradient: [LightColors.primary, LightColors.accent],
  },
  {
    id: 'nebula-creative',
    name: 'Nebula Creative',
    description: 'Imaginative storytelling & art',
    icon: 'magic_button',
    color: LightColors.accent,
    gradient: [LightColors.accent, LightColors.primary],
  },
  {
    id: 'quick-converse',
    name: 'Quick Converse',
    description: 'Everyday conversations & tasks',
    icon: 'chat_bubble',
    color: LightColors.gray[500],
    gradient: [LightColors.gray[400], LightColors.gray[500]],
  },
];
