import { useSearchParams } from 'react-router-dom';
import { AdmissionsManager } from '@/app/(institution)/institution/admissions/AdmissionsManager';
import { ApplicationsReviewPanel } from '@/app/(institution)/institution/admissions/ApplicationsReviewPanel';
import { CampusAdmissionsAvailability } from '@/app/(institution)/institution/admissions/CampusAdmissionsAvailability';
import { useWorkspace } from '../components/WorkspaceProvider';
import { PageHead } from '../ui/Bits';
export default function Admissions() {
  const [params, setParams] = useSearchParams();
  const { workspace } = useWorkspace();
  const canConfigure = workspace?.isMainCampus !== false;
  const sections = (canConfigure ? ['setup','status','review','offline'] : ['status','review','offline']);
  const section = sections.includes(params.get('section') || '') ? params.get('section')! : sections[0];
  return <div className="page"><PageHead title="Admissions" subtitle="Configure cycles and review applications." /><nav className="row" aria-label="Admission sections">{sections.map(value => <button key={value} className={section === value ? 'btn btn-primary' : 'btn btn-quiet'} onClick={() => setParams({section:value})}>{({setup:'Admissions setup',status:'Open / close',review:'Review applications',offline:'Walk-in applications'} as Record<string,string>)[value]}</button>)}</nav>
  {section === 'setup' && <AdmissionsManager mode="setup" />}
  {section === 'status' && (canConfigure ? <AdmissionsManager mode="status" /> : <CampusAdmissionsAvailability refreshKey="campus" />)}
  {section === 'review' && <ApplicationsReviewPanel />}{section === 'offline' && <ApplicationsReviewPanel offlineOnly />}</div>;
}
