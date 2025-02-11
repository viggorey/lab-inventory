'use client';

import React, { useState, useEffect, useRef } from 'react';
import _ from 'lodash';
import { Item } from '@/types/inventory';



interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  items: Item[];
  field: 'category' | 'location';
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

  useEffect(() => {
    setMounted(true);
  }, []);

  // Get unique values for the specified field
  const uniqueValues = _.uniq(items.map(item => item[field])).filter((value): value is string => Boolean(value));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const inputValue = e.target.value;
      onChange(inputValue);
      
      // Safely handle null or undefined values
      const filtered = uniqueValues.filter((item: string) => {
        if (!item) return false;
        return item.toLowerCase().includes(inputValue.toLowerCase());
      });
      
      setSuggestions(filtered);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Error in autocomplete:', error);
      setSuggestions([]);
      setShowSuggestions(false);
      // Add more specific error handling
      if (error instanceof TypeError) {
        console.error('Type error in autocomplete:', error.message);
      } else {
        console.error('Unexpected error in autocomplete:', error);
      }
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    onChange(suggestion);
    setShowSuggestions(false);
  };

  const renderInput = () => (
    <input
      className="px-3 py-2 border rounded w-full text-gray-700 placeholder-gray-500 font-normal"
      type="text"
      value={value}
      onChange={handleInputChange}
      placeholder={placeholder}
      required
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
        <ul className="absolute z-10 w-full bg-white border rounded-b mt-1 max-h-48 overflow-y-auto shadow-lg">
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