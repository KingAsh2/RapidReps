import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, s, formatCents, StatCard, DonutChart, MiniBarChart } from './AdminShared';
import { AnimatedBarChart } from '../AnimatedBarChart';

interface Props {
  dashboard: any;
  leaderboard: any[];
  earningsSummary: any;
  setActiveTab: (tab: string) => void;
}

export const OverviewTab = ({ dashboard, leaderboard, earningsSummary, setActiveTab }: Props) => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'today' | 'week' | 'month'>('month');
  const [earningsPeriod, setEarningsPeriod] = useState<'week' | 'month' | '6months'>('week');

  if (!dashboard) return null;

  const platformPct = dashboard.totalRevenueCents > 0 ? (dashboard.platformRevenueCents / dashboard.totalRevenueCents) * 100 : 25;
  const trainerPct = 100 - platformPct;
  const pendingCount = dashboard.pendingVerifications || 0;

  // Real earnings chart data
  const getChartData = () => {
    if (!earningsSummary) return { data: [0, 0, 0, 0, 0, 0, 0], labels: ['M', 'T', 'W', 'T', 'F', 'S', 'S'], platformData: [] };
    if (earningsPeriod === 'week') {
      const daily = earningsSummary.dailyBreakdown || [];
      return {
        data: daily.map((d: any) => d.revenueCents / 100),
        labels: daily.map((d: any) => d.day),
        platformData: daily.map((d: any) => d.platformCents / 100),
        sessions: daily.map((d: any) => d.sessions),
      };
    }
    if (earningsPeriod === 'month') {
      const weekly = earningsSummary.weeklyBreakdown || [];
      return {
        data: weekly.map((w: any) => w.revenueCents / 100),
        labels: weekly.map((w: any) => w.week?.replace('Week ', 'W')),
        platformData: weekly.map((w: any) => w.platformCents / 100),
        sessions: weekly.map((w: any) => w.sessions),
      };
    }
    // 6months
    const monthly = earningsSummary.monthlyBreakdown || [];
    return {
      data: monthly.map((m: any) => m.revenueCents / 100),
      labels: monthly.map((m: any) => m.month),
      platformData: monthly.map((m: any) => m.platformCents / 100),
      sessions: monthly.map((m: any) => m.sessions),
    };
  };

  const chartInfo = getChartData();
  const maxBarVal = Math.max(1, ...chartInfo.data);

  // Earnings summary stats
  const weekRevenue = earningsSummary?.weekRevenueCents || 0;
  const lastWeekRevenue = earningsSummary?.lastWeekRevenueCents || 0;
  const monthRevenue = earningsSummary?.monthRevenueCents || 0;
  const lastMonthRevenue = earningsSummary?.lastMonthRevenueCents || 0;
  const weekChange = lastWeekRevenue > 0 ? Math.round(((weekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100) : 0;
  const monthChange = lastMonthRevenue > 0 ? Math.round(((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100) : 0;

  const TimeframePills = () => {
    const options: { key: 'today' | 'week' | 'month'; label: string }[] = [
      { key: 'today', label: 'Today' },
      { key: 'week', label: 'This Week' },
      { key: 'month', label: 'This Month' },
    ];
    return (
      <View style={s.timeframePills} data-testid="timeframe-pills">
        {options.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={[s.timeframePill, selectedTimeframe === opt.key && s.timeframePillActive]}
            onPress={() => setSelectedTimeframe(opt.key)}
            data-testid={`timeframe-${opt.key}`}
          >
            <Text style={[s.timeframePillText, selectedTimeframe === opt.key && s.timeframePillTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <View>
      <TimeframePills />

      <Text style={s.sectionTitle}>Platform Stats</Text>
      <View style={s.statsGrid}>
        <TouchableOpacity onPress={() => setActiveTab('users')} data-testid="stat-total-users">
          <StatCard icon="people" label="Total Users" value={dashboard.totalUsers} color={'#FF6A00'} subtitle="All-time" growth="+12%" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveTab('users')} data-testid="stat-trainers">
          <StatCard icon="fitness" label="Trainers" value={dashboard.totalTrainers} color={C.orange} subtitle="Approved trainers" growth="+3%" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveTab('users')} data-testid="stat-trainees">
          <StatCard icon="person" label="Trainees" value={dashboard.totalTrainees} color={'#FF6A00'} subtitle="Active clients" growth="+8%" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveTab('sessions')} data-testid="stat-sessions">
          <StatCard icon="calendar" label="Sessions" value={dashboard.totalSessions} color={C.success} subtitle="Booked in period" growth="+5%" />
        </TouchableOpacity>
      </View>

      <Text style={s.sectionTitle}>User Breakdown</Text>
      <View style={s.chartCard}>
        <View style={s.chartRow}>
          <DonutChart
            segments={[
              { value: dashboard.totalTrainers, color: C.orange, label: 'Trainers' },
              { value: dashboard.totalTrainees, color: '#FF6A00', label: 'Trainees' },
            ]}
            size={130} strokeWidth={18} centerLabel="Users" centerValue={String(dashboard.totalUsers)}
          />
          <View style={s.chartLegend}>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: C.orange }]} />
              <Text style={s.legendLabel}>Trainers</Text>
              <Text style={s.legendValue}>{dashboard.totalTrainers}</Text>
            </View>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: '#FF6A00' }]} />
              <Text style={s.legendLabel}>Trainees</Text>
              <Text style={s.legendValue}>{dashboard.totalTrainees}</Text>
            </View>
            <View style={s.legendDivider} />
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: '#0A0E1A' }]} />
              <Text style={s.legendLabel}>Total</Text>
              <Text style={[s.legendValue, { fontWeight: '900' }]}>{dashboard.totalUsers}</Text>
            </View>
          </View>
        </View>
      </View>

      <Text style={s.sectionTitle}>Revenue</Text>
      <View style={s.chartCard}>
        <View style={s.chartRow}>
          <DonutChart
            segments={[
              { value: dashboard.platformRevenueCents, color: C.success, label: 'Platform' },
              { value: dashboard.trainerPayoutsCents, color: C.orange, label: 'Trainers' },
            ]}
            size={130} strokeWidth={18} centerLabel="Total" centerValue={formatCents(dashboard.totalRevenueCents)}
          />
          <View style={s.chartLegend}>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: C.success }]} />
              <Text style={s.legendLabel}>Platform (20%)</Text>
              <Text style={[s.legendValue, { color: C.success }]}>{formatCents(dashboard.platformRevenueCents)}</Text>
            </View>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: C.orange }]} />
              <Text style={s.legendLabel}>Trainers (80%)</Text>
              <Text style={s.legendValue}>{formatCents(dashboard.trainerPayoutsCents)}</Text>
            </View>
          </View>
        </View>
        <View style={s.revenueBarContainer}>
          <View style={[s.revenueBarSegment, { flex: platformPct, backgroundColor: C.success, borderTopLeftRadius: 6, borderBottomLeftRadius: 6 }]} />
          <View style={[s.revenueBarSegment, { flex: trainerPct, backgroundColor: C.orange, borderTopRightRadius: 6, borderBottomRightRadius: 6 }]} />
        </View>
        <View style={s.revenueBarLabels}>
          <Text style={[s.revenueBarLabel, { color: C.success }]}>Platform {platformPct.toFixed(0)}%</Text>
          <Text style={[s.revenueBarLabel, { color: C.orange }]}>Trainers {trainerPct.toFixed(0)}%</Text>
        </View>
      </View>

      {/* Earnings Trend Chart */}
      <Text style={s.sectionTitle}>Earnings Trend</Text>
      <View style={s.chartCard}>
        {/* Period toggle pills */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }} data-testid="earnings-period-toggle">
          {(['week', 'month', '6months'] as const).map((p) => (
            <TouchableOpacity
              key={p}
              onPress={() => setEarningsPeriod(p)}
              style={{
                paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                backgroundColor: earningsPeriod === p ? '#FF6A00' : 'rgba(255,255,255,0.06)',
                borderWidth: 1,
                borderColor: earningsPeriod === p ? '#FF6A00' : 'rgba(255,255,255,0.08)',
              }}
              data-testid={`earnings-period-${p}`}
            >
              <Text style={{
                fontSize: 12, fontWeight: '700',
                color: earningsPeriod === p ? '#fff' : C.gray,
              }}>
                {p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : '6 Months'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Summary row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }}>
          <View>
            <Text style={{ fontSize: 12, color: C.gray, fontWeight: '600' }}>
              {earningsPeriod === 'week' ? 'Weekly Revenue' : earningsPeriod === 'month' ? 'Monthly Revenue' : '6-Month Revenue'}
            </Text>
            <Text style={{ fontSize: 22, fontWeight: '900', color: '#FFFFFF', marginTop: 2 }} data-testid="earnings-total">
              {formatCents(
                earningsPeriod === 'week' ? weekRevenue :
                earningsPeriod === 'month' ? monthRevenue :
                (earningsSummary?.totalRevenueCents || 0)
              )}
            </Text>
          </View>
          {earningsPeriod !== '6months' && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 4,
              backgroundColor: (earningsPeriod === 'week' ? weekChange : monthChange) >= 0 ? `${C.success}15` : '#FF475715',
              paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start',
            }}>
              <Ionicons
                name={(earningsPeriod === 'week' ? weekChange : monthChange) >= 0 ? 'trending-up' : 'trending-down'}
                size={14}
                color={(earningsPeriod === 'week' ? weekChange : monthChange) >= 0 ? C.success : '#FF4757'}
              />
              <Text style={{
                fontSize: 13, fontWeight: '700',
                color: (earningsPeriod === 'week' ? weekChange : monthChange) >= 0 ? C.success : '#FF4757',
              }}>
                {(earningsPeriod === 'week' ? weekChange : monthChange) >= 0 ? '+' : ''}
                {earningsPeriod === 'week' ? weekChange : monthChange}% vs last
              </Text>
            </View>
          )}
        </View>

        {/* Animated bar chart */}
        <AnimatedBarChart
          data={chartInfo.data.map((val: number, idx: number) => ({
            label: chartInfo.labels[idx] || '',
            value: val,
            color: val > 0 ? '#FF6A00' : 'rgba(255,255,255,0.08)',
          }))}
          height={140}
        />

        {/* Platform cut row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F0F1F5' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.success }} />
            <Text style={{ fontSize: 12, color: C.gray, fontWeight: '600' }}>Platform Revenue (20%)</Text>
          </View>
          <Text style={{ fontSize: 13, fontWeight: '800', color: C.success }} data-testid="platform-revenue-summary">
            {formatCents(
              earningsPeriod === 'week' ? Math.round(weekRevenue * 0.20) :
              earningsPeriod === 'month' ? Math.round(monthRevenue * 0.20) :
              (earningsSummary?.platformRevenueCents || 0)
            )}
          </Text>
        </View>
      </View>

      <Text style={s.sectionTitle}>Quick Info</Text>
      <View style={s.statsGrid}>
        <StatCard icon="checkmark-circle" label="Completed" value={dashboard.completedSessions} color={C.success} subtitle="Sessions done" />
        <StatCard icon="star" label="Memberships" value={dashboard.activeMemberships} color={C.warning} subtitle="Active plans" />
        <StatCard icon="flash" label="Boosts" value={dashboard.activeBoosts} color={C.orange} subtitle="Active boosts" />
        <StatCard icon="hourglass" label="Pending" value={pendingCount} color={C.error} subtitle="Awaiting review" />
      </View>

      <Text style={s.sectionTitle}>Attention Needed</Text>
      <View style={s.attentionCard}>
        <TouchableOpacity style={s.attentionRow} onPress={() => setActiveTab('verifications')} data-testid="attention-verifications">
          <View style={[s.attentionIconBg, { backgroundColor: 'rgba(255, 179, 0, 0.12)' }]}>
            <Ionicons name="shield-checkmark" size={16} color={C.warning} />
          </View>
          <Text style={s.attentionText}><Text style={s.attentionCount}>{pendingCount}</Text> trainers pending verification</Text>
          <Ionicons name="chevron-forward" size={16} color={C.gray} />
        </TouchableOpacity>
        <View style={s.attentionDivider} />
        <TouchableOpacity style={s.attentionRow} onPress={() => setActiveTab('payments')} data-testid="attention-payments">
          <View style={[s.attentionIconBg, { backgroundColor: '#FF475720' }]}>
            <Ionicons name="card" size={16} color={C.error} />
          </View>
          <Text style={s.attentionText}><Text style={s.attentionCount}>0</Text> payment issues</Text>
          <Ionicons name="chevron-forward" size={16} color={C.gray} />
        </TouchableOpacity>
        <View style={s.attentionDivider} />
        <TouchableOpacity style={s.attentionRow} onPress={() => setActiveTab('users')} data-testid="attention-low-rated">
          <View style={[s.attentionIconBg, { backgroundColor: '#FF7F0020' }]}>
            <Ionicons name="star-half" size={16} color={C.orange} />
          </View>
          <Text style={s.attentionText}><Text style={s.attentionCount}>0</Text> low-rated trainers ({'<'}3.0)</Text>
          <Ionicons name="chevron-forward" size={16} color={C.gray} />
        </TouchableOpacity>
      </View>

      <Text style={s.sectionTitle}>Session Status</Text>
      <View style={s.chartCard}>
        <View style={s.chartRow}>
          <DonutChart
            segments={[
              { value: dashboard.completedSessions, color: C.success, label: 'Completed' },
              { value: Math.max(dashboard.totalSessions - dashboard.completedSessions, 0), color: C.warning, label: 'Active' },
              { value: pendingCount, color: C.error, label: 'Pending' },
            ]}
            size={120} strokeWidth={16} centerLabel="Sessions" centerValue={String(dashboard.totalSessions)}
          />
          <View style={s.chartLegend}>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: C.success }]} />
              <Text style={s.legendLabel}>Completed</Text>
              <Text style={s.legendValue}>{dashboard.completedSessions}</Text>
            </View>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: C.warning }]} />
              <Text style={s.legendLabel}>Active / Upcoming</Text>
              <Text style={s.legendValue}>{Math.max(dashboard.totalSessions - dashboard.completedSessions, 0)}</Text>
            </View>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: C.error }]} />
              <Text style={s.legendLabel}>Pending Review</Text>
              <Text style={s.legendValue}>{pendingCount}</Text>
            </View>
          </View>
        </View>
      </View>

      <Text style={s.sectionTitle}>Top Trainers This Week</Text>
      {leaderboard.length > 0 ? (
        leaderboard.map((trainer: any, index: number) => {
          const rankColors = ['#FFB300', '#A0A0A0', '#CD7F32', '#FF6A00', '#1A2035'];
          const rankColor = rankColors[index] || C.gray;
          const tierLabel = trainer.tier === 'elite' ? 'Elite' : trainer.tier === 'pro' ? 'Pro' : 'Rising';
          const tierColor = trainer.tier === 'elite' ? C.orange : trainer.tier === 'pro' ? '#FF6A00' : C.gray;
          return (
            <View key={trainer.trainerId} style={[s.leaderRow, index === 0 && s.leaderRowFirst]}>
              <View style={[s.leaderRank, { backgroundColor: `${rankColor}20`, borderColor: rankColor }]}>
                <Text style={[s.leaderRankText, { color: rankColor }]}>#{index + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.leaderName}>{trainer.fullName}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
                  <View style={[s.leaderTierBadge, { backgroundColor: `${tierColor}15` }]}>
                    <Ionicons name="ribbon" size={10} color={tierColor} />
                    <Text style={[s.leaderTierText, { color: tierColor }]}>{tierLabel}</Text>
                  </View>
                  {trainer.averageRating > 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                      <Ionicons name="star" size={11} color={C.warning} />
                      <Text style={s.leaderRating}>{trainer.averageRating}</Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={s.leaderStats}>
                <Text style={s.leaderStatNum}>{trainer.sessionCount}</Text>
                <Text style={s.leaderStatLabel}>sessions</Text>
              </View>
            </View>
          );
        })
      ) : (
        <View style={s.chartCard}>
          <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <Ionicons name="trophy-outline" size={32} color={C.gray} />
            <Text style={{ color: C.gray, fontSize: 13, marginTop: 8 }}>No sessions completed this week yet</Text>
          </View>
        </View>
      )}
    </View>
  );
};
