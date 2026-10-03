import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();
export const isNavigationReadyRef = { current: false };
export const ROOT_DRAWER_ROUTE = 'MainDrawer';
export const ROOT_DRAWER_SCREEN_NAMES = new Set([
  'Chat',
  'History',
  'Assistants',
  'Documents',
  'VideoSummaries',
  'Settings',
  'Studio',
]);

export function navigate(name, params) {
  if (isNavigationReadyRef.current && navigationRef.isReady()) {
    if (ROOT_DRAWER_SCREEN_NAMES.has(name)) {
      const nestedParams = params
        ? { screen: name, params }
        : { screen: name };
      navigationRef.navigate(ROOT_DRAWER_ROUTE, nestedParams);
      return;
    }

    navigationRef.navigate(name, params);
  }
}

