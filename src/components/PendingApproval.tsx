'use client';

import { Box, Clock, LogOut, Mail, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function PendingApprovalPage() {
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-lg p-8">
          {/* Header */}
          <div className="flex items-center gap-3 justify-center mb-8">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Box className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Lab Inventory System
            </h1>
          </div>

          {/* Status Icon */}
          <div className="flex justify-center mb-6">
            <div className="bg-yellow-100 p-4 rounded-full">
              <Clock className="w-12 h-12 text-yellow-600" />
            </div>
          </div>

          {/* Main Content */}
          <div className="text-center space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Awaiting Administrator Approval
              </h2>
              <p className="text-gray-600">
                Your account has been created and email verified. Please wait while an administrator reviews your account.
              </p>
            </div>

            {/* Information Cards */}
            <div className="space-y-4">
              
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-amber-700 text-sm text-left">
                  If you need immediate access or have questions, please contact your laboratory administrator.
                </p>
              </div>
            </div>

            {/* Sign Out Button */}
            <div>
              <button
                onClick={handleSignOut}
                className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}