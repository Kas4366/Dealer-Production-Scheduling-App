import { useState, useEffect } from 'react';
import { supabase, Dealer } from '../lib/supabase';
import { Plus, CreditCard as Edit2, Loader2, Search, CheckCircle2, XCircle, Users } from 'lucide-react';

export default function DealerManagement() {
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<Dealer | null | 'new'>(null);
  const [saving, setSaving] = useState(false);

  const fetchDealers = async () => {
    setLoading(true);
    const { data } = await supabase.from('dealers').select('*').order('name');
    setDealers(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchDealers(); }, []);

  const filtered = dealers.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.code.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async (form: Partial<Dealer>) => {
    setSaving(true);
    if (modal === 'new') {
      await supabase.from('dealers').insert({
        name: form.name,
        code: form.code?.toUpperCase(),
        max_19l: form.max_19l || 0,
        max_10l: form.max_10l || 0,
        active: form.active ?? true,
        contact: form.contact || '',
      });
    } else if (modal && modal !== 'new') {
      await supabase.from('dealers').update({
        name: form.name,
        code: form.code?.toUpperCase(),
        max_19l: form.max_19l || 0,
        max_10l: form.max_10l || 0,
        active: form.active ?? true,
        contact: form.contact || '',
      }).eq('id', modal.id);
    }
    setSaving(false);
    setModal(null);
    fetchDealers();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search dealers..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
        <button
          onClick={() => setModal('new')}
          className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 transition-colors"
        >
          <Plus size={16} />
          Add Dealer
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-sky-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="flex justify-center mb-3">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
              <Users size={24} className="text-slate-400" />
            </div>
          </div>
          <p className="text-slate-500">No dealers found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Dealer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Code</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Max 19L</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Max 10L</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(dealer => (
                <tr key={dealer.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{dealer.name}</div>
                    {dealer.contact && <div className="text-xs text-slate-400">{dealer.contact}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm bg-slate-100 px-2 py-0.5 rounded text-slate-700">{dealer.code}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-slate-700">{dealer.max_19l.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-sm text-slate-700">{dealer.max_10l.toLocaleString()}</td>
                  <td className="px-4 py-3 text-center">
                    {dealer.active ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">
                        <CheckCircle2 size={11} /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-500">
                        <XCircle size={11} /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setModal(dealer)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors"
                    >
                      <Edit2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <DealerModal
          dealer={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  );
}

function DealerModal({
  dealer,
  onClose,
  onSave,
  saving,
}: {
  dealer: Dealer | null;
  onClose: () => void;
  onSave: (form: Partial<Dealer>) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Partial<Dealer>>({
    name: dealer?.name ?? '',
    code: dealer?.code ?? '',
    max_19l: dealer?.max_19l ?? 0,
    max_10l: dealer?.max_10l ?? 0,
    active: dealer?.active ?? true,
    contact: dealer?.contact ?? '',
  });

  const set = (k: keyof Dealer, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-5 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">{dealer ? 'Edit Dealer' : 'Add Dealer'}</h3>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
              <input type="text" value={form.name || ''} onChange={e => set('name', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="Dealer name" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Code</label>
              <input type="text" value={form.code || ''} onChange={e => set('code', e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="ABC" maxLength={10} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
              <select value={form.active ? 'active' : 'inactive'} onChange={e => set('active', e.target.value === 'active')}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Max 19L / week</label>
              <input type="number" min={0} value={form.max_19l || 0} onChange={e => set('max_19l', +e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Max 10L / week</label>
              <input type="number" min={0} value={form.max_10l || 0} onChange={e => set('max_10l', +e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Contact</label>
              <input type="text" value={form.contact || ''} onChange={e => set('contact', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="Phone or email" />
            </div>
          </div>
        </div>
        <div className="p-5 border-t border-slate-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.name || !form.code}
            className="flex-1 py-2.5 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
