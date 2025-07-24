
'use client';

import React, { useState, useRef, useId, useEffect } from 'react';
import type { LatLng, LatLngExpression } from 'leaflet';
import dynamic from 'next/dynamic';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from "@/hooks/use-toast";
import { geocodeAddress } from '@/ai/flows/geocode-address';
import { Download, Loader2, LocateFixed, MapPin, Trash2, Menu, Crosshair, MoreVertical, Pencil } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

type MarkerData = {
  id: string;
  position: LatLngExpression;
  label: string;
};

function SidebarContent({
  onGeocode,
  isGeocoding,
  markers,
  onPanToMarker,
  onDeleteMarker,
  onExport,
  onAddMarker,
}: {
  onGeocode: (address: string) => void;
  isGeocoding: boolean;
  markers: MarkerData[];
  onPanToMarker: (position: LatLngExpression) => void;
  onDeleteMarker: (id: string) => void;
  onExport: () => void;
  onAddMarker: () => void;
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
            <Button onClick={onAddMarker} className="w-full">
                <Pencil className="mr-2 h-4 w-4" /> Add Marker at Center
            </Button>
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
              <CardTitle className="text-base">Your Markers</CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              {markers.length === 0 ? (
                <div className="text-center text-muted-foreground py-4 text-xs">
                  <p>Add a marker to see it here.</p>
                </div>
              ) : (
                <ScrollArea className="h-40">
                  <div className="space-y-2">
                    {markers.map((marker, index) => (
                      <React.Fragment key={marker.id}>
                        <div className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors">
                          <button onClick={() => onPanToMarker(marker.position)} className="flex-1 text-left truncate pr-2">
                            <span className="font-medium text-sm">{marker.label}</span>
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
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      <div className="p-4 mt-auto border-t border-border/50">
        <Button onClick={onExport} className="w-full" variant="secondary">
          <Download className="mr-2 h-4 w-4" /> Export Markers
        </Button>
      </div>
    </div>
  );
}


export default function MapExplorer() {
  const [markers, setMarkers] = useState<MarkerData[]>([]);
  const [view, setView] = useState<{ center: LatLngExpression; zoom: number }>({
    center: [48.8584, 2.2945], // Default to Paris
    zoom: 12, // Zoom level for approx 5km
  });
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isLocating, setIsLocating] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<LatLngExpression | null>(null);
  const [pendingMarker, setPendingMarker] = useState<LatLngExpression | null>(null);
  const addMarkerInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const componentId = useId();
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setIsLocating(false);
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newPosition: LatLngExpression = [latitude, longitude];
        setCurrentLocation(newPosition);
        if (isLocating) {
          setView({ center: newPosition, zoom: 12 });
          setIsLocating(false);
        }
      },
      () => {
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


  const handleMapClick = (latlng: LatLng) => {
    // This is now disabled in favor of adding marker at center
  };

  const handleCenterMarker = () => {
    setPendingMarker(view.center);
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
      console.error("Geocoding failed:", error);
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
        setView(prevView => ({ ...prevView, center: currentLocation }));
    } else {
        setIsLocating(true); 
    }
  };

  const handlePanToMarker = (position: LatLngExpression) => {
    setView(prevView => ({ ...prevView, center: position, zoom: 15 }));
  };
  
  const handleDeleteMarker = (id: string) => {
    setMarkers((prev) => prev.filter((m) => m.id !== id));
  };

  const handleExport = () => {
    if (markers.length === 0) {
      toast({
        title: 'No markers to export',
        description: 'Add some markers to the map first.',
        variant: 'destructive'
      });
      return;
    }
    const dataStr = JSON.stringify(markers, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = 'map_markers.json';
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const sidebarProps = {
    onGeocode: handleGeocode,
    isGeocoding,
    markers,
    onPanToMarker: handlePanToMarker,
    onDeleteMarker: handleDeleteMarker,
    onExport: handleExport,
    onAddMarker: handleCenterMarker,
  };

  return (
    <div className="h-screen w-screen flex bg-background font-body">
      <div className="hidden md:block md:w-80 lg:w-96 border-r">
        <SidebarContent {...sidebarProps} />
      </div>
      <main className="flex-1 flex flex-col relative">
         <div className="md:hidden absolute top-2 left-2 z-[1001]">
             <Popover>
                <PopoverTrigger asChild>
                    <Button variant="default" size="icon" className="h-9 w-9 rounded-full shadow-lg bg-white/80 backdrop-blur-sm hover:bg-white/90">
                        <MoreVertical className="h-5 w-5" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="start" className="p-2 w-auto bg-card/95 backdrop-blur-sm border-border/50">
                     <Button onClick={handleCenterMarker} variant="outline" size="icon" className="h-12 w-12 rounded-full">
                        <Pencil className="h-6 w-6"/>
                     </Button>
                </PopoverContent>
            </Popover>
        </div>
        <div className="flex-1 relative">
            <Map
              center={view.center}
              zoom={view.zoom}
              markers={markers}
              onMapClick={handleMapClick}
              currentLocation={currentLocation}
            />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000] pointer-events-none">
              <Crosshair className="h-6 w-6 text-primary opacity-80" />
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="default" 
                    size="icon" 
                    className="absolute top-2 right-2 h-9 w-9 rounded-full shadow-lg z-[1000]"
                    onClick={handleLocateMe}
                    disabled={isLocating}
                  >
                    {isLocating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Crosshair className="h-5 w-5" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Locate Me</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
        </div>
      </main>

      <Dialog open={!!pendingMarker} onOpenChange={(isOpen) => !isOpen && setPendingMarker(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Marker</DialogTitle>
            <DialogDescription>
              Enter a label for the point at the center of the map.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddMarkerSubmit}>
            <div className="grid gap-4 py-4">
              <Input
                ref={addMarkerInputRef}
                id="marker-label"
                defaultValue="marker 0"
                required
                autoFocus
                onFocus={(e) => e.target.select()}
              />
            </div>
            <DialogFooter>
              <Button type="submit">
                <MapPin className="mr-2 h-4 w-4" /> Add Marker
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

    