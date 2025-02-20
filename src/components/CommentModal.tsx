// components/CommentModal.tsx
import React from 'react';
import { X } from 'lucide-react';

interface CommentModalProps {
  comment: string;
  onChange: (comment: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  title?: string;
}

const CommentModal: React.FC<CommentModalProps> = ({ 
  comment, 
  onChange, 
  onClose,
  onSubmit,
  title = "Add Comment" 
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg m-4">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <textarea
            value={comment}
            onChange={(e) => onChange(e.target.value)}
            className="w-full h-40 px-3 py-2 border rounded-lg resize-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
            placeholder="Enter your comment here..."
          />
          <div className="flex justify-end mt-4 gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onSubmit}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Submit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommentModal;