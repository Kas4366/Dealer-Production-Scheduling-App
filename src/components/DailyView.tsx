import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Clock, Package, CheckCircle, XCircle, AlertCircle, RefreshCw, ArrowRightLeft, ArrowRight, Plus, Zap, Trash2, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useDailySchedule, useDealers, useProductionSettings } from '../hooks/useData';
import {
  getTodayDate, getWeekDates, formatDate, formatTime,
  getChangeLabel, getDayOfWeek, getDealerColor, getCurrentTimeStr,
  getEffectiveCapacity, formatFillDuration, DAY_NAMES
} from '../lib/utils';
import type { DailyScheduleWithDealer, VisitStatus, VisitRecord } from '../lib/database.types';
import VisitPanel from './VisitPanel';
import GenerateWeekModal from './GenerateWeekModal';
import AddExtraSlotModal from './AddExtraSlotModal';

export default function DailyView() {
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [weekOffset, setWeekOffset] = useState(0);
  const weekDates = getWeekDates(weekOffset);
  const { slots, loading, reload } = useDailySchedule([selectedDate]);
  const { dealers } = useDealers();
  const { settings } = useProductionSettings();
  const [panelSlot, setPanelSlot] = useState<DailyScheduleWithDealer | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [showAddExtra, setShowAddExtra] = useState(false);
  const [holidayThisWeek, setHolidayThisWeek] = useState<{ holiday_date: string; name: string } | null>(null);

  // Check for holiday banner on Monday
  useEffect(() => {
    const checkHoliday = async () => {
      const today = new Date();
      if (today.getDay() === 1) { // Monday
        const { data } = await supabase
          .from('holidays')
          .select('*')
          .in('holiday_date', weekDates)
          .maybeSingle();
        if (data) setHolidayThisWeek(data);
      }
    };
    checkHoliday();
  }, [weekOffset]);

  const activeSlots = slots.filter(s => s.status !== 'moved_out');
  const totalPlanned19 = activeSlots.reduce((sum, s) => sum + s.planned_19l, 0);
  const totalPlanned10 = activeSlots.reduce((sum, s) => sum + s.planned_10l, 0);
  const totalPlanned = totalPlanned19 + totalPlanned10;
  const totalFilled19 = activeSlots.reduce((sum, s) => sum + (s.visit_record?.bottles_19l_out || 0), 0);
  const totalFilled10 = activeSlots.reduce((sum, s) => sum + (s.visit_record?.bottles_10l_out || 0), 0);
  const totalFilledHome = activeSlots.reduce((sum, s) => sum + (s.visit_record?.bottles_home || 0), 0);
  const totalFilled = totalFilled19 + totalFilled10;
  const completed = activeSlots.filter(s => s.visit_record?.status === 'completed').length;
  const capacity = settings ? getEffectiveCapacity(settings) : 0;

  const dayLabel = formatDate(selectedDate);
  const currentTime = getCurrentTimeStr();

  const changeDay = (dir: number) => {
    const idx = weekDates.indexOf(selectedDate);
    const next = idx + dir;
    if (next >= 0 && next < 6) {
      setSelectedDate(weekDates[next]);
    } else {
      const newOffset = weekOffset + dir;
      const newDates = getWeekDates(newOffset);
      setWeekOffset(newOffset);
      setSelectedDate(dir > 0 ? newDates[0] : newDates[5]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Holiday banner */}
      {holidayThisWeek && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3">
          <AlertCircle size={18} className="text-amber-500 shrink-0" />
          <div className="flex-1 text-sm">
            <span className="font-semibold text-amber-800">Holiday this week: </span>
            <span className="text-amber-700">{holidayThisWeek.name} on {formatDate(holidayThisWeek.holiday_date)}</span>
          </div>
          <a href="#" onClick={e => { e.preventDefault(); }} className="text-xs text-amber-600 font-medium underline">Redistribute</a>
        </div>
      )}

      {/* Date selector */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => changeDay(-1)} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <ChevronLeft size={18} className="text-slate-600" />
          </button>
          <div className="text-center">
            <div className="text-base font-bold text-slate-800">{dayLabel}</div>
            <div className="text-xs text-slate-500">{DAY_NAMES[getDayOfWeek(selectedDate)]}</div>
          </div>
          <button onClick={() => changeDay(1)} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <ChevronRight size={18} className="text-slate-600" />
          </button>
        </div>

        {/* Day tabs */}
        <div className="grid grid-cols-6 gap-1">
          {weekDates.map((d, i) => {
            const isSelected = d === selectedDate;
            const isToday = d === getTodayDate();
            return (
              <button
                key={d}
                onClick={() => setSelectedDate(d)}
                className={`flex flex-col items-center py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isSelected ? 'bg-blue-600 text-white' : isToday ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                <span>{['M','T','W','T','F','S'][i]}</span>
                <span className="text-[10px] mt-0.5">{new Date(d + 'T00:00:00').getDate()}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-5 gap-2">
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm text-center">
          <div className="text-xl font-bold text-slate-800">{activeSlots.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">Slots</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm text-center">
          <div className="text-xl font-bold text-blue-600">{totalFilled19}</div>
          <div className="text-xs text-slate-500 mt-0.5">19L</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm text-center">
          <div className="text-xl font-bold text-cyan-600">{totalFilled10}</div>
          <div className="text-xs text-slate-500 mt-0.5">10L</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm text-center">
          <div className="text-xl font-bold text-emerald-500">{totalFilledHome}</div>
          <div className="text-xs text-slate-500 mt-0.5">Home</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm text-center">
          <div className="text-xl font-bold text-emerald-600">{completed}</div>
          <div className="text-xs text-slate-500 mt-0.5">Done</div>
        </div>
      </div>

      {/* Progress bar */}
      {totalPlanned > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
          <div className="flex justify-between text-xs text-slate-500 mb-2">
            <span>Daily Progress</span>
            <span className="font-semibold text-slate-700">
              <span className="text-blue-600">{totalFilled19}</span>
              <span className="text-slate-400"> / </span>
              <span className="text-slate-600">{totalPlanned19} 19L</span>
              <span className="mx-1.5 text-slate-300">·</span>
              <span className="text-cyan-600">{totalFilled10}</span>
              <span className="text-slate-400"> / </span>
              <span className="text-slate-600">{totalPlanned10} 10L</span>
              {totalFilledHome > 0 && (
                <>
                  <span className="mx-1.5 text-slate-300">·</span>
                  <span className="text-emerald-500">{totalFilledHome} Home</span>
                </>
              )}
            </span>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (totalFilled / totalPlanned) * 100)}%` }}
            />
          </div>
          {capacity > 0 && (
            <div className="text-xs text-slate-400 mt-1.5 text-right">
              Daily capacity: {capacity} bottles
            </div>
          )}
        </div>
      )}

      {/* Slot list */}
      <div className="space-y-2">
        {loading && (
          <div className="text-center py-12 text-slate-400 text-sm">Loading...</div>
        )}
        {!loading && activeSlots.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <Package size={32} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 text-sm font-medium">No slots scheduled for this day</p>
            <p className="text-slate-400 text-xs mt-1">Generate week from the weekly template to add slots</p>
            <button
              onClick={() => setShowGenerate(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus size={15} />
              Generate Week
            </button>
          </div>
        )}
        {!loading && activeSlots.map(slot => (
          <SlotCard
            key={slot.id}
            slot={slot}
            currentTime={currentTime}
            fillSpeed={settings?.fill_speed_per_hour ?? 0}
            onClick={() => setPanelSlot(slot)}
            onDelete={async () => {
              await supabase.from('daily_schedule').delete().eq('id', slot.id);
              reload();
            }}
          />
        ))}
        {!loading && activeSlots.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setShowGenerate(true)}
              className="flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-400 hover:border-blue-300 hover:text-blue-500 transition-colors"
            >
              <Plus size={16} />
              Refresh Week
            </button>
            <button
              onClick={() => setShowAddExtra(true)}
              className="flex items-center justify-center gap-2 py-3 border-2 border-dashed border-emerald-200 rounded-xl text-sm text-emerald-500 hover:border-emerald-400 hover:bg-emerald-50 transition-colors font-medium"
            >
              <Plus size={16} />
              Extra Slot
            </button>
          </div>
        )}
      </div>

      {panelSlot && (
        <VisitPanel
          slot={panelSlot}
          fillSpeed={settings?.fill_speed_per_hour ?? 0}
          onClose={() => setPanelSlot(null)}
          onSaved={() => { setPanelSlot(null); reload(); }}
        />
      )}

      {showGenerate && (
        <GenerateWeekModal
          weekDates={weekDates}
          onClose={() => setShowGenerate(false)}
          onGenerated={reload}
        />
      )}

      {showAddExtra && (
        <AddExtraSlotModal
          date={selectedDate}
          onClose={() => setShowAddExtra(false)}
          onAdded={reload}
        />
      )}
    </div>
  );
}

function SlotCard({ slot, currentTime, fillSpeed, onClick, onDelete }: {
  slot: DailyScheduleWithDealer;
  currentTime: string;
  fillSpeed: number;
  onClick: () => void;
  onDelete: () => void;
}) {
  const vr = slot.visit_record;
  const status = vr?.status ?? 'pending';
  const color = getDealerColor(slot.dealer_id);
  const changeLabel = getChangeLabel(slot.change_type, slot.original_date, slot.swapped_with_dealer?.name);
  const isPast = slot.scheduled_time < currentTime;
  const [confirmDelete, setConfirmDelete] = useState(false);

  const statusConfig = {
    pending: { icon: Clock, color: 'text-slate-400', bg: 'bg-slate-100', label: 'Pending' },
    arrived: { icon: Zap, color: 'text-amber-500', bg: 'bg-amber-50', label: 'Arrived' },
    completed: { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50', label: 'Completed' },
    no_show: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', label: 'No Show' },
  }[status] ?? { icon: Clock, color: 'text-slate-400', bg: 'bg-slate-100', label: 'Pending' };

  const StatusIcon = statusConfig.icon;

  return (
    <div className={`w-full bg-white rounded-xl border shadow-sm transition-all ${
      status === 'completed' ? 'border-emerald-200 opacity-80' :
      status === 'no_show' ? 'border-red-200 opacity-70' :
      isPast && status === 'pending' ? 'border-amber-200' :
      'border-slate-200'
    }`}>
      <button
        onClick={onClick}
        className="w-full text-left p-4 hover:bg-slate-50/50 rounded-xl active:scale-[0.99] transition-all"
      >
        {/* Change banner */}
        {changeLabel && (
          <div className={`flex items-center gap-1.5 text-xs font-medium mb-2 px-2 py-1 rounded-md ${
            slot.change_type === 'moved_in' ? 'bg-blue-50 text-blue-600' :
            slot.change_type === 'swapped' ? 'bg-orange-50 text-orange-600' :
            slot.change_type === 'extra' ? 'bg-emerald-50 text-emerald-600' :
            'bg-slate-50 text-slate-500'
          }`}>
            {slot.change_type === 'moved_in' && <ArrowRight size={13} />}
            {slot.change_type === 'swapped' && <ArrowRightLeft size={13} />}
            {changeLabel}
          </div>
        )}

        <div className="flex items-start gap-3">
          <div className={`w-1 self-stretch rounded-full ${color.bg} shrink-0`} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${color.light} ${color.text} mr-2`}>
                  {slot.dealer.code}
                </span>
                <span className="font-semibold text-slate-800 text-sm">{slot.dealer.name}</span>
              </div>
              <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${statusConfig.bg}`}>
                <StatusIcon size={13} className={statusConfig.color} />
                <span className={`text-xs font-medium ${statusConfig.color}`}>{statusConfig.label}</span>
              </div>
            </div>

            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1.5 text-slate-500">
                <Clock size={13} />
                <span className="text-sm font-semibold">{formatTime(slot.scheduled_time)}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                {slot.planned_19l > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                    19L: <b className="text-slate-700">{slot.planned_19l}</b>
                  </span>
                )}
                {slot.planned_10l > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    10L: <b className="text-slate-700">{slot.planned_10l}</b>
                  </span>
                )}
                {fillSpeed > 0 && (slot.planned_19l + slot.planned_10l) > 0 && (
                  <span className="text-slate-400 text-[10px] font-medium">
                    ~{formatFillDuration(slot.planned_19l + slot.planned_10l, fillSpeed)}
                  </span>
                )}
              </div>
            </div>

            {/* Actual counts if recorded */}
            {vr && (vr.bottles_19l_out > 0 || vr.bottles_10l_out > 0 || vr.bottles_home > 0) && (
              <div className="flex gap-3 mt-1.5 text-xs text-emerald-600 font-medium">
                <span>Filled:</span>
                {vr.bottles_19l_out > 0 && <span>19L: {vr.bottles_19l_out}</span>}
                {vr.bottles_10l_out > 0 && <span>10L: {vr.bottles_10l_out}</span>}
                {vr.bottles_home > 0 && (
                  <span className="text-emerald-500">Home: {vr.bottles_home}</span>
                )}
              </div>
            )}

            {/* Saved record indicator */}
            {vr && vr.updated_at && (
              <div className="flex items-center gap-1 mt-1.5 text-[10px] text-emerald-600 font-medium">
                <Check size={10} strokeWidth={3} />
                <span>Saved {new Date(vr.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
              </div>
            )}
          </div>
        </div>
      </button>

      {/* Delete button for extra slots */}
      {slot.change_type === 'extra' && (
        <div className="border-t border-slate-100 px-4 py-2 flex items-center justify-end gap-2">
          {confirmDelete ? (
            <>
              <span className="text-xs text-slate-500 mr-1">Remove this extra slot?</span>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-2.5 py-1 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Keep
              </button>
              <button
                onClick={onDelete}
                className="px-2.5 py-1 text-xs text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors font-semibold"
              >
                Remove
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-colors"
            >
              <Trash2 size={12} />
              Remove slot
            </button>
          )}
        </div>
      )}
    </div>
  );
}
