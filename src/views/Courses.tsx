import { useCallback, useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, ChevronRight, Circle, UserRound } from 'lucide-react';
import { api } from '../utils/api';
import { PageHead } from '../ui/Bits';
import Modal from '../ui/Modal';
import PageSkeleton from '../components/PageSkeleton';
import { useToast } from '../ui/Feedback';

type CourseSummary = { id: number; title: string; teacherName: string; subjectName: string; plannedLectures: number; addedLectures: number; isActive: boolean; createdAt: string };
type CourseDetail = { course: Omit<CourseSummary, 'addedLectures'>; classes: Array<{ id: number; name: string }>; lectures: Array<{ id: number; sequence: number; title: string; description: string | null; createdAt: string }> };

export default function Courses() {
  const toast = useToast();
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    try { const response = await api.get('/institution/courses'); setCourses(response.courses || []); }
    catch (error) { toast.error('Courses unavailable', error instanceof Error ? error.message : 'Please try again.'); }
    finally { setLoading(false); }
  }, [toast]);
  useEffect(() => { void load(); }, [load]);

  async function openCourse(id: number) {
    setSelectedId(id); setDetail(null); setDetailLoading(true);
    try { setDetail(await api.get(`/institution/courses?id=${id}`)); }
    catch (error) { toast.error('Course unavailable', error instanceof Error ? error.message : 'Please try again.'); setSelectedId(null); }
    finally { setDetailLoading(false); }
  }

  if (loading) return <div className="page"><PageSkeleton cards={4} rows={3} /></div>;
  return <div className="page">
    <PageHead title="Courses" subtitle="Review teacher-created courses and their lecture plans." />
    {courses.length === 0 ? <div className="empty"><BookOpen /><p className="empty-title">No teacher courses yet</p><p className="empty-text">Courses appear here after teachers create them.</p></div> : <div className="grid-cards">{courses.map((course) => {
      const percent = course.plannedLectures > 0 ? Math.min(100, Math.round(course.addedLectures / course.plannedLectures * 100)) : 0;
      return <button key={course.id} type="button" className="card card-hover" style={{ textAlign: 'left' }} onClick={() => openCourse(course.id)}><div className="card-pad stack"><div className="row-between"><span className="metric-icon"><BookOpen /></span><ChevronRight /></div><div><b style={{ fontSize: 17 }}>{course.title}</b><p className="field-hint">{course.subjectName}</p></div><span className="row"><UserRound style={{ width: 15 }} />{course.teacherName}</span><div><div className="row-between field-hint"><span>{course.addedLectures} of {course.plannedLectures} lectures</span><span>{percent}%</span></div><div style={{ height: 6, marginTop: 7, borderRadius: 99, background: 'var(--sunken)', overflow: 'hidden' }}><div style={{ width: `${percent}%`, height: '100%', background: 'var(--brand)', borderRadius: 99 }} /></div></div></div></button>;
    })}</div>}
    <Modal open={selectedId !== null} onClose={() => { setSelectedId(null); setDetail(null); }} title={detail?.course.title || 'Course details'} description={detail ? `${detail.course.subjectName} · ${detail.course.teacherName}` : 'Loading course details…'} size="lg" scrollBody>
      {detailLoading || !detail ? <PageSkeleton rows={5} /> : <div className="split"><aside className="stack"><div><span className="label">Assigned classes</span><div className="row" style={{ flexWrap: 'wrap', marginTop: 8 }}>{detail.classes.map((item) => <span key={item.id} className="chip chip-brand">{item.name}</span>)}</div></div><div className="prose-note"><b>{detail.course.teacherName}</b><br />{detail.course.subjectName}<br />{detail.course.plannedLectures} planned lectures<br />{detail.course.isActive ? 'Active' : 'Inactive'}</div></aside><section><b>Lectures</b><p className="field-hint">Ascending order shown to students.</p><div className="stack" style={{ marginTop: 12 }}>{Array.from({ length: detail.course.plannedLectures }, (_, index) => index + 1).map((sequence) => { const lecture = detail.lectures.find((item) => item.sequence === sequence); return <div className="list-row" key={sequence} style={{ alignItems: 'flex-start' }}>{lecture ? <CheckCircle2 style={{ color: 'var(--ok)' }} /> : <Circle style={{ color: 'var(--ink-4)' }} />}<span className="cell-stack"><small>Lecture {sequence}</small><b>{lecture?.title || 'Not added yet'}</b>{lecture?.description && <span>{lecture.description}</span>}</span></div>; })}</div></section></div>}
    </Modal>
  </div>;
}
