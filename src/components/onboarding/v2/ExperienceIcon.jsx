import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

const PATHS = {
  ask: 'M6.5 7.5h11v7h-6l-3.5 3v-3H6.5z',
  write: 'M6 17.5l1.1-4.4L15.9 4.3a1.7 1.7 0 0 1 2.4 2.4l-8.8 8.8L6 17.5Z',
  create: 'M4.8 17.2 9.2 12l3.2 3.3 2.2-2.4 4.6 4.3H4.8Z',
  plan: 'M7 4.5v3M17 4.5v3M5 9h14M6 6h12a1 1 0 0 1 1 1v11H5V7a1 1 0 0 1 1-1Z',
  sparkle: 'm12 3 1.2 4.2L17 9l-3.8 1.8L12 15l-1.2-4.2L7 9l3.8-1.8L12 3Z',
};

export default function ExperienceIcon({ name, color = '#F7FAFC', size = 24 }) {
  if (name === 'create') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Rect
          x="4"
          y="5"
          width="16"
          height="14"
          rx="3"
          fill="none"
          stroke={color}
          strokeWidth="1.7"
        />
        <Circle cx="15.8" cy="9.1" r="1.4" fill={color} />
        <Path
          d={PATHS.create}
          fill="none"
          stroke={color}
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={PATHS[name] || PATHS.sparkle}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
