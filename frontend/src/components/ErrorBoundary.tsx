import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('ErrorBoundary caught:', error, errorInfo);
    
    // Log error to AsyncStorage for debugging
    const errorLog = {
      timestamp: new Date().toISOString(),
      error: error.toString(),
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    };
    AsyncStorage.getItem('error_log').then((existing) => {
      const logs = existing ? JSON.parse(existing) : [];
      logs.push(errorLog);
      const trimmedLogs = logs.slice(-10);
      AsyncStorage.setItem('error_log', JSON.stringify(trimmedLogs)).catch(() => {});
    }).catch(() => {});
  }

  handleRestart = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleShare = async () => {
    const { error, errorInfo } = this.state;
    const errorReport = `
=== RAPIDREPS CRASH REPORT ===
Time: ${new Date().toISOString()}

ERROR TYPE: ${error?.name || 'Unknown'}

ERROR MESSAGE:
${error?.message || 'No message'}

WHAT THIS MEANS:
${this.getErrorExplanation()}

STACK TRACE (where it crashed):
${error?.stack || 'No stack trace'}

COMPONENT TREE (which screen/component):
${errorInfo?.componentStack || 'No component info'}
==============================
`;
    try {
      await Share.share({ message: errorReport, title: 'RapidReps Crash Report' });
    } catch (e) {
      // Ignore share errors
    }
  };

  getErrorExplanation = (): string => {
    const { error } = this.state;
    const msg = error?.message || '';
    
    if (msg.includes('undefined is not a function')) {
      return '⚠️ A function was called that does not exist. This usually happens when:\n- A hook returned undefined instead of expected functions\n- A callback prop was not passed correctly\n- An object property was accessed before it was initialized';
    }
    if (msg.includes('Cannot read property') || msg.includes('Cannot read properties')) {
      return '⚠️ Code tried to access a property on null or undefined. This usually happens when:\n- Data has not loaded yet\n- An API returned unexpected data\n- A variable was not initialized';
    }
    if (msg.includes('Network') || msg.includes('fetch')) {
      return '⚠️ Network error - the app could not connect to the server. Check your internet connection.';
    }
    if (msg.includes('AsyncStorage')) {
      return '⚠️ Error reading/writing app storage. Try clearing app data and reinstalling.';
    }
    return '⚠️ An unexpected error occurred in the app.';
  };

  getSimplifiedStack = (): string => {
    const { error } = this.state;
    if (!error?.stack) return 'No stack trace available';
    
    // Extract the most relevant parts of the stack
    const lines = error.stack.split('\n');
    const relevantLines = lines.filter(line => 
      line.includes('app/') || 
      line.includes('src/') || 
      line.includes('contexts/') ||
      line.includes('components/')
    ).slice(0, 5);
    
    return relevantLines.length > 0 
      ? relevantLines.join('\n') 
      : lines.slice(0, 5).join('\n');
  };

  getComponentLocation = (): string => {
    const { errorInfo } = this.state;
    if (!errorInfo?.componentStack) return 'Unknown location';
    
    // Extract component names from the stack
    const stack = errorInfo.componentStack;
    const matches = stack.match(/at (\w+)/g);
    if (matches) {
      return matches.slice(0, 5).map(m => m.replace('at ', '')).join(' → ');
    }
    return stack.slice(0, 200);
  };

  render() {
    if (this.state.hasError) {
      const { error } = this.state;
      
      return (
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
              <View style={styles.iconCircle}>
                <Ionicons name="bug" size={40} color="#FF4444" />
              </View>
              <Text style={styles.title}>App Crashed</Text>
            </View>

            {/* Error Type */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>❌ ERROR TYPE</Text>
              <View style={styles.errorBox}>
                <Text style={styles.errorType}>{error?.name || 'Error'}</Text>
              </View>
            </View>

            {/* Error Message */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📝 ERROR MESSAGE</Text>
              <View style={styles.errorBox}>
                <Text style={styles.errorMessage}>{error?.message || 'Unknown error'}</Text>
              </View>
            </View>

            {/* Explanation */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>💡 WHAT THIS MEANS</Text>
              <View style={styles.explanationBox}>
                <Text style={styles.explanation}>{this.getErrorExplanation()}</Text>
              </View>
            </View>

            {/* Component Location */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📍 WHERE IT CRASHED</Text>
              <View style={styles.errorBox}>
                <Text style={styles.locationText}>{this.getComponentLocation()}</Text>
              </View>
            </View>

            {/* Stack Trace */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🔍 TECHNICAL DETAILS</Text>
              <View style={styles.stackBox}>
                <Text style={styles.stackText}>{this.getSimplifiedStack()}</Text>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity style={styles.restartBtn} onPress={this.handleRestart}>
                <Ionicons name="refresh" size={20} color="#fff" />
                <Text style={styles.btnText}>Try Again</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.shareBtn} onPress={this.handleShare}>
                <Ionicons name="share-outline" size={20} color="#FF7F00" />
                <Text style={styles.shareBtnText}>Share Error Report</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0A1128',
  },
  scrollContent: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    backgroundColor: 'rgba(255,68,68,0.15)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 16,
  },
  title: { 
    fontSize: 24, 
    fontWeight: '700', 
    color: '#fff',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8892B0',
    marginBottom: 8,
    letterSpacing: 1,
  },
  errorBox: {
    backgroundColor: 'rgba(255,68,68,0.1)',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#FF4444',
  },
  errorType: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FF4444',
  },
  errorMessage: {
    fontSize: 15,
    color: '#FF6B6B',
    lineHeight: 22,
  },
  explanationBox: {
    backgroundColor: 'rgba(255,127,0,0.1)',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#FF7F00',
  },
  explanation: {
    fontSize: 14,
    color: '#FFB366',
    lineHeight: 20,
  },
  locationText: {
    fontSize: 13,
    color: '#FF6B6B',
    fontFamily: 'monospace',
  },
  stackBox: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 14,
  },
  stackText: {
    fontSize: 11,
    color: '#8892B0',
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  actions: {
    marginTop: 24,
    gap: 12,
  },
  restartBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    gap: 8, 
    backgroundColor: '#FF7F00', 
    paddingVertical: 16, 
    borderRadius: 12,
  },
  btnText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '600',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#FF7F00',
    paddingVertical: 14,
    borderRadius: 12,
  },
  shareBtnText: {
    color: '#FF7F00',
    fontSize: 16,
    fontWeight: '600',
  },
});
