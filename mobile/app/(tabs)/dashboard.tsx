import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  RefreshControl, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import api, {
  type ApiResponse, type AnalyticsSummary, type LowAttendanceAlert,
} from '@/services/api';
import { getUser } from '@/services/auth';
import type { User } from '@/services/api';
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Colors } from '@/constants/Colors';

export default function DashboardScreen() {
  const [user,     setUser]     = useState<User | null>(null);
  const [summary,  setSummary]  = useState<AnalyticsSummary | null>(null);
  const [alerts,   setAlerts]   = useState<LowAttendanceAlert[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [refresh,  setRefresh]  = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefresh(true); else setLoading(true);
    try {
      const [u, sumRes, alertRes] = await Promise.all([
        getUser(),
        api.get<ApiResponse<AnalyticsSummary>>('/analytics/attendance/today'),
        api.get<ApiResponse<LowAttendanceAlert[]>>('/analytics/attendance/alerts?threshold=75'),
      ]);
      setUser(u);
      setSummary(sumRes.data.data);
      setAlerts(alertRes.data.data);
    } catch { /* axios interceptor handles 401 */ }
    finally { setLoading(false); setRefresh(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function greeting() {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  }

  if (loading) return <LoadingScreen />;

  return (
    <ScrollView
      style={styles.bg}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => load(true)} tintColor={Colors.brand} />}
    >
      {/* Greeting */}
      <View style={styles.greeting}>
        <Text style={styles.greetText}>{greeting()}, {user?.name?.split(' ')[0] ?? 'there'} 👋</Text>
        <Text style={styles.dateText}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>
      </View>

      {/* Stats grid */}
      <View style={styles.statsRow}>
        <StatCard
          title="Marked Today"
          value={summary?.totalStudents ?? 0}
          icon="people"
          color="blue"
        />
        <StatCard
          title="Present"
          value={summary?.presentToday ?? 0}
          icon="checkmark-circle"
          color="green"
        />
      </View>
      <View style={styles.statsRow}>
        <StatCard
          title="Absent"
          value={summary?.absentToday ?? 0}
          icon="close-circle"
          color="red"
        />
        <StatCard
          title="Attendance %"
          value={`${summary?.attendancePercentage ?? 0}%`}
          icon="bar-chart"
          color={(summary?.attendancePercentage ?? 0) >= 75 ? 'green' : 'red'}
        />
      </View>

      {/* Quick actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsRow}>
        {[
          { label: 'Mark\nAttendance', icon: 'calendar', route: '/(tabs)/attendance', color: '#dbeafe', iconColor: Colors.brand },
          { label: 'Students',        icon: 'people',    route: '/(tabs)/students',   color: '#dcfce7', iconColor: Colors.success },
          { label: 'Test\nPapers',    icon: 'book',      route: '/(tabs)/tests',      color: '#ede9fe', iconColor: '#7c3aed' },
          { label: 'Profile',         icon: 'person',    route: '/(tabs)/profile',    color: '#fef9c3', iconColor: Colors.warning },
        ].map((a) => (
          <TouchableOpacity
            key={a.label}
            onPress={() => router.push(a.route as never)}
            style={[styles.actionBtn, { backgroundColor: a.color }]}
            activeOpacity={0.75}
          >
            <Ionicons name={a.icon as never} size={26} color={a.iconColor} />
            <Text style={[styles.actionLabel, { color: a.iconColor }]}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Low-attendance alerts */}
      {alerts.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>
            ⚠️ Low Attendance Alerts ({alerts.length})
          </Text>
          <Card style={styles.alertCard}>
            {alerts.slice(0, 6).map((a, idx) => (
              <View key={a.studentId} style={[styles.alertRow, idx < Math.min(alerts.length - 1, 5) && styles.alertDivider]}>
                <View style={styles.alertLeft}>
                  <Text style={styles.alertName}>{a.studentName}</Text>
                  <Text style={styles.alertBatch}>{a.batchName}</Text>
                </View>
                <Badge
                  label={`${a.attendancePercent}%`}
                  variant={a.attendancePercent < 60 ? 'red' : 'yellow'}
                />
              </View>
            ))}
          </Card>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg:           { flex: 1, backgroundColor: Colors.background },
  content:      { padding: 20, paddingBottom: 40 },
  greeting:     { marginBottom: 20 },
  greetText:    { fontSize: 22, fontWeight: '700', color: Colors.text },
  dateText:     { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  statsRow:     { flexDirection: 'row', gap: 12, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginTop: 8, marginBottom: 12 },
  actionsRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  actionBtn: {
    width: '47%', padding: 16, borderRadius: 16,
    alignItems: 'center', gap: 8,
  },
  actionLabel:  { fontSize: 12, fontWeight: '600', textAlign: 'center', lineHeight: 17 },
  alertCard:    { padding: 0, overflow: 'hidden' },
  alertRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', padding: 14,
  },
  alertDivider: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  alertLeft:    { flex: 1 },
  alertName:    { fontSize: 14, fontWeight: '600', color: Colors.text },
  alertBatch:   { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
});
