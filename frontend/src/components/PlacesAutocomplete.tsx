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
  // iter106i: cache the user's coarse GPS once on mount so we can bias
  // autocomplete results to nearby streets/parks instead of returning
  // international matches like "Starnberg, Germany" when they type "Star".
  // Only reads location if permission has ALREADY been granted — we do not
  // pop a prompt just to bias autocomplete.
  const biasRef = useRef<{ latitude: number; longitude: number } | null>(null);

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

  // iter106i: best-effort prime of the locationBias on mount. We do NOT
  // prompt — we only consume the cached fix if the user already granted
  // foreground location to the app elsewhere (the trainee dashboard already
  // requests it for the Nearby Trainers map).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getLastKnownPositionAsync();
        if (cancelled || !loc) return;
        biasRef.current = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      } catch { /* ignore — autocomplete still works without bias */ }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
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
        // iter106e: Places API (New) — Google has deprecated the legacy
        // `maps/api/place/autocomplete/json` endpoint. The new endpoint is a
        // POST to `places.googleapis.com/v1/places:autocomplete` with the
        // key in the `X-Goog-Api-Key` header.
        //
        // Required Google Cloud setup (one-time, on the project that owns
        // EXPO_PUBLIC_GOOGLE_MAPS_API_KEY):
        //   1. Enable "Places API (New)" in the API library.
        //   2. Make sure the key has no API restriction OR includes
        //      "Places API (New)" in its allow-list.
        const body: any = {
          input: q,
          // iter106i: US-default + nearby-first results. Circle = 50km
          // around the user's last-known GPS when available; falls back to
          // pure regionCode bias otherwise.
          regionCode: 'US',
          languageCode: 'en',
        };
        if (biasRef.current) {
          body.locationBias = {
            circle: {
              center: {
                latitude: biasRef.current.latitude,
                longitude: biasRef.current.longitude,
              },
              radius: 50000, // 50 km
            },
          };
        }
        const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_KEY,
          },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        const suggestions = Array.isArray(data?.suggestions) ? data.suggestions : [];
        if (suggestions.length > 0) {
          // Map the new shape onto the existing UI props so we don't have to
          // change the dropdown markup.
          const next: Prediction[] = suggestions.slice(0, 5).map((sg: any) => {
            const pp = sg.placePrediction || {};
            const text = pp?.text?.text || '';
            const mainText = pp?.structuredFormat?.mainText?.text || text;
            const secondaryText = pp?.structuredFormat?.secondaryText?.text || '';
            return {
              place_id: pp?.placeId || pp?.place || text,
              description: text,
              structured_formatting: {
                main_text: mainText,
                secondary_text: secondaryText,
              },
            };
          });
          setPredictions(next);
          setShowResults(true);
        } else {
          // Surface the Google error message in dev so misconfiguration
          // (e.g. API not enabled) doesn't get silently swallowed.
          if (data?.error?.message) {
            console.warn('Places autocomplete:', data.error.message);
          }
          setPredictions([]);
        }
      } catch (e) {
        console.warn('Places autocomplete network error:', e);
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
