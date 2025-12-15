import React from 'react';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../../styles/colors';

export const Icon = ({ name, size = 20, color = colors.text, filled = false, style }) => {
  const iconName = name || 'circle';
  return (
    <MaterialIcons
      name={iconName}
      size={size}
      color={color}
      style={style}
      // MaterialIcons does not expose font-variation fill in RN; the flag is kept for API parity.
    />
  );
};

export default Icon;
