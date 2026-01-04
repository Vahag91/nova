import React from 'react';
import { UITextView as UITextViewText } from 'react-native-uitextview';

export default function ChatText({ uiTextView = false, selectable = false, ...props }) {
  return <UITextViewText {...props} uiTextView={uiTextView} selectable={selectable} />;
}

