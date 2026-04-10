import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Modal, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export const PERSONALITY_TAGS: Record<string, { icon: string; color: string; description: string }> = {
  'INTENSE': { icon: 'flame', color: '#FF3D00', description: 'Maximum effort, no shortcuts. Every rep counts.' },
  'CHILL': { icon: 'leaf', color: '#00D68F', description: 'Relaxed pace, steady gains. No pressure, just progress.' },
  'BEAST MODE': { icon: 'barbell', color: '#FF6A00', description: 'Go hard or go home. Built for warriors.' },
  'ZEN': { icon: 'fitness', color: '#6C5CE7', description: 'Mind-body connection first. Balance is everything.' },
  'HIGH ENERGY': { icon: 'flash', color: '#FDBB2D', description: 'Nonstop motivation machine. Bring the hype.' },
  'NO EXCUSES': { icon: 'shield-checkmark', color: '#FF4757', description: 'Accountability is everything. Show up or step aside.' },
  'PATIENT': { icon: 'heart', color: '#A29BFE', description: 'Everyone starts somewhere. Growth at your pace.' },
  'COMPETITIVE': { icon: 'trophy', color: '#FFD700', description: 'Push your limits daily. Beat yesterday.' },
};

interface PersonalityTagBadgeProps {
  tag: string;
  compact?: boolean;
  onPress?: () => void;
}

export const PersonalityTagBadge = ({ tag, compact = false, onPress }: PersonalityTagBadgeProps) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const tagData = PERSONALITY_TAGS[tag];

  useEffect(() => {
    if (!compact) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.04, duration: 1500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [compact]);

  if (!tagData) return null;

  if (compact) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={[styles.compactBadge, { borderColor: `${tagData.color}30` }]}
        data-testid={`personality-tag-${tag.toLowerCase().replace(/\s/g, '-')}`}
      >
        <Ionicons name={tagData.icon as any} size={10} color={tagData.color} />
        <Text style={[styles.compactText, { color: tagData.color }]}>{tag}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={styles.fullBadge}
        data-testid={`personality-tag-full-${tag.toLowerCase().replace(/\s/g, '-')}`}
      >
        <LinearGradient
          colors={[`${tagData.color}20`, `${tagData.color}08`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.fullGradient, { borderColor: `${tagData.color}25` }]}
        >
          <Ionicons name={tagData.icon as any} size={16} color={tagData.color} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.fullTagName, { color: tagData.color }]}>{tag}</Text>
            <Text style={styles.fullDescription}>{tagData.description}</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

interface PersonalityTagSelectorProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (tag: string) => void;
  currentTag?: string | null;
}

export const PersonalityTagSelector = ({ visible, onClose, onSelect, currentTag }: PersonalityTagSelectorProps) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <LinearGradient colors={['#141929', '#1A2035']} style={styles.modalGradient}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>YOUR VIBE</Text>
              <TouchableOpacity onPress={onClose} data-testid="close-personality-selector">
                <Ionicons name="close-circle" size={28} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>Pick the tag that defines your energy</Text>

            <View style={styles.tagGrid}>
              {Object.entries(PERSONALITY_TAGS).map(([name, data]) => {
                const isSelected = currentTag === name;
                return (
                  <TouchableOpacity
                    key={name}
                    style={[
                      styles.tagOption,
                      isSelected && { borderColor: data.color, backgroundColor: `${data.color}15` },
                    ]}
                    onPress={() => onSelect(name)}
                    activeOpacity={0.7}
                    data-testid={`select-tag-${name.toLowerCase().replace(/\s/g, '-')}`}
                  >
                    <View style={[styles.tagIconBg, { backgroundColor: `${data.color}20` }]}>
                      <Ionicons name={data.icon as any} size={22} color={data.color} />
                    </View>
                    <Text style={[styles.tagOptionName, isSelected && { color: data.color }]}>{name}</Text>
                    <Text style={styles.tagOptionDesc} numberOfLines={2}>{data.description}</Text>
                    {isSelected && (
                      <View style={[styles.selectedCheck, { backgroundColor: data.color }]}>
                        <Ionicons name="checkmark" size={12} color="#FFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {currentTag && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => onSelect('')}
                data-testid="clear-personality-tag"
              >
                <Text style={styles.clearButtonText}>Remove Tag</Text>
              </TouchableOpacity>
            )}
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  compactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
  },
  compactText: {
    fontSize: 9,
    fontFamily: 'Oswald_700Bold',
    letterSpacing: 1,
  },
  fullBadge: {
    marginBottom: 12,
  },
  fullGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  fullTagName: {
    fontSize: 13,
    fontFamily: 'Oswald_700Bold',
    letterSpacing: 1.5,
  },
  fullDescription: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    maxHeight: '85%',
  },
  modalGradient: {
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 24,
    fontFamily: 'Oswald_700Bold',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  modalSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 20,
  },
  tagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tagOption: {
    width: (width - 68) / 2,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    position: 'relative',
  },
  tagIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  tagOptionName: {
    fontSize: 13,
    fontFamily: 'Oswald_700Bold',
    color: '#FFFFFF',
    letterSpacing: 1,
    marginBottom: 4,
  },
  tagOptionDesc: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.4)',
    lineHeight: 15,
  },
  selectedCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButton: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 16,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    textDecorationLine: 'underline',
  },
});
