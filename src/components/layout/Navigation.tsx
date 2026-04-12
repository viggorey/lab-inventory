'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Box, FileText, BookOpen, ExternalLink, LogOut, ChevronDown, Menu, X } from 'lucide-react';

interface NavigationProps {
  isAdmin: boolean;
  onLogout: () => void;
}

interface NavLink {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const otherNavLinks: NavLink[] = [
  { href: '/manuals', label: 'Manuals', icon: <FileText className="w-4 h-4" /> },
  { href: '/publications', label: 'Publications', icon: <BookOpen className="w-4 h-4" /> },
  { href: '/other', label: 'Other', icon: <ExternalLink className="w-4 h-4" /> },
];

export default function Navigation({ isAdmin, onLogout }: NavigationProps) {
  const pathname = usePathname();
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isInventoryActive = pathname.startsWith('/inventory');

  // Close inventory dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setInventoryOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false);
    setInventoryOpen(false);
  }, [pathname]);

  return (
    <div className="bg-white rounded-xl shadow-lg p-4 mb-6">
      <div className="flex justify-between items-center">
        {/* Logo/Title */}
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Box className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Lab System
          </h1>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {/* Inventory Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setInventoryOpen(!inventoryOpen)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                isInventoryActive
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Box className="w-4 h-4" />
              Inventory
              <ChevronDown className={`w-3 h-3 transition-transform ${inventoryOpen ? 'rotate-180' : ''}`} />
            </button>

            {inventoryOpen && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50">
                <Link
                  href="/inventory"
                  onClick={() => setInventoryOpen(false)}
                  className={`flex items-center px-4 py-2 text-sm transition-colors ${
                    pathname === '/inventory'
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Lab Inventory
                </Link>
                <Link
                  href="/inventory/brunei"
                  onClick={() => setInventoryOpen(false)}
                  className={`flex items-center px-4 py-2 text-sm transition-colors ${
                    pathname === '/inventory/brunei'
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Brunei Inventory
                </Link>
              </div>
            )}
          </div>

          {otherNavLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-100 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                {link.icon}
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Desktop Right Side */}
        <div className="hidden md:flex items-center gap-4">
          {isAdmin && (
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
              Admin
            </span>
          )}
          <button
            onClick={onLogout}
            className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>

        {/* Mobile: Admin badge + Hamburger */}
        <div className="flex md:hidden items-center gap-2">
          {isAdmin && (
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
              Admin
            </span>
          )}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Panel */}
      {menuOpen && (
        <div className="md:hidden mt-4 pt-4 border-t border-gray-100 flex flex-col gap-1">
          <Link
            href="/inventory"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              pathname === '/inventory'
                ? 'bg-blue-100 text-blue-700 font-medium'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Box className="w-4 h-4" />
            Lab Inventory
          </Link>
          <Link
            href="/inventory/brunei"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              pathname === '/inventory/brunei'
                ? 'bg-blue-100 text-blue-700 font-medium'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Box className="w-4 h-4" />
            Brunei Inventory
          </Link>
          {otherNavLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                pathname === link.href
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {link.icon}
              {link.label}
            </Link>
          ))}
          <button
            onClick={onLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-colors mt-1"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
