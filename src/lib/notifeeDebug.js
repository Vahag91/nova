import notifee from '@notifee/react-native';

export async function debugLocalNotification() {
  // iOS needs permission before showing notifications
  await notifee.requestPermission();

  // Android needs a channel (safe to call on iOS too)
  const channelId = await notifee.createChannel({
    id: 'default',
    name: 'Default',
  });

  await notifee.displayNotification({
    title: 'Notifee is working',
    body: 'This is a local notification test.',
    android: {
      channelId,
      pressAction: { id: 'default' },
    },
  });
}
