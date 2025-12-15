// src/lib/testFirebasePush.js
import messaging from '@react-native-firebase/messaging';

export async function initPush() {
  // iOS: make sure device is registered before getting token
  await messaging().registerDeviceForRemoteMessages();

  const status = await messaging().requestPermission();
  const enabled =
    status === messaging.AuthorizationStatus.AUTHORIZED ||
    status === messaging.AuthorizationStatus.PROVISIONAL;

  if (!enabled) {
    throw new Error('Notification permission not granted');
  }

  const token = await messaging().getToken();
  console.log('FCM token:', token);
  return token;
}







