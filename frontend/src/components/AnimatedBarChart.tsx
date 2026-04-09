import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';

interface AnimatedBarChartProps {
  data: { label: string; value: number; color: string }[];
  height?: number;
}

export const AnimatedBarChart: React.FC<AnimatedBarChartProps> = ({ data, height = 140 }) => {
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const barAnims = useRef(data.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    // Staggered bar entrance animation
    const animations = barAnims.map((anim, i) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 600,
        delay: i * 100,
        useNativeDriver: false, // height animation needs non-native
      })
    );
    Animated.stagger(80, animations).start();
  }, [data]);

  return (
    <View style={[styles.container, { height }]}>
      <View style={styles.barsRow}>
        {data.map((item, i) => {
          const barHeight = barAnims[i]
            ? barAnims[i].interpolate({
                inputRange: [0, 1],
                outputRange: [0, (item.value / maxVal) * (height - 30)],
              })
            : 0;

          return (
            <View key={i} style={styles.barColumn}>
              <View style={[styles.barTrack, { height: height - 30 }]}>
                <Animated.View
                  style={[
                    styles.bar,
                    {
                      height: barHeight,
                      backgroundColor: item.color,
                      shadowColor: item.color,
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.4,
                      shadowRadius: 8,
                    },
                  ]}
                />
              </View>
              <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  barsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
  },
  barTrack: {
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: {
    width: '60%',
    minWidth: 16,
    borderRadius: 8,
    minHeight: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    marginTop: 6,
    textAlign: 'center',
  },
});
