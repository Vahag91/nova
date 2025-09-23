import React, { memo } from 'react';
import { View, Dimensions } from 'react-native';

const AdaptiveGrid = memo(({ items, renderTile, gap = 12, horizontalPadding = 16 }) => {
  const screenWidth = Dimensions.get('window').width;
  const containerWidth = screenWidth - (horizontalPadding * 2);
  const itemWidth = (containerWidth - gap) / 2; // 2 columns with gap between

  return (
    <View style={styles.gridContainer}>
      {items.map((item, index) => {
        const isLastInRow = (index + 1) % 2 === 0;
        const isLastRow = index >= items.length - 2;
        const style = {
          width: itemWidth,
          marginRight: isLastInRow ? 0 : gap,
          marginBottom: isLastRow ? 0 : gap,
        };
        // Create a unique key that combines item.id, jobId, and index to ensure uniqueness
        const uniqueKey = `${item.id || 'unknown'}-${item.jobId || 'nojob'}-${index}`;
        
        return (
          <View key={uniqueKey} style={[styles.gridItem, style]}>
            {renderTile(item, index, { width: itemWidth, height: itemWidth })}
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