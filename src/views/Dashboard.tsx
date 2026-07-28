import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../utils/api';
import { 
  XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area,
  PieChart, Pie, Cell, BarChart, Bar
} from 'recharts';
import { Building2, Users, GraduationCap, BookOpen, Bell, CalendarDays, ArrowUpRight } from 'lucide-react';
import PageSkeleton from '../components/PageSkeleton';

export default function Dashboard() {
  const { selectedCampus } = useOutletContext<any>();
  const [data, setData] = useState({ campuses: 0, classes: 0, staff: 0, students: 0 });
  const [charts, setCharts] = useState({ attendanceTrends: [], classDistribution: [], examPerformance: [] });
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const campusQuery = selectedCampus?.id !== 'all' && selectedCampus?.id ? `?campusId=${selectedCampus.id}` : '';
        const [dashResp, chartsResp, announcementsResp] = await Promise.all([
          api.get(`/institution/dashboard${campusQuery}`),
          api.get(`/institution/dashboard/charts${campusQuery}`).catch(() => ({ attendanceTrends: [], classDistribution: [], examPerformance: [] })),
          api.get('/institution/announcements').catch(() => ({ announcements: [] })),
        ]);
        
        setData({
          campuses: dashResp.campuses || 0,
          classes: dashResp.classes || 0,
          staff: dashResp.staff || 0,
          students: dashResp.students || 0
        });

        // Set chart data, apply colors to class distribution
        const colors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4'];
        const classDist = (chartsResp?.classDistribution || []).map((c: any, i: number) => ({
          ...c,
          color: colors[i % colors.length]
        }));

        setCharts({
          attendanceTrends: chartsResp?.attendanceTrends || [],
          classDistribution: classDist,
          examPerformance: chartsResp?.examPerformance || []
        });

        const recent = (announcementsResp?.announcements || [])
          .slice(0, 4)
          .map((item: any) => ({
            ...item,
            date: item?.createdAt ? new Date(item.createdAt).toLocaleDateString() : '-',
            type: item?.targetType || 'ALL',
          }));
        setAnnouncements(recent);

      } catch (err: any) {
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [selectedCampus]);

  const stats = [
    { title: 'Total Campuses', value: data.campuses, change: 'Active', icon: Building2, color: 'from-blue-500 to-indigo-500' },
    { title: 'Active Staff', value: data.staff, change: 'Active', icon: Users, color: 'from-emerald-400 to-teal-500' },
    { title: 'Enrolled Students', value: data.students, change: 'Active', icon: GraduationCap, color: 'from-orange-400 to-pink-500' },
    { title: 'Total Classes', value: data.classes, change: 'Active', icon: BookOpen, color: 'from-violet-400 to-purple-500' }
  ];

  if (loading) {
    return (
      <PageSkeleton cards={4} rows={4} />
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="dashboard-hero">
        <div className="dashboard-intro">
          <div>
            <span className="eyebrow">Institution pulse</span>
            <h1 className="text-3xl font-bold text-white tracking-tight">Good morning, Admin.</h1>
            <p className="text-slate-400">Here’s a clear view of your institution today.</p>
          </div>
          <div className="dashboard-date"><CalendarDays className="w-4 h-4" /><span>{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span></div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-xl">
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="metric-card bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl transition-transform hover:-translate-y-1 duration-300">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-slate-400 text-sm font-medium">{stat.title}</p>
                  <h3 className="text-3xl font-bold text-white mt-2 tracking-tight">{stat.value}</h3>
                </div>
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm">
                <span className="text-emerald-400 font-medium">{stat.change}</span><ArrowUpRight className="w-3.5 h-3.5 ml-auto text-slate-400" />
              </div>
            </div>
          )
        })}
      </div>

      {/* Charts / Activity Area 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Trends */}
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 h-80 shadow-xl flex flex-col">
          <h3 className="text-lg font-semibold text-white mb-4">Weekly Attendance (Present)</h3>
          <div className="flex-1 w-full h-full mt-2">
            {charts.attendanceTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts.attendanceTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAtt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                    itemStyle={{ color: '#f8fafc' }}
                  />
                  <Area type="monotone" dataKey="PRESENT" stroke="#10b981" fillOpacity={1} fill="url(#colorAtt)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">No attendance data</div>
            )}
          </div>
        </div>

        {/* Exam Performance */}
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 h-80 shadow-xl flex flex-col">
          <h3 className="text-lg font-semibold text-white mb-4">Recent Exam Performance</h3>
          <div className="flex-1 w-full h-full mt-2">
            {charts.examPerformance.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.examPerformance} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="title" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <RechartsTooltip 
                    cursor={{fill: 'rgba(255,255,255,0.05)'}}
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                    itemStyle={{ color: '#f8fafc' }}
                  />
                  <Bar dataKey="average" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">No exam data</div>
            )}
          </div>
        </div>
      </div>

      {/* Charts / Activity Area 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Class Distribution */}
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 h-96 shadow-xl flex flex-col">
          <h3 className="text-lg font-semibold text-white mb-4">Class Distribution</h3>
          <div className="flex-1 w-full h-full relative flex items-center justify-center">
            {charts.classDistribution.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={charts.classDistribution}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {charts.classDistribution.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                      itemStyle={{ color: '#f8fafc' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Custom Legend */}
                <div className="absolute bottom-0 w-full flex flex-wrap justify-center gap-4 text-xs font-medium text-slate-300">
                  {charts.classDistribution.map((c: any, i: number) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                      {c.name}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">No classes found</div>
            )}
          </div>
        </div>
        
        {/* Recent Announcements */}
        <div className="lg:col-span-2 bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 h-96 shadow-xl flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-white">Recent Announcements</h3>
            <button className="text-sm text-indigo-400 hover:text-indigo-300 font-medium">View All</button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-2">
            {announcements.length > 0 ? announcements.map((item: any) => (
              <div key={item.id} className="flex items-start gap-4 p-4 rounded-xl bg-slate-700/20 border border-slate-600/30 hover:bg-slate-700/40 transition-colors">
                <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0 text-indigo-400">
                  <Bell className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-200 truncate">{item.title}</p>
                  <p className="text-xs text-slate-500 mt-1">{item.date} • {item.type}</p>
                </div>
              </div>
            )) : (
              <div className="flex items-center justify-center h-full text-slate-500">No recent announcements</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
