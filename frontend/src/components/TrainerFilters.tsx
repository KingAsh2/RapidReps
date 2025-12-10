import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Colors } from '../utils/colors';
import { Ionicons } from '@expo/vector-icons';

interface FilterProps {
  filters: {
    minRating: number;
    gender: string;
    specialties: string[];
  };
  onFiltersChange: (filters: any) => void;
  onClose: () => void;
}

const SPECIALTIES = [
  'Weight Loss',
  'Strength Training',
  'HIIT',
  'Yoga',
  'Pilates',
  'Boxing',
  'Crossfit',
  'Rehabilitation',
  'Sports Training',
  'Flexibility',
];

export default function TrainerFilters({ filters, onFiltersChange, onClose }: FilterProps) {
  const toggleSpecialty = (specialty: string) => {
    const newSpecialties = filters.specialties.includes(specialty)
      ? filters.specialties.filter((s) => s !== specialty)
      : [...filters.specialties, specialty];
    onFiltersChange({ ...filters, specialties: newSpecialties });
  };

  const clearFilters = () => {
    onFiltersChange({
      minRating: 0,
      gender: 'any',
      specialties: [],
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Filters</Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={28} color={Colors.navy} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Minimum Rating */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Minimum Rating</Text>
          <View style={styles.ratingOptions}>
            {[0, 3, 4, 5].map((rating) => (
              <TouchableOpacity
                key={rating}
                onPress={() => onFiltersChange({ ...filters, minRating: rating })}
                style={[
                  styles.ratingChip,
                  filters.minRating === rating && styles.ratingChipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.ratingChipText,
                    filters.minRating === rating && styles.ratingChipTextSelected,
                  ]}
                >
                  {rating === 0 ? 'Any' : `${rating}★+`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Gender Preference */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gender Preference</Text>
          <View style={styles.genderOptions}>
            {[
              { value: 'any', label: 'No Preference' },
              { value: 'male', label: 'Male' },
              { value: 'female', label: 'Female' },
            ].map((option) => (
              <TouchableOpacity
                key={option.value}
                onPress={() => onFiltersChange({ ...filters, gender: option.value })}
                style={[
                  styles.genderChip,
                  filters.gender === option.value && styles.genderChipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.genderChipText,
                    filters.gender === option.value && styles.genderChipTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Specialties */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Specialties</Text>
          <View style={styles.specialtiesGrid}>
            {SPECIALTIES.map((specialty) => (
              <TouchableOpacity
                key={specialty}
                onPress={() => toggleSpecialty(specialty)}
                style={[
                  styles.specialtyChip,
                  filters.specialties.includes(specialty) && styles.specialtyChipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.specialtyChipText,
                    filters.specialties.includes(specialty) && styles.specialtyChipTextSelected,
                  ]}
                >
                  {specialty}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Footer Actions */}
      <View style={styles.footer}>
        <TouchableOpacity onPress={clearFilters} style={styles.clearButton}>
          <Text style={styles.clearButtonText}>Clear All</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} style={styles.applyButton}>
          <Text style={styles.applyButtonText}>Apply Filters</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 2,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.navy,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.navy,
    marginBottom: 12,
  },
  ratingOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  ratingChip: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.navy,
    backgroundColor: Colors.white,
  },
  ratingChipSelected: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  ratingChipText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.navy,
  },
  ratingChipTextSelected: {
    color: Colors.white,
  },
  genderOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  genderChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.navy,
    backgroundColor: Colors.white,
    alignItems: 'center',
  },
  genderChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  genderChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.navy,
  },
  genderChipTextSelected: {
    color: Colors.white,
  },
  specialtiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  specialtyChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  specialtyChipSelected: {
    backgroundColor: Colors.neonBlue,
    borderColor: Colors.neonBlue,
  },
  specialtyChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  specialtyChipTextSelected: {
    color: Colors.white,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 2,
    borderTopColor: Colors.border,
  },
  clearButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.navy,
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.navy,
  },
  applyButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.white,
  },
});
