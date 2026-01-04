import React from 'react';
import { View, Text, Platform } from 'react-native';
import { userStyles, assistantStyles } from './markdownStyles';
import ChatText from '../ChatText';
import { MarkdownLink } from './MarkdownLink';


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
  const useUiTextView = Platform.OS === 'ios' && !isUser;

  const renderSelectableRuns = () => {
    const arr = React.Children.toArray(children);
    const out = [];
    let run = [];
    let k = 0;

    const isTextLike = (child) => {
      if (typeof child === 'string' || typeof child === 'number') return true;
      if (!React.isValidElement(child)) return false;
      if (child.type === ChatText) return true;
      // react-native Text
      if (child.type === Text) return true;
      if (child.type === MarkdownLink) return true;
      // Common heuristic: RN Text has displayName "Text"
      if (child.type && child.type.displayName === 'Text') return true;
      return false;
    };

    const flush = () => {
      if (!run.length) return;
      out.push(
        <ChatText
          key={`li-sel-${index}-${k++}`}
          selectable
          uiTextView
          style={styles.body || styles.text}
        >
          {run}
        </ChatText>,
      );
      run = [];
    };

    for (const child of arr) {
      if (isTextLike(child)) run.push(child);
      else {
        flush();
        out.push(React.isValidElement(child) ? React.cloneElement(child, { key: `li-nt-${index}-${k++}` }) : child);
      }
    }
    flush();
    return out;
  };
  
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
        {useUiTextView ? renderSelectableRuns() : children}
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
