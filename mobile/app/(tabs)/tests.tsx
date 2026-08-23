import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, RefreshControl, Linking, Alert, Modal, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';

import api, { type ApiResponse, type Test } from '@/services/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/Colors';

export default function TestsScreen() {
  const [tests,   setTests]   = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(false);
  const [page,    setPage]    = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [detail,  setDetail]  = useState<Test | null>(null);

  const fetchTests = useCallback(async (reset = false) => {
    const p = reset ? 1 : page;
    if (!reset && !hasMore) return;
    if (reset) setLoading(true);
    try {
      const res = await api.get<ApiResponse<Test[]>>(`/tests?page=${p}&limit=15`);
      const data = res.data.data;
      setTests(reset ? data : (prev) => [...prev, ...data]);
      setHasMore(p < (res.data.meta?.pages ?? 1));
      if (!reset) setPage(p + 1); else setPage(2);
    } catch { /* handled */ }
    finally { setLoading(false); setRefresh(false); }
  }, [page, hasMore]);

  useEffect(() => { fetchTests(true); }, []);

  async function openPdf(url: string) {
    const ok = await Linking.canOpenURL(url);
    if (ok) Linking.openURL(url);
    else Alert.alert('Error', 'Cannot open PDF');
  }

  async function dispatchTest(test: Test) {
    Alert.alert(
      'Send to Parents',
      `Send "${test.title}" PDF to all parents in this batch via WhatsApp?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            try {
              const res = await api.post<ApiResponse<{ sent: number; failed: number }>>(
                `/tests/${test.id}/dispatch-whatsapp`,
              );
              Alert.alert('✅ Sent', `Delivered to ${res.data.data.sent} parents.`);
            } catch { Alert.alert('Error', 'WhatsApp dispatch failed.'); }
          },
        },
      ],
    );
  }

  return (
    <View style={styles.flex}>
      <FlatList
        data={tests}
        keyExtractor={(t) => String(t.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refresh} onRefresh={() => fetchTests(true)} tintColor={Colors.brand} />
        }
        onEndReached={() => fetchTests()}
        onEndReachedThreshold={0.3}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => setDetail(item)}
            activeOpacity={0.75}
            style={styles.testCard}
          >
            {/* Icon */}
            <View style={styles.testIconBox}>
              <Ionicons name="book-outline" size={22} color={Colors.brand} />
            </View>

            <View style={styles.testInfo}>
              <Text style={styles.testTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.testMeta}>
                {item.subject} · Grade {item.grade}{item.stream ? ` – ${item.stream}` : ''}
              </Text>
              {item.test_date && (
                <Text style={styles.testDate}>
                  📅 {format(new Date(item.test_date), 'dd MMM yyyy')}
                </Text>
              )}
            </View>

            <View style={styles.testRight}>
              <Badge label={`${item.total_marks}m`} variant="blue" />
              <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} style={{ marginTop: 8 }} />
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          loading ? null : (
            <Text style={styles.emptyText}>No test papers yet.</Text>
          )
        }
      />

      {/* Test detail modal */}
      <Modal
        visible={!!detail}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDetail(null)}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Test Details</Text>
          <TouchableOpacity onPress={() => setDetail(null)}>
            <Ionicons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>
        {detail && (
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.testDetailHero}>
              <Ionicons name="book" size={36} color={Colors.brand} />
              <Text style={styles.detailTitle}>{detail.title}</Text>
              <Text style={styles.detailSub}>
                {detail.subject} · Grade {detail.grade}
                {detail.stream ? ` – ${detail.stream}` : ''}
              </Text>
            </View>

            {/* Info rows */}
            <View style={styles.infoGrid}>
              {[
                { icon: 'ribbon-outline',   label: 'Total Marks', value: String(detail.total_marks) },
                { icon: 'time-outline',     label: 'Duration',    value: `${detail.duration_mins} min` },
                { icon: 'layers-outline',   label: 'Batch',       value: detail.batch_name ?? '—' },
                { icon: 'calendar-outline', label: 'Date',        value: detail.test_date ? format(new Date(detail.test_date), 'dd MMM yyyy') : '—' },
              ].map((d) => (
                <View key={d.label} style={styles.infoRow}>
                  <Ionicons name={d.icon as never} size={16} color={Colors.brand} />
                  <Text style={styles.infoLabel}>{d.label}</Text>
                  <Text style={styles.infoValue}>{d.value}</Text>
                </View>
              ))}
            </View>

            {/* Action buttons */}
            <View style={styles.actionBtns}>
              {detail.student_pdf_url && (
                <Button
                  title="Download Student PDF"
                  onPress={() => openPdf(detail.student_pdf_url!)}
                  icon={<Ionicons name="download-outline" size={18} color="#fff" />}
                />
              )}
              {detail.batch_id && detail.student_pdf_url && (
                <Button
                  title="Send to Parents via WhatsApp"
                  onPress={() => dispatchTest(detail)}
                  variant="secondary"
                  icon={<Ionicons name="logo-whatsapp" size={18} color={Colors.brand} />}
                  style={{ marginTop: 10 }}
                />
              )}
            </View>
          </ScrollView>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex:         { flex: 1, backgroundColor: Colors.background },
  list:         { padding: 16, paddingBottom: 40 },
  testCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, marginBottom: 10,
    backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  testIconBox: {
    width: 46, height: 46, borderRadius: 12,
    backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center',
  },
  testInfo:     { flex: 1 },
  testTitle:    { fontSize: 15, fontWeight: '700', color: Colors.text },
  testMeta:     { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  testDate:     { fontSize: 12, color: Colors.textSecondary, marginTop: 3 },
  testRight:    { alignItems: 'flex-end' },
  emptyText:    { textAlign: 'center', color: Colors.textSecondary, marginTop: 60, fontSize: 14 },
  // Modal
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  modalTitle:     { fontSize: 17, fontWeight: '700', color: Colors.text },
  modalContent:   { padding: 24 },
  testDetailHero: { alignItems: 'center', gap: 8, marginBottom: 24 },
  detailTitle:    { fontSize: 20, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  detailSub:      { fontSize: 14, color: Colors.textSecondary },
  infoGrid: {
    backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  infoLabel:      { flex: 1, fontSize: 13, color: Colors.textSecondary },
  infoValue:      { fontSize: 14, fontWeight: '600', color: Colors.text },
  actionBtns:     { gap: 0 },
});
