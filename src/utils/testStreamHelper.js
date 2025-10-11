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

  console.log('🧪 Test Mode Enabled');
  console.log('Available commands:');
  console.log('  global.testStream.forceHTTP500()   - Next request returns HTTP 500');
  console.log('  global.testStream.forceTimeout()   - Next request times out');
  console.log('  global.testStream.forceNetworkErr() - Next request fails with network error');
  console.log('  global.testStream.reset()          - Reset to normal behavior');
  
  // Create global test object
  global.testStream = {
    nextError: null,
    
    forceHTTP500: () => {
      global.testStream.nextError = 'http_500';
      console.log('⚠️ Next request will return HTTP 500');
    },
    
    forceTimeout: () => {
      global.testStream.nextError = 'timeout';
      console.log('⚠️ Next request will timeout');
    },
    
    forceNetworkErr: () => {
      global.testStream.nextError = 'network';
      console.log('⚠️ Next request will fail with network error');
    },
    
    reset: () => {
      global.testStream.nextError = null;
      console.log('✅ Reset to normal behavior');
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
  
  console.log(`🧪 Injecting test error: ${errorType}`);
  
  // Override _connect to simulate error
  const originalConnect = sseClientInstance._connect.bind(sseClientInstance);
  
  sseClientInstance._connect = function() {
    originalConnect();
    
    // Inject error after a short delay
    setTimeout(() => {
      switch (errorType) {
        case 'http_500':
          console.log('🧪 Simulating HTTP 500 error');
          this._terminate('http_error', 500, true);
          break;
          
        case 'timeout':
          console.log('🧪 Simulating timeout');
          this._terminate('timeout', 'TIMEOUT', true);
          break;
          
        case 'network':
          console.log('🧪 Simulating network error');
          this._terminate('network_error', 'NETWORK', true);
          break;
      }
    }, 1000); // Simulate error after 1 second
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
      console.log(`[TEST-MONITOR] ${type}:`, data);
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
      console.log('\n📊 TEST REPORT');
      console.log('═══════════════════════════════════');
      console.log(`Total Events: ${report.totalEvents}`);
      console.log(`onDone fired: ${report.onDoneCount} time(s)`);
      console.log(`onError fired: ${report.onErrorCount} time(s)`);
      console.log(`\nVerdict: ${report.verdict}`);
      console.log('═══════════════════════════════════\n');
      
      if (report.events.length > 0) {
        console.log('Event Timeline:');
        report.events.forEach((e, i) => {
          const relTime = i === 0 ? 0 : e.timestamp - report.events[0].timestamp;
          console.log(`  ${i + 1}. [+${relTime}ms] ${e.type}`, e.data ? `- ${JSON.stringify(e.data).substring(0, 50)}` : '');
        });
      }
      
      return report;
    }
  };
}

/**
 * Quick test suite - run all tests automatically
 */
export async function runQuickTests(streamChatFn) {
  console.log('\n🧪 RUNNING QUICK TEST SUITE\n');
  
  const results = [];
  
  // Test 1: Success path
  console.log('Test 1: Success Path');
  // This requires actual backend - skip in automated test
  
  // Test 2: HTTP 500
  console.log('\nTest 2: HTTP 500 Error');
  global.testStream.forceHTTP500();
  // User should send a message now
  results.push({ test: 'HTTP 500', status: 'manual', message: 'Send a message to test' });
  
  console.log('\n✅ Tests configured. Send messages to verify each scenario.');
  
  return results;
}

