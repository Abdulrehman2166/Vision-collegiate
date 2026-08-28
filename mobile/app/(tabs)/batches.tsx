import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Modal, ScrollView, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import api, { type ApiResponse, type Batch } from '@/services/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Colors } from '@/constants/Colors';

interface BatchForm {
  name: string;
  grade: 'Juniors' | 'IX' | 'X' | 'XI' | 'XII';
  stream: string;
  is_active: boolean;
}
const EMPTY: BatchForm = { name: '', grade: 'Juniors', stream: '', is_active: true };

const GRADES = ['Juniors', 'IX', 'X', 'XI', 'XII'] as const;

export default function BatchesScreen() {
  const [batches,   setBatches]   = useState<Batch[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [refresh,   setRefresh]   = useState(false);
  const [formOpen,  setFormOpen]  = useState(false);
  const [editBatch, setEditBatch] = useState<Batch | null>(null);
  const [form,      setForm]      = useState<BatchForm>(EMPTY);
  const [saving,    setSaving]    = useState(false);
  const [errors,    setErrors]    = useState<Partial<BatchForm>>({});

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefresh(true); else setLoading(true);
    try {
      const res = await api.get<ApiResponse<Batch[]>>('/batches?active=false');
      setBatches(res.data.data);
    } catch { /* handled */ }
    finally { setLoading(false); setRefresh(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditBatch(null);
    setForm(EMPTY);
    setErrors({});
    setFormOpen(true);
  }

  function openEdit(b: Batch) {
    setEditBatch(b);
    setForm({ name: b.name, grade: b.grade as BatchForm['grade'], stream: b.stream ?? '', is_active: b.is_active });
    setErrors({});
    setFormOpen(true);
  }

  function setField(k: keyof BatchForm, v: string | boolean) {
    setForm((p) => ({ ...p, [k]: v }));
    if (errors[k as keyof typeof errors]) setErrors((p) => ({ ...p, [k]: undefined }));
  }

  function validate() {
    const e: Partial<BatchForm> = {};
    if (!form.name.trim()) e.name = 'Batch name is required';
    setErrors(e);
    return !Object.keys(e).length;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), grade: form.grade, stream: form.stream.trim() || null, is_active: form.is_active };
      if (editBatch) {
        await api.put(`/batches/${editBatch.id}`, payload);
        Alert.alert('✅ Updated', `${form.name} updated.`);
      } else {
        await api.post('/batches', payload);
        Alert.alert('✅ Created', `${form.name} created.`);
      }
      setFormOpen(false);
      load(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Save failed';
      Alert.alert('Error', msg);
    } finally { setSaving(false); }
  }

  function handleDelete(b: Batch) {
    Alert.alert('Delete Batch', `Delete "${b.name}"? Students in this batch will be unassigned.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/batches/${b.id}`);
            Alert.alert('Deleted', `${b.name} removed.`);
            load(true);
          } catch { Alert.alert('Error', 'Delete failed.'); }
        },
      },
    ]);
  }

  // Group by grade
  const gradeOrder = ['Juniors', 'IX', 'X', 'XI', 'XII'];
  const grouped = gradeOrder
    .map((g) => ({ grade: g, items: batches.filter((b) => b.grade === g) }))
    .filter((g) => g.items.length > 0);

  return (
    <View style={styles.flex}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Batches <Text style={styles.headerCount}>({batches.length})</Text></Text>
        <TouchableOpacity onPress={openAdd} style={styles.addBtn} activeOpacity={0.8}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => load(true)} tintColor={Colors.brand} />}
      >
        {loading ? (
          <Text style={styles.loadingText}>Loading batches…</Text>
        ) : batches.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="school-outline" size={48} color={Colors.border} />
            <Text style={styles.emptyText}>No batches yet</Text>
            <Text style={styles.emptySubText}>Tap + to create your first batch</Text>
          </View>
        ) : (
          grouped.map(({ grade, items }) => (
            <View key={grade} style={styles.gradeSection}>
              <Text style={styles.gradeLabel}>Grade {grade}</Text>
              {items.map((b) => (
                <View key={b.id} style={styles.batchCard}>
                  <View style={styles.batchIcon}>
                    <Ionicons name="school" size={20} color={Colors.brand} />
                  </View>
                  <View style={styles.batchInfo}>
                    <Text style={styles.batchName}>{b.name}</Text>
                    <View style={styles.batchMeta}>
                      {b.stream && <Text style={styles.batchMetaText}>{b.stream}</Text>}
                      <Text style={styles.batchMetaText}>
                        <Ionicons name="people" size={11} color={Colors.textSecondary} /> {b.student_count} students
                      </Text>
                      {!b.is_active && <Badge label="Inactive" variant="gray" />}
                    </View>
                  </View>
                  <View style={styles.batchActions}>
                    <TouchableOpacity onPress={() => openEdit(b)} style={styles.iconBtn}>
                      <Ionicons name="pencil-outline" size={18} color={Colors.brand} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(b)} style={styles.iconBtn}>
                      <Ionicons name="trash-outline" size={18} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>

      {/* ── Add / Edit Form Modal ── */}
      <Modal visible={formOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setFormOpen(false)}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{editBatch ? 'Edit Batch' : 'Add Batch'}</Text>
            <TouchableOpacity onPress={() => setFormOpen(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
            <Input
              label="Batch Name *"
              placeholder="e.g. Batch A, Morning Group"
              value={form.name}
              onChangeText={(v) => setField('name', v)}
              error={errors.name}
              leftIcon="people-outline"
            />

            <Text style={styles.fieldLabel}>Grade *</Text>
            <View style={styles.gradeRow}>
              {GRADES.map((g) => (
                <TouchableOpacity
                  key={g}
                  onPress={() => setField('grade', g)}
                  style={[styles.gradeChip, form.grade === g && styles.gradeChipActive]}
                >
                  <Text style={[styles.gradeChipText, form.grade === g && styles.gradeChipTextActive]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input
              label="Stream (optional)"
              placeholder="Science, Commerce, Arts…"
              value={form.stream}
              onChangeText={(v) => setField('stream', v)}
              leftIcon="layers-outline"
            />

            {/* Active toggle */}
            <TouchableOpacity
              onPress={() => setField('is_active', !form.is_active)}
              style={styles.toggleRow}
              activeOpacity={0.7}
            >
              <View style={[styles.toggle, form.is_active && styles.toggleActive]}>
                <View style={[styles.toggleThumb, form.is_active && styles.toggleThumbActive]} />
              </View>
              <Text style={styles.toggleLabel}>Active batch</Text>
            </TouchableOpacity>

            <View style={styles.saveRow}>
              <Button title="Cancel" onPress={() => setFormOpen(false)} variant="secondary" style={styles.saveBtn} />
              <Button
                title={saving ? 'Saving…' : editBatch ? 'Update Batch' : 'Create Batch'}
                onPress={handleSave}
                loading={saving}
                icon={<Ionicons name={editBatch ? 'checkmark' : 'add'} size={18} color="#fff" />}
                style={styles.saveBtn}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex:           { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle:    { fontSize: 18, fontWeight: '700', color: Colors.text },
  headerCount:    { color: Colors.textSecondary, fontWeight: '400' },
  addBtn: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: Colors.brand, alignItems: 'center', justifyContent: 'center',
  },
  content:        { padding: 16, paddingBottom: 60 },
  loadingText:    { textAlign: 'center', color: Colors.textSecondary, marginTop: 40 },
  empty:          { alignItems: 'center', marginTop: 80, gap: 10 },
  emptyText:      { fontSize: 16, fontWeight: '600', color: Colors.textSecondary },
  emptySubText:   { fontSize: 13, color: Colors.textSecondary },
  gradeSection:   { marginBottom: 24 },
  gradeLabel: {
    fontSize: 12, fontWeight: '700', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
  },
  batchCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface, borderRadius: 14,
    padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  batchIcon: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center',
  },
  batchInfo:      { flex: 1 },
  batchName:      { fontSize: 15, fontWeight: '700', color: Colors.text },
  batchMeta:      { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 3, flexWrap: 'wrap' },
  batchMetaText:  { fontSize: 12, color: Colors.textSecondary },
  batchActions:   { flexDirection: 'row', gap: 4 },
  iconBtn:        { padding: 8, borderRadius: 8 },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  sheetTitle:     { fontSize: 17, fontWeight: '700', color: Colors.text },
  closeBtn:       { padding: 4 },
  formContent:    { padding: 20, paddingBottom: 60 },
  fieldLabel:     { fontSize: 13, fontWeight: '500', color: Colors.text, marginBottom: 8 },
  gradeRow:       { flexDirection: 'row', gap: 8, marginBottom: 16 },
  gradeChip: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center',
  },
  gradeChipActive: { backgroundColor: Colors.brand, borderColor: Colors.brand },
  gradeChipText:   { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  gradeChipTextActive: { color: '#fff' },
  toggleRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 16 },
  toggle: {
    width: 46, height: 26, borderRadius: 13,
    backgroundColor: Colors.border, justifyContent: 'center', padding: 2,
  },
  toggleActive:   { backgroundColor: Colors.brand },
  toggleThumb: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#fff', shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2,
  },
  toggleThumbActive: { alignSelf: 'flex-end' },
  toggleLabel:    { fontSize: 15, color: Colors.text, fontWeight: '500' },
  saveRow:        { flexDirection: 'row', gap: 12, marginTop: 24 },
  saveBtn:        { flex: 1 },
});
