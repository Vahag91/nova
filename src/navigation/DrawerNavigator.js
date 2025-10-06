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
import CustomDrawerContent from './CustomDrawerContent';
import { useThreadsStore } from '../state/useThreadsStore';
import { useSettingsStore } from '../state/useSettingsStore';
import { colors } from '../styles/colors';
import { useTranslation } from 'react-i18next';

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
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: isPrivate ? colors.primary : colors.surface,
        borderRadius: 14,
        marginBottom: 14,
      }}
      onPress={handlePrivateChat}
    >
      <SvgIcon 
        name="lock" 
        size={22} 
        color="#FFFFFF" 
      />
    </TouchableOpacity>
  );
}

// Header right component for new chat button
function HistoryHeaderRight({ navigation }) {
  const { t } = useTranslation();
  const createThread = useThreadsStore(s => s.createThread);
  const setActiveThread = useThreadsStore(s => s.setActiveThread);

  const handleNewChat = () => {
    Haptic.trigger('impactLight');
    const th = createThread({ title: t('history.newChat') });
    setActiveThread(th.id);
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
  const { t } = useTranslation();
  return (
    <NavigationContainer>
      <Drawer.Navigator 
        initialRouteName="Chat"
        drawerContent={(props) => <CustomDrawerContent {...props} />}
        screenOptions={{
          headerStyle: {
            backgroundColor: '#000000',
            borderBottomWidth: 0,
          },
          headerTintColor: colors.text,
          headerTitleStyle: {
            color: colors.text,
            fontFamily: 'Lato-Bold',
          },
          drawerStyle: {
            backgroundColor: colors.background,
            width: 280,
          },
          drawerActiveTintColor: colors.accent,
          drawerInactiveTintColor: colors.textSecondary,
          drawerType: 'slide',
          swipeEnabled: true,
          swipeEdgeWidth: 50,
        }}
      >
        <Drawer.Screen 
          name="Chat" 
          component={Chat}
          options={({ navigation }) => ({
            headerTitle: () => <ChatHeaderCenter />,
            headerRight: () => <ChatHeaderRight />,
            headerLeft: () => (
              <TouchableOpacity 
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  backgroundColor: colors.surface,
                  borderRadius: 14,
                  marginBottom: 14,
                }}
                onPress={() => navigation.toggleDrawer()}
              >
                <SvgIcon name="menu" size={22} color={colors.text} />
              </TouchableOpacity>
            ),
          })}
        />
        <Drawer.Screen 
          name="History" 
          component={History}
          options={({ navigation }) => ({
            headerTitle: t('navigation.history'),
            headerRight: () => <HistoryHeaderRight navigation={navigation} />,
          })}
        />
        <Drawer.Screen name="Assistants" component={Assistants} options={{ title: t('navigation.assistants') }} />
        <Drawer.Screen name="Settings" component={Settings} options={{ title: t('navigation.settings') }} />
        <Drawer.Screen 
          name="ImagesStudio" 
          component={ImagesStudio}
          options={{
            headerShown: false, // Hide navigation header completely
            title: t('navigation.imagesStudio'),
          }}
        />
      </Drawer.Navigator>
    </NavigationContainer>
  );
}


