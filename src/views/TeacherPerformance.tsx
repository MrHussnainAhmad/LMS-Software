import { useCallback } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { api } from '../utils/api';
import { useRemoteData } from '../utils/use-remote-data';
import { TeacherPerformancePanels } from '@/app/(institution)/institution/staff/[id]/performance/TeacherPerformancePanels';
import { PageHead, ErrorNote } from '../ui/Bits';
export default function TeacherPerformance(){
 const {id}=useParams(); const [params,setParams]=useSearchParams(); const months=params.get('months')||'6';
 const load=useCallback(()=>api.get(`/institution/staff/${id}/performance?months=${months}`),[id,months]);
 const {data,error,reload}=useRemoteData(load);
 return <div className="page"><Link to="/staff">Back to staff</Link><PageHead title={data?.teacher.name||'Teacher performance'} subtitle="Published assessment results by teaching assignment."/>
 <nav className="row" aria-label="Reporting period">{[3,6,12].map(period=><button className={String(period)===months?'btn btn-primary':'btn btn-quiet'} key={period} onClick={()=>setParams({months:String(period)})}>{period} months</button>)}</nav>
 {error?<><ErrorNote message={error}/><button className="btn btn-quiet" onClick={reload}>Retry</button></>:data?<><div className="card card-pad row"><span>{data.assignments.length} assignments</span><span>{data.allPoints.length} published assessments</span><span>Average: {data.overallAverage===null?'—':`${data.overallAverage}%`}</span></div><TeacherPerformancePanels key={`${id}-${months}`} groups={data.performanceGroups}/>{!data.assignments.length&&<p>No timetable assignments for this teacher.</p>}</>:<p>Loading report…</p>}</div>;
}
