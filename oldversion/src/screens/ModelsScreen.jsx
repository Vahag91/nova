// import React from 'react';
// import {
//   View,
//   Text,
//   StyleSheet,
// } from 'react-native';
// import LinearGradient from 'react-native-linear-gradient';
// import { Header } from '../components/Header.jsx';
// import { GlassBottomNav } from '../components/GlassBottomNav.jsx';
// import { useTheme } from '../context/ThemeContext';
// import { getColors, getGradients } from '../styles/colors';
// import { getFontFamily } from '../styles/fonts';

// export const ModelsScreen = ({
//   onSettingsPress,
//   onTabPress,
//   activeTab,
// }) => {
//   const { isDarkMode } = useTheme();
//   const colors = getColors(isDarkMode);
//   const gradients = getGradients(isDarkMode);

//   const bgGradient = gradients.background || [colors.gradientStart, colors.gradientEnd];

//   return (
//     <LinearGradient colors={bgGradient} style={styles.container}>
//       <Header title="Models" onSettingsPress={onSettingsPress} />
      
//       <View style={styles.content}>
//         <Text style={[styles.title, { color: colors.textPrimary }]}>AI Models</Text>
//         <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Coming soon...</Text>
//       </View>

//       <GlassBottomNav activeTab={activeTab} onTabPress={onTabPress} />
//     </LinearGradient>
//   );
// };

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//   },
//   content: {
//     flex: 1,
//     alignItems: 'center',
//     justifyContent: 'center',
//     paddingHorizontal: 16,
//   },
//   title: {
//     fontSize: 24,
//     fontFamily: getFontFamily('bold'),
//     marginBottom: 8,
//   },
//   subtitle: {
//     fontSize: 16,
//   },
// });
