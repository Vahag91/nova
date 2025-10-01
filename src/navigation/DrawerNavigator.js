import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createDrawerNavigator} from '@react-navigation/drawer';
import { TouchableOpacity, Text } from 'react-native';
import Haptic from 'react-native-haptic-feedback';
import Chat from '../screens/Chat';
import History from '../screens/HistorySimple';
import Assistants from '../screens/Assistants';
import Settings from '../screens/Settings.jsx';
import ImagesStudio from '../screens/ImagesStudio';
import ModelSelector from '../components/ModelSelector';
import SvgIcon from '../components/SvgIcon';
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
        {paddingHorizontal:10, paddingVertical:6}
      ]}
      onPress={handlePrivateChat}
    >
      <SvgIcon 
        name="lock" 
        size={20} 
        color="#FFFFFF" 
      />
    </TouchableOpacity>
  );
}

// Header right component for new chat button
function HistoryHeaderRight({ navigation }) {
  const createThread = useThreadsStore(s => s.createThread);
  const setActiveThread = useThreadsStore(s => s.setActiveThread);

  const handleNewChat = () => {
    Haptic.trigger('impactLight');
    const t = createThread({ title: 'New chat' });
    setActiveThread(t.id);
    navigation?.navigate?.('Chat');
  };

  return (
    <TouchableOpacity 
      style={{
        paddingHorizontal: 16,
        paddingVertical: 6,
      }}
      onPress={handleNewChat}
    >
      <SvgIcon name="newchat" size={24} color={colors.text} />
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
            backgroundColor: '#000000',
          },
          headerTintColor: colors.text,
          headerTitleStyle: {
            color: colors.text,
          },
          drawerStyle: {
            backgroundColor: '#000000',
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
        <Drawer.Screen 
          name="History" 
          component={History}
          options={({ navigation }) => ({
            headerTitle: 'Chats History',
            headerRight: () => <HistoryHeaderRight navigation={navigation} />,
          })}
        />
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


