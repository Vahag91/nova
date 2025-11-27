import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();
export const isNavigationReadyRef = { current: false };

export function navigate(name, params) {
  if (isNavigationReadyRef.current && navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
}

