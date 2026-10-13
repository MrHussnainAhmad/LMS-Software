import { useEffect, useState, type ChangeEvent } from 'react';
import QRCodeGenerator from 'qrcode';
import { Download, ExternalLink, Globe2, Plus, QrCode, Save, Trash2, Upload, X } from 'lucide-react';
import { api } from '../utils/api';
import { PageHead } from '../ui/Bits';
import PageSkeleton from '../components/PageSkeleton';
import { useToast } from '../ui/Feedback';
import { IMAGE_FILE_ACCEPT, prepareImageUpload } from '../utils/upload-file';

type CardItem = { title: string; description: string };
type StatItem = { value: string; label: string };
type GalleryItem = { url: string; caption: string };
type Profile = {
  tagline: string; description: string; heroImageUrl: string; announcementText: string; announcementLink: string;
  aboutTitle: string; mission: string; vision: string; principalName: string; principalTitle: string;
  principalMessage: string; principalImageUrl: string; statistics: StatItem[]; programs: CardItem[];
  highlights: CardItem[]; galleryImages: GalleryItem[]; publicEmail: string; publicPhone: string;
  publicAddress: string; mapUrl: string; facebookUrl: string; instagramUrl: string; youtubeUrl: string; accentColor: string;
};
type WebsiteResponse = { institution: { name: string; publicSlug: string | null; publicSiteEnabled: boolean }; profile: Partial<Profile> | null; publicUrl: string | null; qrUrl: string | null };

const EMPTY_PROFILE: Profile = {
  tagline: '', description: '', heroImageUrl: '', announcementText: '', announcementLink: '', aboutTitle: '', mission: '', vision: '',
  principalName: '', principalTitle: '', principalMessage: '', principalImageUrl: '', statistics: [], programs: [], highlights: [], galleryImages: [],
  publicEmail: '', publicPhone: '', publicAddress: '', mapUrl: '', facebookUrl: '', instagramUrl: '', youtubeUrl: '', accentColor: '#233c32',
};
const COLORS = [['#233c32', 'Forest'], ['#1d4ed8', 'Blue'], ['#7c2d12', 'Rust'], ['#5b21b6', 'Violet'], ['#0f766e', 'Teal']] as const;
const TABS = ['Homepage', 'About', 'Programs', 'Leadership', 'Gallery', 'Contact'] as const;
type Tab = typeof TABS[number];

export default function PublicWebsite() {
  const toast = useToast();
  const [data, setData] = useState<WebsiteResponse | null>(null);
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [tab, setTab] = useState<Tab>('Homepage');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api.get('/institution/public-site', { signal: controller.signal }).then((response: WebsiteResponse) => {
      setData(response);
      setProfile({ ...EMPTY_PROFILE, ...(response.profile || {}), statistics: response.profile?.statistics || [], programs: response.profile?.programs || [], highlights: response.profile?.highlights || [], galleryImages: response.profile?.galleryImages || [] });
    }).catch((error) => { if (error.name !== 'AbortError') toast.error('Public website unavailable', error.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [toast]);

  function field<K extends keyof Profile>(key: K, value: Profile[K]) { setProfile((current) => ({ ...current, [key]: value })); }
  function updateCard(list: 'programs' | 'highlights', index: number, key: keyof CardItem, value: string) { field(list, profile[list].map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item)); }
  async function save() {
    setSaving(true);
    try { await api.patch('/institution/public-site', profile); toast.success('Public website saved', 'Changes may take up to one minute to appear.'); }
    catch (error: any) { toast.error('Could not save website', error.message); }
    finally { setSaving(false); }
  }

  async function uploadImage(event: ChangeEvent<HTMLInputElement>, target: 'hero' | 'leadership' | 'gallery') {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    setUploading(target);
    try {
      const preparedFile = await prepareImageUpload(file);
      const signature = await api.post('/institution/public-site/images', { action: 'signature' });
      const form = new FormData();
      form.append('file', preparedFile); form.append('api_key', signature.apiKey); form.append('timestamp', String(signature.timestamp)); form.append('signature', signature.signature); form.append('folder', signature.folder); form.append('allowed_formats', signature.allowedFormats); form.append('type', signature.type);
      const response = await fetch(`https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`, { method: 'POST', body: form });
      const uploaded = await response.json();
      if (!response.ok) throw new Error(uploaded.error?.message || 'Image upload failed');
      const completed = await api.post('/institution/public-site/images', { action: 'complete', publicId: uploaded.public_id, format: uploaded.format, resourceType: uploaded.resource_type });
      if (target === 'hero') field('heroImageUrl', completed.url);
      else if (target === 'leadership') field('principalImageUrl', completed.url);
      else setProfile((current) => current.galleryImages.length >= 8 ? current : ({ ...current, galleryImages: [...current.galleryImages, { url: completed.url, caption: '' }] }));
      toast.success('Image uploaded');
    } catch (error: any) { toast.error('Image upload failed', error.message); }
    finally { setUploading(''); }
  }

  async function generateQrCode() {
    if (!data?.qrUrl) return;
    try { setQrDataUrl(await QRCodeGenerator.toDataURL(data.qrUrl, { width: 320, margin: 2, color: { dark: '#171c1a', light: '#ffffff' } })); }
    catch (error: any) { toast.error('Could not generate QR code', error.message); }
  }

  if (loading) return <div className="page"><PageSkeleton cards={2} rows={6} /></div>;
  const canEdit = Boolean(data?.institution.publicSlug);
  const guide: Record<Tab, string> = {
    Homepage: 'Use a short promise as the headline, not the institution name. Add one wide, real campus photograph. Announcements are for current notices only.',
    About: 'Explain your history and teaching approach. Mission is what you do today; vision is the future you want to create. Statistics must be factual numbers.',
    Programs: 'Programs are what students can study, such as Matric Science, FSc Pre-Medical, ICS, or BS Computer Science. Campus names do not belong here. Highlights describe facilities and student experience.',
    Leadership: 'Add one genuine welcome message with the leader’s exact name, designation, and a formal portrait selected from your device.',
    Gallery: 'Use real campus, classroom, facility, or event photographs with permission. Add useful captions and avoid posters or repeated logos.',
    Contact: 'Enter visitor-facing contact information and full HTTPS links to the official map and social-media accounts.',
  };

  return <div className="page">
    <PageHead title="Public website" subtitle={data ? `Manage the public website for ${data.institution.name}.` : 'Manage your institution website.'}>{data?.qrUrl && data.institution.publicSiteEnabled && <button className="btn btn-quiet" onClick={generateQrCode}><QrCode />Generate QR code</button>}{data?.publicUrl && data.institution.publicSiteEnabled && <button className="btn btn-quiet" onClick={() => window.open(data.publicUrl!, '_blank', 'noopener')}><ExternalLink />Visit website</button>}<button className="btn btn-primary" disabled={!canEdit || saving} onClick={save}><Save />{saving ? 'Saving…' : 'Save website'}</button></PageHead>

    <div className={`alert ${data?.institution.publicSiteEnabled ? 'alert-ok' : 'alert-warn'}`}><Globe2 /><div><b>{data?.publicUrl ? new URL(data.publicUrl).hostname : 'Subdomain not assigned'}</b><p>{data?.institution.publicSiteEnabled ? 'Your public website is live.' : canEdit ? 'Your subdomain is reserved but the website is not published.' : 'Nisaab360 staff assign the subdomain after approval and payment verification.'}</p></div></div>

    {qrDataUrl && data?.qrUrl && <section className="card qr-card"><button type="button" className="btn btn-ghost btn-sm qr-close" aria-label="Close QR code" onClick={() => setQrDataUrl(null)}><X /></button><img src={qrDataUrl} width="144" height="144" alt={`QR code for ${data.institution.name}`} /><div className="cell-stack"><b>Institution homepage QR code</b><span>{data.qrUrl}</span><a className="btn btn-quiet btn-sm" href={qrDataUrl} download={`${data.institution.publicSlug || 'institution'}-website-qr.png`}><Download />Download PNG</a></div></section>}

    <div className="card">
      <div className="card-head" style={{ overflowX: 'auto' }}>{TABS.map((name) => <button type="button" key={name} className={`btn btn-sm ${tab === name ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(name)}>{name}</button>)}</div>
      <fieldset disabled={!canEdit || saving} className="card-pad stack" style={{ gap: 18 }}>
        <div className="alert alert-info"><Globe2 /><div><b>What to add here</b><p>{guide[tab]}</p></div></div>

        {tab === 'Homepage' && <div className="form-grid form-grid-2"><div style={{ gridColumn: '1 / -1' }}><ImageChoice label="Homepage cover image" url={profile.heroImageUrl} busy={uploading === 'hero'} onChange={(event) => uploadImage(event, 'hero')} onRemove={() => field('heroImageUrl', '')} hint="Choose a wide JPG, PNG, or WebP photograph. It is compressed before upload and must be no larger than 5 MB afterward." /></div><TextField label="Homepage headline" value={profile.tagline} onChange={(value) => field('tagline', value)} placeholder="Building confident learners for a changing world" /><div /><TextField label="Announcement text" value={profile.announcementText} onChange={(value) => field('announcementText', value)} placeholder="Admissions for 2027 are open" /><TextField label="Announcement link" value={profile.announcementLink} onChange={(value) => field('announcementLink', value)} placeholder="/admissions" /><div className="field" style={{ gridColumn: '1 / -1' }}><span className="label">Website color</span><div className="row" style={{ flexWrap: 'wrap' }}>{COLORS.map(([value, name]) => <label key={value} className={`chip ${profile.accentColor === value ? 'chip-brand' : 'chip-mute'}`} style={{ cursor: 'pointer' }}><input type="radio" name="accent" checked={profile.accentColor === value} onChange={() => field('accentColor', value)} /><i style={{ width: 12, height: 12, borderRadius: 99, background: value }} />{name}</label>)}</div></div></div>}

        {tab === 'About' && <div className="form-grid"><TextField label="About section heading" value={profile.aboutTitle} onChange={(value) => field('aboutTitle', value)} placeholder="Welcome to our institution" /><AreaField label="About the institution" value={profile.description} onChange={(value) => field('description', value)} rows={5} /><div className="form-grid form-grid-2"><AreaField label="Mission" value={profile.mission} onChange={(value) => field('mission', value)} /><AreaField label="Vision" value={profile.vision} onChange={(value) => field('vision', value)} /></div><Repeater title="Statistics" limit={6} onAdd={() => field('statistics', [...profile.statistics, { value: '', label: '' }])}>{profile.statistics.map((item, index) => <div className="form-grid form-grid-2" key={index}><TextField label="Value" value={item.value} onChange={(value) => field('statistics', profile.statistics.map((entry, i) => i === index ? { ...entry, value } : entry))} placeholder="1,200+" /><TextField label="Meaning" value={item.label} onChange={(value) => field('statistics', profile.statistics.map((entry, i) => i === index ? { ...entry, label: value } : entry))} placeholder="Students" /><Remove onClick={() => field('statistics', profile.statistics.filter((_, i) => i !== index))} /></div>)}</Repeater></div>}

        {tab === 'Programs' && <div className="form-grid form-grid-2">{(['programs', 'highlights'] as const).map((list) => <Repeater key={list} title={list === 'programs' ? 'Programs students can study' : 'Campus and student highlights'} limit={8} onAdd={() => field(list, [...profile[list], { title: '', description: '' }])}>{profile[list].map((item, index) => <div className="stack" style={{ gap: 8 }} key={index}><TextField label={list === 'programs' ? 'Program or class' : 'Highlight'} value={item.title} onChange={(value) => updateCard(list, index, 'title', value)} placeholder={list === 'programs' ? 'FSc Pre-Medical' : 'Science laboratories'} /><AreaField label="Description" value={item.description} onChange={(value) => updateCard(list, index, 'description', value)} rows={2} /><Remove onClick={() => field(list, profile[list].filter((_, i) => i !== index))} /></div>)}</Repeater>)}</div>}

        {tab === 'Leadership' && <div className="form-grid form-grid-2"><TextField label="Name" value={profile.principalName} onChange={(value) => field('principalName', value)} /><TextField label="Designation" value={profile.principalTitle} onChange={(value) => field('principalTitle', value)} placeholder="Principal" /><div style={{ gridColumn: '1 / -1' }}><ImageChoice label="Leadership photograph" url={profile.principalImageUrl} busy={uploading === 'leadership'} onChange={(event) => uploadImage(event, 'leadership')} onRemove={() => field('principalImageUrl', '')} hint="Choose a clear portrait JPG, PNG, or WebP. It is compressed before upload and must be no larger than 5 MB afterward." portrait /></div><div style={{ gridColumn: '1 / -1' }}><AreaField label="Welcome message" value={profile.principalMessage} onChange={(value) => field('principalMessage', value)} rows={6} /></div></div>}

        {tab === 'Gallery' && <section className="card" style={{ boxShadow: 'none' }}><div className="card-head"><div className="card-head-copy"><h3 className="card-title">Website photographs</h3><p className="card-sub">{profile.galleryImages.length} of 8</p></div><ImageUpload label="Choose image from device" busy={uploading === 'gallery'} disabled={profile.galleryImages.length >= 8} onChange={(event) => uploadImage(event, 'gallery')} /></div><div className="card-pad form-grid form-grid-2">{profile.galleryImages.map((item, index) => <div className="card" style={{ overflow: 'hidden', boxShadow: 'none' }} key={`${item.url}-${index}`}><img src={item.url} alt={item.caption || `Gallery image ${index + 1}`} style={{ display: 'block', width: '100%', height: 190, objectFit: 'cover', background: 'var(--sunken)' }} /><div className="card-pad stack" style={{ gap: 10 }}><TextField label="Caption" value={item.caption} onChange={(value) => field('galleryImages', profile.galleryImages.map((entry, i) => i === index ? { ...entry, caption: value } : entry))} /><Remove onClick={() => field('galleryImages', profile.galleryImages.filter((_, i) => i !== index))} /></div></div>)}{profile.galleryImages.length === 0 && <p className="prose-note">No photographs added. Choose images from your device; this section remains hidden until then.</p>}</div></section>}

        {tab === 'Contact' && <div className="form-grid form-grid-2"><TextField label="Public email" value={profile.publicEmail} onChange={(value) => field('publicEmail', value)} type="email" /><TextField label="Public phone" value={profile.publicPhone} onChange={(value) => field('publicPhone', value)} /><div style={{ gridColumn: '1 / -1' }}><TextField label="Campus address" value={profile.publicAddress} onChange={(value) => field('publicAddress', value)} /></div><div style={{ gridColumn: '1 / -1' }}><TextField label="Google Maps link" value={profile.mapUrl} onChange={(value) => field('mapUrl', value)} type="url" /></div><TextField label="Facebook URL" value={profile.facebookUrl} onChange={(value) => field('facebookUrl', value)} type="url" /><TextField label="Instagram URL" value={profile.instagramUrl} onChange={(value) => field('instagramUrl', value)} type="url" /><TextField label="YouTube URL" value={profile.youtubeUrl} onChange={(value) => field('youtubeUrl', value)} type="url" /></div>}
      </fieldset>
    </div>
  </div>;
}

function TextField({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) { return <label className="field"><span className="label">{label}</span><input className="input" type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>; }
function AreaField({ label, value, onChange, rows = 4 }: { label: string; value: string; onChange: (value: string) => void; rows?: number }) { return <label className="field"><span className="label">{label}</span><textarea className="textarea" rows={rows} value={value} onChange={(event) => onChange(event.target.value)} /></label>; }
function Repeater({ title, limit, onAdd, children }: { title: string; limit: number; onAdd: () => void; children: React.ReactNode }) { const count = Array.isArray(children) ? children.length : children ? 1 : 0; return <section className="card" style={{ boxShadow: 'none' }}><div className="card-head"><div className="card-head-copy"><h3 className="card-title">{title}</h3><p className="card-sub">{count} of {limit}</p></div><button type="button" className="btn btn-quiet btn-sm" onClick={onAdd} disabled={count >= limit}><Plus />Add</button></div><div className="card-pad stack" style={{ gap: 14 }}>{children}{count === 0 && <p className="prose-note">Nothing added. This section stays hidden on the public website.</p>}</div></section>; }
function Remove({ onClick }: { onClick: () => void }) { return <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--bad)', justifySelf: 'start' }} onClick={onClick}><Trash2 />Remove</button>; }
function ImageUpload({ label, busy, disabled = false, onChange }: { label: string; busy: boolean; disabled?: boolean; onChange: (event: ChangeEvent<HTMLInputElement>) => void }) { return <label className={`btn btn-quiet ${busy || disabled ? 'is-disabled' : ''}`} style={{ width: 'fit-content' }}><Upload />{busy ? 'Compressing and uploading…' : label}<input className="sr-only" type="file" accept={IMAGE_FILE_ACCEPT} disabled={busy || disabled} onChange={onChange} /></label>; }

function ImageChoice({ label, url, busy, onChange, onRemove, hint, portrait = false }: { label: string; url: string; busy: boolean; onChange: (event: ChangeEvent<HTMLInputElement>) => void; onRemove: () => void; hint: string; portrait?: boolean }) {
  return <div className="field"><span className="label">{label}</span>{url ? <div className="card" style={{ maxWidth: portrait ? 320 : 'none', overflow: 'hidden', boxShadow: 'none' }}><img src={url} alt={`${label} preview`} style={{ display: 'block', width: '100%', height: portrait ? 360 : 250, objectFit: 'cover', background: 'var(--sunken)' }} /><div className="card-pad row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}><span className="prose-note">Image selected</span><div className="row"><ImageUpload label="Replace" busy={busy} onChange={onChange} /><Remove onClick={onRemove} /></div></div></div> : <div className="card-pad" style={{ border: '1px dashed var(--line-2)', borderRadius: 'var(--r)', background: 'var(--sunken)' }}><ImageUpload label="Choose image from device" busy={busy} onChange={onChange} /><p className="prose-note" style={{ marginTop: 8 }}>{hint}</p></div>}</div>;
}
