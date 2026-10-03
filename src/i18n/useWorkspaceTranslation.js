import { useTranslation } from 'react-i18next';

// Workspace copy lives under `workspace` in every locale catalog, so it shares
// the app's translation pipeline, localization audit and lazy locale loading.
export function useWorkspaceTranslation() {
  const { t, i18n } = useTranslation();
  const c = (key, fallback, values = {}) =>
    t(`workspace.${key}`, { defaultValue: fallback, ...values });
  return { c, i18n };
}
