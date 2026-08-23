import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, RefreshControl, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';

import api, { type ApiResponse, type Batch } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Colors } from '@/constants/Colors';

type Status = 'present' | 'absent' | 'late' | 'holiday';

interface GridRow {
  studentId:   number;
  studentName: string;
  rollNumber:  string;
  status:      Status;
}

const STATUS_CYCLE: Status[] = ['present', 'absent', 'late', 'holiday'];

const STATUS_CONFIG: Record<Status, { label: string; bg: string; textColor: string; icon: string }> = {
  present: { label: 'P', bg: '#dcfce7', textColor: '#16a34a', icon: 'checkmark-circle' },
  absent:  { label: 'A', bg: '#fee2e2', textColor: '#dc2626', icon: 'close-circle'     },
  late:    { label: 'L', bg: '#fef9c3', textColor: '#ca8a04', icon: 'time'             },
  holiday: { label: 'H', bg: '#f1f5f9', textColor: '#64748b', icon: 'sunny'            },
};

export default function AttendanceScreen() {
  const [batches,    setBatches]    = useState<Batch[]>([]);
  const [batchId,    setBatchId]    = useState<number | null>(null);
  const [date,       setDate]       = useState(format(new Date(), 'yyyy-MM-dd'));
  const [grid,       setGrid]       = useState<GridRow[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [refresh,    setRefresh]    = useState(false);

  useEffect(() => {
    api.get<ApiResponse<Batch[]>>('/batches?active=false')
      .then((r) => {
        setBatches(r.data.data);
        if (r.data.data.length) setBatchId(r.data.data[0].id);
      })
      .catch(() => {});
  }, []);

  const loadGrid = useCallback(async (isRefresh = false) => {
    if (!batchId) return;
    if (isRefresh) setRefresh(true); else setLoading(true);
    try {
      const [studRes, attRes] = await Promise.all([
        api.get<ApiResponse<{ id: number; name: string; roll_number: string }[]>>(
          `/students?batchId=${batchId}&limit=200`,
        ),
        api.get<ApiResponse<{ student_id: number; status: Status }[]>>(
          `/attendance/batch/${batchId}?date=${date}`,
        ),
      ]);
      const attMap = new Map(attRes.data.data.map((a) => [a.student_id, a.status]));
      setGrid(studRes.data.data.map((s) => ({
        studentId:   s.id,
        studentName: s.name,
        rollNumber:  s.roll_number ?? '—',
        status:      attMap.get(s.id) ?? 'present',
      })));
    } catch { Alert.alert('Error', 'Failed to load attendance data'); }
    finally { setLoading(false); setRefresh(false); }
  }, [batchId, date]);

  useEffect(() => { loadGrid(); }, [loadGrid]);

  function cycleStatus(idx: number) {
    setGrid((prev) => {
      const next = [...prev];
      const cur  = STATUS_CYCLE.indexOf(next[idx].status);
      next[idx]  = { ...next[idx], status: STATUS_CYCLE[(cur + 1) % STATUS_CYCLE.length] };
      return next;
    });
  }

  function markAll(status: Status) {
    setGrid((prev) => prev.map((r) => ({ ...r, status })));
  }

  async function saveAttendance() {
    if (!batchId || !grid.length) return;
    setSaving(true);
    try {
      await api.post('/attendance/mark', {
        batchId,
        date,
        records: grid.map((r) => ({ studentId: r.studentId, status: r.status })),
      });
      Alert.alert('✅ Saved', `Attendance saved for ${grid.length} students.`);
    } catch { Alert.alert('Error', 'Failed to save attendance.'); }
    finally { setSaving(false); }
  }

  const present = grid.filter((r) => r.status === 'present').length;
  const absent  = grid.filter((r) => r.status === 'absent').length;

  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.bg}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => loadGrid(true)} tintColor={Colors.brand} />}
      >
        {/* Batch selector */}
        <Text style={styles.sectionLabel}>Select Batch</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.batchScroll}>
          {batches.map((b) => (
            <TouchableOpacity
              key={b.id}
              onPress={() => setBatchId(b.id)}
              style={[styles.batchChip, batchId === b.id && styles.batchChipActive]}
              activeOpacity={0.75}
            >
              <Text style={[styles.batchChipText, batchId === b.id && styles.batchChipTextActive]}>
                {b.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Date */}
        <Card style={styles.dateCard}>
          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={18} color={Colors.brand} />
            <Text style={styles.dateText}>
              {format(new Date(date), 'EEEE, MMMM d yyyy')}
            </Text>
          </View>
        </Card>

        {/* Summary strip */}
        {grid.length > 0 && (
          <View style={styles.summaryRow}>
            <View style={[styles.summaryChip, { backgroundColor: '#dcfce7' }]}>
              <Text style={[styles.summaryText, { color: '#16a34a' }]}>✓ Present: {present}</Text>
            </View>
            <View style={[styles.summaryChip, { backgroundColor: '#fee2e2' }]}>
              <Text style={[styles.summaryText, { color: '#dc2626' }]}>✗ Absent: {absent}</Text>
            </View>
            <View style={[styles.summaryChip, { backgroundColor: '#f1f5f9' }]}>
              <Text style={[styles.summaryText, { color: Colors.textSecondary }]}>Total: {grid.length}</Text>
            </View>
          </View>
        )}

        {/* Mark-all buttons */}
        {grid.length > 0 && (
          <View style={styles.markAllRow}>
            <Text style={styles.markAllLabel}>Mark all:</Text>
            {STATUS_CYCLE.map((s) => {
              const cfg = STATUS_CONFIG[s];
              return (
                <TouchableOpacity
                  key={s}
                  onPress={() => markAll(s)}
                  style={[styles.markAllChip, { backgroundColor: cfg.bg }]}
                >
                  <Text style={[styles.markAllChipText, { color: cfg.textColor }]}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Loading / empty */}
        {loading ? (
          <Text style={styles.emptyText}>Loading students…</Text>
        ) : grid.length === 0 ? (
          <Text style={styles.emptyText}>
            {batches.length === 0 ? 'No batches found.' : 'No students in this batch.'}
          </Text>
        ) : (
          /* Student grid */
          <View style={styles.grid}>
            {grid.map((row, idx) => {
              const cfg = STATUS_CONFIG[row.status];
              return (
                <TouchableOpacity
                  key={row.studentId}
                  onPress={() => cycleStatus(idx)}
                  activeOpacity={0.7}
                  style={[styles.studentCard, { backgroundColor: cfg.bg }]}
                >
                  <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                    <Text style={[styles.statusLabel, { color: cfg.textColor }]}>{cfg.label}</Text>
                  </View>
                  <View style={styles.studentInfo}>
                    <Text style={[styles.studentName, { color: cfg.textColor }]} numberOfLines={1}>
                      {row.studentName}
                    </Text>
                    <Text style={[styles.rollNum, { color: cfg.textColor, opacity: 0.7 }]}>
                      {row.rollNumber}
                    </Text>
                  </View>
                  <Ionicons
                    name={cfg.icon as never}
                    size={18}
                    color={cfg.textColor}
                    style={{ opacity: 0.8 }}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={styles.spacer} />
      </ScrollView>

      {/* Save button — sticky at bottom */}
      {grid.length > 0 && (
        <View style={styles.footer}>
          <Button
            title="Save Attendance"
            onPress={saveAttendance}
            loading={saving}
            icon={<Ionicons name="checkmark-circle-outline" size={18} color="#fff" />}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex:             { flex: 1 },
  bg:               { flex: 1, backgroundColor: Colors.background },
  content:          { padding: 20, paddingBottom: 100 },
  sectionLabel:     { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 10 },
  batchScroll:      { marginBottom: 16 },
  batchChip: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, marginRight: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
  },
  batchChipActive:  { backgroundColor: Colors.brand, borderColor: Colors.brand },
  batchChipText:    { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  batchChipTextActive: { color: '#fff' },
  dateCard:         { flexDirection: 'row', padding: 12, marginBottom: 16 },
  dateRow:          { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateText:         { fontSize: 14, fontWeight: '600', color: Colors.text },
  summaryRow:       { flexDirection: 'row', gap: 8, marginBottom: 12 },
  summaryChip:      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  summaryText:      { fontSize: 12, fontWeight: '700' },
  markAllRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  markAllLabel:     { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  markAllChip:      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  markAllChipText:  { fontSize: 12, fontWeight: '600' },
  grid:             { gap: 8 },
  studentCard: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12, borderRadius: 14, gap: 12,
  },
  statusBadge: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  statusLabel:  { fontSize: 14, fontWeight: '800' },
  studentInfo:  { flex: 1 },
  studentName:  { fontSize: 14, fontWeight: '600' },
  rollNum:      { fontSize: 12, marginTop: 2 },
  emptyText:    { textAlign: 'center', color: Colors.textSecondary, marginTop: 40, fontSize: 14 },
  spacer:       { height: 20 },
  footer: {
    padding: 16,
    paddingBottom: 24,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
});
