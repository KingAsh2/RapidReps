import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { haptic } from '../utils/haptics';

const COLORS = {
  orange: '#FF6A00',
  teal: '#00CED1',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  gray: '#5a6785',
  grayLight: '#F0F2F5',
  success: '#00D68F',
  error: '#FF4757',
};

interface QuickActionsProps {
  sessionId: string;
  otherPartyName: string;
  otherPartyPhone?: string;
  otherPartyId: string;
  role: 'trainer' | 'trainee';
  onCancel?: () => void;
  showCancel?: boolean;
  style?: any;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  sessionId,
  otherPartyName,
  otherPartyPhone,
  otherPartyId,
  role,
  onCancel,
  showCancel = true,
  style,
}) => {
  const router = useRouter();

  const handleCall = () => {
    haptic.light();
    if (otherPartyPhone) {
      Linking.openURL(`tel:${otherPartyPhone}`);
    }
  };

  const handleMessage = () => {
    haptic.light();
    router.push({
      pathname: '/chat/[id]',
      params: {
        id: sessionId,
        recipientName: otherPartyName,
        recipientId: otherPartyId,
      },
    });
  };

  const handleCancel = () => {
    haptic.warning();
    onCancel?.();
  };

  return (
    <View style={[styles.container, style]}>
      {/* Call Button */}
      <TouchableOpacity
        style={styles.actionButton}
        onPress={handleCall}
        disabled={!otherPartyPhone}
        data-testid="quick-action-call"
      >
        <LinearGradient
          colors={otherPartyPhone ? [COLORS.success, '#00B87A'] : [COLORS.gray, COLORS.gray]}
          style={styles.actionGradient}
        >
          <Ionicons name="call" size={22} color={COLORS.white} />
        </LinearGradient>
        <Text style={[styles.actionLabel, !otherPartyPhone && styles.disabledLabel]}>Call</Text>
      </TouchableOpacity>

      {/* Message Button */}
      <TouchableOpacity
        style={styles.actionButton}
        onPress={handleMessage}
        data-testid="quick-action-message"
      >
        <LinearGradient
          colors={[COLORS.teal, '#00A5A5']}
          style={styles.actionGradient}
        >
          <Ionicons name="chatbubble-ellipses" size={22} color={COLORS.white} />
        </LinearGradient>
        <Text style={styles.actionLabel}>Message</Text>
      </TouchableOpacity>

      {/* Cancel Button */}
      {showCancel && (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleCancel}
          data-testid="quick-action-cancel"
        >
          <LinearGradient
            colors={[COLORS.error, '#E53935']}
            style={styles.actionGradient}
          >
            <Ionicons name="close" size={22} color={COLORS.white} />
          </LinearGradient>
          <Text style={[styles.actionLabel, styles.cancelLabel]}>Cancel</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// Floating version for overlay on map
export const FloatingQuickActions: React.FC<QuickActionsProps> = (props) => {
  return (
    <View style={styles.floatingContainer}>
      <QuickActions {...props} style={styles.floatingInner} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  actionButton: {
    alignItems: 'center',
    gap: 6,
  },
  actionGradient: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.navy,
  },
  disabledLabel: {
    color: COLORS.gray,
  },
  cancelLabel: {
    color: COLORS.error,
  },
  // Floating styles
  floatingContainer: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    zIndex: 100,
  },
  floatingInner: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
});

export default QuickActions;
