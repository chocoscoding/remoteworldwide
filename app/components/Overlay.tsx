// components/common/Overlay.tsx
"use client";

import { X } from "lucide-react";
import { FC, ReactNode } from "react";

interface OverlayProps {
  children: ReactNode;
  isVisible: boolean;
  onClose: () => void;
}

const Overlay: FC<OverlayProps> = ({ children, isVisible, onClose }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="relative bg-white p-4 rounded shadow-lg">
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-600 hover:text-gray-800">
          <X />
        </button>
        {children}
      </div>
    </div>
  );
};

export default Overlay;
