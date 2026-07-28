import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { api } from '../utils/api';
import {
  XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area,
  PieChart, Pie, Cell, BarChart, Bar, CartesianGrid
} from 'recharts';
import {
  Building2, Users, GraduationCap, BookOpen, Bell, CalendarDays, ArrowRight,
  TrendingUp, PieChart as PieIcon, ClipboardCheck, Megaphone,
} from 'lucide-react';
import PageSkeleton from '../components/PageSkeleton';
import { EmptyState, ErrorNote, Stat } from '../ui/Bits';

/* A restrained palette that belongs to the same family as the rest of the UI.
   Charts should read as part of the document, not as a separate toy. */
const SERIES = ['#2C3A5C', '#BE7B14', '#14795A', '#2C69AC', '#8A6BA8', '#B0433D'];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function ChartTip({ active, payload, label, suffix = '' }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      {label !== undefined && <b>{String(label)}</b>}
      {payload.map((entry: any) => (
        <div key={entry.name} style={{ color: entry.color || entry.payload?.color }}>
          <i aria-hidden="true" />
          <span style={{ color: 'var(--ink-2)' }}>
            {entry.name}: <b style={{ color: 'var(--ink)' }}>{entry.value}{suffix}</b>
          </span>
        </div>
      ))}
    </div>
  );
}

function ChartBlank({ text }: { text: string }) {
  return <div className="chart-blank">{text}</div>;
}

export default function Dashboard() {
  const { selectedCampus } = useOutletContext<any>();
  const navigate = useNavigate();
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

        const classDist = (chartsResp?.classDistribution || []).map((c: any, i: number) => ({
          ...c,
          color: SERIES[i % SERIES.length]
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

  const scopeLabel =
    selectedCampus?.id && selectedCampus.id !== 'all' ? selectedCampus.name : 'all campuses';

  if (loading) {
    return (
      <div className="page">
        <PageSkeleton cards={4} rows={4} />
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 className="page-title">{greeting()}.</h1>
          <p className="page-sub">
            Today across <strong style={{ color: 'var(--ink-2)', fontWeight: 600 }}>{scopeLabel}</strong>.
            Numbers refresh as your staff record attendance, results and diary entries.
          </p>
        </div>
        <div className="page-tools">
          <span className="chip chip-mute">
            <CalendarDays aria-hidden="true" />
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
          </span>
          <button type="button" className="btn btn-quiet" onClick={() => navigate('/announcements')}>
            <Megaphone />
            Announce something
          </button>
        </div>
      </header>

      {error && <ErrorNote message={error} />}

      <section className="metrics">
        <Stat label="Campuses" value={data.campuses} icon={<Building2 />} tone="brand" foot="Active locations" />
        <Stat label="Staff" value={data.staff} icon={<Users />} tone="ok" foot="On the payroll" />
        <Stat label="Students" value={data.students} icon={<GraduationCap />} tone="accent" foot="Currently enrolled" />
        <Stat label="Classes" value={data.classes} icon={<BookOpen />} tone="info" foot="Across all sections" />
      </section>

      <section className="dash-charts">
        <article className="card">
          <div className="card-head">
            <div className="card-head-copy">
              <h2 className="card-title">
                <TrendingUp aria-hidden="true" />
                Attendance this week
              </h2>
              <p className="card-sub">Students marked present, by day.</p>
            </div>
          </div>
          <div className="card-body chart-frame">
            {charts.attendanceTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts.attendanceTrends} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAtt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#14795A" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#14795A" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} width={44} />
                  <RechartsTooltip content={<ChartTip />} />
                  <Area
                    type="monotone"
                    dataKey="PRESENT"
                    stroke="#14795A"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorAtt)"
                    dot={{ r: 2.5, strokeWidth: 0, fill: '#14795A' }}
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <ChartBlank text="No attendance recorded yet this week." />
            )}
          </div>
        </article>

        <article className="card">
          <div className="card-head">
            <div className="card-head-copy">
              <h2 className="card-title">
                <ClipboardCheck aria-hidden="true" />
                Recent exam averages
              </h2>
              <p className="card-sub">Mean score per published exam.</p>
            </div>
          </div>
          <div className="card-body chart-frame">
            {charts.examPerformance.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.examPerformance} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="title" tickLine={false} axisLine={false} interval={0} />
                  <YAxis tickLine={false} axisLine={false} width={44} />
                  <RechartsTooltip cursor={{ fill: 'rgba(19,26,42,0.04)' }} content={<ChartTip />} />
                  <Bar dataKey="average" fill="#BE7B14" radius={[4, 4, 0, 0]} maxBarSize={34} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ChartBlank text="No exam results published yet." />
            )}
          </div>
        </article>
      </section>

      <section className="dash-lower">
        <article className="card">
          <div className="card-head">
            <div className="card-head-copy">
              <h2 className="card-title">
                <PieIcon aria-hidden="true" />
                Class distribution
              </h2>
              <p className="card-sub">Where your students sit.</p>
            </div>
          </div>
          <div className="card-body">
            {charts.classDistribution.length > 0 ? (
              <>
                <div style={{ height: 176 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={charts.classDistribution}
                        innerRadius={54}
                        outerRadius={78}
                        paddingAngle={2}
                        stroke="#fff"
                        strokeWidth={2}
                        dataKey="value"
                      >
                        {charts.classDistribution.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip content={<ChartTip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="chart-legend" style={{ marginTop: 14 }}>
                  {charts.classDistribution.slice(0, 6).map((c: any, i: number) => (
                    <div className="chart-legend-row" key={i}>
                      <i style={{ backgroundColor: c.color }} aria-hidden="true" />
                      {c.name}
                      <b>{c.value}</b>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <ChartBlank text="No classes set up yet." />
            )}
          </div>
        </article>

        <article className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-head">
            <div className="card-head-copy">
              <h2 className="card-title">
                <Bell aria-hidden="true" />
                Latest announcements
              </h2>
              <p className="card-sub">The four most recent broadcasts.</p>
            </div>
            <div className="card-tools">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/announcements')}>
                View all
                <ArrowRight />
              </button>
            </div>
          </div>
          <div style={{ flex: '1 1 auto' }}>
            {announcements.length > 0 ? (
              announcements.map((item: any) => (
                <div className="list-row" key={item.id}>
                  <span className="initials initials-accent" aria-hidden="true">
                    <Bell className="w-3.5 h-3.5" />
                  </span>
                  <span className="cell-stack" style={{ flex: '1 1 auto', minWidth: 0 }}>
                    <b style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.title}
                    </b>
                    <span>{item.date}</span>
                  </span>
                  <span className="chip chip-brand">{item.type === 'ALL' ? 'Everyone' : item.type}</span>
                </div>
              ))
            ) : (
              <EmptyState
                icon={<Megaphone />}
                title="Nothing announced yet"
                text="Broadcast a message and it will appear here for every staff member and student you target."
                action={
                  <button type="button" className="btn btn-primary" onClick={() => navigate('/announcements')}>
                    Write an announcement
                  </button>
                }
              />
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
