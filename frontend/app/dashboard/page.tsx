'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { AppShell } from '@/components/layout/AppShell';
import { SkeletonCard } from '@/components/ui/Loading';
import {
  Users, CheckCircle2, XCircle, TrendingUp, Clock,
  CalendarCheck, BookOpen, MessageSquare, AlertTriangle,
  Activity, Zap, ArrowRight,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import api, {
  type ApiResponse, type AnalyticsSummary,
  type TrendPoint, type LowAttendanceAlert,
} from '@/utils/api';
import { getUser } from '@/utils/auth';
import { format } from 'date-fns';
import Link from 'next/link';
import toast from 'react-hot-toast';

const QUICK_ACTIONS = [
  { label: 'Mark Attendance', icon: CalendarCheck, href: '/attendance', from: '#6366f1', to: '#4f46e5', glow: 'rgba(99,102,241,0.45)' },
  { label: 'Create Test',     icon: BookOpen,      href: '/tests',      from: '#a855f7', to: '#7c3aed', glow: 'rgba(168,85,247,0.45)' },
  { label: 'WhatsApp Blast',  icon: MessageSquare, href: '/whatsapp',   from: '#10b981', to: '#059669', glow: 'rgba(16,185,129,0.45)' },
  { label: 'Analytics',       icon: TrendingUp,    href: '/analytics',  from: '#f59e0b', to: '#d97706', glow: 'rgba(245,158,11,0.45)' },
];

const STAT_CONFIGS = [
  { key: 'totalStudents', title: 'Marked Today', icon: Users,        color: '#6366f1', bg: 'rgba(99,102,241,0.12)',  border: 'rgba(99,102,241,0.2)'  },
  { key: 'presentToday',  title: 'Present',      icon: CheckCircle2, color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.2)' },
  { key: 'absentToday',   title: 'Absent',       icon: XCircle,      color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.2)'  },
  { key: 'pct',           title: 'Attendance',   icon: Activity,     color: '#a855f7', bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.2)' },
];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}

export default function DashboardPage() {
  const [user, setUser] = useState<ReturnType<typeof getUser>>(null);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [trend, setTrend]     = useState<TrendPoint[]>([]);
  const [alerts, setAlerts]   = useState<LowAttendanceAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { setUser(getUser()); }, []);

  const load = useCallback(async () => {
    try {
      const [s, t, a] = await Promise.all([
        api.get<ApiResponse<AnalyticsSummary>>('/analytics/attendance/today'),
        api.get<ApiResponse<TrendPoint[]>>('/analytics/attendance/trend?days=14'),
        api.get<ApiResponse<LowAttendanceAlert[]>>('/analytics/attendance/alerts?threshold=75'),
      ]);
      setSummary(s.data.data);
      setTrend(t.data.data);
      setAlerts(a.data.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Failed to load dashboard';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const pct = summary?.attendancePercentage ?? 0;
  const pctColor = pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444';

  const statValues: Record<string, string | number> = {
    totalStudents: summary?.totalStudents ?? 0,
    presentToday:  summary?.presentToday  ?? 0,
    absentToday:   summary?.absentToday   ?? 0,
    pct:           `${pct}%`,
  };

  return (
    <AppShell>
      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div style={{
          position:'absolute', top:'-10%', left:'-5%',
          width:'500px', height:'500px', borderRadius:'50%',
          background:'radial-gradient(circle, rgba(99,102,241,0.06), transparent 70%)',
          filter:'blur(60px)',
        }} />
        <div style={{
          position:'absolute', bottom:'10%', right:'-5%',
          width:'400px', height:'400px', borderRadius:'50%',
          background:'radial-gradient(circle, rgba(168,85,247,0.05), transparent 70%)',
          filter:'blur(60px)',
        }} />
      </div>

      <div style={{ position:'relative', zIndex:1 }}>
        {/* ── Greeting ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{ marginBottom: '28px' }}
        >
          <p style={{
            fontSize:'11px', fontWeight:700, textTransform:'uppercase',
            letterSpacing:'0.12em', color:'#475569',
            display:'flex', alignItems:'center', gap:'6px', marginBottom:'8px',
          }}>
            <Clock size={13} />
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
          <h1 style={{ fontSize:'clamp(22px,4vw,30px)', fontWeight:900, letterSpacing:'-0.02em', color:'#f1f5f9', lineHeight:1.2, margin:0 }}>
            Good {greeting()},{' '}
            <span style={{
              background:'linear-gradient(135deg, #818cf8, #c084fc, #818cf8)',
              backgroundSize:'200%',
              WebkitBackgroundClip:'text',
              WebkitTextFillColor:'transparent',
              backgroundClip:'text',
            }}>
              {user?.name?.split(' ')[0] ?? 'there'}
            </span>{' '}
            <span className="animate-float" style={{ display:'inline-block' }}>👋</span>
          </h1>
          <p style={{ fontSize:'13px', color:'#64748b', marginTop:'6px' }}>
            Your institute overview for today
          </p>
        </motion.div>

        {/* ── KPI Cards ── */}
        {loading ? (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'16px', marginBottom:'24px' }}>
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'16px', marginBottom:'24px' }}>
            {STAT_CONFIGS.map((cfg, i) => {
              const Icon = cfg.icon;
              const val  = statValues[cfg.key];
              const isAttendance = cfg.key === 'pct';
              const dotColor = isAttendance ? pctColor : cfg.color;
              return (
                <motion.div
                  key={cfg.key}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.07, ease: [0.16,1,0.3,1] }}
                  className="card card-glow"
                  style={{ padding:'20px', cursor:'default' }}
                >
                  {/* Top row */}
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px' }}>
                    <div style={{
                      width:'40px', height:'40px', borderRadius:'12px',
                      background: cfg.bg, border:`1px solid ${cfg.border}`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                    }}>
                      <Icon size={18} style={{ color: cfg.color }} />
                    </div>
                    {/* Mini live dot */}
                    <div style={{
                      width:'8px', height:'8px', borderRadius:'50%',
                      background: dotColor,
                      boxShadow: `0 0 8px ${dotColor}`,
                    }} className="status-dot" />
                  </div>
                  {/* Label */}
                  <p style={{ fontSize:'10px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'#475569', marginBottom:'4px' }}>
                    {cfg.title}
                  </p>
                  {/* Value */}
                  <p style={{ fontSize:'32px', fontWeight:900, color:'#f1f5f9', letterSpacing:'-0.03em', lineHeight:1, margin:0 }}>
                    {val}
                  </p>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* ── Main grid ── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:'24px' }} className="lg-grid-3col">

          {/* Chart */}
          <motion.div
            initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}
            transition={{ duration:0.4, delay:0.2 }}
            className="card"
            style={{ padding:'24px', gridColumn:'span 2' }}
          >
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                <div style={{
                  width:'36px', height:'36px', borderRadius:'10px',
                  background:'rgba(99,102,241,0.12)', border:'1px solid rgba(99,102,241,0.2)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                }}>
                  <TrendingUp size={16} style={{ color:'#6366f1' }} />
                </div>
                <div>
                  <p style={{ fontSize:'13px', fontWeight:700, color:'#f1f5f9', margin:0 }}>Attendance Trend</p>
                  <p style={{ fontSize:'11px', color:'#475569', margin:0 }}>Last 14 days — Present vs Absent</p>
                </div>
              </div>
              <div style={{ display:'flex', gap:'16px' }}>
                {[{c:'#6366f1',l:'Present'},{c:'#ef4444',l:'Absent'}].map(x=>(
                  <div key={x.l} style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                    <div style={{ width:'8px',height:'8px',borderRadius:'50%',background:x.c,boxShadow:`0 0 6px ${x.c}` }} />
                    <span style={{ fontSize:'11px', fontWeight:600, color:'#64748b' }}>{x.l}</span>
                  </div>
                ))}
              </div>
            </div>

            {trend.length === 0 ? (
              <div style={{ height:'200px', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <p style={{ color:'#475569', fontSize:'13px' }}>No data yet — mark attendance to see trends</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={trend} margin={{ top:5, right:4, left:-28, bottom:0 }}>
                  <defs>
                    <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tickFormatter={v=>{const s=String(v??'');try{return s?format(new Date(s),'MMM d'):'';}catch{return '';}}} tick={{fontSize:10,fill:'#475569'}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fontSize:10,fill:'#475569'}} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{
                    background:'rgba(8,8,28,0.97)',
                    border:'1px solid rgba(99,102,241,0.2)',
                    borderRadius:'12px',
                    boxShadow:'0 20px 50px rgba(0,0,0,0.5)',
                    backdropFilter:'blur(16px)',
                    fontSize:'12px',
                    color:'#f1f5f9',
                  }} labelFormatter={v=>{const s=String(v??'');try{return s?format(new Date(s),'MMM d, yyyy'):'';}catch{return '';}}} cursor={{stroke:'rgba(99,102,241,0.2)',strokeWidth:1}} />
                  <Area dataKey="present" name="Present" stroke="#6366f1" fill="url(#gP)" strokeWidth={2} dot={false} />
                  <Area dataKey="absent"  name="Absent"  stroke="#ef4444" fill="url(#gA)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </motion.div>

          {/* Right column: Quick Actions + Alerts */}
          <motion.div
            initial={{ opacity:0, x:16 }} animate={{ opacity:1, x:0 }}
            transition={{ duration:0.4, delay:0.25 }}
            style={{ display:'flex', flexDirection:'column', gap:'16px' }}
          >
            {/* Quick Actions */}
            <div className="card" style={{ padding:'20px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'16px' }}>
                <Zap size={14} style={{ color:'#6366f1' }} />
                <p style={{ fontSize:'12px', fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.08em', margin:0 }}>Quick Actions</p>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {QUICK_ACTIONS.map((a, i) => {
                  const Icon = a.icon;
                  return (
                    <motion.div key={a.label} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{delay:0.3+i*0.06}}>
                      <Link href={a.href}
                        style={{
                          display:'flex', alignItems:'center', gap:'12px',
                          padding:'12px 14px', borderRadius:'12px', textDecoration:'none',
                          background:'rgba(255,255,255,0.03)',
                          border:'1px solid rgba(255,255,255,0.06)',
                          transition:'all 0.15s ease',
                        }}
                        onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.06)';(e.currentTarget as HTMLElement).style.borderColor='rgba(99,102,241,0.2)';}}
                        onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.03)';(e.currentTarget as HTMLElement).style.borderColor='rgba(255,255,255,0.06)';}}
                      >
                        <div style={{
                          width:'34px', height:'34px', borderRadius:'10px', flexShrink:0,
                          background:`linear-gradient(135deg, ${a.from}, ${a.to})`,
                          boxShadow:`0 4px 14px ${a.glow}`,
                          display:'flex', alignItems:'center', justifyContent:'center',
                        }}>
                          <Icon size={16} color="white" />
                        </div>
                        <span style={{ fontSize:'13px', fontWeight:600, color:'#cbd5e1', flex:1 }}>{a.label}</span>
                        <ArrowRight size={14} style={{ color:'#334155' }} />
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* User card */}
            {user && (
              <div className="card" style={{ padding:'16px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'12px' }}>
                  <div style={{
                    width:'40px', height:'40px', borderRadius:'12px',
                    background:'linear-gradient(135deg, #6366f1, #a855f7)',
                    boxShadow:'0 0 16px -4px rgba(99,102,241,0.6)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    color:'white', fontWeight:900, fontSize:'16px', flexShrink:0,
                  }}>
                    {user.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <p style={{ fontSize:'13px', fontWeight:700, color:'#f1f5f9', margin:0, lineHeight:1.3 }}>{user.name}</p>
                    <p style={{ fontSize:'11px', color:'#475569', margin:0, textTransform:'capitalize' }}>{user.role === 'admin' ? '⚡ Administrator' : '🎓 Teacher'}</p>
                  </div>
                </div>
                <div className="glow-line" />
                <div style={{ marginTop:'12px', display:'flex', flexDirection:'column', gap:'6px' }}>
                  {[
                    { l:'Email',  v: user.email },
                    { l:'Access', v: user.role === 'admin' ? 'Full Access' : 'Teacher Access' },
                  ].map(({l,v})=>(
                    <div key={l} style={{ display:'flex', justifyContent:'space-between', fontSize:'12px' }}>
                      <span style={{ color:'#475569' }}>{l}</span>
                      <span style={{ color:'#94a3b8', fontWeight:600, maxWidth:'60%', textAlign:'right', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Low attendance alerts */}
        {!loading && alerts.length > 0 && (
          <motion.div
            initial={{opacity:0,y:16}} animate={{opacity:1,y:0}}
            transition={{duration:0.4,delay:0.35}}
            className="card"
            style={{ padding:'24px', marginTop:'24px' }}
          >
            <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'16px' }}>
              <div style={{
                width:'36px', height:'36px', borderRadius:'10px',
                background:'rgba(245,158,11,0.12)', border:'1px solid rgba(245,158,11,0.2)',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                <AlertTriangle size={16} style={{ color:'#f59e0b' }} />
              </div>
              <div>
                <p style={{ fontSize:'13px', fontWeight:700, color:'#f1f5f9', margin:0 }}>Low Attendance Alerts</p>
                <p style={{ fontSize:'11px', color:'#475569', margin:0 }}>{alerts.length} students below 75%</p>
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {alerts.slice(0,6).map((a,i)=>(
                <motion.div
                  key={a.studentId}
                  initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}}
                  transition={{delay:0.05*i}}
                  style={{
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'12px 14px', borderRadius:'12px',
                    background:'rgba(245,158,11,0.05)',
                    border:'1px solid rgba(245,158,11,0.12)',
                  }}
                >
                  <div style={{ display:'flex', alignItems:'center', gap:'10px', minWidth:0 }}>
                    <div style={{
                      width:'32px', height:'32px', borderRadius:'10px',
                      background:'rgba(245,158,11,0.15)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      color:'#f59e0b', fontWeight:900, fontSize:'13px', flexShrink:0,
                    }}>
                      {a.studentName.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth:0 }}>
                      <p style={{ fontSize:'13px', fontWeight:600, color:'#e2e8f0', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {a.studentName}
                        {a.rollNumber && <span style={{ marginLeft:'6px', fontSize:'11px', color:'#475569', fontWeight:400 }}>#{a.rollNumber}</span>}
                      </p>
                      <p style={{ fontSize:'11px', color:'#475569', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.batchName}</p>
                    </div>
                  </div>
                  <span style={{
                    padding:'4px 10px', borderRadius:'8px', fontSize:'12px', fontWeight:800,
                    background: a.attendancePercent < 50 ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                    color:      a.attendancePercent < 50 ? '#f87171' : '#fbbf24',
                    border:     `1px solid ${a.attendancePercent < 50 ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
                    flexShrink: 0, marginLeft:'12px',
                  }}>
                    {a.attendancePercent}%
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </AppShell>
  );
}
