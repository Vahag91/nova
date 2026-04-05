import React, { createContext, useContext } from 'react';

const AndroidNavigationMenuContext = createContext({
  openMenu: () => {},
  closeMenu: () => {},
  reportScreenReady: () => {},
  isAvailable: false,
});

export function AndroidNavigationMenuProvider({ value, children }) {
  return (
    <AndroidNavigationMenuContext.Provider value={value}>
      {children}
    </AndroidNavigationMenuContext.Provider>
  );
}

export function useAndroidNavigationMenu() {
  return useContext(AndroidNavigationMenuContext);
}
