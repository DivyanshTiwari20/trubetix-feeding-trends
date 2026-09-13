'use client';

import { PanelLeft, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AppHeaderProps {
  sidebarOpen: boolean;
  onOpenSidebar: () => void;
}

export function AppHeader({ sidebarOpen, onOpenSidebar }: AppHeaderProps) {
  return (
    <header className="flex h-[56px] shrink-0 items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-3">
        {!sidebarOpen && (
          <Button
            variant="outline"
            size="icon-sm"
            onClick={onOpenSidebar}
            className="border-[#E9E5FF] bg-white hover:bg-[#F9F7FF]"
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="hidden border-[#EDE8FF] bg-white py-2 text-[13px] font-medium text-[#374151] shadow-sm hover:bg-[#F9F7FF] md:flex"
        >
          <Download className="h-4 w-4" /> Export chat
        </Button>
        <Button size="sm" className="bg-[#0B0B0F] py-2 text-[13px] font-medium text-white hover:bg-black">
          Upgrade
        </Button>
      </div>
    </header>
  );
}
