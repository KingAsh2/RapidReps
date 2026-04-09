import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInRight } from 'react-native-reanimated';

const COLORS = {
  orange: '#FF6A00',
  teal: '#00CED1',
  navy: '#1a2a5e',
  white: '#FFFFFF',
  gray: '#5a6785',
  grayLight: '#F0F2F5',
  success: '#00D68F',
  warning: '#FFAA00',
};

export type SessionTimelineStatus = 
  | 'requested' 
  | 'confirmed' 
  | 'en_route' 
  | 'arrived'
  | 'in_progress' 
  | 'completed'
  | 'cancelled';

interface TimelineStep {
  key: SessionTimelineStatus;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const TIMELINE_STEPS: TimelineStep[] = [
  { key: 'requested', label: 'Requested', icon: 'paper-plane' },
  { key: 'confirmed', label: 'Confirmed', icon: 'checkmark-circle' },
  { key: 'en_route', label: 'En Route', icon: 'car' },
  { key: 'arrived', label: 'Arrived', icon: 'location' },
  { key: 'in_progress', label: 'In Progress', icon: 'fitness' },
  { key: 'completed', label: 'Completed', icon: 'trophy' },
];

interface SessionTimelineProps {
  currentStatus: SessionTimelineStatus;
  eta?: string;
  showLabels?: boolean;
  compact?: boolean;
}

export const SessionTimeline: React.FC<SessionTimelineProps> = ({
  currentStatus,
  eta,
  showLabels = true,
  compact = false,
}) => {
  const getStatusIndex = (status: SessionTimelineStatus): number => {
    // Handle 'arrived' as between en_route and in_progress
    if (status === 'arrived') return 3;
    const index = TIMELINE_STEPS.findIndex(s => s.key === status);
    return index >= 0 ? index : 0;
  };

  const currentIndex = getStatusIndex(currentStatus);

  const getStepColor = (index: number): string => {
    if (currentStatus === 'cancelled') return COLORS.gray;
    if (index < currentIndex) return COLORS.success;
    if (index === currentIndex) return COLORS.orange;
    return COLORS.grayLight;
  };

  const getIconColor = (index: number): string => {
    if (currentStatus === 'cancelled') return COLORS.gray;
    if (index <= currentIndex) return COLORS.white;
    return COLORS.gray;
  };

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        {TIMELINE_STEPS.slice(0, 5).map((step, index) => (
          <React.Fragment key={step.key}>
            <View
              style={[
                styles.compactDot,
                { backgroundColor: getStepColor(index) },
              ]}
            />
            {index < 4 && (
              <View
                style={[
                  styles.compactLine,
                  { backgroundColor: index < currentIndex ? COLORS.success : COLORS.grayLight },
                ]}
              />
            )}
          </React.Fragment>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.timeline}>
        {TIMELINE_STEPS.slice(0, 5).map((step, index) => (
          <Animated.View
            key={step.key}
            entering={FadeInRight.delay(index * 100)}
            style={styles.stepWrapper}
          >
            {/* Connector Line */}
            {index > 0 && (
              <View
                style={[
                  styles.connector,
                  { backgroundColor: index <= currentIndex ? COLORS.success : COLORS.grayLight },
                ]}
              />
            )}
            
            {/* Step Circle */}
            <View
              style={[
                styles.stepCircle,
                { backgroundColor: getStepColor(index) },
                index === currentIndex && styles.currentStep,
              ]}
            >
              <Ionicons
                name={step.icon}
                size={index === currentIndex ? 18 : 14}
                color={getIconColor(index)}
              />
            </View>
            
            {/* Label */}
            {showLabels && (
              <Text
                style={[
                  styles.stepLabel,
                  index === currentIndex && styles.currentLabel,
                  index < currentIndex && styles.completedLabel,
                ]}
              >
                {step.label}
              </Text>
            )}
            
            {/* ETA for en_route step */}
            {step.key === 'en_route' && currentStatus === 'en_route' && eta && (
              <View style={styles.etaBadge}>
                <Text style={styles.etaText}>{eta}</Text>
              </View>
            )}
          </Animated.View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  timeline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  stepWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  connector: {
    position: 'absolute',
    top: 16,
    left: -50,
    right: 50,
    height: 3,
    borderRadius: 2,
    zIndex: -1,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentStep: {
    width: 40,
    height: 40,
    borderRadius: 20,
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  stepLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 6,
    textAlign: 'center',
  },
  currentLabel: {
    color: COLORS.orange,
    fontWeight: '700',
    fontSize: 11,
  },
  completedLabel: {
    color: COLORS.success,
    fontWeight: '600',
  },
  etaBadge: {
    backgroundColor: COLORS.orange,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 4,
  },
  etaText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '700',
  },
  // Compact styles
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  compactDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  compactLine: {
    width: 24,
    height: 2,
    marginHorizontal: 2,
  },
});

export default SessionTimeline;
