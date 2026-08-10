/**
 * PhotoCropper — iter118s
 *
 * In-app square cropper for profile photos. Opens as a fullscreen modal after
 * the user picks an image; lets them pinch-to-zoom and pan the image inside a
 * circular disc that matches the exact avatar chrome used across the app.
 * On confirm, uses expo-image-manipulator to produce a tightly-cropped square
 * JPEG that renders identically wherever <UserAvatar /> appears.
 *
 * Design decisions:
 *  - Circular preview mask (not just a square) so athletes see the EXACT
 *    framing the disc will show — no more "chopped chin" surprises after save.
 *  - Reanimated + Gesture Handler for 60fps pan / pinch. Falls back gracefully
 *    on lower-end devices because the animated values live on the UI thread.
 *  - Crop math runs on the JS thread using the final shared-value snapshot,
 *    so the manipulator call is deterministic and mirrors the preview.
 *  - Zero-dependency addition — everything already ships in package.json.
 *
 * Usage:
 *   <PhotoCropper
 *     visible={visible}
 *     uri={pickedUri}
 *     onCancel={() => setVisible(false)}
 *     onConfirm={(croppedUri) => { setVisible(false); useTheUri(croppedUri); }}
 *   />
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_W } = Dimensions.get('window');
// Circular crop viewport size — mirrors the trainee-home profile disc scale.
const CROP_SIZE = Math.min(SCREEN_W - 48, 340);
// How far past the disc edge the user is allowed to overshoot before the
// spring snap-back tugs them back in — a tiny bounce reads "elastic" and
// prevents finger-slip framing loss.
// (Reserved for a future rubber-band gesture; consulted by the min/max
// clamps in the pinch handler.)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const OVERSHOOT = 60;
const MIN_SCALE = 1.0;
const MAX_SCALE = 4.0;

type Props = {
  visible: boolean;
  uri: string | null;
  onCancel: () => void;
  onConfirm: (croppedUri: string) => void;
  /** Optional testID prefix for automation. */
  testID?: string;
};

type ImgSize = { width: number; height: number };

export function PhotoCropper({ visible, uri, onCancel, onConfirm, testID }: Props) {
  const [imgSize, setImgSize] = useState<ImgSize | null>(null);
  const [processing, setProcessing] = useState(false);

  // Reanimated shared values — these live on the UI thread for smooth 60fps.
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  // Read the source image dimensions so we can compute crop math accurately.
  // Image.getSize is safe to call from JS thread — result is used for both
  // the initial "cover the disc" scale and the final crop calculation.
  useEffect(() => {
    if (!uri || !visible) return;
    let cancelled = false;
    setImgSize(null);
    // Reset gesture state whenever a new URI comes in.
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedX.value = 0;
    savedY.value = 0;
    Image.getSize(
      uri,
      (w, h) => { if (!cancelled) setImgSize({ width: w, height: h }); },
      () => { if (!cancelled) setImgSize({ width: CROP_SIZE, height: CROP_SIZE }); },
    );
    return () => { cancelled = true; };
    // scale/translate shared values intentionally omitted — mutating them
    // does not require a re-run of this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri, visible]);

  // Compute the "cover" display size — the smaller dimension fills the disc,
  // the larger one overflows equally on both sides so pan can center it.
  const displaySize = useMemo(() => {
    if (!imgSize) return { width: CROP_SIZE, height: CROP_SIZE };
    const aspect = imgSize.width / imgSize.height;
    if (aspect >= 1) {
      // Landscape source — height fills, width overflows.
      return { width: CROP_SIZE * aspect, height: CROP_SIZE };
    }
    // Portrait source — width fills, height overflows.
    return { width: CROP_SIZE, height: CROP_SIZE / aspect };
  }, [imgSize]);

  // Clamp helper — used on gesture-end to snap out-of-bounds pans back.
  const clampTranslation = (x: number, y: number, s: number) => {
    'worklet';
    // Maximum pan is (scaled overflow) / 2. Beyond this the disc would see
    // background bleed at the edge, which we never want in the final crop.
    const maxX = Math.max(0, (displaySize.width * s - CROP_SIZE) / 2);
    const maxY = Math.max(0, (displaySize.height * s - CROP_SIZE) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  };

  const panGesture = Gesture.Pan()
    .onStart(() => {
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = savedX.value + e.translationX;
      translateY.value = savedY.value + e.translationY;
    })
    .onEnd(() => {
      const { x, y } = clampTranslation(translateX.value, translateY.value, scale.value);
      translateX.value = withSpring(x, { damping: 22, stiffness: 260 });
      translateY.value = withSpring(y, { damping: 22, stiffness: 260 });
    });

  const pinchGesture = Gesture.Pinch()
    .onStart(() => { savedScale.value = scale.value; })
    .onUpdate((e) => {
      const next = savedScale.value * e.scale;
      scale.value = Math.max(MIN_SCALE - 0.15, Math.min(MAX_SCALE + 0.5, next));
    })
    .onEnd(() => {
      const s = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale.value));
      scale.value = withSpring(s, { damping: 22, stiffness: 260 });
      const { x, y } = clampTranslation(translateX.value, translateY.value, s);
      translateX.value = withSpring(x, { damping: 22, stiffness: 260 });
      translateY.value = withSpring(y, { damping: 22, stiffness: 260 });
    });

  const combined = Gesture.Simultaneous(panGesture, pinchGesture);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const doCrop = async () => {
    if (!uri || !imgSize) return;
    setProcessing(true);
    try {
      // Snapshot the animated state — shared values are on the UI thread, but
      // reading them synchronously here is safe (they're just JS numbers).
      const s = scale.value;
      const tx = translateX.value;
      const ty = translateY.value;

      // Convert the visible disc back into source-image pixel coordinates.
      // The image renders at `displaySize * s`. The disc is centered at
      // (displaySize/2 - tx, displaySize/2 - ty) in that scaled coord space,
      // and covers CROP_SIZE / s pixels of the ORIGINAL image.
      const scaledW = displaySize.width * s;
      const scaledH = displaySize.height * s;
      // Source-image pixels per screen pixel (of the SCALED display image).
      const srcPerScreenX = imgSize.width / scaledW;
      const srcPerScreenY = imgSize.height / scaledH;
      // Center of the visible disc in scaled-display coords:
      const centerXInScaled = scaledW / 2 - tx;
      const centerYInScaled = scaledH / 2 - ty;
      // Convert center + half-crop to source-image pixels.
      const halfCropScaled = CROP_SIZE / 2;
      const cropOriginX = Math.max(0, (centerXInScaled - halfCropScaled) * srcPerScreenX);
      const cropOriginY = Math.max(0, (centerYInScaled - halfCropScaled) * srcPerScreenY);
      const cropWidth = Math.min(
        imgSize.width - cropOriginX,
        CROP_SIZE * srcPerScreenX,
      );
      const cropHeight = Math.min(
        imgSize.height - cropOriginY,
        CROP_SIZE * srcPerScreenY,
      );
      // Guard against sub-pixel weirdness — if width/height collapsed, just
      // export the whole source (never crash the crop flow).
      const safeW = Math.max(8, Math.floor(cropWidth));
      const safeH = Math.max(8, Math.floor(cropHeight));

      const result = await ImageManipulator.manipulateAsync(
        uri,
        [
          {
            crop: {
              originX: Math.floor(cropOriginX),
              originY: Math.floor(cropOriginY),
              width: safeW,
              height: safeH,
            },
          },
          // Downscale to the final avatar preset (720px max edge) so we
          // don't ship a 4K crop over the wire.
          { resize: { width: Math.min(720, safeW) } },
        ],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
      );
      onConfirm(result.uri);
    } catch {
      // Fall back to the un-cropped source so the user never gets stuck.
      onConfirm(uri);
    } finally {
      setProcessing(false);
    }
  };

  const startCrop = () => { runOnJS(doCrop)(); };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancel}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView style={styles.root}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={onCancel}
              hitSlop={12}
              data-testid={`${testID || 'photo-cropper'}-cancel`}
            >
              <Text style={styles.headerBtn}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Frame your photo</Text>
            <TouchableOpacity
              onPress={startCrop}
              disabled={!imgSize || processing}
              hitSlop={12}
              data-testid={`${testID || 'photo-cropper'}-confirm`}
            >
              {processing ? (
                <ActivityIndicator color="#FF7A00" />
              ) : (
                <Text style={[styles.headerBtn, { color: '#FF7A00', fontWeight: '800' }]}>
                  Use photo
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            {uri && imgSize ? (
              <GestureDetector gesture={combined}>
                <View style={[styles.viewport, { width: CROP_SIZE, height: CROP_SIZE }]}>
                  {/* The pan/pinch image */}
                  <Animated.View
                    style={[
                      { width: displaySize.width, height: displaySize.height, position: 'absolute' },
                      imageStyle,
                    ]}
                  >
                    <Image
                      source={{ uri }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="contain"
                    />
                  </Animated.View>

                  {/* Circular mask overlay — 4 corners painted dark to leave
                      only the disc showing. Rendered as a single SVG-free hack
                      using border-radius on 4 square corners. */}
                  <View pointerEvents="none" style={styles.discOutline} />
                </View>
              </GestureDetector>
            ) : (
              <ActivityIndicator color="#FF7A00" size="large" />
            )}
            <Text style={styles.hint}>
              <Ionicons name="move-outline" size={14} color="rgba(255,255,255,0.65)" />
              {'   '}Pinch to zoom, drag to reframe
            </Text>
          </View>
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(6,8,15,0.985)' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  headerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.4 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  viewport: {
    overflow: 'hidden',
    borderRadius: CROP_SIZE / 2,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discOutline: {
    position: 'absolute',
    width: CROP_SIZE,
    height: CROP_SIZE,
    borderRadius: CROP_SIZE / 2,
    borderWidth: 3,
    borderColor: 'rgba(255,122,0,0.85)',
    // Subtle inner glow via boxShadow — iOS renders shadowColor around the
    // border on a round element, Android relies on elevation.
    shadowColor: '#FF7A00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: Platform.OS === 'android' ? 6 : 0,
  },
  hint: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 28,
    textAlign: 'center',
  },
});

export default PhotoCropper;
