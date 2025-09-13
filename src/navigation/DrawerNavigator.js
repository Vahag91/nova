import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createDrawerNavigator} from '@react-navigation/drawer';
import { TouchableOpacity, Text } from 'react-native';
import Chat from '../screens/Chat';
import History from '../screens/HistorySimple';
import Assistants from '../screens/Assistants';
import Settings from '../screens/Settings.jsx';
import { useThreadsStore } from '../state/useThreadsStore';
import { colors } from '../styles/colors';

const Drawer = createDrawerNavigator();

// Header right component for private chat toggle
function ChatHeaderRight() {
  const isPrivate = useThreadsStore(s => s.privateActive);
  const startPrivate = useThreadsStore(s => s.startPrivate);
  const endPrivate = useThreadsStore(s => s.endPrivate);
  const model = useThreadsStore(s => s.model);

  const onTogglePrivate = () => {
    if (!isPrivate) {
      startPrivate(model);
    } else {
      endPrivate();
    }
  };

  return (
    <TouchableOpacity onPress={onTogglePrivate} style={{paddingHorizontal:10, paddingVertical:6, borderWidth:1, borderColor: colors.border, borderRadius:12, backgroundColor: colors.surface}}>
      <Text style={{fontSize:12, fontWeight:'600', color: colors.textSecondary}}>
        {isPrivate ? 'Normal' : 'Private'}
      </Text>
    </TouchableOpacity>
  );
}

export default function DrawerNavigator() {
  return (
    <NavigationContainer>
      <Drawer.Navigator 
        initialRouteName="Chat"
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.headerBackground,
          },
          headerTintColor: colors.text,
          headerTitleStyle: {
            color: colors.text,
          },
          drawerStyle: {
            backgroundColor: colors.surface,
          },
          drawerActiveTintColor: colors.primary,
          drawerInactiveTintColor: colors.textSecondary,
        }}
      >
        <Drawer.Screen 
          name="Chat" 
          component={Chat}
          options={{
            headerRight: () => <ChatHeaderRight />,
          }}
        />
        <Drawer.Screen name="History" component={History} />
        <Drawer.Screen name="Assistants" component={Assistants} />
        <Drawer.Screen name="Settings" component={Settings} />
      </Drawer.Navigator>
    </NavigationContainer>
  );
}


