
'use client';

import React, { useState, useRef, useId, useEffect } from 'react';
import type { LatLng, LatLngExpression, Map as LeafletMap } from 'leaflet';
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sidebar, SidebarProvider, SidebarTrigger, SidebarContent, SidebarHeader } from '@/components/ui/sidebar';


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

    if (interactionMode === 'add_pin') {
        // This case is handled by handleAddPin now to drop at center
    }

    if (interactionMode === 'draw_line') {
        const updatedLinePoints = [...linePoints, latlng];
        setLinePoints(updatedLinePoints);

        if (updatedLinePoints.length === 1) {
            addLog('Line started. Click another point to finish.');
            toast({ title: "Line Started", description: "Click another point on the map to finish the line." });
        } else if (updatedLinePoints.length >= 2) {
            addLog('Line endpoint selected. Opening details pane.');
            setIsSheetOpen(true);
            setInteractionMode('none');
        }
    }
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

  const handleLocateMe = () => {
    addLog('Locate me button clicked.');
    if (currentLocation) {
        addLog('Centering view on current location.');
        setView({ center: currentLocation, zoom: 15 });
    } else {
        addLog('Current location not available, re-attempting location.');
        setIsLocating(true); 
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

  const panToItem = (item: Pin | Line) => {
    let target: LatLngExpression;
    if ('lat' in item) { // It's a Pin
        target = [item.lat, item.lng];
    } else { // It's a Line
        if (item.path.length > 0) {
            target = [item.path[0].lat, item.path[0].lng];
        } else {
            return;
        }
    }
    setView(prev => ({ ...prev, center: target, zoom: Math.max(prev.zoom, 16) }));
  }

  return (
    <SidebarProvider>
    <div className="h-screen w-screen flex bg-background font-body relative overflow-hidden">
       <Sidebar>
            <SidebarHeader>
                 <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Map Objects</h2>
                    <SidebarTrigger />
                 </div>
            </SidebarHeader>
            <SidebarContent className="flex flex-col gap-4 p-4">
                 <div className="flex flex-col gap-2 p-2 bg-card rounded-lg shadow-inner border">
                   <TooltipProvider>
                       <Tooltip>
                            <TooltipTrigger asChild>
                                <Button 
                                    variant={interactionMode === 'add_pin' ? 'secondary' : 'ghost'} 
                                    onClick={handleAddPin}
                                    className="w-full justify-start"
                                >
                                    <MapPin className="mr-2 h-5 w-5" />
                                    Add a Pin
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="right"><p>Drop a pin at the map center</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                 <Button 
                                    variant={interactionMode === 'draw_line' ? 'secondary' : 'ghost'}
                                    onClick={() => {
                                        setInteractionMode(prev => {
                                            const newMode = prev === 'draw_line' ? 'none' : 'draw_line';
                                            if (newMode === 'draw_line') {
                                                toast({ title: 'Draw a Line', description: 'Click a start and end point on the map.' });
                                                addLog('Entered "Draw Line" mode.');
                                            } else {
                                                addLog('Exited "Draw Line" mode.');
                                                setLinePoints([]); // Clear points if exiting mode
                                            }
                                            return newMode;
                                        });
                                    }}
                                    className="w-full justify-start"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-5 w-5">
                                        <path d="M4 12h16"/>
                                        <circle cx="4" cy="12" r="2" fill="currentColor"/>
                                        <circle cx="20" cy="12" r="2" fill="currentColor"/>
                                    </svg>
                                    Draw a Line
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="right"><p>Draw a line between two points</p></TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>

                <Accordion type="multiple" collapsible className="w-full" defaultValue={['pins', 'lines']}>
                    <AccordionItem value="pins">
                        <AccordionTrigger className="text-base font-medium">Pins ({pins.length})</AccordionTrigger>
                        <AccordionContent>
                            {pins.length > 0 ? (
                                <ul className="space-y-2 pt-2">
                                    {pins.map(pin => (
                                        <li key={pin.id}>
                                            <Button variant="ghost" className="w-full justify-start h-auto py-2" onClick={() => panToItem(pin)}>
                                                <MapPin className="mr-2 h-4 w-4 text-accent" />
                                                <span className="truncate">{pin.label}</span>
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-muted-foreground p-2">No pins added yet.</p>
                            )}
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="lines">
                        <AccordionTrigger className="text-base font-medium">Lines ({lines.length})</AccordionTrigger>
                        <AccordionContent>
                             {lines.length > 0 ? (
                                <ul className="space-y-2 pt-2">
                                    {lines.map(line => (
                                        <li key={line.id}>
                                            <Button variant="ghost" className="w-full justify-start h-auto py-2" onClick={() => panToItem(line)}>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 text-primary">
                                                    <path d="M4 12h16"/><circle cx="4" cy="12" r="2" fill="currentColor"/><circle cx="20" cy="12" r="2" fill="currentColor"/>
                                                </svg>
                                                <span className="truncate">{line.label}</span>
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-muted-foreground p-2">No lines added yet.</p>
                            )}
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </SidebarContent>
       </Sidebar>

      <main className="flex-1 flex flex-col relative h-full">
         <div className="absolute top-4 left-4 z-30 md:hidden">
            <SidebarTrigger />
         </div>

        <div className="flex-1 relative" style={{ cursor: getInteractionCursor() }}>
            <Map
              mapRef={mapRef}
              center={view.center}
              zoom={view.zoom}
              pins={pins}
              lines={lines}
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
    </SidebarProvider>
  );
}

    