import { useSearchParams } from 'react-router-dom';
import { FeesManager } from '@/app/(institution)/institution/fees/FeesManager';
import { PageHead } from '../ui/Bits';
export default function Fees() {
  const [params, setParams] = useSearchParams();
  const modes = ['setup', 'billing', 'collections', 'paid'] as const;
  const mode = modes.find(value => value === params.get('section')) || 'setup';
  return <div className="page"><PageHead title="Fees" subtitle="Manage fee structure, billing and collections." /><nav className="row" aria-label="Fee sections">{modes.map(value => <button key={value} className={mode === value ? 'btn btn-primary' : 'btn btn-quiet'} onClick={() => setParams({ section: value })}>{({setup:'Fee setup',billing:'Billing',collections:'Collections',paid:'Paid challans'})[value]}</button>)}</nav><FeesManager key={mode} mode={mode} /></div>;
}
