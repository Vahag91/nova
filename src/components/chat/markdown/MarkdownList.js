import React from 'react';
import { View, Text } from 'react-native';
import { userStyles, assistantStyles } from './markdownStyles';


export const MarkdownList = ({ 
  children, 
  type = 'ul', 
  start = 1, 
  depth = 0,
  isUser = false 
}) => {
  const styles = isUser ? userStyles : assistantStyles;
  
  return (
    <View style={[
      styles.listContainer,
      { 
        paddingLeft: depth > 0 ? 24 : 0,
        marginBottom: 16,
        marginTop: depth === 0 ? 8 : 0,
      }
    ]}>
      {children}
    </View>
  );
};

export const MarkdownListItem = ({ 
  children, 
  index = 0, 
  type = 'ul',
  isUser = false 
}) => {
  const styles = isUser ? userStyles : assistantStyles;
  
  const renderBulletOrNumber = () => {
    if (type === 'ol') {
      return (
        <Text style={[ { marginRight: 4, minWidth: 24 }]}>
          {index + 1}.
        </Text>
      );
    }
    
    return (
      <Text style={[styles.text, styles.bulletPoint, { marginRight: 2 }]}>
        {'\u2022'}
      </Text>
    );
  };

  return (
    <View style={styles.listItemContainer}>
      {renderBulletOrNumber()}
      
      <View style={styles.contentContainer}>
        {children}
      </View>
    </View>
  );
};

export const listStyles = {
  nestedList: {
    marginTop: 4,
    marginBottom: 0,
  },
};
