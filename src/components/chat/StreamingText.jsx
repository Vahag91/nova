import React, { useEffect, useMemo, useState, memo } from 'react';
import MarkdownContent from './MarkdownContent';
import { subscribeStream, getStream } from '../../lib/streamingBuffer';

function StreamingText({
  messageId,
  base = '',
  streaming = false,
}) {
  const [live, setLive] = useState('');

  // Subscribe to buffer with reduced frequency
  useEffect(() => {
    if (!streaming || !messageId) { 
      setLive(''); 
      return; 
    }
    
    const initialContent = getStream(messageId);
    setLive(initialContent);
    
    return subscribeStream(messageId, () => {
      setLive(getStream(messageId));
    }, { throttleMs: 50 });
  }, [messageId, streaming]);

  // Current visible text
  const fullText = useMemo(
    () => (base || '') + live,
    [base, live]
  );
  
  // Check if this is a pure image message (contains only images, no text)
  const isPureImageMessage = /^!\[[^\]]*\]\([^)]+\)(\s*!\[[^\]]*\]\([^)]+\))*\s*$/.test(fullText.trim());
  
  if (isPureImageMessage) {
    // For pure image messages, render once and don't update during streaming
    // This prevents the massive base64 strings from being processed repeatedly
    const baseContent = base || '';
    return <MarkdownContent text={baseContent} isUser={false} animateOnMount={false} streaming={false} />;
  }
  
  // For text-only or mixed content, render normally
  return <MarkdownContent text={fullText} isUser={false} animateOnMount={!streaming} streaming={false} />;
}

export default memo(StreamingText);

