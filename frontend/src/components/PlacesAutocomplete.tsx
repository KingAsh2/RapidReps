/**
 * iter102aq — Google Places Autocomplete input.
 *
 * Lightweight wrapper around the Google Places `autocomplete` endpoint.
 * No 3rd-party RN library — uses the existing `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`
 * and a 250ms debounce so we don't hammer the API on every keystroke.
 *
 * Designed for the outdoor session-location field; the trainee types, the
 * dropdown shows up to 5 matching addresses, tap → the input + parent state
 * locks in the chosen address.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

interface Prediction {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
}

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  onSelect: (address: string, placeId: string) => void;
  placeholder?: string;
  accentColor?: string;
  testID?: string;
}

export const PlacesAutocomplete: React.FC<Props> = ({
  value,
  onChangeText,
  onSelect,
  placeholder = 'Type an address or park name…',
  accentColor = '#FF6A00',
  testID,
}) => {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const justSelectedRef = useRef(false);

  // iter102ar: "Use my current location" — reverse-geocode the device's GPS
  // fix via Google's Geocoding API and lock the result into the input. One-tap
  // outdoor location for trainees at a park; works just as well for trainers
  // editing their primaryGym in the future.
  const useCurrentLocation = async () => {
    if (!GOOGLE_KEY) return;
    try {
      setGpsLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = loc.coords;
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 'OK' && data.results?.[0]) {
        const address = data.results[0].formatted_address as string;
        justSelectedRef.current = true;
        onChangeText(address);
        onSelect(address, data.results[0].place_id || '');
        setShowResults(false);
        setPredictions([]);
      }
    } catch {
      // silent — user can fall back to typing
    } finally {
      setGpsLoading(false);
    }
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Skip a fetch right after a user tap (otherwise we'd re-query on
    // the newly-set full address).
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }
    const q = value.trim();
    if (!q || q.length < 3 || !GOOGLE_KEY) {
      setPredictions([]);
      setShowResults(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        setLoading(true);
        const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&types=geocode|establishment&key=${GOOGLE_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status === 'OK' && Array.isArray(data.predictions)) {
          setPredictions(data.predictions.slice(0, 5));
          setShowResults(true);
        } else {
          setPredictions([]);
        }
      } catch {
        setPredictions([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  return (
    <View>
      <View style={[s.inputWrap, { borderColor: `${accentColor}40` }]}>
        <Ionicons name="location" size={18} color={accentColor} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setShowResults(true)}
          placeholder={placeholder}
          placeholderTextColor="rgba(255,255,255,0.4)"
          style={s.input}
          maxLength={200}
          autoCorrect={false}
          returnKeyType="done"
          data-testid={testID}
        />
        {loading && <ActivityIndicator size="small" color={accentColor} />}
      </View>

      {showResults && (
        <View style={s.dropdown}>
          {/* iter102ar: GPS quick-action — always first in the list. */}
          <TouchableOpacity
            style={[s.predictionRow, s.gpsRow]}
            onPress={useCurrentLocation}
            disabled={gpsLoading}
            data-testid="use-current-location-btn"
          >
            {gpsLoading ? (
              <ActivityIndicator size="small" color={accentColor} />
            ) : (
              <Ionicons name="navigate-circle" size={18} color={accentColor} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={[s.predictionMain, { color: accentColor }]}>
                Use my current location
              </Text>
              <Text style={s.predictionSub}>Auto-fills from GPS</Text>
            </View>
          </TouchableOpacity>

          {predictions.map((p) => (
            <TouchableOpacity
              key={p.place_id}
              style={s.predictionRow}
              onPress={() => {
                justSelectedRef.current = true;
                onChangeText(p.description);
                onSelect(p.description, p.place_id);
                setShowResults(false);
                setPredictions([]);
              }}
            >
              <Ionicons name="pin" size={16} color={accentColor} />
              <View style={{ flex: 1 }}>
                <Text style={s.predictionMain} numberOfLines={1}>
                  {p.structured_formatting?.main_text || p.description}
                </Text>
                {p.structured_formatting?.secondary_text ? (
                  <Text style={s.predictionSub} numberOfLines={1}>
                    {p.structured_formatting.secondary_text}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    paddingVertical: 0,
  },
  dropdown: {
    marginTop: 6,
    borderRadius: 12,
    backgroundColor: '#141929',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  predictionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  gpsRow: {
    backgroundColor: 'rgba(255,106,0,0.06)',
  },
  predictionMain: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  predictionSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 1,
  },
});

export default PlacesAutocomplete;
