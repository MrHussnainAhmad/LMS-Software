import { useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../utils/api';
import { useRemoteData } from '../utils/use-remote-data';
import { PromotionReviewActions, type PromotionReviewCsvRow } from '@/app/(institution)/institution/students/promotion/[id]/PromotionReviewActions';
import { ErrorNote, PageHead } from '../ui/Bits';
export default function PromotionReview(){
 const {id}=useParams();
 const load=useCallback(async()=>{const [details,list]=await Promise.all([api.get(`/institution/students/auto-promote?batchExamId=${id}`),api.get('/institution/students/auto-promote')]);const batch=list.batches.find((row:{id:number})=>String(row.id)===id);if(!batch)throw new Error('Promotion batch not found');return {batch,rows:details.rows};},[id]);
 const {data,error,reload}=useRemoteData(load);
 if(error)return <div className="page"><ErrorNote message={error}/><button className="btn btn-quiet" onClick={reload}>Retry</button></div>;
 if(!data)return <div className="page">Loading promotion sheet…</div>;
 const subjects=Array.from(new Set<string>(data.rows.map((row:{subject:string})=>row.subject)));
 const grouped=new Map<number,PromotionReviewCsvRow & {max:number}>();
 for(const item of data.rows){const row: PromotionReviewCsvRow & {max:number}=grouped.get(item.studentId)||{student:item.student,roll:item.roll,total:0,max:0,percentage:0,status:data.batch.officialPublishedAt?'Officially published':data.batch.allSubjectsPublished?'Ready for institution publish':'Awaiting teachers',subjects:{}};row.total+=item.marks;row.max+=item.maxMarks;row.subjects[item.subject]=`${item.marks}/${item.maxMarks}`;row.percentage=row.max?100*row.total/row.max:0;grouped.set(item.studentId,row);}
 const rows=[...grouped.values()];
 return <div className="page print-document"><Link className="print:hidden" to="/promotion">Back to promotion</Link><PageHead title={data.batch.title} subtitle={`${data.batch.className} ${data.batch.sectionName||''}`}/><PromotionReviewActions fileName={`promotion-${id}`} subjects={subjects} rows={rows}/><div className="table-wrap"><table className="tbl"><thead><tr><th>Roll</th><th>Student</th>{subjects.map(subject=><th key={subject}>{subject}</th>)}<th>Total</th><th>Percentage</th><th>Status</th></tr></thead><tbody>{rows.map(row=><tr key={row.roll}><td>{row.roll}</td><td>{row.student}</td>{subjects.map(subject=><td key={subject}>{row.subjects[subject]||'—'}</td>)}<td>{row.total}/{row.max}</td><td>{row.percentage.toFixed(2)}%</td><td>{row.status}</td></tr>)}</tbody></table></div></div>;
}
