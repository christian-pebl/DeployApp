
'use client';

import React, { useState, useRef, useId, useEffect } from 'react';
import type { LatLng, LatLngExpression } from 'leaflet';
import dynamic from 'next/dynamic';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
    PopoverAnchor,
} from "@/components/ui/popover";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from "@/hooks/use-toast";
import { geocodeAddress } from '@/ai/flows/geocode-address';
import { Download, Loader2, LocateFixed, Trash2, Menu, Crosshair, MoreVertical, Pencil, MapPin, Spline, ChevronRight, ChevronLeft } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';


const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-muted flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>,
});

type MarkerData = {
  id: string;
  position: LatLngExpression;
  label: string;
};

type LineData = {
  id: string;
  positions: LatLngExpression[];
  label: string;
};

function SidebarContent({
  onGeocode,
  isGeocoding,
  markers,
  lines,
  onPanTo,
  onDeleteMarker,
  onDeleteLine,
  onExport,
  onAddMarker,
  onStartLine,
  isDrawingLine,
}: {
  onGeocode: (address: string) => void;
  isGeocoding: boolean;
  markers: MarkerData[];
  lines: LineData[];
  onPanTo: (position: LatLngExpression) => void;
  onDeleteMarker: (id: string) => void;
  onDeleteLine: (id: string) => void;
  onExport: () => void;
  onAddMarker: () => void;
  onStartLine: () => void;
  isDrawingLine: boolean;
}) {
  const addressInputRef = useRef<HTMLInputElement>(null);

  const handleGeocodeSubmit = (e: React.FormEvent<HTMLFormEvent>) => {
    e.preventDefault();
    const address = addressInputRef.current?.value;
    if (address) {
      onGeocode(address);
    }
  };

  return (
    <div className="flex flex-col h-full text-card-foreground">
        <div className="p-4 space-y-2">
            <div className="flex gap-2">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button onClick={onAddMarker} variant="outline" size="icon" className="h-12 w-12 rounded-full flex-shrink-0">
                                <MapPin className="h-6 w-6"/>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            <p>Add Marker</p>
                        </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                             <Button onClick={onStartLine} variant={isDrawingLine ? "destructive" : "outline"} size="icon" className="h-12 w-12 rounded-full flex-shrink-0">
                                <Spline className="h-6 w-6"/>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            <p>{isDrawingLine ? 'Cancel Drawing' : 'Draw Line'}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
            <Separator />
            <Card className="bg-transparent border-0 shadow-none">
            <CardHeader className="p-2">
              <CardTitle className="text-base">Find Location</CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <form onSubmit={handleGeocodeSubmit} className="space-y-2">
                <Input ref={addressInputRef} placeholder="e.g., Eiffel Tower" disabled={isGeocoding} />
                <Button type="submit" className="w-full" disabled={isGeocoding}>
                  {isGeocoding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LocateFixed className="mr-2 h-4 w-4" />}
                  Find
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="bg-transparent border-0 shadow-none">
            <CardHeader className="p-2">
              <CardTitle className="text-base">Your Items</CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              {markers.length === 0 && lines.length === 0 ? (
                <div className="text-center text-muted-foreground py-4 text-xs">
                  <p>Add an item to see it here.</p>
                </div>
              ) : (
                <ScrollArea className="h-40">
                  <div className="space-y-2">
                    {markers.map((marker, index) => (
                      <React.Fragment key={marker.id}>
                        <div className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors">
                          <button onClick={() => onPanTo(marker.position)} className="flex-1 text-left truncate pr-2">
                            <span className="font-medium text-sm"><MapPin className="inline-block mr-2 h-4 w-4"/>{marker.label}</span>
                          </button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => onDeleteMarker(marker.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        {index < markers.length - 1 && <Separator />}
                      </React.Fragment>
                    ))}
                     {lines.map((line, index) => (
                      <React.Fragment key={line.id}>
                        <div className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors">
                          <button onClick={() => onPanTo(line.positions[0])} className="flex-1 text-left truncate pr-2">
                            <span className="font-medium text-sm"><Spline className="inline-block mr-2 h-4 w-4"/>{line.label}</span>
                          </button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => onDeleteLine(line.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        {index < lines.length - 1 && <Separator />}
                      </React.Fragment>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      <div className="p-4 mt-auto border-t border-border/50">
        <Button onClick={onExport} className="w-full" variant="secondary">
          <Download className="mr-2 h-4 w-4" /> Export Items
        </Button>
      </div>
    </div>
  );
}


export default function MapExplorer() {
  const [markers, setMarkers] = useState<MarkerData[]>([]);
  const [lines, setLines] = useState<LineData[]>([]);
  const [view, setView] = useState<{ center: LatLngExpression; zoom: number }>({
    center: [48.8584, 2.2945], // Default to Paris
    zoom: 13,
  });
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isLocating, setIsLocating] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<LatLngExpression | null>(null);
  
  // Marker states
  const [pendingMarker, setPendingMarker] = useState<LatLngExpression | null>(null);
  const addMarkerInputRef = useRef<HTMLInputElement>(null);
  
  // Line states
  const [isDrawingLine, setIsDrawingLine] = useState(false);
  const [drawingLine, setDrawingLine] = useState<LineData | null>(null);
  const [pendingLine, setPendingLine] = useState<LineData | null>(null);
  const lineNameInputRef = useRef<HTMLInputElement>(null);
  
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const { toast } = useToast();
  const componentId = useId();
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setIsLocating(false);
      return;
    }
  
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newPosition: LatLngExpression = [latitude, longitude];
        setCurrentLocation(newPosition);
        if (isLocating) {
          setView(prev => ({ ...prev, center: newPosition, zoom: 13 }));
          setIsLocating(false);
        }
      },
      () => {
        // Error case, for now we just stop trying to locate.
        if (isLocating) {
            setIsLocating(false);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [isLocating]);

  const handleMapMove = (center: LatLng, zoom: number) => {
    const newCenter: LatLngExpression = [center.lat, center.lng];
    setView({ center: newCenter, zoom });

    if (isDrawingLine && drawingLine) {
        setDrawingLine(prev => {
            if (!prev) return null;
            return {
                ...prev,
                positions: [prev.positions[0], newCenter]
            }
        });
    }
  };

  const handleMapClick = (latlng: LatLng) => {
    // This is now disabled in favor of adding marker at center
  };
  
  // Marker Handlers
  const handleCenterMarker = () => {
    setPendingMarker(view.center);
    setIsSheetOpen(false);
  };
  
  const handleAddMarkerSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const label = addMarkerInputRef.current?.value;
    if (label && pendingMarker) {
      const newMarker: MarkerData = {
        id: `marker-${componentId}-${Date.now()}`,
        position: pendingMarker,
        label,
      };
      setMarkers((prev) => [...prev, newMarker]);
      setPendingMarker(null);
    }
  };

  // Line Handlers
  const handleStartLine = () => {
    if(isDrawingLine) { // Cancel drawing
      setIsDrawingLine(false);
      setDrawingLine(null);
      return;
    }
    
    setIsSheetOpen(false);
    setIsDrawingLine(true);
    const startPoint = view.center;
    const newLine: LineData = {
        id: `line-temp-${componentId}-${Date.now()}`,
        positions: [startPoint, startPoint],
        label: 'New Line'
    };
    setDrawingLine(newLine);
  };
  
  const handleConfirmLine = () => {
    if (drawingLine) {
        setPendingLine(drawingLine);
        setIsDrawingLine(false);
        setDrawingLine(null);
    }
  };

  const handleAddLineSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const label = lineNameInputRef.current?.value;
    if (label && pendingLine) {
        const newLine = {
            ...pendingLine,
            id: `line-${componentId}-${Date.now()}`,
            label: label,
        };
        setLines(prev => [...prev, newLine]);
        setPendingLine(null);
    }
  };


  const handleGeocode = async (address: string) => {
    setIsGeocoding(true);
    try {
      const result = await geocodeAddress({ address });
      if (result.latitude && result.longitude) {
        const position: LatLngExpression = [result.latitude, result.longitude];
        setView({ center: position, zoom: 17 });
        const newMarker: MarkerData = {
          id: `marker-${componentId}-${Date.now()}`,
          position,
          label: address,
        };
        setMarkers((prev) => [...prev, newMarker]);
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Geocoding Error",
        description: "Could not find the specified location. Please try a different address.",
      });
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleLocateMe = () => {
    if (currentLocation) {
        setView(prevView => ({ ...prevView, center: currentLocation, zoom: 15 }));
    } else {
        setIsLocating(true); 
    }
  };

  const handlePanTo = (position: LatLngExpression) => {
    setView(prevView => ({ ...prevView, center: position, zoom: 15 }));
  };
  
  const handleDeleteMarker = (id: string) => {
    setMarkers((prev) => prev.filter((m) => m.id !== id));
  };

  const handleDeleteLine = (id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
  };


  const handleExport = () => {
    const exportData = {
      markers,
      lines
    }
    if (exportData.markers.length === 0 && exportData.lines.length === 0) {
      toast({
        title: 'No items to export',
        description: 'Add some markers or lines to the map first.',
        variant: 'destructive'
      });
      return;
    }
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = 'map_items.json';
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const sidebarProps = {
    onGeocode: handleGeocode,
    isGeocoding,
    markers,
    lines,
    onPanTo: handlePanTo,
    onDeleteMarker: handleDeleteMarker,
    onDeleteLine: handleDeleteLine,
    onExport: handleExport,
    onAddMarker: handleCenterMarker,
    onStartLine: handleStartLine,
    isDrawingLine,
  };

  return (
    <div className="h-screen w-screen flex bg-background font-body">
      <div className="hidden md:block md:w-80 lg:w-96 border-r">
        <SidebarContent {...sidebarProps} />
      </div>
      <main className="flex-1 flex flex-col relative">
        <div className="md:hidden absolute top-4 left-4 z-[1001]">
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetTrigger asChild>
                    <Button variant="outline" size="icon" className="h-12 w-12 rounded-full shadow-lg">
                        <Menu className="h-6 w-6" />
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80">
                     <SidebarContent {...sidebarProps} />
                </SheetContent>
            </Sheet>
        </div>
        <div className="flex-1 relative">
            <Map
              center={view.center}
              zoom={view.zoom}
              markers={markers}
              lines={drawingLine ? [...lines, drawingLine] : lines}
              onMapClick={handleMapClick}
              onMapMove={handleMapMove}
              currentLocation={currentLocation}
            />
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000] pointer-events-none">
                <Crosshair className="h-8 w-8 text-primary opacity-80" />
            </div>
             <Popover open={!!pendingMarker} onOpenChange={(isOpen) => !isOpen && setPendingMarker(null)}>
                <PopoverAnchor asChild>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000] pointer-events-none">
                       {/* Anchor for popover */}
                    </div>
                </PopoverAnchor>
                <PopoverContent className="w-80">
                  <form onSubmit={handleAddMarkerSubmit}>
                      <div className="grid gap-4">
                        <div className="space-y-2">
                          <h4 className="font-medium leading-none">Add New Marker</h4>
                          <p className="text-sm text-muted-foreground">
                            Enter a label for the point at the center of the map.
                          </p>
                        </div>
                        <div className="grid gap-2">
                           <Input
                            ref={addMarkerInputRef}
                            id="marker-label"
                            defaultValue="marker 0"
                            required
                            autoFocus
                            onFocus={(e) => e.target.select()}
                          />
                        </div>
                         <Button type="submit">
                            <MapPin className="mr-2 h-4 w-4" /> Add Marker
                          </Button>
                      </div>
                    </form>
                </PopoverContent>
            </Popover>

            <Popover open={!!pendingLine} onOpenChange={(isOpen) => !isOpen && setPendingLine(null)}>
                <PopoverAnchor asChild>
                   <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000] pointer-events-none">
                     {/* Anchor for popover */}
                   </div>
                </PopoverAnchor>
                <PopoverContent className="w-80">
                   <form onSubmit={handleAddLineSubmit}>
                        <div className="grid gap-4">
                            <div className="space-y-2">
                                <h4 className="font-medium leading-none">Name Your Line</h4>
                                <p className="text-sm text-muted-foreground">
                                    Enter a label for the newly created line.
                                </p>
                            </div>
                            <div className="grid gap-2">
                                <Input
                                    ref={lineNameInputRef}
                                    id="line-label"
                                    defaultValue="My new line"
                                    required
                                    autoFocus
                                    onFocus={(e) => e.target.select()}
                                />
                            </div>
                            <Button type="submit">
                                <Spline className="mr-2 h-4 w-4" /> Save Line
                            </Button>
                        </div>
                    </form>
                </PopoverContent>
            </Popover>
           
            {isDrawingLine && (
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[1001]">
                    <Button onClick={handleConfirmLine} size="lg" className="shadow-lg">
                        Confirm Line
                    </Button>
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
                    disabled={isLocating}
                  >
                    {isLocating ? <Loader2 className="h-6 w-6 animate-spin" /> : <Crosshair className="h-6 w-6" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Locate Me</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
        </div>
      </main>
    </div>
  );
}
