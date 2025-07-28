
'use client';

import React, { useState, useRef, useId, useEffect } from 'react';
import type { LatLng, LatLngExpression, Map as LeafletMap } from 'leaflet';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { useToast } from "@/hooks/use-toast";
import { geocodeAddress } from '@/ai/flows/geocode-address';
import { Loader2, Crosshair, MapPin, Check, Menu, ZoomIn, ZoomOut } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";


const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-muted flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>,
});

type Pin = { id: string; lat: number; lng: number; label: string };
type Line = { id: string; path: { lat: number; lng: number }[]; label: string };

export default function MapExplorer() {
  const [log, setLog] = useState<string[]>(['App Initialized']);
  const [pins, setPins] = useState<Pin[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [view, setView] = useState<{ center: LatLngExpression; zoom: number }>({
    center: [48.8584, 2.2945], // Default to Paris
    zoom: 13,
  });
  const [isLocating, setIsLocating] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<LatLng | null>(null);
  
  const { toast } = useToast();
  
  const initialLocationFound = useRef(false);
  const mapRef = useRef<LeafletMap | null>(null);

  const addLog = (entry: string) => {
    setLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${entry}`]);
  };
  
  useEffect(() => {
      addLog('Attempting to get user location.');
      setIsLocating(true);
  }, []);

  const handleLocationFound = (latlng: LatLng) => {
    setCurrentLocation(latlng);
    if (!initialLocationFound.current) {
      addLog(`Initial location found: ${latlng.lat}, ${latlng.lng}`);
      setView({ center: latlng, zoom: 15 });
      setIsLocating(false);
      initialLocationFound.current = true;
    }
  };

  const handleLocationError = (error: any) => {
    let errorMsg = `Geolocation error: ${error.message}`;
    if (error.code === 1) { // PERMISSION_DENIED
      errorMsg = "Location access denied. Please enable it in your browser settings.";
    }
    addLog(`Error: ${errorMsg}`);
    if (isLocating) setIsLocating(false);
    toast({ variant: "destructive", title: "Geolocation Error", description: errorMsg });
  };

  const handleLocateMe = () => {
    addLog('Locate me button clicked.');
    if (currentLocation) {
        addLog('Centering view on current location.');
        mapRef.current?.setView(currentLocation, 15, { animate: true });
    } else if (mapRef.current) {
        addLog('Current location not available, re-attempting location.');
        setIsLocating(true);
        mapRef.current.locate({ setView: true, maxZoom: 15 });
    }
  };
  
  const handleShowLog = () => {
    const logContent = log.join('\n');
    toast({
        title: "Event Log",
        description: <pre className="text-xs whitespace-pre-wrap max-h-60 overflow-y-auto">{logContent}</pre>,
        duration: 10000,
    });
  }

  const handleZoomIn = () => {
    mapRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapRef.current?.zoomOut();
  };

  return (
    <div className="h-screen w-screen flex bg-background font-body relative overflow-hidden">
       
      <main className="flex-1 flex flex-col relative h-full">
        <div className="flex-1 relative">
            <Map
              mapRef={mapRef}
              center={view.center}
              zoom={view.zoom}
              pins={pins}
              setPins={setPins}
              lines={lines}
              setLines={setLines}
              currentLocation={currentLocation}
              onLocationFound={handleLocationFound}
              onLocationError={handleLocationError}
            />
            
            <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="default" 
                      size="icon" 
                      className="h-12 w-12 rounded-full shadow-lg"
                      onClick={handleLocateMe}
                      disabled={isLocating && !currentLocation}
                    >
                      {isLocating && !currentLocation ? <Loader2 className="h-6 w-6 animate-spin" /> : <Crosshair className="h-6 w-6" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Center on Me</p>
                  </TooltipContent>
                </Tooltip>

                <div className="flex flex-col gap-1 bg-background rounded-full shadow-lg border">
                   <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" onClick={handleZoomIn}>
                            <ZoomIn className="h-5 w-5" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left"><p>Zoom In</p></TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" onClick={handleZoomOut}>
                          <ZoomOut className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left"><p>Zoom Out</p></TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            </div>

            <div className="absolute bottom-4 right-4 z-[1000] flex flex-col gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                      <Button
                          variant="outline"
                          size="icon"
                          onClick={handleShowLog}
                          className="h-12 w-12 rounded-full shadow-lg bg-card"
                      >
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>
                      </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                      <p>Show Event Log</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
        </div>
      </main>

    </div>
  );
}

    