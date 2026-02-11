'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Box, FileText, BookOpen, LogOut } from 'lucide-react';

interface NavigationProps {
  isAdmin: boolean;
  onLogout: () => void;
}

interface NavLink {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const navLinks: NavLink[] = [
  { href: '/inventory', label: 'Inventory', icon: <Box className="w-4 h-4" /> },
  { href: '/manuals', label: 'Manuals', icon: <FileText className="w-4 h-4" /> },
  { href: '/publications', label: 'Publications', icon: <BookOpen className="w-4 h-4" /> },
];

export default function Navigation({ isAdmin, onLogout }: NavigationProps) {
  const pathname = usePathname();

  return (
    <div className="bg-white rounded-xl shadow-lg p-4 mb-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-6">
          {/* Logo/Title */}
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Box className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Lab System
            </h1>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1">
            {navLinks.map((link) => {
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
        </div>

        {/* Right side: Admin badge + Logout */}
        <div className="flex items-center gap-4">
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
      </div>
    </div>
  );
}
