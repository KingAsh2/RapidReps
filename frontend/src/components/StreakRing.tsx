/**
 * StreakRing — iter105 polish.
 *
 * Renders a circular progress ring around the trainee's avatar showing how
 * close they are to their next streak milestone. Invisible until earned
 * (returns null when streak === 0) so it never adds visual noise on day-1
 * users — but turns on like a victory lap as soon as they have momentum.
 *
 * Pure presentational. Reads `currentStreak` + `nextMilestone` already
 * computed by /api/streaks/me — no business-logic change.
 */
import React from 'react';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { View } from 'react-native';

type Props = {
  size: number;          // outer diameter — match the wrapped avatar
  strokeWidth?: number;  // ring thickness
  currentStreak: number; // weeks
  nextMilestone: number; // weeks
  children: React.ReactNode;
};

export const StreakRing: React.FC<Props> = ({
  size, strokeWidth = 4, currentStreak, nextMilestone, children,
}) => {
  // Don't render the ring at all on day-1 users — keeps the screen quiet
  // until there's something worth celebrating.
  if (!currentStreak || currentStreak <= 0) {
    return <>{children}</>;
  }

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const denom = Math.max(1, nextMilestone || currentStreak);
  const progress = Math.min(1, currentStreak / denom);
  const dashOffset = circumference * (1 - progress);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0 }}>
        <Defs>
          <SvgLinearGradient id="streakRingGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FF6A00" stopOpacity="1" />
            <Stop offset="1" stopColor="#F7931E" stopOpacity="1" />
          </SvgLinearGradient>
        </Defs>
        {/* Faint track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.10)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Filled progress */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#streakRingGrad)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
};
