import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import StudioHome from '../screens/StudioHome.jsx';
import CreateImage from '../screens/CreateImage.jsx';
import EditImage from '../screens/EditImage.jsx';
import CoinStore from '../screens/CoinStore.jsx';

const Stack = createNativeStackNavigator();

export default function StudioStack() {
  return (
    <Stack.Navigator
      initialRouteName="StudioHome"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: true,
      }}
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
