import React, { memo } from 'react';
import {
  View,
  Text,
  Animated,
} from 'react-native';

const ProgressBar = memo(({ 
  progress = 0, 
  animatedValue, 
  showText = true,
  height = 4,
  color = '#00E0C7',
  backgroundColor = '#374151',
}) => {
  return (
    <View style={styles.progressContainer}>
      <View style={[styles.progressBar, { height, backgroundColor }]}>
        <Animated.View 
          style={[
            styles.progressFill, 
            { 
              height: '100%',
              backgroundColor: color,
              width: animatedValue ? animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }) : `${progress}%`,
            }
          ]} 
        />
      </View>
      {showText && (
        <Text style={styles.progressText}>
          {Math.round(progress)}% complete
        </Text>
      )}
    </View>
  );
});

const styles = {
  progressContainer: {
    marginBottom: 12,
  },
  progressBar: {
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    borderRadius: 2,
  },
  progressText: {
    color: '#9CA3AF',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
};

export default ProgressBar;
