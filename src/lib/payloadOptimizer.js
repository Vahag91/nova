// Payload optimization to prevent "payload too large" errors
const MAX_PAYLOAD_SIZE = 100000; // 100KB limit
const MAX_MESSAGE_COUNT = 10; // Reduced message count
const MAX_MESSAGE_LENGTH = 4000; // Max chars per message

export function optimizePayload(messages) {
  
  // Start with recent messages
  let recentMessages = messages.slice(-MAX_MESSAGE_COUNT);
  let totalSize = 0;
  
  // Calculate initial size
  const initialSize = JSON.stringify(recentMessages).length;
  
  // If already under limit, return
  if (initialSize <= MAX_PAYLOAD_SIZE) {
    return recentMessages;
  }
  
  
  // Strategy 1: Truncate very long messages
  recentMessages = recentMessages.map(msg => {
    if (msg.content && msg.content.length > MAX_MESSAGE_LENGTH) {
      const truncated = msg.content.substring(0, MAX_MESSAGE_LENGTH) + '...';
      return { ...msg, content: truncated };
    }
    return msg;
  });
  
  // Check size after truncation
  let currentSize = JSON.stringify(recentMessages).length;
  if (currentSize <= MAX_PAYLOAD_SIZE) {
    return recentMessages;
  }
  
  // Strategy 2: Reduce message count
  let messageCount = MAX_MESSAGE_COUNT;
  while (messageCount > 3 && currentSize > MAX_PAYLOAD_SIZE) {
    messageCount -= 2;
    recentMessages = messages.slice(-messageCount);
    currentSize = JSON.stringify(recentMessages).length;
  }
  
  // Strategy 3: If still too large, truncate all messages more aggressively
  if (currentSize > MAX_PAYLOAD_SIZE) {
    
    recentMessages = recentMessages.map(msg => {
      if (msg.content && msg.content.length > 1000) {
        const truncated = msg.content.substring(0, 1000) + '...';
        return { ...msg, content: truncated };
      }
      return msg;
    });
    
    currentSize = JSON.stringify(recentMessages).length;
  }
  
  const finalSize = JSON.stringify(recentMessages).length;
  
  return recentMessages;
}

export function validatePayload(messages) {
  const payload = JSON.stringify(messages);
  const size = payload.length;
  
  const issues = [];
  
  if (size > MAX_PAYLOAD_SIZE) {
    issues.push(`Payload size ${Math.round(size / 1024)}KB exceeds limit ${Math.round(MAX_PAYLOAD_SIZE / 1024)}KB`);
  }
  
  if (messages.length > MAX_MESSAGE_COUNT) {
    issues.push(`Message count ${messages.length} exceeds limit ${MAX_MESSAGE_COUNT}`);
  }
  
  const totalContent = messages.reduce((sum, msg) => sum + (msg.content?.length || 0), 0);
  if (totalContent > 50000) {
    issues.push(`Total content ${totalContent} chars exceeds limit 50000`);
  }
  
  const largeMessages = messages.filter(msg => msg.content && msg.content.length > MAX_MESSAGE_LENGTH);
  if (largeMessages.length > 0) {
    issues.push(`${largeMessages.length} messages exceed ${MAX_MESSAGE_LENGTH} char limit`);
  }
  
  return {
    valid: issues.length === 0,
    size,
    issues,
    stats: {
      messageCount: messages.length,
      totalContent,
      largestMessage: Math.max(...messages.map(m => m.content?.length || 0)),
      averageMessageSize: Math.round(totalContent / messages.length)
    }
  };
}
