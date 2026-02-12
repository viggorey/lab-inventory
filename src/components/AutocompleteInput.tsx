'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Item } from '@/types/inventory';

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  items: Item[];
  field: 'category' | 'location' | 'unit';
  className?: string;
}

const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
  value,
  onChange,
  placeholder,
  items,
  field
}) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mounted, setMounted] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Memoize unique values to avoid recomputing on every render
  const uniqueValues = useMemo(() =>
    [...new Set(items.map(item => item[field]))]
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => a.localeCompare(b)),
    [items, field]
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    onChange(inputValue);

    // Debounce the filtering
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const filtered = uniqueValues.filter((item: string) =>
        item && item.toLowerCase().includes(inputValue.toLowerCase())
      );
      setSuggestions(filtered);
      setShowSuggestions(true);
    }, 150);
  };

  const handleInputFocus = () => {
    setSuggestions(uniqueValues);
    setShowSuggestions(true);
  };

  const handleSuggestionClick = (suggestion: string) => {
    onChange(suggestion);
    setShowSuggestions(false);
  };

  const renderInput = () => (
    <input
      className="px-3 py-2 border rounded-lg w-full text-gray-700 placeholder-gray-500 font-normal focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-all"
      type="text"
      value={value}
      onChange={handleInputChange}
      onFocus={handleInputFocus}
      placeholder={placeholder}
      required={field !== 'unit'}
    />
  );

  if (!mounted) {
    return (
      <div className="relative">
        {renderInput()}
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      {renderInput()}
      {mounted && showSuggestions && suggestions.length > 0 && (
        <ul className="absolute z-10 w-full bg-white border rounded-b mt-1 shadow-lg max-h-48 overflow-y-scroll">
          {suggestions.map((suggestion, index) => (
            <li
              key={index}
              className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-gray-700"
              onClick={() => handleSuggestionClick(suggestion)}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AutocompleteInput;
