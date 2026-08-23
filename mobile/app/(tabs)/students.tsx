'use client';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, RefreshControl, Modal, ScrollView,
  Alert, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import api, { type ApiResponse, type Student, type Batch } from '@/services/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Colors } from '@/constants/Colors';

// ─── Form state ───────────────────────────────────────────────────────────────
interface StudentForm {
  name: string;
  grade: 'IX' | 'X' | 'XI' | 'XII';
  stream: string;
  batch_id: string;
  roll_number: string;
  parent_name: string;
  parent_phone: string;
  parent_email: string;
  address: string;
}

const EMPTY_FORM: StudentForm = {
  name: '', grade: 'IX', stream: '', batch_id: '',
  roll_number: '', parent_name: '', parent_phone: '',
  parent_email: '', address: '',
};

const GRADES = ['IX', 'X', 'XI', 'XII'] as const;

// ─── Component ────────────────────────────────────────────────────────────────
export default function StudentsScreen() {
  const [students,    setStudents]    = useState<Student[]>([]);
  const [batches,     setBatches]     = useState<Batch[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refresh,     setRefresh]     = useState(false);
  const [page,        setPage]        = useState(1);
  const [hasMore,     setHasMore]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [fBatch,      setFBatch]      = useState<number | null>(null);

  // Detail / Edit modal
  const [selected,    setSelected]    = useState<Student | null>(null);
  const [detailOpen,  setDetailOpen]  = useState(false);

  // Add / Edit form modal
  const [formOpen,    setFormOpen]    = useState(false);
  const [editMode,    setEditMode]    = useState(false);
  const [form,        setForm]        = useState<StudentForm>(EMPTY_FORM);
  const [saving,      setSaving]      = useState(false);
  const [formErrors,  setFormErrors]  = useState<Partial<StudentForm>>({});

  // ── Fetch students ──────────────────────────────────────────────────────────
  const fetchStudents = useCallback(async (reset = false) => {
    const p = reset ? 1 : page;
    if (!reset && !hasMore) return;
    if (reset) setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20' });
      if (search) params.set('search', search);
      if (fBatch) params.set('batchId', String(fBatch));
      const res = await api.get<ApiResponse<Student[]>>(`/students?${params}`);
      const data = res.data.data;
      setStudents(reset ? data : (prev) => [...prev, ...data]);
      setHasMore(p < (res.data.meta?.pages ?? 1));
      setPage(reset ? 2 : p + 1);
    } catch { /* interceptor handles 401 */ }
    finally { setLoading(false); setRefresh(false); }
  }, [page, search, fBatch, hasMore]);

  useEffect(() => {
    // Fetch all batches (active and inactive) so the picker is never empty
    api.get<ApiResponse<Batch[]>>('/batches?active=false')
      .then((r) => setBatches(r.data.data))
      .catch(() => {
        // Retry with active=true as fallback
        api.get<ApiResponse<Batch[]>>('/batches?active=true')
          .then((r) => setBatches(r.data.data))
          .catch(() => {});
      });
  }, []);

  useEffect(() => { fetchStudents(true); }, [search, fBatch]);

  // ── Open detail view ─────────────────────────────────────────────────────────
  function openDetail(s: Student) {
    setSelected(s);
    setDetailOpen(true);
  }

  // ── Open Add form ────────────────────────────────────────────────────────────
  function openAdd() {
    setEditMode(false);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setFormOpen(true);
  }

  // ── Open Edit form ───────────────────────────────────────────────────────────
  function openEdit(s: Student) {
    setEditMode(true);
    setSelected(s);
    setForm({
      name:         s.name,
      grade:        s.grade as StudentForm['grade'],
      stream:       s.stream ?? '',
      batch_id:     s.batch_id ? String(s.batch_id) : '',
      roll_number:  s.roll_number ?? '',
      parent_name:  s.parent_name ?? '',
      parent_phone: s.parent_phone ?? '',
      parent_email: s.parent_email ?? '',
      address:      '',
    });
    setFormErrors({});
    setDetailOpen(false);
    setFormOpen(true);
  }

  // ── Validate ─────────────────────────────────────────────────────────────────
  function validate(): boolean {
    const errs: Partial<StudentForm> = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (form.parent_email && !/\S+@\S+\.\S+/.test(form.parent_email))
      errs.parent_email = 'Invalid email';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Save (create or update) ──────────────────────────────────────────────────
  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        name:         form.name.trim(),
        grade:        form.grade,
        stream:       form.stream.trim() || null,
        batch_id:     form.batch_id ? parseInt(form.batch_id) : null,
        roll_number:  form.roll_number.trim() || null,
        parent_name:  form.parent_name.trim() || null,
        parent_phone: form.parent_phone.trim() || null,
        parent_email: form.parent_email.trim() || null,
        address:      form.address.trim() || null,
      };

      if (editMode && selected) {
        await api.put(`/students/${selected.id}`, payload);
        Alert.alert('✅ Updated', `${form.name} has been updated.`);
      } else {
        await api.post('/students', payload);
        Alert.alert('✅ Created', `${form.name} has been added.`);
      }
      setFormOpen(false);
      fetchStudents(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        .response?.data?.message ?? 'Save failed';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────────
  function handleDelete(s: Student) {
    Alert.alert(
      'Delete Student',
      `Are you sure you want to delete ${s.name}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/students/${s.id}`);
              setDetailOpen(false);
              Alert.alert('Deleted', `${s.name} has been removed.`);
              fetchStudents(true);
            } catch { Alert.alert('Error', 'Delete failed.'); }
          },
        },
      ],
    );
  }

  // ── Field helper ─────────────────────────────────────────────────────────────
  function setField(key: keyof StudentForm, val: string) {
    setForm((prev) => ({ ...prev, [key]: val }));
    if (formErrors[key]) setFormErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.flex}>

      {/* ── Top bar: search + add button ── */}
      <View style={styles.topBar}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={16} color={Colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search name or roll no…"
            placeholderTextColor={Colors.textSecondary}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={openAdd} style={styles.addBtn} activeOpacity={0.8}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ── Batch filter chips ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}>
        {[{ id: null, name: 'All' }, ...batches].map((b) => (
          <TouchableOpacity
            key={b.id ?? 'all'}
            onPress={() => setFBatch(b.id)}
            style={[styles.chip, fBatch === b.id && styles.chipActive]}
          >
            <Text style={[styles.chipText, fBatch === b.id && styles.chipTextActive]}>{b.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Student list ── */}
      <FlatList
        data={students}
        keyExtractor={(s) => String(s.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refresh} onRefresh={() => fetchStudents(true)} tintColor={Colors.brand} />
        }
        onEndReached={() => fetchStudents()}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          loading
            ? <ActivityIndicator style={{ marginTop: 60 }} color={Colors.brand} size="large" />
            : <Text style={styles.emptyText}>No students found.</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => openDetail(item)} activeOpacity={0.75} style={styles.row}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowName}>{item.name}</Text>
              <Text style={styles.rowMeta}>
                Grade {item.grade}{item.stream ? ` · ${item.stream}` : ''}
                {item.batch_name ? ` · ${item.batch_name}` : ''}
                {item.roll_number ? ` · #${item.roll_number}` : ''}
              </Text>
            </View>
            <View style={styles.rowRight}>
              <Badge label={item.status} variant={item.status === 'active' ? 'green' : 'gray'} />
              <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} style={{ marginTop: 6 }} />
            </View>
          </TouchableOpacity>
        )}
      />

      {/* ════════════════════════════════════════════════════════════
          DETAIL MODAL
      ════════════════════════════════════════════════════════════ */}
      <Modal visible={detailOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDetailOpen(false)}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Student Details</Text>
          <TouchableOpacity onPress={() => setDetailOpen(false)} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={Colors.text} />
          </TouchableOpacity>
        </View>

        {selected && (
          <ScrollView contentContainerStyle={styles.sheetContent}>
            {/* Avatar + name */}
            <View style={styles.heroSection}>
              <View style={styles.heroAvatar}>
                <Text style={styles.heroAvatarText}>{selected.name.charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={styles.heroName}>{selected.name}</Text>
              <Badge label={selected.status} variant={selected.status === 'active' ? 'green' : 'gray'} />
            </View>

            {/* Info cards */}
            <View style={styles.infoSection}>
              {[
                { icon: 'ribbon-outline',   label: 'Roll Number',  value: selected.roll_number ?? '—' },
                { icon: 'school-outline',   label: 'Grade',        value: `${selected.grade}${selected.stream ? ' – ' + selected.stream : ''}` },
                { icon: 'people-outline',   label: 'Batch',        value: selected.batch_name ?? '—' },
                { icon: 'person-outline',   label: 'Parent Name',  value: selected.parent_name ?? '—' },
                { icon: 'call-outline',     label: 'Parent Phone', value: selected.parent_phone ?? '—' },
                { icon: 'mail-outline',     label: 'Parent Email', value: selected.parent_email ?? '—' },
              ].map((d) => (
                <View key={d.label} style={styles.infoRow}>
                  <View style={styles.infoIcon}>
                    <Ionicons name={d.icon as never} size={16} color={Colors.brand} />
                  </View>
                  <Text style={styles.infoLabel}>{d.label}</Text>
                  <Text style={styles.infoValue} numberOfLines={1}>{d.value}</Text>
                </View>
              ))}
            </View>

            {/* Action buttons */}
            <View style={styles.actionRow}>
              <Button
                title="Edit Student"
                onPress={() => openEdit(selected)}
                icon={<Ionicons name="pencil" size={16} color="#fff" />}
                style={styles.actionBtn}
              />
              <Button
                title="Delete"
                onPress={() => handleDelete(selected)}
                variant="danger"
                icon={<Ionicons name="trash" size={16} color="#fff" />}
                style={styles.actionBtn}
              />
            </View>
          </ScrollView>
        )}
      </Modal>

      {/* ════════════════════════════════════════════════════════════
          ADD / EDIT FORM MODAL
      ════════════════════════════════════════════════════════════ */}
      <Modal visible={formOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setFormOpen(false)}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{editMode ? 'Edit Student' : 'Add Student'}</Text>
            <TouchableOpacity onPress={() => setFormOpen(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">

            {/* ── Student Info ── */}
            <Text style={styles.formSection}>Student Information</Text>

            <Input
              label="Full Name *"
              placeholder="e.g. Rahul Sharma"
              value={form.name}
              onChangeText={(v) => setField('name', v)}
              error={formErrors.name}
              leftIcon="person-outline"
            />

            {/* Grade selector */}
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
              label="Stream"
              placeholder="Science / Commerce / Arts"
              value={form.stream}
              onChangeText={(v) => setField('stream', v)}
              leftIcon="layers-outline"
            />

            <Input
              label="Roll Number"
              placeholder="e.g. 2024-001"
              value={form.roll_number}
              onChangeText={(v) => setField('roll_number', v)}
              leftIcon="ribbon-outline"
            />

            {/* Batch selector */}
            <Text style={styles.fieldLabel}>Batch</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.batchPickScroll}
              contentContainerStyle={styles.batchPickContent}>
              <TouchableOpacity
                onPress={() => setField('batch_id', '')}
                style={[styles.chip, form.batch_id === '' && styles.chipActive]}
              >
                <Text style={[styles.chipText, form.batch_id === '' && styles.chipTextActive]}>None</Text>
              </TouchableOpacity>
              {batches.map((b) => (
                <TouchableOpacity
                  key={b.id}
                  onPress={() => setField('batch_id', String(b.id))}
                  style={[styles.chip, form.batch_id === String(b.id) && styles.chipActive]}
                >
                  <Text style={[styles.chipText, form.batch_id === String(b.id) && styles.chipTextActive]}>
                    {b.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* ── Parent Info ── */}
            <Text style={styles.formSection}>Parent / Guardian</Text>

            <Input
              label="Parent Name"
              placeholder="e.g. Ramesh Sharma"
              value={form.parent_name}
              onChangeText={(v) => setField('parent_name', v)}
              leftIcon="person-circle-outline"
            />

            <Input
              label="Parent Phone"
              placeholder="+91 9876543210"
              value={form.parent_phone}
              onChangeText={(v) => setField('parent_phone', v)}
              keyboardType="phone-pad"
              leftIcon="call-outline"
            />

            <Input
              label="Parent Email"
              placeholder="parent@example.com"
              value={form.parent_email}
              onChangeText={(v) => setField('parent_email', v)}
              keyboardType="email-address"
              autoCapitalize="none"
              leftIcon="mail-outline"
              error={formErrors.parent_email}
            />

            <Input
              label="Address"
              placeholder="House no, Street, City…"
              value={form.address}
              onChangeText={(v) => setField('address', v)}
              leftIcon="location-outline"
              multiline
              numberOfLines={2}
            />

            {/* ── Save button ── */}
            <View style={styles.saveRow}>
              <Button
                title="Cancel"
                onPress={() => setFormOpen(false)}
                variant="secondary"
                style={styles.saveBtn}
              />
              <Button
                title={saving ? 'Saving…' : editMode ? 'Update Student' : 'Add Student'}
                onPress={handleSave}
                loading={saving}
                icon={<Ionicons name={editMode ? 'checkmark' : 'add'} size={18} color="#fff" />}
                style={styles.saveBtn}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  flex:            { flex: 1, backgroundColor: Colors.background },

  // Top bar
  topBar:          { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  searchWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.surface, borderRadius: 12,
    paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.border,
  },
  searchInput:     { flex: 1, paddingVertical: 11, fontSize: 14, color: Colors.text },
  addBtn: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: Colors.brand, alignItems: 'center', justifyContent: 'center',
  },

  // Filter
  filterScroll:    { maxHeight: 44 },
  filterContent:   { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
  },
  chipActive:      { backgroundColor: Colors.brand, borderColor: Colors.brand },
  chipText:        { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  chipTextActive:  { color: '#fff' },

  // List
  list:            { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, marginBottom: 8,
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center',
  },
  avatarText:      { fontSize: 18, fontWeight: '700', color: Colors.brand },
  rowInfo:         { flex: 1 },
  rowName:         { fontSize: 15, fontWeight: '600', color: Colors.text },
  rowMeta:         { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  rowRight:        { alignItems: 'flex-end' },
  emptyText:       { textAlign: 'center', color: Colors.textSecondary, marginTop: 60, fontSize: 14 },

  // Sheet (modal) common
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  sheetTitle:      { fontSize: 17, fontWeight: '700', color: Colors.text },
  closeBtn:        { padding: 4 },

  // Detail modal
  sheetContent:    { padding: 20, paddingBottom: 40 },
  heroSection:     { alignItems: 'center', gap: 8, marginBottom: 24 },
  heroAvatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  heroAvatarText:  { fontSize: 34, fontWeight: '700', color: Colors.brand },
  heroName:        { fontSize: 20, fontWeight: '700', color: Colors.text },
  infoSection: {
    backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  infoIcon: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center',
  },
  infoLabel:       { flex: 1, fontSize: 13, color: Colors.textSecondary },
  infoValue:       { fontSize: 14, fontWeight: '600', color: Colors.text, maxWidth: 180, textAlign: 'right' },
  actionRow:       { flexDirection: 'row', gap: 12 },
  actionBtn:       { flex: 1 },

  // Form modal
  formContent:     { padding: 20, paddingBottom: 60 },
  formSection: {
    fontSize: 13, fontWeight: '700', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginTop: 20, marginBottom: 12,
  },
  fieldLabel:      { fontSize: 13, fontWeight: '500', color: Colors.text, marginBottom: 8, marginTop: 4 },
  gradeRow:        { flexDirection: 'row', gap: 8, marginBottom: 16 },
  gradeChip: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center',
  },
  gradeChipActive: { backgroundColor: Colors.brand, borderColor: Colors.brand },
  gradeChipText:   { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  gradeChipTextActive: { color: '#fff' },
  batchPickScroll: { marginBottom: 16, maxHeight: 42 },
  batchPickContent: { gap: 8 },
  saveRow:         { flexDirection: 'row', gap: 12, marginTop: 24 },
  saveBtn:         { flex: 1 },
});
