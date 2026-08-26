import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://web-production-7ab5f.up.railway.app';

const api = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// Attach stored JWT on every request
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('vc_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401 clear credentials (navigation handled in auth hook)
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync('vc_token');
      await SecureStore.deleteItemAsync('vc_user');
    }
    return Promise.reject(error);
  },
);

export default api;

// ─── Shared types ──────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  meta?: { total: number; page: number; limit: number; pages: number };
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'teacher' | 'parent' | 'student';
  phone?: string;
}

export interface Batch {
  id: number;
  grade: string;
  stream: string | null;
  name: string;
  is_active: boolean;
  student_count: number;
}

export interface Student {
  id: number;
  name: string;
  grade: string;
  stream: string | null;
  batch_id: number | null;
  batch_name: string | null;
  roll_number: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  parent_email: string | null;
  status: string;
}

export interface AttendanceRecord {
  student_id: number;
  student_name: string;
  roll_number: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'holiday';
}

export interface Test {
  id: number;
  title: string;
  subject: string;
  grade: string;
  stream: string | null;
  batch_id: number | null;
  batch_name: string | null;
  total_marks: number;
  duration_mins: number;
  test_date: string | null;
  student_pdf_url: string | null;
  created_at: string;
}

export interface AnalyticsSummary {
  totalStudents: number;
  presentToday: number;
  absentToday: number;
  attendancePercentage: number;
}

export interface LowAttendanceAlert {
  studentId: number;
  studentName: string;
  rollNumber: string;
  batchName: string;
  attendancePercent: number;
}
