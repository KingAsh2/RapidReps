/**
 * InfoTip — iter118w
 *
 * Tiny reusable "tap the ⓘ icon for help" affordance. Complements the
 * existing CoachMarkTour system (first-run guided tours) with a persistent
 * per-field option — so users who dismissed the tour, or who forgot what a
 * field means, can always tap ⓘ to see contextual help.
 *
 * Usage:
 *   <InfoTip text="Where you want to meet your trainer. Pick a park, gym, or your address." />
 *
 * Renders a small circular icon; tap opens a compact popover with the
 * provided text and a "Got it" dismiss button. Uses a Modal so the tooltip
 * paints on top of ScrollViews and modal stacks without z-index acrobatics.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  /** Copy to show inside the popover. Keep it under ~140 chars for scannability. */
  text: string;
  /** Optional short title above the body. */
  title?: string;
  /** Icon color override (default: muted white). */
  color?: string;
  /** Icon size (default: 16). */
  size?: number;
  /** Optional test id override — otherwise auto-derived from title. */
  testID?: string;
};

export const InfoTip: React.FC<Props> = ({ text, title, color = 'rgba(255,255,255,0.55)', size = 16, testID }) => {
  const [open, setOpen] = useState(false);
  const id = testID || (title ? `info-tip-${title.toLowerCase().replace(/\s+/g, '-')}` : 'info-tip');

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel={`More info${title ? `: ${title}` : ''}`}
        data-testid={id}
      >
        <Ionicons name="information-circle-outline" size={size} color={color} />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.card} onPress={() => {}}>
            <View style={styles.header}>
              <Ionicons name="information-circle" size={22} color="#FF6A00" />
              {title ? <Text style={styles.title}>{title}</Text> : null}
            </View>
            <Text style={styles.body}>{text}</Text>
            <TouchableOpacity
              onPress={() => setOpen(false)}
              style={styles.cta}
              data-testid={`${id}-dismiss`}
            >
              <Text style={styles.ctaText}>Got it</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#141929',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.82)',
    lineHeight: 20,
  },
  cta: {
    alignSelf: 'flex-end',
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FF6A00',
  },
  ctaText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});

export default InfoTip;
