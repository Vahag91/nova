import React, { useState, useCallback, useMemo, memo } from 'react';
import { View } from 'react-native';

const AdaptiveGrid = memo(({ items, renderTile, gap = 12 }) => {
  const [containerWidth, setContainerWidth] = useState(0);
  
  const onLayout = useCallback((e) => {
    setContainerWidth(e.nativeEvent.layout.width);
  }, []);

  const gridConfig = useMemo(() => {
    if (items.length === 0) return { columns: 1, itemWidth: 0 };
    if (items.length === 1) return { columns: 1, itemWidth: containerWidth };
    if (items.length <= 4) return { columns: 2, itemWidth: (containerWidth - gap) / 2 };
    return { columns: 2, itemWidth: (containerWidth - gap) / 2 };
  }, [items.length, containerWidth, gap]);

  if (containerWidth === 0) {
    return <View onLayout={onLayout} style={styles.gridContainer} />;
  }

  return (
    <View onLayout={onLayout} style={styles.gridContainer}>
      {items.map((item, index) => {
        const isLastInRow = (index + 1) % gridConfig.columns === 0;
        const isLastRow = index >= items.length - gridConfig.columns;
        
        return (
          <View
            key={item.id}
            style={[
              styles.gridItem,
              {
                width: gridConfig.itemWidth,
                marginRight: isLastInRow ? 0 : gap,
                marginBottom: isLastRow ? 0 : gap,
              }
            ]}
          >
            {renderTile(item, index, { width: gridConfig.itemWidth, height: gridConfig.itemWidth })}
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
    justifyContent: 'space-between',
  },
  gridItem: {
    marginBottom: 12,
  },
};

export default AdaptiveGrid;
