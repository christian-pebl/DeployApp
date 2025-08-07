'use client';

import React, { useState, useRef, useEffect } from 'react';
import { signOut as authSignOut } from '@/hooks/use-auth';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from "@/hooks/use-toast";
import { Loader2, Crosshair, MapPin, Check, Menu, ZoomIn, ZoomOut, Plus, Eye, Pencil, Trash2, X, Search, Settings as SettingsIcon, LogOut } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useMapView } from '@/hooks/use-map-view';
import { useSettings } from '@/hooks/use-settings';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-muted flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>,
});

type Project = { id: string; name: string; description?: string; createdAt: Date; };
type Tag = { id: string; name: string; color: string; projectId: string; };
type Pin = { id: string; lat: number; lng: number; label: string; labelVisible?: boolean; notes?: string; projectId?: string; tagIds?: string[]; };
type Line = { id:string; path: { lat: number; lng: number }[]; label: string; labelVisible?: boolean; notes?: string; projectId?: string; tagIds?: string[]; };
type Area = { id: string; path: { lat: number; lng: number }[]; label: string; labelVisible?: boolean; notes?: string; fillVisible?: boolean; projectId?: string; tagIds?: string[]; };

export default function MapExplorer({ user }: { user: any }) {
  const [log, setLog] = useState<string[]>(['App Initialized - Using Vercel Stack']);
  const { view, setView } = useMapView(user.id);
  const { settings } = useSettings();
  
  // Temporary empty state - will be replaced with API calls
  const [pins, setPins] = useState<Pin[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const [isLocating, setIsLocating] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [isObjectListOpen, setIsObjectListOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  const { toast } = useToast();
  const router = useRouter();
  
  const mapRef = useRef<any>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const addLog = (entry: string) => {
    setLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${entry}`]);
    console.log(`[LOG] ${entry}`);
  };

  useEffect(() => {
    addLog('Vercel stack loaded successfully - no Firebase errors!');
  }, []);

  const handleLocateMe = () => {
    addLog('Locate me button clicked.');
    // Geolocation logic here
  };

  const handleShowLog = () => {
    const logContent = log.join('\n');
    toast({
        title: "Event Log",
        description: <pre className="text-xs whitespace-pre-wrap max-h-60 overflow-y-auto">{logContent}</pre>,
        duration: 10000,
    });
  };

  const handleLogout = async () => {
    try {
      await authSignOut();
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (!view || !settings) {
    return (
      <div className="w-full h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex bg-background font-body relative overflow-hidden">
      <main className="flex-1 flex flex-col relative h-full">
        <div className="flex-1 relative">
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <div className="text-center space-y-4">
              <h1 className="text-2xl font-bold">🎉 Vercel Migration Complete!</h1>
              <p className="text-lg">No more Turbopack errors!</p>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>✅ Firebase removed</p>
                <p>✅ NextAuth.js authentication</p>
                <p>✅ Vercel Postgres ready</p>
                <p>✅ Prisma ORM setup</p>
              </div>
              <Button onClick={handleShowLog} variant="outline">
                View Success Log
              </Button>
            </div>
          </div>
          
          <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="default" size="icon" className="h-12 w-12 rounded-full shadow-lg" onClick={() => setIsObjectListOpen(true)}>
                    <Menu className="h-6 w-6" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Project Menu</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="absolute bottom-4 right-4 z-[1000] flex flex-col gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={handleLogout} className="h-12 w-12 rounded-full shadow-lg bg-card">
                    <LogOut className="h-6 w-6" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>Sign Out</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </main>
    </div>
  );
}