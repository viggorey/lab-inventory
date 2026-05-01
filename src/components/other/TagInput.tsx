'use client';

import React, { useState, useRef } from 'react';

interface TagInputProps {
  values: string[];
  onChange: (values: string[]) => void;
  suggestions: string[];
  placeholder?: string;
}

export default function TagInput({ values, onChange, suggestions, placeholder }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredSuggestions = suggestions.filter(
    (s) => s.toLowerCase().includes(inputValue.toLowerCase()) && !values.includes(s)
  );

  function addTag(value: string) {
    const v = value.trim();
    if (!v || values.includes(v)) return;
    onChange([...values, v]);
    setInputValue('');
    setShowSuggestions(false);
  }

  function removeTag(index: number) {
    onChange(values.filter((_, i) => i !== index));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === 'Enter' || e.key === ',') && inputValue.trim()) {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  }

  return (
    <div className="relative">
      <div
        className="flex flex-wrap gap-1 min-h-[38px] border border-gray-300 rounded-lg px-2 py-1.5 cursor-text focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent bg-white"
        onClick={() => inputRef.current?.focus()}
      >
        {values.map((v, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm font-medium"
            style={{ background: '#e8f8f0', border: '1px solid #a9dfbf', color: '#1e8449' }}
          >
            {v}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeTag(i); }}
              className="hover:opacity-70 leading-none"
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setShowSuggestions(e.target.value.trim().length > 0);
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          onFocus={() => { if (inputValue.trim()) setShowSuggestions(true); }}
          placeholder={values.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] outline-none text-sm text-gray-900 bg-transparent"
        />
      </div>

      {showSuggestions && filteredSuggestions.length > 0 && (
        <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
          {filteredSuggestions.map((s) => (
            <li
              key={s}
              onMouseDown={(e) => { e.preventDefault(); addTag(s); }}
              className="px-3 py-2 text-sm text-gray-800 hover:bg-green-50 cursor-pointer"
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
