/**
 * @format
 */

import 'react-native-get-random-values';
import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import './src/error/initErrorHandling'; // ✅ global JS error handler (one-time import)

AppRegistry.registerComponent(appName, () => App);
