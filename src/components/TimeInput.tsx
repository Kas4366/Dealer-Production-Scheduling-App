import React, { useState } from 'react';
import { Keyboard, Clock } from 'lucide-react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export default function TimeInput({ value, onChange, className = '' }: Props) {
  const [manualMode, setManualMode] = useState(false);
  const [textValue, setTextValue] = useState(value);

  const baseClass = `border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 ${className}`;

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setTextValue(v);
    // Accept HH:MM format (with or without leading zero)
    if (/^\d{1,2}:\d{2}$/.test(v)) {
      const [h, m] = v.split(':').map(Number);
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        const normalized = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        onChange(normalized);
      }
    }
  };

  const switchToManual = () => {
    setTextValue(value);
    setManualMode(true);
  };

  const switchToClock = () => {
    setManualMode(false);
  };

  return (
    <div className="space-y-1">
      {manualMode ? (
        <input
          type="text"
          value={textValue}
          onChange={handleTextChange}
          placeholder="HH:MM"
          pattern="[0-9]{2}:[0-9]{2}"
          inputMode="numeric"
          className={baseClass}
        />
      ) : (
        <input
          type="time"
          value={value}
          onChange={e => onChange(e.target.value)}
          className={baseClass}
        />
      )}
      <button
        type="button"
        onClick={manualMode ? switchToClock : switchToManual}
        className="flex items-center gap-1 text-xs text-slate-400 hover:text-blue-500 transition-colors"
      >
        {manualMode ? (
          <><Clock size={11} /> Use clock picker</>
        ) : (
          <><Keyboard size={11} /> Type manually</>
        )}
      </button>
    </div>
  );
}
