import React, { memo, useMemo } from 'react';
import { View, useWindowDimensions } from 'react-native';

const AdaptiveGrid = memo(({ items, renderTile, gap = 12, horizontalPadding = 16 }) => {
  const { width: screenW } = useWindowDimensions();
  const containerW = Math.max(0, screenW - horizontalPadding * 2); // match ScrollView content padding

  const { columns, itemW } = useMemo(() => {
    if (!containerW) return { columns: 1, itemW: 0 };
    if (items.length <= 1) return { columns: 1, itemW: containerW };
    // 2-col layout for 2+ items (your current logic)
    const cols = 2;
    const itemWidth = (containerW - gap * (cols - 1)) / cols;
    return { columns: cols, itemW: Math.floor(itemWidth) }; // prevent fractional pixels
  }, [containerW, items.length, gap]);

  return (
    <View style={styles.gridContainer}>
      {items.map((item, index) => {
        const isLastInRow = (index + 1) % columns === 0;
        const isLastRow = index >= items.length - columns;
        const style = {
          width: itemW,
          marginRight: isLastInRow ? 0 : gap,
          marginBottom: isLastRow ? 0 : gap,
        };
        return (
          <View key={item.id ?? index} style={[styles.gridItem, style]}>
            {renderTile(item, index, { width: itemW, height: itemW })}
          </View>
        );
      })}
    </View>
  );
});

const styles = {
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  gridItem: {
    marginBottom: 12,
  },
};

export default AdaptiveGrid;