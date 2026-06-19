/**
 * AnimatedNumber — iter106ap.
 *
 * Counts up from `0` (or previous value) to `value` over `duration` ms.
 * Used for earnings, streaks, sessions-completed and similar "stat" labels.
 * Tiny on purpose — uses Animated.Value + listener instead of pulling in
 * Reanimated for a single-text use case.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text, TextStyle, StyleProp } from 'react-native';

interface Props {
  value: number;
  /** Optional prefix like "$" — rendered before the digits. */
  prefix?: string;
  /** Optional suffix like " pts" — rendered after the digits. */
  suffix?: string;
  /** Decimal places to render (e.g. 2 for currency). */
  decimals?: number;
  duration?: number;
  style?: StyleProp<TextStyle>;
  testID?: string;
}

export const AnimatedNumber: React.FC<Props> = ({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  duration = 700,
  style,
  testID,
}) => {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(() => value.toFixed(decimals));
  const prev = useRef(value);

  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    anim.setValue(from);
    const id = anim.addListener(({ value: v }) => {
      setDisplay(v.toFixed(decimals));
    });
    Animated.timing(anim, {
      toValue: value,
      duration,
      // Driving JS thread because we're sampling the listener for text.
      // The label itself only updates ~60 times during the animation; for a
      // single text node that's fine and avoids native-driver text limits.
      useNativeDriver: false,
    }).start();
    return () => anim.removeListener(id);
  }, [value, duration, decimals, anim]);

  return (
    <Text style={style} testID={testID}>
      {prefix}
      {display}
      {suffix}
    </Text>
  );
};

export default AnimatedNumber;
