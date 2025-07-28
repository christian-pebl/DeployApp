
'use client';

import React, { useState, useRef, useId, useEffect } from 'react';
import type { LatLng, LatLngExpression } from 'leaflet';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { useToast } from "@/hooks/use-toast";
import { geocodeAddress } from '@/ai/flows/geocode-address';
import { Loader2, Crosshair, MapPin, Code } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-muted flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>,
});

type Pin = { id: string; lat: number; lng: number; label: string };
type Line = { id: string; path: { lat: number; lng: number }[]; label: string };
type InteractionMode = 'none' | 'add_pin' | 'draw_line';

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
  
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('none');
  const [linePoints, setLinePoints] = useState<LatLng[]>([]);
  
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [newItem, setNewItem] = useState<{ type: 'pin' | 'line'; data: any } | null>(null);
  const [newItemLabel, setNewItemLabel] = useState('');
  
  const { toast } = useToast();
  const componentId = useId();
  const watchIdRef = useRef<number | null>(null);
  
  const [pendingPin, setPendingPin] = useState<LatLng | null>(null);

  const addLog = (entry: string) => {
    setLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${entry}`]);
  };

  useEffect(() => {
    addLog('Attempting to get user location.');
    if (typeof window === 'undefined' || !navigator.geolocation) {
        setIsLocating(false);
        const errorMsg = "Geolocation not supported by your browser.";
        addLog(`Error: ${errorMsg}`);
        toast({ variant: "destructive", title: "Geolocation Error", description: errorMsg });
        return;
    }

    let initialLocationFound = false;
    const handleSuccess = (position: GeolocationPosition) => {
        const { latitude, longitude } = position.coords;
        const newPosition: LatLng = L.latLng(latitude, longitude);
        setCurrentLocation(newPosition);
        // Do not log every location update to prevent clutter
        if (!initialLocationFound) {
            addLog(`Initial location found: ${latitude}, ${longitude}`);
            addLog('Centering map on initial location.');
            setView({ center: newPosition, zoom: 15 });
            setIsLocating(false);
            initialLocationFound = true;
        }
    };
    const handleError = (error: GeolocationPositionError) => {
        const errorMsg = error.code === error.PERMISSION_DENIED ? "Location access denied." : `Geolocation error (code ${error.code}): ${error.message}`;
        addLog(`Error: ${errorMsg}`);
        if (isLocating) setIsLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
            toast({ variant: "destructive", title: "Geolocation Error", description: "Location access denied. Please enable it in your browser settings." });
        }
    };
    
    addLog('Setting up geolocation watcher.');
    watchIdRef.current = navigator.geolocation.watchPosition(handleSuccess, handleError, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });

    return () => {
        if (watchIdRef.current !== null) {
            addLog('Cleaning up geolocation watcher.');
            navigator.geolocation.clearWatch(watchIdRef.current);
        }
    };
  }, [toast]);


  const handleMapClick = (latlng: LatLng) => {
    addLog(`Map clicked at: ${latlng.lat}, ${latlng.lng}`);

    if (interactionMode === 'add_pin') {
        addLog('Creating new pin.');
        setPendingPin(latlng);
        setInteractionMode('none'); // Exit add_pin mode after first click
    }

    if (interactionMode === 'draw_line') {
        if (linePoints.length === 0) {
            addLog('Starting a new line.');
            setLinePoints([latlng]);
            toast({ title: "Line Started", description: "Click another point on the map to finish the line." });
        } else {
            addLog('Finishing line.');
            const finalPoints = [...linePoints, latlng];
            setNewItem({ type: 'line', data: finalPoints });
            setIsSheetOpen(true);
            setInteractionMode('none');
            setLinePoints([]);
        }
    }
  };

  const handleLocateMe = () => {
    addLog('Locate me button clicked.');
    if (currentLocation) {
        addLog('Centering view on current location.');
        setView({ center: currentLocation, zoom: 15 });
    } else {
        addLog('Current location not available, attempting to locate.');
        setIsLocating(true); 
    }
  };

  const handlePinSave = (label: string) => {
    if (!pendingPin) return;
    const newPin: Pin = {
      id: `pin-${componentId}-${Date.now()}`,
      lat: pendingPin.lat,
      lng: pendingPin.lng,
      label: label
    };
    setPins(prev => [...prev, newPin]);
    addLog(`Saved pin: "${label}"`);
    setPendingPin(null);
  };

  const handlePinCancel = () => {
    setPendingPin(null);
    addLog('Pin creation cancelled.');
  };
  
  const handleSaveNewItem = () => {
    if (!newItem || !newItemLabel.trim()) {
      toast({ variant: "destructive", title: "Validation Error", description: "Please provide a label." });
      return;
    }
    
    // This part is now only for lines, as pins are handled via popup
    if (newItem.type === 'line') {
      const newLine: Line = {
        id: `line-${componentId}-${Date.now()}`,
        path: newItem.data.map((p: LatLng) => ({ lat: p.lat, lng: p.lng })),
        label: newItemLabel,
      };
      setLines(prev => [...prev, newLine]);
      addLog(`Saved line: "${newItemLabel}"`);
    }
    
    setIsSheetOpen(false);
    setNewItem(null);
    setNewItemLabel('');
  };

  const handleShowLog = () => {
    const logContent = log.join('\n');
    toast({
        title: "Event Log",
        description: <pre className="text-xs whitespace-pre-wrap max-h-60 overflow-y-auto">{logContent}</pre>,
        duration: 10000,
    });
  }

  const getInteractionCursor = () => {
    switch (interactionMode) {
      case 'add_pin':
      case 'draw_line':
        return 'crosshair';
      default:
        return 'grab';
    }
  };
  
  const sheetTitle = 'Add a new Line';
  const sheetDescription = "You've drawn a line on the map. Give it a label to save it.";

  return (
    <div className="h-screen w-screen flex bg-background font-body relative overflow-hidden">
       <div className="absolute top-4 left-4 z-30 flex flex-col gap-2">
            <TooltipProvider>
                <div className="flex flex-col gap-2 p-2 bg-card rounded-full shadow-lg border">
                   <Tooltip>
                        <TooltipTrigger asChild>
                            <Button 
                                variant={interactionMode === 'add_pin' ? 'default' : 'ghost'} 
                                size="icon" 
                                className="h-10 w-10 rounded-full"
                                onClick={() => {
                                  setInteractionMode(p => p === 'add_pin' ? 'none' : 'add_pin');
                                  if (interactionMode !== 'add_pin') {
                                    toast({ title: 'Add a Pin', description: 'Click anywhere on the map to place a pin.' });
                                  }
                                }}
                            >
                                <MapPin className="h-5 w-5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right"><p>Add a Pin</p></TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                             <Button 
                                variant={interactionMode === 'draw_line' ? 'default' : 'ghost'} 
                                size="icon" 
                                className="h-10 w-10 rounded-full"
                                onClick={() => {
                                    setInteractionMode(p => p === 'draw_line' ? 'none' : 'draw_line');
                                    if (interactionMode !== 'draw_line') {
                                      toast({ title: 'Draw a Line', description: 'Click a start and end point on the map.' });
                                    }
                                }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 12h16"/>
                                    <circle cx="4" cy="12" r="2" fill="currentColor"/>
                                    <circle cx="20" cy="12" r="2" fill="currentColor"/>
                                </svg>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right"><p>Draw a Line</p></TooltipContent>
                    </Tooltip>
                </div>
            </TooltipProvider>
        </div>


      <main className="flex-1 flex flex-col relative h-full">
        <div className="flex-1 relative" style={{ cursor: getInteractionCursor() }}>
            <Map
              center={view.center}
              zoom={view.zoom}
              pins={pins}
              lines={lines}
              onMapClick={handleMapClick}
              currentLocation={currentLocation}
              pendingPin={pendingPin}
              onPinSave={handlePinSave}
              onPinCancel={handlePinCancel}
            />
             {interactionMode === 'none' && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000] pointer-events-none">
                    <Crosshair className="h-8 w-8 text-primary opacity-80" />
                </div>
             )}
           
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="default" 
                    size="icon" 
                    className="absolute top-4 right-4 h-12 w-12 rounded-full shadow-lg z-[1000]"
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
            </TooltipProvider>
            
            <div className="absolute bottom-[calc(3rem+1rem+0.5rem)] right-4 z-[1000] flex flex-col gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                      <Button
                          variant="outline"
                          size="icon"
                          onClick={handleShowLog}
                          className="h-12 w-12 rounded-full shadow-lg bg-card"
                      >
                          <Code className="h-6 w-6" />
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

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent>
            <SheetHeader>
                <SheetTitle>{sheetTitle}</SheetTitle>
                <SheetDescription>{sheetDescription}</SheetDescription>
            </SheetHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="item-label" className="text-right">Label</Label>
                    <Input 
                        id="item-label"
                        value={newItemLabel}
                        onChange={(e) => setNewItemLabel(e.target.value)}
                        className="col-span-3"
                        placeholder="e.g. Start of trail"
                    />
                </div>
            </div>
            <SheetFooter>
                <Button type="submit" onClick={handleSaveNewItem}>Save</Button>
            </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

    