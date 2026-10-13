import { useEffect, useState, FormEvent } from 'react';
import { api } from '../utils/api';
import Modal from '../ui/Modal';
import { useToast, useConfirm } from '../ui/Feedback';
import { CreditCard, Trash2 } from 'lucide-react';

type Gateway = 'jazzcash' | 'easypaisa' | 'hblpay';
type Status = { configured: boolean; enabled: boolean; environment: string; ready: boolean; reason: string };

const FIELDS = {
  jazzcash: [
    ['merchantId', 'Merchant ID', 'text'],
    ['password', 'Merchant password', 'password'],
    ['hashKey', 'Integrity salt / hash key', 'password'],
  ],
  easypaisa: [
    ['accountNum', 'Merchant account number', 'text'],
    ['storeId', 'Store ID', 'text'],
    ['username', 'Partner username', 'text'],
    ['password', 'Partner password', 'password'],
    ['privateKey', 'Client RSA private key (PEM)', 'textarea'],
    ['easypaisaPublicKey', 'Easypaisa RSA public key (PEM)', 'textarea'],
  ],
  hblpay: [
    ['profileId', 'HBL-issued Cybersource profile ID', 'text'],
    ['accessKey', 'Secure Acceptance access key', 'password'],
    ['secretKey', 'Secure Acceptance secret key', 'password'],
  ],
};

function GatewayConfig({ gateway, title, onUpdate }: { gateway: Gateway; title: string; onUpdate: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [status, setStatus] = useState<Status | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  
  async function load() {
    try {
      const data = await api.get('/institution/settings/payment-gateway');
      setStatus(data.gateways?.[gateway] || null);
    } catch {
      // Ignore
    }
  }

  useEffect(() => {
    load();
  }, [gateway]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    
    const credentials = Object.fromEntries(FIELDS[gateway].map(([name]) => [name, String(data.get(name) || '')]));
    if (gateway === 'hblpay') credentials.integration = 'cybersource-hosted';
    
    try {
      const result = await api.put('/institution/settings/payment-gateway', {
        gateway,
        credentials,
        environment: data.get('environment'),
        enabled: data.get('enabled') === 'on'
      });
      form.reset();
      await load();
      setOpen(false);
      onUpdate();
      toast.success('Configuration saved', result.ready ? 'Live payment collection enabled.' : result.reason);
    } catch (err: any) {
      toast.error('Could not save settings', err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    const ok = await confirm({
      title: 'Remove configuration?',
      body: `This disables ${title} payments immediately. Existing payment records are retained.`,
      confirmLabel: 'Remove configuration',
      tone: 'danger'
    });
    if (!ok) return;

    setBusy(true);
    try {
      await api.delete('/institution/settings/payment-gateway', { gateway });
      await load();
      setOpen(false);
      onUpdate();
      toast.info('Configuration removed');
    } catch (err: any) {
      toast.error('Could not remove configuration', err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invoiceId = Number(new FormData(event.currentTarget).get('invoiceId'));
    setBusy(true);
    try {
      const data = await api.post('/institution/settings/payment-gateway/test', { gateway, invoiceId });
      if (data.checkoutUrl) {
        window.location.assign(data.checkoutUrl);
        return;
      }
      const checkout = document.createElement('form');
      checkout.method = 'POST';
      checkout.action = data.redirectUrl;
      for (const [name, value] of Object.entries(data.payload || {})) {
        const field = document.createElement('input');
        field.type = 'hidden';
        field.name = name;
        field.value = String(value);
        checkout.appendChild(field);
      }
      document.body.appendChild(checkout);
      checkout.submit();
      checkout.remove();
    } catch (err: any) {
      toast.error('Could not start sandbox checkout', err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button 
        className="card card-hover card-pad" 
        style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 4, cursor: 'pointer' }}
        onClick={() => setOpen(true)}
      >
        <b style={{ color: 'var(--ink)' }}>{title}</b>
        <span style={{ fontSize: '0.8125rem', color: 'var(--ink-3)' }}>
          {status?.reason || "Not configured"}
        </span>
      </button>

      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        title={`${title} settings`}
        description={gateway === 'hblpay' ? 'For an HBL-issued Cybersource Secure Acceptance Hosted Checkout profile only.' : 'Use credentials issued to this institution.'}
        size="md"
        scrollBody
      >
        <div className="stack" style={{ gap: 24 }}>
          <form id={`form-${gateway}`} onSubmit={handleSave} className="stack" style={{ gap: 14 }}>
            {FIELDS[gateway].map(([name, label, type]) => (
              <label key={name} className="field">
                <span className="label">{label}</span>
                {type === 'textarea' ? (
                  <textarea name={name} required maxLength={8192} rows={4} className="input" style={{ resize: 'vertical' }} />
                ) : (
                  <input name={name} type={type} required maxLength={1024} autoComplete="off" className="input" />
                )}
              </label>
            ))}
            
            <label className="field">
              <span className="label">Environment</span>
              <select name="environment" defaultValue={status?.environment || 'sandbox'} className="select">
                <option value="sandbox">Sandbox</option>
                <option value="production">Production</option>
              </select>
            </label>

            <label className="list-row" style={{ padding: 0, gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" name="enabled" defaultChecked={status?.enabled} />
              <span>Enable collection after provider acceptance testing</span>
            </label>
          </form>

          {status?.configured && status.environment === 'sandbox' && (
            <form onSubmit={handleTest} className="card-pad stack" style={{ background: 'var(--sunken)', borderRadius: 'var(--r-md)', border: '1px solid var(--line)', gap: 10 }}>
              <div>
                <b style={{ fontSize: '0.875rem' }}>Test Sandbox Checkout</b>
                <p style={{ fontSize: '0.8125rem', color: 'var(--ink-2)' }}>Test with an unpaid challan ID from this institution. Sandbox payments never change its balance.</p>
              </div>
              <div className="row" style={{ gap: 10 }}>
                <input name="invoiceId" type="number" min="1" step="1" required className="input input-sm" placeholder="Challan ID" style={{ width: 120 }} />
                <button type="submit" disabled={busy} className="btn btn-quiet btn-sm">Start checkout</button>
              </div>
            </form>
          )}

          <div className="row-between">
            {status?.configured ? (
              <button type="button" disabled={busy} className="btn btn-danger btn-sm" onClick={handleRemove}>
                <Trash2 />
                Remove configuration
              </button>
            ) : <span />}
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
              <button type="submit" form={`form-${gateway}`} className="btn btn-primary" disabled={busy}>
                {busy ? 'Saving…' : 'Save configuration'}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default function PaymentGatewaySettings() {
  const [, setTick] = useState(0);
  const refresh = () => setTick(t => t + 1);

  return (
    <section className="card">
      <div className="card-head">
        <div className="card-head-copy">
          <h2 className="card-title">
            <CreditCard aria-hidden="true" />
            Payment gateways
          </h2>
          <p className="card-sub">Configure payment gateways to accept online fees from students.</p>
        </div>
      </div>
      <div className="card-pad grid-cards">
        <GatewayConfig gateway="easypaisa" title="Easypaisa" onUpdate={refresh} />
        <GatewayConfig gateway="jazzcash" title="JazzCash" onUpdate={refresh} />
        <GatewayConfig gateway="hblpay" title="HBLPay" onUpdate={refresh} />
      </div>
    </section>
  );
}
