import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleRestart = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <View style={styles.iconCircle}>
              <Ionicons name="warning" size={48} color="#FF7F00" />
            </View>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.subtitle}>
              The app encountered an unexpected error. Tap below to try again.
            </Text>
            <TouchableOpacity style={styles.btn} onPress={this.handleRestart} data-testid="error-boundary-restart">
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.btnText}>Try Again</Text>
            </TouchableOpacity>
            {__DEV__ && this.state.error && (
              <ScrollView style={styles.debugBox}>
                <Text style={styles.debugText}>{this.state.error.toString()}</Text>
              </ScrollView>
            )}
          </View>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A1128', justifyContent: 'center', alignItems: 'center', padding: 24 },
  content: { alignItems: 'center', maxWidth: 340 },
  iconCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(255,127,0,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#8892B0', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1a2a5e', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  debugBox: { marginTop: 20, maxHeight: 120, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 12, width: '100%' },
  debugText: { fontSize: 12, color: '#FF4444', fontFamily: 'monospace' },
});
