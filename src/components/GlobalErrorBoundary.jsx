// src/components/GlobalErrorBoundary.jsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { withTranslation } from 'react-i18next';
import { logException } from '../error/logger';

const { width } = Dimensions.get('window');

class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // In dev we still want the red box; in prod show fallback
    return { hasError: __DEV__ ? false : true, error };
  }

  componentDidCatch(error, info) {
    logException(error, { componentStack: info?.componentStack });
    this.props.onCatch?.(error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      const { t } = this.props;
      return (
        <View style={styles.container} accessibilityLabel={t('app.errors.crashLabel', { defaultValue: 'App crashed' })}>
          <Text style={styles.title}>
            {t('app.errors.crashTitle', { defaultValue: 'Something went wrong.' })}
          </Text>
          <Text style={styles.subtitle}>
            {t('app.errors.crashSubtitle', { defaultValue: 'Please try again.' })}
          </Text>
          <TouchableOpacity style={styles.button} onPress={this.handleReload}>
            <Text style={styles.buttonText}>
              {t('common.tryAgain', { defaultValue: 'Try Again' })}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

export default withTranslation()(GlobalErrorBoundary);

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24,
  },
  title: { fontSize: 22, color: '#F8FAFC', fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#94A3B8', textAlign: 'center', marginBottom: 20 },
  button: {
    backgroundColor: '#6366F1', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 10, width: width * 0.6, alignItems: 'center',
  },
  buttonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 16 },
});
