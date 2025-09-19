import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createDrawerNavigator} from '@react-navigation/drawer';
import { TouchableOpacity, Text } from 'react-native';
import Chat from '../screens/Chat';
import History from '../screens/HistorySimple';
import Assistants from '../screens/Assistants';
import Settings from '../screens/Settings.jsx';
import ImagesStudio from '../screens/ImagesStudio';
import ModelSelector from '../components/ModelSelector';
import { useThreadsStore } from '../state/useThreadsStore';
import { useSettingsStore } from '../state/useSettingsStore';
import { colors } from '../styles/colors';

const Drawer = createDrawerNavigator();

// Header center component for model dropdown
function ChatHeaderCenter() {
  return <ModelSelector />;
}

// Header right component for private chat button
function ChatHeaderRight() {
  const isPrivate = useThreadsStore(s => s.privateActive);
  const startPrivate = useThreadsStore(s => s.startPrivate);
  const endPrivate = useThreadsStore.getState().endPrivate;
  const model = useSettingsStore(s => s.model);

  const handlePrivateChat = () => {
    if (isPrivate) {
      endPrivate();
    } else {
      startPrivate(model);
    }
  };

  return (
    <TouchableOpacity 
      style={[
        {paddingHorizontal:10, paddingVertical:6, borderWidth:1, borderColor: colors.border, borderRadius:12, backgroundColor: colors.surface},
        isPrivate && {backgroundColor: colors.primary, borderColor: colors.primary}
      ]}
      onPress={handlePrivateChat}
    >
      <Text style={{fontSize:16, color: colors.textSecondary}}>🔒</Text>
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
            headerTitle: () => <ChatHeaderCenter />,
            headerRight: () => <ChatHeaderRight />,
          }}
        />
        <Drawer.Screen name="History" component={History} />
        <Drawer.Screen name="Assistants" component={Assistants} />
        <Drawer.Screen name="Settings" component={Settings} />
        <Drawer.Screen 
          name="ImagesStudio" 
          component={ImagesStudio}
          options={{
            headerShown: false, // Hide navigation header completely
            drawerItemStyle: { display: 'none' }, // Hide from drawer menu
          }}
        />
      </Drawer.Navigator>
    </NavigationContainer>
  );
}


