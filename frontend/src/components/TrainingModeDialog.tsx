import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
} from 'react-native';
import { Colors } from '../utils/colors';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

interface TrainingModeDialogProps {
  visible: boolean;
  onClose: () => void;
  onSelectInPerson: () => void;
  onSelectVirtual: () => void;
}

export default function TrainingModeDialog({
  visible,
  onClose,
  onSelectInPerson,
  onSelectVirtual,
}: TrainingModeDialogProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.dialogContainer}>
          <LinearGradient
            colors={Colors.gradientOrangeStart}
            style={styles.dialog}
          >
            {/* Close Button */}
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={28} color={Colors.navy} />
            </TouchableOpacity>

            {/* Title */}
            <View style={styles.header}>
              <Text style={styles.title}>How do you want to</Text>
              <Text style={styles.titleBold}>TRAIN TODAY?</Text>
            </View>

            {/* Options */}
            <View style={styles.optionsContainer}>
              {/* In-Person Training */}
              <TouchableOpacity
                style={styles.optionCard}
                onPress={onSelectInPerson}
                activeOpacity={0.8}
              >
                <View style={styles.optionIconContainer}>
                  <Ionicons name="fitness" size={48} color={Colors.primary} />
                </View>
                <Text style={styles.optionTitle}>In-Person Training</Text>
                <Text style={styles.optionDescription}>
                  Meet your trainer at the gym
                </Text>
                <View style={styles.optionBadge}>
                  <Text style={styles.optionBadgeText}>Popular Choice</Text>
                </View>
              </TouchableOpacity>

              {/* Virtual Training */}
              <TouchableOpacity
                style={styles.optionCard}
                onPress={onSelectVirtual}
                activeOpacity={0.8}
              >
                <View style={styles.optionIconContainer}>
                  <Ionicons name="videocam" size={48} color={Colors.secondary} />
                </View>
                <Text style={styles.optionTitle}>Virtual Live Video</Text>
                <Text style={styles.optionDescription}>
                  Train from anywhere, instantly
                </Text>
                <View style={[styles.optionBadge, styles.optionBadgeVirtual]}>
                  <Text style={styles.optionBadgeText}>$18 / 30 min</Text>
                </View>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialogContainer: {
    width: width - 40,
    maxWidth: 400,
    borderRadius: 20,
    overflow: 'hidden',
  },
  dialog: {
    padding: 24,
    borderWidth: 4,
    borderColor: Colors.navy,
    borderRadius: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    backgroundColor: Colors.white,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.navy,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.white,
    textAlign: 'center',
  },
  titleBold: {
    fontSize: 32,
    fontWeight: '900',
    color: Colors.navy,
    textAlign: 'center',
    letterSpacing: 1,
  },
  optionsContainer: {
    gap: 16,
  },
  optionCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: Colors.navy,
    padding: 24,
    alignItems: 'center',
    shadowColor: Colors.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  optionIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.background,
    borderWidth: 3,
    borderColor: Colors.navy,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  optionTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.navy,
    marginBottom: 8,
    textAlign: 'center',
  },
  optionDescription: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  optionBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.navy,
  },
  optionBadgeVirtual: {
    backgroundColor: Colors.secondary,
  },
  optionBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.5,
  },
});
