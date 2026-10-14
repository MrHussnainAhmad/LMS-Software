import { PublicWebsiteEditor } from '@/app/(institution)/institution/settings/PublicWebsiteEditor';
import { normalizeWebsiteNotices } from '@/lib/public-website-notices';
import { getPublicSiteTheme } from '@/lib/public-site-themes';
import { useRemoteData } from '../utils/use-remote-data';
import { api } from '../utils/api';
import { ErrorNote, PageHead } from '../ui/Bits';
import PageSkeleton from '../components/PageSkeleton';
const load = async () => { const [site, events] = await Promise.all([api.get('/institution/public-site'), api.get('/institution/public-events')]); return {site,events:events.events.filter((event:any) => event.status === 'PUBLISHED' && (!event.expiresAt || new Date(event.expiresAt) > new Date()))}; };
export default function PublicWebsite() {
 const {data,error,reload} = useRemoteData(load);
 if(error) return <div className="page"><ErrorNote message={error}/><button className="btn btn-quiet" onClick={reload}>Retry</button></div>;
 if(!data) return <div className="page"><PageSkeleton/></div>;
 const {site,events} = data; const profile = site.profile || {};
 const initialProfile = {...profile, statistics:profile.statistics || [], programs:profile.programs || [], highlights:profile.highlights || [], galleryImages:profile.galleryImages || [], websiteNotices:normalizeWebsiteNotices(profile.websiteNotices), theme:getPublicSiteTheme(profile.theme).id, design:profile.design || {}};
 return <div className="page"><PageHead title="Public website" subtitle="Design and preview your institution website."/><PublicWebsiteEditor publicSlug={site.institution.publicSlug} publicSiteEnabled={site.institution.publicSiteEnabled} publicUrl={site.publicUrl} qrUrl={site.qrUrl} eventLinks={events} initialProfile={initialProfile} previewIdentity={site.institution} previewEvents={events.slice(0,6)}/></div>;
}
