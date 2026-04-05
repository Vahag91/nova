import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import StudioHome from '../screens/StudioHome.jsx';
import CreateImage from '../screens/CreateImage.jsx';
import EditImage from '../screens/EditImage.jsx';
import CoinStore from '../screens/CoinStore.jsx';
import { perfLog } from '../lib/perfTrace';

const Stack = createNativeStackNavigator();

export default function StudioStack() {
  return (
    <Stack.Navigator
      id="StudioStack"
      initialRouteName="StudioHome"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: true,
      }}
      screenListeners={({ route }) => ({
        focus: () => {
          perfLog('studio.stack.focus', {
            routeName: route.name,
          });
        },
        blur: () => {
          perfLog('studio.stack.blur', {
            routeName: route.name,
          });
        },
        transitionStart: (e) => {
          perfLog('studio.stack.transition:start', {
            routeName: route.name,
            closing: !!e.data?.closing,
          });
        },
        transitionEnd: (e) => {
          perfLog('studio.stack.transition:end', {
            routeName: route.name,
            closing: !!e.data?.closing,
          });
        },
        state: (e) => {
          const state = e.data?.state;
          const activeRoute = state?.routes?.[state.index]?.name || route.name;
          perfLog('studio.stack.state', {
            routeName: activeRoute,
            index: state?.index ?? null,
            routes: state?.routes?.length ?? null,
          });
        },
      })}
    >
      <Stack.Screen name="StudioHome" component={StudioHome} />
      <Stack.Screen name="CreateImage" component={CreateImage} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="EditImage" component={EditImage} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen
        name="CoinStore"
        component={CoinStore}
        options={{
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
          headerShown: false,
          gestureEnabled: true,
        }}
      />
    </Stack.Navigator>
  );
}
