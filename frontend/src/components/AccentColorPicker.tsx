import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Dimensions } from 'react-native';
import Slider from '@react-native-community/slider';
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
  // iter102aj: optional intensity slider (0.0 = no glow, 1.0 = max brightness)
  currentIntensity?: number;
  onIntensityCommit?: (intensity: number) => void;
}

export const AccentColorPicker = ({
  visible,
  onClose,
  onSelect,
  currentColor,
  currentIntensity,
  onIntensityCommit,
}: AccentColorPickerProps) => {
  const selected = currentColor || DEFAULT_ACCENT;
  // Local optimistic state — the slider updates instantly while only the final
  // value (onSlidingComplete) hits the network. Default to Max (1.0) when no
  // intensity has been persisted yet.
  const [intensity, setIntensity] = useState<number>(
    typeof currentIntensity === 'number' ? currentIntensity : 1,
  );
  useEffect(() => {
    if (visible) {
      setIntensity(typeof currentIntensity === 'number' ? currentIntensity : 1);
    }
  }, [visible, currentIntensity]);

  // Apply intensity to the preview tint exactly the same way AccentGlowOverlay does.
  const intensityHex = (() => {
    const pct = Math.round(intensity * 0x20); // 0x20 = same alpha base used in preview
    return pct.toString(16).padStart(2, '0').toUpperCase();
  })();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <LinearGradient colors={['#141929', '#1A2035']} style={styles.gradient}>
            <View style={styles.header}>
              <Text style={styles.title}>BRAND COLOR</Text>
              <TouchableOpacity onPress={onClose} data-testid="close-accent-picker" accessibilityLabel="Close color picker" accessibilityRole="button">
                <Ionicons name="close-circle" size={28} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            </View>
            <Text style={styles.subtitle}>Pick a color that tints your card, hero, and vibe</Text>

            {/* Preview — alpha scaled by current intensity so the swatch
                feels dimmer/brighter live as the user drags the slider. */}
            <View style={[styles.preview, { borderColor: `${selected}${intensityHex}` }]}>
              <LinearGradient
                colors={[`${selected}${intensityHex}`, `${selected}05`]}
                style={styles.previewGradient}
              >
                <View style={[styles.previewDot, { backgroundColor: selected, opacity: Math.max(0.3, intensity) }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.previewName, { color: selected, opacity: Math.max(0.4, intensity) }]}>YOUR PROFILE</Text>
                  <Text style={styles.previewDesc}>This is how your accent color will look</Text>
                </View>
              </LinearGradient>
            </View>

            {/* iter102aj: Brightness slider — None (0.0) to Bright/Max (1.0).
                Updates instantly while dragging; only persists on release. */}
            <View style={styles.sliderBlock}>
              <View style={styles.sliderHeaderRow}>
                <Text style={styles.sliderLabel}>BRIGHTNESS</Text>
                <Text style={[styles.sliderValue, { color: selected }]}>
                  {intensity <= 0.001 ? 'None' : intensity >= 0.999 ? 'Max' : `${Math.round(intensity * 100)}%`}
                </Text>
              </View>
              <Slider
                style={{ width: '100%', height: 36 }}
                minimumValue={0}
                maximumValue={1}
                step={0.05}
                value={intensity}
                onValueChange={setIntensity}
                onSlidingComplete={(v) => {
                  setIntensity(v);
                  onIntensityCommit?.(v);
                }}
                minimumTrackTintColor={selected}
                maximumTrackTintColor="rgba(255,255,255,0.15)"
                thumbTintColor={selected}
                data-testid="accent-brightness-slider"
              />
              <View style={styles.sliderEndsRow}>
                <Text style={styles.sliderEnd}>None</Text>
                <Text style={styles.sliderEnd}>Bright</Text>
              </View>
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
  sliderBlock: {
    marginTop: 18,
    marginBottom: 4,
  },
  sliderHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  sliderLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.6)',
  },
  sliderValue: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  sliderEndsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginTop: -4,
  },
  sliderEnd: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
});
