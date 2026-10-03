import React, { memo } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

// One outlined icon family for the app: 24px grid, round caps and joins, a
// single stroke weight. Each entry is a list of shapes; `fill: true` paints a
// shape solid in the icon colour instead of stroking it.
const p = (d, fill = false) => ({ type: 'path', d, fill });

const ICONS = {
  menu: [p('M4 7h16'), p('M4 12h16'), p('M4 17h16')],
  plus: [p('M12 5v14'), p('M5 12h14')],
  check: [p('M20 6 9 17l-5-5')],
  close: [p('M18 6 6 18'), p('m6 6 12 12')],
  'chevron-right': [p('m9 6 6 6-6 6')],
  'chevron-down': [p('m6 9 6 6 6-6')],
  'arrow-right': [p('M5 12h14'), p('m13 6 6 6-6 6')],
  search: [{ type: 'circle', cx: 11, cy: 11, r: 7 }, p('m20 20-3.6-3.6')],
  spark: [
    p(
      'M12 2c.7 5.3 4.7 9.3 10 10-5.3.7-9.3 4.7-10 10-.7-5.3-4.7-9.3-10-10 5.3-.7 9.3-4.7 10-10Z',
      true,
    ),
  ],
  chat: [
    p('M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7'),
    p('M18.4 2.6a2.12 2.12 0 1 1 3 3L12 15l-4 1 1-4Z'),
  ],
  documents: [
    p('M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z'),
    p('M14 2v4a2 2 0 0 0 2 2h4'),
    p('M10 9H8'),
    p('M16 13H8'),
    p('M16 17H8'),
  ],
  video: [
    { type: 'rect', x: 2.5, y: 5, width: 19, height: 14, rx: 4 },
    p('M10.25 9.4v5.2l4.4-2.6Z', true),
  ],
  history: [
    p('M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8'),
    p('M3 3v5h5'),
    p('M12 7v5l4 2'),
  ],
  assistants: [
    { type: 'circle', cx: 9, cy: 8, r: 3.5 },
    p('M2.5 20a6.5 6.5 0 0 1 13 0'),
    p('M16 4.6a3.5 3.5 0 0 1 0 6.8'),
    p('M18.5 14.4a6.5 6.5 0 0 1 3 5.6'),
  ],
  settings: [
    p('M21 4h-7'),
    p('M10 4H3'),
    p('M21 12h-9'),
    p('M8 12H3'),
    p('M21 20h-5'),
    p('M12 20H3'),
    p('M14 2v4'),
    p('M8 10v4'),
    p('M16 18v4'),
  ],
  image: [
    { type: 'rect', x: 3, y: 3, width: 18, height: 18, rx: 3 },
    { type: 'circle', cx: 9, cy: 9, r: 2 },
    p('m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21'),
  ],
  camera: [
    p('M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z'),
    { type: 'circle', cx: 12, cy: 13, r: 3 },
  ],
  mic: [
    p('M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z'),
    p('M19 10v2a7 7 0 0 1-14 0v-2'),
    p('M12 19v3'),
  ],
  restore: [
    p('M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8'),
    p('M21 3v5h-5'),
    p('M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16'),
    p('M8 16H3v5'),
  ],
  trash: [
    p('M3 6h18'),
    p('M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6'),
    p('M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'),
    p('M10 11v6'),
    p('M14 11v6'),
  ],
  star: [
    p(
      'M11.53 2.3a.53.53 0 0 1 .95 0l2.3 4.67a2.12 2.12 0 0 0 1.6 1.16l5.17.76a.53.53 0 0 1 .3.9l-3.74 3.64a2.12 2.12 0 0 0-.61 1.88l.88 5.14a.53.53 0 0 1-.77.56l-4.62-2.43a2.12 2.12 0 0 0-1.97 0l-4.62 2.43a.53.53 0 0 1-.77-.56l.88-5.14a2.12 2.12 0 0 0-.61-1.88L2.16 9.8a.53.53 0 0 1 .3-.9l5.16-.76a2.12 2.12 0 0 0 1.6-1.16z',
    ),
  ],
  support: [
    { type: 'circle', cx: 12, cy: 12, r: 9.5 },
    { type: 'circle', cx: 12, cy: 12, r: 4 },
    p('m5.3 5.3 3.9 3.9'),
    p('m14.8 9.2 3.9-3.9'),
    p('m14.8 14.8 3.9 3.9'),
    p('m9.2 14.8-3.9 3.9'),
  ],
  shield: [
    p(
      'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z',
    ),
    p('m9 12 2 2 4-4'),
  ],
  terms: [
    p('M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z'),
    p('M14 2v4a2 2 0 0 0 2 2h4'),
    p('m9 15 2 2 4-4'),
  ],
  crown: [
    p(
      'M11.56 3.27a.5.5 0 0 1 .88 0l2.95 5.6a1 1 0 0 0 1.52.3l4.27-3.67a.5.5 0 0 1 .8.52l-2.83 10.25a1 1 0 0 1-.96.73H5.81a1 1 0 0 1-.96-.73L2.02 6.02a.5.5 0 0 1 .8-.52l4.27 3.66a1 1 0 0 0 1.52-.29z',
    ),
    p('M5 21h14'),
  ],
  share: [
    p('M12 15V3'),
    p('m7 8 5-5 5 5'),
    p('M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7'),
  ],
  upload: [p('M12 15V4'), p('m7 9 5-5 5 5'), p('M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3')],
};

function Icon({ name, size = 22, color = '#FFFFFF', strokeWidth = 1.75, style }) {
  const shapes = ICONS[name];
  if (!shapes) return null;

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={style}
      pointerEvents="none"
    >
      {shapes.map((shape, index) => {
        const paint = shape.fill
          ? { fill: color }
          : {
              stroke: color,
              strokeWidth,
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
            };
        if (shape.type === 'circle') {
          return <Circle key={index} cx={shape.cx} cy={shape.cy} r={shape.r} {...paint} />;
        }
        if (shape.type === 'rect') {
          return (
            <Rect
              key={index}
              x={shape.x}
              y={shape.y}
              width={shape.width}
              height={shape.height}
              rx={shape.rx}
              {...paint}
            />
          );
        }
        return <Path key={index} d={shape.d} {...paint} />;
      })}
    </Svg>
  );
}

export default memo(Icon);
