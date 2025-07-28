
'use client';

import React, { useState, useRef, useId, useEffect } from 'react';
import type { LatLng, LatLngExpression, Map as LeafletMap } from 'leaflet';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { useToast } from "@/hooks/use-toast";
import { geocodeAddress } from '@/ai/flows/geocode-address';
import { Loader2, Crosshair, MapPin, Check, Menu } from 'lucide-react';
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
type InteractionMode = 'none' | 'add_pin' | 'draw_line_start' | 'draw_line_end';

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
  const [liveLine, setLiveLine] = useState<LatLng[] | null>(null);
  
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [newItemLabel, setNewItemLabel] = useState('');
  
  const { toast } = useToast();
  const componentId = useId();
  
  const [pendingPin, setPendingPin] = useState<LatLng | null>(null);
  const initialLocationFound = useRef(false);
  const mapRef = useRef<LeafletMap | null>(null);

  const addLog = (entry: string) => {
    setLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${entry}`]);
  };
  
  useEffect(() => {
      addLog('Attempting to get user location.');
      setIsLocating(true);
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || interactionMode !== 'draw_line_start') {
        setLiveLine(null);
        return;
    }

    const handleMove = () => {
        if (linePoints.length > 0) {
            setLiveLine([linePoints[0], map.getCenter()]);
        }
    };
    
    map.on('move', handleMove);

    return () => {
        map.off('move', handleMove);
    };
}, [interactionMode, linePoints]);


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


  const handleMapClick = (latlng: LatLng) => {
    addLog(`Map clicked at: ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`);
  };
  
  const handleAddPin = () => {
    if (mapRef.current) {
        const center = mapRef.current.getCenter();
        addLog(`Adding pin at map center: ${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`);
        setPendingPin(center);
        setInteractionMode('none');
    } else {
        addLog('Error: Map not initialized.');
        toast({ variant: "destructive", title: "Error", description: "Map is not ready yet." });
    }
  };
  
  const handleStartLine = () => {
    if (mapRef.current) {
      const center = mapRef.current.getCenter();
      setLinePoints([center]);
      setInteractionMode('draw_line_start');
      addLog('Line started. Drag map to draw.');
      toast({ title: 'Line Started', description: 'Pan the map to draw the line. Click Confirm to set the end point.' });
    }
  };

  const handleConfirmLine = () => {
    if (mapRef.current && linePoints.length === 1) {
        const endPoint = mapRef.current.getCenter();
        setLinePoints(prev => [...prev, endPoint]);
        setInteractionMode('none');
        setIsSheetOpen(true);
        setLiveLine(null);
        addLog('Line endpoint confirmed. Opening details pane.');
    }
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

  const handlePinSave = (label: string) => {
    if (!pendingPin) return;
    if (!label.trim()) {
        toast({ variant: "destructive", title: "Validation Error", description: "Pin label cannot be empty." });
        return;
    }
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
  
  const handleSaveLine = () => {
    if (!newItemLabel.trim()) {
      toast({ variant: "destructive", title: "Validation Error", description: "Please provide a label for the line." });
      return;
    }
    
    const newLine: Line = {
        id: `line-${componentId}-${Date.now()}`,
        path: linePoints.map(p => ({ lat: p.lat, lng: p.lng })),
        label: newItemLabel,
    };
    setLines(prev => [...prev, newLine]);
    addLog(`Saved line: "${newItemLabel}"`);
    
    // Reset for next line
    setIsSheetOpen(false);
    setLinePoints([]);
    setNewItemLabel('');
  };

  const handleCloseSheet = () => {
      setIsSheetOpen(false);
      setLinePoints([]);
      setNewItemLabel('');
      addLog('Line creation cancelled.');
  }

  const handleShowLog = () => {
    const logContent = log.join('\n');
    toast({
        title: "Event Log",
        description: <pre className="text-xs whitespace-pre-wrap max-h-60 overflow-y-auto">{logContent}</pre>,
        duration: 10000,
    });
  }
  
  const sheetTitle = 'Add a new Line';
  const sheetDescription = "You've drawn a line on the map. Give it a label to save it.";

  return (
    <div className="h-screen w-screen flex bg-background font-body relative overflow-hidden">
       
      <main className="flex-1 flex flex-col relative h-full">
         <div className="absolute top-4 left-4 z-30 flex items-center gap-2 bg-background/80 p-2 rounded-lg shadow-lg backdrop-blur-sm border">
           <TooltipProvider>
               <Tooltip>
                    <TooltipTrigger asChild>
                        <Button 
                            variant={'ghost'} 
                            size="icon"
                            onClick={handleAddPin}
                            className="rounded-full h-10 w-10"
                        >
                            <MapPin className="h-5 w-5" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right"><p>Add a Pin</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                         <Button 
                            variant={interactionMode.startsWith('draw_line') ? 'secondary' : 'ghost'}
                            size="icon"
                            onClick={handleStartLine}
                            disabled={interactionMode.startsWith('draw_line')}
                            className="rounded-full h-10 w-10"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                                <path d="M4 12h16"/>
                                <circle cx="4" cy="12" r="2" fill="currentColor"/>
                                <circle cx="20" cy="12" r="2" fill="currentColor"/>
                            </svg>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right"><p>Draw a Line</p></TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>

        <div className="flex-1 relative" style={{ cursor: interactionMode === 'none' ? 'grab' : 'crosshair' }}>
            <Map
              mapRef={mapRef}
              center={view.center}
              zoom={view.zoom}
              pins={pins}
              lines={lines}
              liveLine={liveLine}
              onMapClick={handleMapClick}
              currentLocation={currentLocation}
              pendingPin={pendingPin}
              onPinSave={handlePinSave}
              onPinCancel={handlePinCancel}
              onLocationFound={handleLocationFound}
              onLocationError={handleLocationError}
            />
             {interactionMode === 'none' && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000] pointer-events-none">
                    <Crosshair className="h-8 w-8 text-primary opacity-80" />
                </div>
             )}
             
             {interactionMode === 'draw_line_start' && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full z-[1000] pointer-events-none text-center">
                    <div className="bg-background/80 backdrop-blur-sm rounded-md px-3 py-1 text-sm font-semibold shadow-lg border">
                        Pan map to draw line
                    </div>
                </div>
            )}
            
            {interactionMode === 'draw_line_start' && (
                 <Button 
                    className="absolute bottom-24 right-4 z-[1000] shadow-lg"
                    onClick={handleConfirmLine}
                 >
                     <Check className="mr-2 h-4 w-4" />
                     Confirm Line
                 </Button>
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

      <Sheet open={isSheetOpen} onOpenChange={handleCloseSheet}>
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
                        placeholder="e.g. Trail Route"
                    />
                </div>
            </div>
            <SheetFooter>
                <Button variant="outline" onClick={handleCloseSheet}>Cancel</Button>
                <Button type="submit" onClick={handleSaveLine}>Save Line</Button>
            </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
