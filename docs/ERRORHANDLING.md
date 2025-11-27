# Error Handling System - Comprehensive Documentation

## Table of Contents
1. [Overview](#overview)
2. [Error Handling Layers](#error-handling-layers)
3. [Components](#components)
4. [Patterns & Implementations](#patterns--implementations)
5. [Translation System](#translation-system)
6. [Best Practices](#best-practices)
7. [Complete Implementation Examples](#complete-implementation-examples)

---

## Overview

This Pokemon Card Scanner app uses a **multi-layered error handling approach** that provides:
- **Graceful degradation** for network and API failures
- **User-friendly error messages** in 8 languages
- **Recovery mechanisms** with retry functionality
- **Silent failures** for non-critical operations
- **Comprehensive logging** for debugging

### Architecture Principles
1. **Never crash the app** - Use try/catch everywhere
2. **User-friendly messages** - Use i18n translations for all error text
3. **Recovery options** - Provide retry buttons when possible
4. **Silent degradation** - Non-critical errors log to console but don't block UX
5. **Visual feedback** - Loading states, error views, and success indicators

---

## Error Handling Layers

### Layer 1: Global Error Boundary (React Level)
Catches unhandled React errors at the top level

**File:** `app/components/ErrorBoundary.jsx`

```jsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  handleReload = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong.</Text>
          <Text style={styles.subtitle}>Please try again later.</Text>
          <TouchableOpacity style={styles.button} onPress={this.handleReload}>
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 22,
    color: '#F8FAFC',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#6366F1',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 10,
    width: width * 0.6,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
});
```

**Usage in App.jsx:**
```jsx
export default function App() {
  return (
    <ErrorBoundary>
      <SubscriptionProvider>
        <ThemeProvider>
          {/* Your app content */}
        </ThemeProvider>
      </SubscriptionProvider>
    </ErrorBoundary>
  );
}
```

---

### Layer 2: Reusable Error View Component
For displaying errors within screens with retry functionality

**File:** `app/components/ErrorView.jsx`

```jsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';

export default function ErrorView({ message, onRetry }) {
  const { t } = useTranslation();
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('errors.oops')}</Text>
      <Text style={styles.message}>{message || t('errors.somethingWentWrong')}</Text>
      {onRetry && (
        <TouchableOpacity style={styles.button} onPress={onRetry}>
          <Text style={styles.buttonText}>{t('errors.tryAgain')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0F172A',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 22,
    color: '#F8FAFC',
    marginBottom: 10,
    fontWeight: 'bold',
  },
  message: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#6366F1',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
```

**Usage Example:**
```jsx
// In any screen
{error ? (
  <ErrorView 
    message={t('sets.failedToLoadStats')} 
    onRetry={retry} 
  />
) : (
  // Normal content
)}
```

---

### Layer 3: Safe Async Hook
Custom hook for handling async operations with automatic error handling

**File:** `app/hooks/useSafeAsync.js`

```javascript
import { useState, useEffect, useCallback } from 'react';

export default function useSafeAsync(fetchFn) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const run = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const result = await fetchFn();
      setData(result);
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [fetchFn]);

  useEffect(() => {
    run();
  }, [run]);

  return { data, loading, error, retry: run };
}
```

**Usage Example:**
```jsx
function MyScreen() {
  const { data, loading, error, retry } = useSafeAsync(async () => {
    const response = await fetchDataFromAPI();
    return response;
  });

  if (loading) return <ActivityIndicator />;
  if (error) return <ErrorView onRetry={retry} />;
  
  return <DataDisplay data={data} />;
}
```

---

## Components

### 1. Error States Management

#### State Variables Pattern
```jsx
const [loading, setLoading] = useState(false);
const [error, setError] = useState(false);
const [errorMessage, setErrorMessage] = useState(null);
const [errorType, setErrorType] = useState(null); // 'network', 'noResults', etc.
```

#### Loading States
```jsx
// Show loading indicator
if (loading) {
  return (
    <View style={styles.loader}>
      <ActivityIndicator size="large" color="#10B981" />
      <Text style={styles.loadingText}>Loading...</Text>
    </View>
  );
}
```

---

### 2. Try-Catch Pattern (Standard Approach)

#### Basic Try-Catch with Finally
```jsx
const handleOperation = async () => {
  try {
    setLoading(true);
    setError(false);
    
    const result = await someAsyncOperation();
    setData(result);
    
  } catch (e) {
    console.warn('❌ Operation failed:', e.message);
    setError(true);
    setErrorMessage(t('errors.somethingWentWrong'));
  } finally {
    setLoading(false);
  }
};
```

#### Try-Catch with User-Facing Alert
```jsx
const handlePurchase = async () => {
  try {
    const result = await purchasePackage(selectedPkg);
    if (result?.customerInfo?.entitlements?.active?.Premium) {
      onClose();
    }
  } catch (e) {
    if (e.message && e.message.includes('Purchase was cancelled')) {
      Alert.alert(
        t('paywall.alerts.purchaseCanceled'),
        t('paywall.alerts.purchaseCanceledMessage'),
      );
      return;
    }
    Alert.alert(
      t('paywall.alerts.purchaseFailed'), 
      t('paywall.alerts.purchaseFailedMessage')
    );
  } finally {
    setLoading(false);
  }
};
```

---

### 3. Silent Error Handling (Non-Critical Operations)

#### Console Warn Only
```jsx
// For non-critical operations that shouldn't interrupt user flow
if (!isPremium) {
  try {
    await incrementScanCount();
    const attempts = await getRemainingFreeAttempts();
    setRemainingAttempts(attempts);
  } catch (error) {
    console.warn('Failed to increment scan count:', error);
    // App continues normally
  }
}
```

#### Empty Catch Block for Expected Failures
```jsx
const checkIfSubscribed = async () => {
  try {
    const info = await restorePurchases();
    if (info?.entitlements?.active?.Premium) {
      onClose();
    }
  } catch {
    // Silently fail - don't show error to user
  }
};
```

---

### 4. Network Connectivity Checks

#### Internet Connection Verification
```jsx
useEffect(() => {
  if (!visible) return;

  const checkConnection = async () => {
    try {
      const res = await fetch('https://www.google.com/generate_204');
      if (res.status === 204) {
        setHasInternet(true);
        fetchOfferings();
      } else {
        throw new Error('No internet');
      }
    } catch (e) {
      setHasInternet(false);
      Alert.alert(
        t('oneTimeOffer.alerts.noInternet'),
        t('oneTimeOffer.alerts.noInternetMessage'),
        [
          { text: t('common.cancel'), style: 'cancel', onPress: onClose },
          { text: t('common.retry'), onPress: () => checkConnection() },
        ]
      );
    }
  };

  checkConnection();
}, [visible]);
```

#### Silent Offline Handling
```jsx
useEffect(() => {
  const runUpdates = async () => {
    try {
      const res = await fetch('https://www.google.com/generate_204');
      if (res.status === 204) {
        await updateDefaultCardPrices();
      }
    } catch (e) {
      // Fail silently if offline
    }
  };
  runUpdates();
}, []);
```

---

### 5. Permission Handling (Camera Example)

```jsx
useEffect(() => {
  (async () => {
    const status = await Camera.getCameraPermissionStatus();
    if (status === 'authorized') {
      setPermissionStatus('authorized');
    } else {
      const newStatus = await Camera.requestCameraPermission();
      if (newStatus === 'denied') {
        Alert.alert(
          t('scanner.cameraAccessNeeded'),
          t('scanner.cameraAccessNeededMessage'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { 
              text: t('scanner.openSettings'), 
              onPress: () => Linking.openSettings() 
            },
          ],
        );
      }
      setPermissionStatus(newStatus);
    }
  })();
}, [t]);

// Render based on permission status
if (permissionStatus === 'not-determined' || device == null) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color="#007AFF" />
      <Text style={styles.loadingText}>Loading camera…</Text>
    </View>
  );
}

if (permissionStatus === 'denied') {
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorText}>{t('scanner.cameraAccessNeeded')}</Text>
      <TouchableOpacity onPress={() => Linking.openSettings()}>
        <Text style={styles.linkText}>{t('scanner.openSettings')}</Text>
      </TouchableOpacity>
    </View>
  );
}
```

---

### 6. Request Cancellation & Race Conditions

#### Request ID Pattern (Prevent Stale Updates)
```jsx
const requestIdRef = useRef(0);

const fetchResults = useCallback(async (query, lang) => {
  const myRequestId = ++requestIdRef.current;
  
  setLoading(true);
  setError(null);
  
  try {
    const data = await searchCardsUnified(query, { language: lang });
    
    // Only update if this is still the latest request
    if (myRequestId !== requestIdRef.current) return;
    
    setResults(data);
  } catch (e) {
    if (myRequestId !== requestIdRef.current) return;
    setError(true);
  } finally {
    if (myRequestId !== requestIdRef.current) return;
    setLoading(false);
  }
}, []);
```

#### Debounced Loader with Timeout
```jsx
const loaderTimeoutRef = useRef(null);

const fetchResults = async (query) => {
  // Clear previous timeout
  clearTimeout(loaderTimeoutRef.current);
  setShowLoader(false);
  
  // Only show loader if request takes > 200ms
  loaderTimeoutRef.current = setTimeout(() => {
    if (myRequestId === requestIdRef.current) {
      setShowLoader(true);
    }
  }, 200);
  
  try {
    const data = await fetchData(query);
    setResults(data);
  } catch (e) {
    setError(true);
  } finally {
    clearTimeout(loaderTimeoutRef.current);
    setShowLoader(false);
  }
};
```

---

### 7. Context-Based Error Handling

#### Subscription Context Error Logging
```jsx
// In app/context/SubscriptionContext.js

const purchasePackage = async pkg => {
  try {
    const info = await Purchases.purchasePackage(pkg);
    await handleCustomerInfo(info.customerInfo);
    return info;
  } catch (err) {
    console.warn('❌ Purchase error:', err.message);
    throw err; // Re-throw for component to handle
  }
};

const restorePurchases = async () => {
  try {
    const info = await Purchases.restorePurchases();
    await handleCustomerInfo(info);
    return info;
  } catch (err) {
    console.warn('❌ Restore error:', err.message);
    throw err;
  }
};
```

#### Using Context Errors in Components
```jsx
const { purchasePackage, restorePurchases } = useContext(SubscriptionContext);

const handleRestore = async () => {
  try {
    const info = await restorePurchases();
    if (info?.entitlements?.active?.Premium) {
      Alert.alert(
        t('alerts.restored'), 
        t('alerts.restoredMessage')
      );
    } else {
      Alert.alert(
        t('alerts.notFound'), 
        t('alerts.notFoundMessage')
      );
    }
  } catch {
    Alert.alert(
      t('alerts.restoreError'), 
      t('alerts.restoreErrorMessage')
    );
  }
};
```

---

## Translation System

### Error Message Structure

**File:** `app/i18n/locales/en.json`

```json
{
  "common": {
    "cancel": "Cancel",
    "retry": "Retry",
    "close": "Close"
  },
  "errors": {
    "oops": "Oops!",
    "tryAgain": "Try Again",
    "somethingWentWrong": "Something went wrong.",
    "pleaseTryAgainLater": "Please try again later.",
    "unableToConnect": "Unable to connect. Please try again.",
    "noResultsFor": "No results for \"{{query}}\".",
    "noResultsFound": "No results found"
  },
  "paywall": {
    "alerts": {
      "noInternetConnection": "No Internet Connection",
      "noInternetConnectionMessage": "Please check your connection and try again.",
      "tryAgain": "Try Again",
      "cancel": "Cancel",
      "purchaseCanceled": "Purchase Canceled",
      "purchaseCanceledMessage": "The purchase process was interrupted. You can try again anytime.",
      "purchaseFailed": "Purchase Failed",
      "purchaseFailedMessage": "Something went wrong. Please try again.",
      "restored": "Restored",
      "restoredMessage": "Your subscription has been successfully restored.",
      "noSubscription": "No Subscription",
      "noSubscriptionMessage": "No active subscription found to restore.",
      "restoreFailed": "Restore Failed",
      "restoreFailedMessage": "Something went wrong during restore."
    }
  },
  "scanner": {
    "cameraAccessNeeded": "Camera Access Needed",
    "cameraAccessNeededMessage": "Please allow camera access in Settings to scan Pokémon cards.",
    "openSettings": "Open Settings",
    "noMatchFound": "We couldn't find a match. Try again with better lighting or clearer framing."
  },
  "sets": {
    "failedToLoadStats": "Failed to load your set statistics."
  },
  "alerts": {
    "restored": "Restored",
    "restoredMessage": "Your subscription has been restored.",
    "notFound": "Not Found",
    "notFoundMessage": "No active purchases to restore.",
    "restoreError": "Error",
    "restoreErrorMessage": "Failed to restore purchases."
  }
}
```

### Using Translations
```jsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  
  // Simple translation
  const errorText = t('errors.somethingWentWrong');
  
  // Translation with interpolation
  const noResultsText = t('errors.noResultsFor', { query: searchTerm });
  
  // Translation with keyPrefix for nested paths
  const { t: tNav } = useTranslation(undefined, { keyPrefix: 'navigation' });
  const screenTitle = tNav('screenTitles.cardDetails');
  
  return (
    <Alert.alert(
      t('alerts.restoreError'),
      t('alerts.restoreErrorMessage')
    )
  );
}
```

---

## Best Practices

### 1. Error Logging Convention

```jsx
// ❌ Bad - No context
console.log('error:', e);

// ✅ Good - Descriptive emoji prefix and message
console.warn('❌ Purchase error:', err.message);
console.warn('Failed to increment scan count:', error);
console.error('[SCAN] classify-card error:', error);
```

### 2. Loading State Management

```jsx
// Always use try-catch-finally for loading states
const handleAction = async () => {
  setLoading(true);
  try {
    await asyncOperation();
  } catch (e) {
    handleError(e);
  } finally {
    setLoading(false); // Always reset loading state
  }
};
```

### 3. User-Facing vs Silent Errors

```jsx
// Critical user-facing operation - show Alert
const handlePurchase = async () => {
  try {
    await purchasePackage(pkg);
  } catch (e) {
    Alert.alert(t('error.title'), t('error.message'));
  }
};

// Non-critical background operation - console only
const trackAnalytics = async () => {
  try {
    await sendAnalytics();
  } catch (e) {
    console.warn('Analytics failed:', e);
    // Don't interrupt user
  }
};
```

### 4. Error Recovery Flow

```jsx
// Provide clear recovery paths
if (error) {
  return (
    <ErrorView 
      message={errorMessage}
      onRetry={() => {
        setError(false);
        fetchData();
      }}
    />
  );
}
```

### 5. Permission Flow Pattern

```jsx
// 1. Check permission
// 2. Request if needed
// 3. Show appropriate UI for each state
// 4. Provide settings link if denied
```

---

## Complete Implementation Examples

### Example 1: Full Screen with Data Fetching

```jsx
import React, { useState, useCallback, useContext } from 'react';
import { View, ActivityIndicator, FlatList } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { ThemeContext } from '../context/ThemeContext';
import ErrorView from '../components/ErrorView';

export default function DataScreen() {
  const { t } = useTranslation();
  const { theme } = useContext(ThemeContext);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      
      const response = await fetch('https://api.example.com/data');
      if (!response.ok) throw new Error('Network response was not ok');
      
      const json = await response.json();
      setData(json);
    } catch (e) {
      console.warn('❌ Failed to fetch data:', e.message);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  if (error) {
    return <ErrorView message={t('errors.unableToConnect')} onRetry={fetchData} />;
  }

  if (data.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text }}>{t('errors.noResultsFound')}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={data}
      renderItem={({ item }) => <ItemComponent item={item} />}
      keyExtractor={(item) => item.id}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
```

---

### Example 2: Form Submission with Validation

```jsx
import React, { useState, useContext } from 'react';
import { View, TextInput, TouchableOpacity, Text, Alert, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemeContext } from '../context/ThemeContext';

export default function FormScreen() {
  const { t } = useTranslation();
  const { theme } = useContext(ThemeContext);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    // Client-side validation
    if (!name.trim()) {
      Alert.alert(
        t('common.error'),
        t('forms.nameRequired')
      );
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch('https://api.example.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        throw new Error('Submission failed');
      }

      Alert.alert(
        t('common.success'),
        t('forms.submittedSuccessfully'),
        [{ text: t('common.done'), onPress: () => navigation.goBack() }]
      );
    } catch (e) {
      console.warn('❌ Form submission error:', e.message);
      Alert.alert(
        t('common.error'),
        t('errors.somethingWentWrong'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('common.retry'), onPress: handleSubmit },
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <TextInput
        style={[styles.input, { color: theme.text, borderColor: theme.border }]}
        value={name}
        onChangeText={setName}
        placeholder={t('forms.enterName')}
        placeholderTextColor={theme.placeholder}
        editable={!loading}
      />
      
      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{t('common.submit')}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#10B981',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

---

### Example 3: Scanner with Multiple Error Types

```jsx
import React, { useState, useRef } from 'react';
import { View, TouchableOpacity, Text, ActivityIndicator, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Camera } from 'react-native-vision-camera';

export default function ScannerScreen() {
  const { t } = useTranslation();
  const cameraRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [scanStage, setScanStage] = useState('idle'); // idle, scanning, searching
  const [noResult, setNoResult] = useState(false);
  const [cardResults, setCardResults] = useState([]);

  const onScan = async () => {
    if (loading) return;

    try {
      setLoading(true);
      setScanStage('scanning');
      setNoResult(false);
      setCardResults([]);

      // 1. Capture photo
      const photo = await cameraRef.current.takePhoto();
      
      // 2. Process image
      setScanStage('searching');
      const response = await processImage(photo);
      
      // 3. Handle results
      if (!response || response.length === 0) {
        setNoResult(true);
      } else {
        setCardResults(response);
      }
      
    } catch (e) {
      console.error('[SCAN] Error:', e.message);
      setNoResult(true);
      
      // Show user-friendly error
      Alert.alert(
        t('common.error'),
        t('scanner.noMatchFound')
      );
    } finally {
      setLoading(false);
      setScanStage('idle');
    }
  };

  // Render different UI based on scan state
  if (noResult) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{t('scanner.noMatchFound')}</Text>
        <TouchableOpacity onPress={() => setNoResult(false)} style={styles.retryButton}>
          <Text style={styles.retryText}>{t('common.tryAgain')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (cardResults.length > 0) {
    return <CardResultsView results={cardResults} />;
  }

  return (
    <View style={styles.container}>
      <Camera ref={cameraRef} style={styles.camera} />
      
      <TouchableOpacity
        onPress={onScan}
        disabled={loading}
        style={[styles.scanButton, loading && styles.scanButtonDisabled]}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.scanText}>{t('scanner.scan')}</Text>
        )}
      </TouchableOpacity>

      {scanStage !== 'idle' && (
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>
            {scanStage === 'scanning' 
              ? t('scanner.scanning')
              : t('scanner.searching')
            }
          </Text>
        </View>
      )}
    </View>
  );
}
```

---

### Example 4: Database Operations with Error Handling

```jsx
import { getDBConnection } from '../lib/db';

export async function safeDBOperation(operation, fallbackValue = null) {
  try {
    const db = await getDBConnection();
    const result = await operation(db);
    return result;
  } catch (error) {
    console.warn('❌ Database operation failed:', error.message);
    return fallbackValue;
  }
}

// Usage in component
const loadCards = useCallback(async () => {
  const cards = await safeDBOperation(
    async (db) => {
      const results = await db.executeSql(
        'SELECT * FROM collection_cards WHERE collectionId = ?',
        [collectionId]
      );
      return results[0].rows.raw();
    },
    [] // fallback to empty array
  );
  
  setCards(cards);
}, [collectionId]);
```

---

## Summary: Error Handling Checklist

### For Every Async Operation:
- [ ] Wrap in try-catch-finally
- [ ] Set loading state in try block
- [ ] Handle errors in catch block
- [ ] Reset loading state in finally block
- [ ] Log errors with descriptive messages
- [ ] Use translated error messages for users
- [ ] Provide retry mechanism when appropriate

### For Critical Operations (Purchases, Auth):
- [ ] Show user-facing Alert with translated messages
- [ ] Provide clear action buttons
- [ ] Log errors to console
- [ ] Re-throw errors when needed for higher-level handling

### For Non-Critical Operations (Analytics, Tracking):
- [ ] Use silent error handling
- [ ] Log to console only
- [ ] Don't interrupt user flow
- [ ] Use empty catch blocks or console.warn

### For Network Operations:
- [ ] Check connectivity first
- [ ] Handle timeout scenarios
- [ ] Provide offline fallbacks
- [ ] Show appropriate loading states

### For UI Rendering:
- [ ] Show loading spinner during async operations
- [ ] Display ErrorView for failures
- [ ] Show empty states for no data
- [ ] Provide retry buttons

---

## Color Scheme Reference

**Used throughout error handling UI:**

```javascript
const errorColors = {
  // Dark theme
  background: '#0F172A',
  text: '#F8FAFC',
  secondaryText: '#94A3B8',
  error: '#EF4444',
  success: '#10B981',
  primary: '#6366F1',
  
  // Light theme
  lightBackground: '#FFFFFF',
  lightText: '#1F2937',
  lightSecondaryText: '#6B7280',
};
```

---

## File Structure Reference

```
app/
├── components/
│   ├── ErrorBoundary.jsx          # Global error boundary
│   ├── ErrorView.jsx               # Reusable error component
│   └── ...
├── hooks/
│   └── useSafeAsync.js            # Safe async hook
├── context/
│   └── SubscriptionContext.js     # Context with error handling
├── i18n/
│   ├── index.js
│   └── locales/
│       ├── en.json                # English error messages
│       ├── de.json                # German translations
│       ├── fr.json                # French translations
│       ├── es.json                # Spanish translations
│       ├── pt.json                # Portuguese translations
│       ├── it.json                # Italian translations
│       ├── ja.json                # Japanese translations
│       └── nl.json                # Dutch translations
└── screens/
    └── *.jsx                      # All screens implement error handling
```

---

This documentation provides a complete reference for implementing error handling in your React Native app using the exact patterns from this Pokemon Card Scanner project. Use it as a template for consistent error handling across your application.

