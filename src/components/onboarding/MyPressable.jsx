import React from 'react';
import { Pressable } from 'react-native';

const MyPressable = ({
  style,
  android_ripple = { color: 'lightgrey' },
  children,
  ...restOfProps
}) => {
  return (
    <Pressable style={style} android_ripple={android_ripple} {...restOfProps}>
      {children}
    </Pressable>
  );
};

export default MyPressable;
