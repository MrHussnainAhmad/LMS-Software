import { WebsiteEventsManager } from '@/app/(institution)/institution/website-events/WebsiteEventsManager';
import { eventListItem } from '@/app/(institution)/institution/website-events/event-types';
import { useRemoteData } from '../utils/use-remote-data';
import { api } from '../utils/api';
import { ErrorNote } from '../ui/Bits';
import PageSkeleton from '../components/PageSkeleton';
const load = async () => { const [site, events] = await Promise.all([api.get('/institution/public-site'), api.get('/institution/public-events')]); return {site,events}; };
export default function PublicEvents() {
 const { data, error, reload } = useRemoteData(load);
 if (error) return <div className="page"><ErrorNote message={error}/><button className="btn btn-quiet" onClick={reload}>Retry</button></div>;
 if (!data) return <div className="page"><PageSkeleton /></div>;
 return <div className="page"><WebsiteEventsManager institutionName={data.site.institution.name} publicBaseUrl={data.site.publicUrl} publicSiteEnabled={data.site.institution.publicSiteEnabled} initialEvents={data.events.events.map(eventListItem)} readOnly={Boolean(sessionStorage.getItem('campus_view'))}/></div>;
}
