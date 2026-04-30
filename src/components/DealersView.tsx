import React, { useState } from 'react';
import { Plus, CreditCard as Edit2, Check, X, Users, ToggleLeft, ToggleRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useDealers } from '../hooks/useData';
import { getDealerColor } from '../lib/utils';
import type { Dealer } from '../lib/database.types';

export default function DealersView() {
  const { dealers, loading, reload } = useDealers();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Dealers</h1>
          <p className="text-sm text-slate-500">{dealers.filter(d => d.active).length} active dealers</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          Add Dealer
        </button>
      </div>

      {showAdd && (
        <DealerForm
          onSave={async (data) => {
            await supabase.from('dealers').insert(data);
            reload();
            setShowAdd(false);
          }}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Loading...</div>
      ) : (
        <div className="space-y-3">
          {dealers.map(dealer => (
            editId === dealer.id ? (
              <DealerForm
                key={dealer.id}
                initial={dealer}
                onSave={async (data) => {
                  await supabase.from('dealers').update(data).eq('id', dealer.id);
                  reload();
                  setEditId(null);
                }}
                onCancel={() => setEditId(null)}
              />
            ) : (
              <DealerCard
                key={dealer.id}
                dealer={dealer}
                onEdit={() => setEditId(dealer.id)}
                onToggle={async () => {
                  await supabase.from('dealers').update({ active: !dealer.active }).eq('id', dealer.id);
                  reload();
                }}
              />
            )
          ))}
        </div>
      )}
    </div>
  );
}

function DealerCard({ dealer, onEdit, onToggle }: {
  dealer: Dealer;
  onEdit: () => void;
  onToggle: () => void;
}) {
  const color = getDealerColor(dealer.id);

  return (
    <div className={`bg-white rounded-xl border shadow-sm p-4 ${dealer.active ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm ${color.light} ${color.text}`}>
          {dealer.code}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-800">{dealer.name}</div>
          {dealer.contact && <div className="text-xs text-slate-500">{dealer.contact}</div>}
          <div className="flex gap-4 mt-1.5">
            {dealer.max_19l > 0 && (
              <span className="text-xs text-blue-600 font-medium flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                19L max: {dealer.max_19l}
              </span>
            )}
            {dealer.max_10l > 0 && (
              <span className="text-xs text-cyan-600 font-medium flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                10L max: {dealer.max_10l}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggle}
            className={`p-2 rounded-lg transition-colors ${dealer.active ? 'text-emerald-500 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`}
          >
            {dealer.active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
          </button>
          <button
            onClick={onEdit}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <Edit2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function DealerForm({ initial, onSave, onCancel }: {
  initial?: Dealer;
  onSave: (data: any) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [code, setCode] = useState(initial?.code ?? '');
  const [contact, setContact] = useState(initial?.contact ?? '');
  const [max19l, setMax19l] = useState(String(initial?.max_19l ?? 0));
  const [max10l, setMax10l] = useState(String(initial?.max_10l ?? 0));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name || !code) return;
    setSaving(true);
    await onSave({
      name,
      code: code.toUpperCase(),
      contact,
      max_19l: parseInt(max19l) || 0,
      max_10l: parseInt(max10l) || 0,
      active: initial?.active ?? true,
    });
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-xl border border-blue-200 p-4 shadow-md space-y-3">
      <div className="text-sm font-semibold text-slate-700">{initial ? 'Edit Dealer' : 'New Dealer'}</div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Full Name *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Kumarasingha"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Short Code *</label>
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. KD"
            maxLength={6}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Max 19L Bottles</label>
          <input
            type="number"
            min="0"
            value={max19l}
            onChange={e => setMax19l(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Max 10L Bottles</label>
          <input
            type="number"
            min="0"
            value={max10l}
            onChange={e => setMax10l(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-slate-500 mb-1 block">Contact (optional)</label>
          <input
            type="text"
            value={contact}
            onChange={e => setContact(e.target.value)}
            placeholder="Phone number"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={onCancel} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors">
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !name || !code}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <Check size={15} />
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
