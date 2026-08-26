/**
 * api.ts — centralised Axios instance.
 *
 * Auth strategy: cookie-only.
 * – withCredentials: true sends the HttpOnly `token` cookie on every request.
 * – No Authorization header / localStorage token injection.
 * – On 401 the interceptor clears local user profile and redirects to /login.
 */
import axios from 'axios';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  'https://visioncollegiateapi-qidn8sah.b4a.run';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// ── Response interceptor: handle 401 globally ──────────────────────────────
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      // Clear stale user profile and redirect — the cookie is handled by the backend
      localStorage.removeItem('vc_user');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export default api;

// ─── Shared TypeScript interfaces ─────────────────────────────────────────────

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
  teacher_count: number;
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
  attendance?: {
    present_days: number;
    absent_days: number;
    total_days: number;
    attendance_percent: number;
  };
}

export interface AttendanceRecord {
  id: number;
  student_id: number;
  student_name: string;
  roll_number: string;
  batch_id: number;
  date: string;
  status: 'present' | 'absent' | 'late' | 'holiday';
  note: string | null;
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
  board_pattern: string | null;
  student_pdf_url: string | null;
  teacher_pdf_url: string | null;
  created_by_name: string;
  created_at: string;
}

export interface AnalyticsSummary {
  totalStudents: number;
  presentToday: number;
  absentToday: number;
  attendancePercentage: number;
}

export interface TrendPoint {
  date: string;
  present: number;
  absent: number;
  late: number;
  total: number;
}

export interface LowAttendanceAlert {
  studentId: number;
  studentName: string;
  rollNumber: string;
  batchName: string;
  attendancePercent: number;
}
