import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import RewardsHome from '../screens/Rewards';
import RewardsList from '../components/rewards/RewardsList';
import RewardsHeader from '../components/rewards/Header';

const Stack = createNativeStackNavigator();

export default function RewardsStack() {
  return (
    <Stack.Navigator
      initialRouteName="RewardsHome"
      screenOptions={{
        headerShown: true,
        animation: 'slide_from_right',
        gestureEnabled: true,
        header: () => <RewardsHeader />,
      }}
    >
      <Stack.Screen 
        name="RewardsHome" 
        component={RewardsHome}
        options={{
          header: () => <RewardsHeader />,
        }}
      />
      <Stack.Screen 
        name="RewardsList" 
        component={RewardsList} 
        options={{ 
          animation: 'slide_from_right',
          headerShown: true,
          header: () => <RewardsHeader />,
        }} 
      />
    </Stack.Navigator>
  );
}

