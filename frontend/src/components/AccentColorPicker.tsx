import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export const ACCENT_COLORS: { hex: string; name: string }[] = [
  { hex: '#FF6A00', name: 'RapidReps Orange' },
  { hex: '#FF3D00', name: 'Fiery Red' },
  { hex: '#00D68F', name: 'Emerald' },
  { hex: '#6C5CE7', name: 'Royal Purple' },
  { hex: '#0984E3', name: 'Electric Blue' },
  { hex: '#FDBB2D', name: 'Gold' },
  { hex: '#E84393', name: 'Hot Pink' },
  { hex: '#00CEC9', name: 'Teal' },
  { hex: '#D63031', name: 'Crimson' },
  { hex: '#A29BFE', name: 'Lavender' },
];

const DEFAULT_ACCENT = '#FF6A00';

interface AccentColorPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (color: string) => void;
  currentColor?: string | null;
}

export const AccentColorPicker = ({ visible, onClose, onSelect, currentColor }: AccentColorPickerProps) => {
  const selected = currentColor || DEFAULT_ACCENT;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <LinearGradient colors={['#141929', '#1A2035']} style={styles.gradient}>
            <View style={styles.header}>
              <Text style={styles.title}>BRAND COLOR</Text>
              <TouchableOpacity onPress={onClose} data-testid="close-accent-picker">
                <Ionicons name="close-circle" size={28} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            </View>
            <Text style={styles.subtitle}>Pick a color that tints your card, hero, and vibe</Text>

            {/* Preview */}
            <View style={[styles.preview, { borderColor: `${selected}30` }]}>
              <LinearGradient
                colors={[`${selected}20`, `${selected}05`]}
                style={styles.previewGradient}
              >
                <View style={[styles.previewDot, { backgroundColor: selected }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.previewName, { color: selected }]}>YOUR PROFILE</Text>
                  <Text style={styles.previewDesc}>This is how your accent color will look</Text>
                </View>
              </LinearGradient>
            </View>

            {/* Color grid */}
            <View style={styles.colorGrid}>
              {ACCENT_COLORS.map(({ hex, name }) => {
                const isSelected = selected === hex;
                return (
                  <TouchableOpacity
                    key={hex}
                    style={[styles.colorOption, isSelected && styles.colorOptionSelected]}
                    onPress={() => onSelect(hex)}
                    activeOpacity={0.7}
                    data-testid={`accent-color-${hex.replace('#', '')}`}
                  >
                    <View style={[styles.colorSwatch, { backgroundColor: hex }]}>
                      {isSelected && (
                        <Ionicons name="checkmark" size={18} color="#FFF" />
                      )}
                    </View>
                    <Text style={[styles.colorName, isSelected && { color: hex }]}>{name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  gradient: {
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Oswald_700Bold',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 20,
  },
  preview: {
    borderRadius: 16,
    borderWidth: 1.5,
    overflow: 'hidden',
    marginBottom: 24,
  },
  previewGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
  },
  previewDot: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  previewName: {
    fontSize: 16,
    fontFamily: 'Oswald_700Bold',
    letterSpacing: 1,
  },
  previewDesc: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorOption: {
    width: (width - 72) / 5,
    alignItems: 'center',
    gap: 6,
  },
  colorOptionSelected: {},
  colorSwatch: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorName: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
  },
});
