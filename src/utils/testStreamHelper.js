/**
 * Quick Test Helper for Streaming State Machine
 * 
 * Usage:
 * 1. Import in Chat.js: import { enableTestMode } from '../utils/testStreamHelper';
 * 2. Call enableTestMode() in useEffect
 * 3. Use global.testStream object to trigger scenarios
 */

let originalSSEConnect = null;
let isTestModeActive = false;

export function enableTestMode() {
  if (isTestModeActive) return;
  isTestModeActive = true;


  // Create global test object
  global.testStream = {
    nextError: null,
    
    forceHTTP500: () => {
      global.testStream.nextError = 'http_500';
    },
    
    forceTimeout: () => {
      global.testStream.nextError = 'timeout';
    },
    
    forceNetworkErr: () => {
      global.testStream.nextError = 'network';
    },
    
    reset: () => {
      global.testStream.nextError = null;
    }
  };
}

/**
 * Intercept SSEClient to inject test errors
 * Call this before creating SSEClient instance
 */
export function maybeInjectTestError(sseClientInstance) {
  if (!global.testStream || !global.testStream.nextError) {
    return; // Normal operation
  }
  
  const errorType = global.testStream.nextError;
  global.testStream.nextError = null; // Reset after using
    
  // Override _connect to simulate error
  const originalConnect = sseClientInstance._connect.bind(sseClientInstance);
  
  sseClientInstance._connect = function() {
    originalConnect();
    
    // Inject error after a short delay
    setTimeout(() => {
      switch (errorType) {
        case 'http_500':
          this._terminate('http_error', 500, true);
          break;
          
        case 'timeout':
          this._terminate('timeout', 'TIMEOUT', true);
          break;
          
        case 'network':
          this._terminate('network_error', 'NETWORK', true);
          break;
      }
    }, 1000);
  };
}

/**
 * Monitor streaming events for testing
 */
export function createTestMonitor() {
  const events = [];
  
  return {
    events,
    
    logEvent: (type, data) => {
      const event = {
        type,
        data,
        timestamp: Date.now()
      };
      events.push(event);
    },
    
    clear: () => {
      events.length = 0;
    },
    
    getReport: () => {
      const hasOnDone = events.some(e => e.type === 'onDone');
      const hasOnError = events.some(e => e.type === 'onError');
      const errorEvents = events.filter(e => e.type === 'onError');
      const doneEvents = events.filter(e => e.type === 'onDone');
      
      return {
        totalEvents: events.length,
        hasOnDone,
        hasOnError,
        onDoneCount: doneEvents.length,
        onErrorCount: errorEvents.length,
        events,
        
        verdict: (() => {
          if (hasOnError && hasOnDone) {
            return '❌ FAIL: Both onError and onDone fired';
          }
          if (doneEvents.length > 1) {
            return '❌ FAIL: onDone fired multiple times';
          }
          if (errorEvents.length > 1) {
            return '⚠️ WARN: onError fired multiple times';
          }
          if (hasOnDone) {
            return '✅ PASS: Success path';
          }
          if (hasOnError) {
            return '✅ PASS: Error handled correctly';
          }
          return '⏳ PENDING: No completion yet';
        })()
      };
    },
    
    printReport: function() {
      const report = this.getReport();
      return report;
    }
  };
}

/**
 * Quick test suite - run all tests automatically
 */
export async function runQuickTests(streamChatFn) {
  const results = [];
  
  global.testStream.forceHTTP500();
  results.push({ test: 'HTTP 500', status: 'manual', message: 'Send a message to test' });
  
  return results;
}

