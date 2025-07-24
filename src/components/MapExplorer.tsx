'use client';

import React, { useState, useRef, useId } from 'react';
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
import { Download, Loader2, LocateFixed, MapPin, Trash2, Menu, Crosshair } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';

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
  onLocateMe,
  isLocating,
  markers,
  onPanToMarker,
  onDeleteMarker,
  onExport,
}: {
  onGeocode: (address: string) => void;
  isGeocoding: boolean;
  onLocateMe: () => void;
  isLocating: boolean;
  markers: MarkerData[];
  onPanToMarker: (position: LatLngExpression) => void;
  onDeleteMarker: (id: string) => void;
  onExport: () => void;
}) {
  const addressInputRef = useRef<HTMLInputElement>(null);

  const handleGeocodeSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const address = addressInputRef.current?.value;
    if (address) {
      onGeocode(address);
    }
  };

  return (
    <div className="flex flex-col h-full bg-card text-card-foreground">
      <div className="p-4 border-b">
        <h2 className="text-2xl font-bold font-headline text-primary">Map Explorer</h2>
        <p className="text-sm text-muted-foreground">Your personal cartography tool.</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Find Location</CardTitle>
              <CardDescription>Enter an address or use your current location.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGeocodeSubmit} className="space-y-2">
                <Input ref={addressInputRef} placeholder="e.g., Eiffel Tower, Paris" disabled={isGeocoding || isLocating} />
                <div className="flex gap-2">
                  <Button type="submit" className="w-full" disabled={isGeocoding || isLocating}>
                    {isGeocoding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LocateFixed className="mr-2 h-4 w-4" />}
                    Find
                  </Button>
                  <Button type="button" variant="outline" className="w-full" onClick={onLocateMe} disabled={isGeocoding || isLocating}>
                    {isLocating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Crosshair className="mr-2 h-4 w-4" />}
                    Locate Me
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your Markers</CardTitle>
              <CardDescription>Click a marker to pan. Click trash to delete.</CardDescription>
            </CardHeader>
            <CardContent>
              {markers.length === 0 ? (
                <div className="text-center text-muted-foreground py-4">
                  <MapPin className="mx-auto h-8 w-8 mb-2" />
                  <p>Click on the map to add your first marker!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {markers.map((marker, index) => (
                    <React.Fragment key={marker.id}>
                      <div className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors">
                        <button onClick={() => onPanToMarker(marker.position)} className="flex-1 text-left truncate pr-2">
                          <span className="font-medium">{marker.label}</span>
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
              )}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
      <div className="p-4 border-t">
        <Button onClick={onExport} className="w-full" variant="secondary">
          <Download className="mr-2 h-4 w-4" /> Export Markers as JSON
        </Button>
      </div>
    </div>
  );
}


export default function MapExplorer() {
  const [markers, setMarkers] = useState<MarkerData[]>([]);
  const [view, setView] = useState<{ center: LatLngExpression; zoom: number }>({
    center: [48.8584, 2.2945],
    zoom: 15,
  });
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [pendingMarker, setPendingMarker] = useState<LatLng | null>(null);
  const addMarkerInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const componentId = useId();

  const handleMapClick = (latlng: LatLng) => {
    setPendingMarker(latlng);
  };

  const handleAddMarker = (e: React.FormEvent<HTMLFormElement>) => {
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
      toast({
        title: "Marker Added",
        description: `"${label}" has been added to the map.`,
      });
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
        toast({
          title: "Location Found",
          description: `Map centered on "${address}".`,
        });
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
    if (!navigator.geolocation) {
      toast({
        variant: 'destructive',
        title: 'Geolocation not supported',
        description: 'Your browser does not support geolocation.',
      });
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newPosition: LatLngExpression = [latitude, longitude];
        setView({ center: newPosition, zoom: 17 });
        
        const newMarker: MarkerData = {
          id: `marker-${componentId}-${Date.now()}`,
          position: newPosition,
          label: "My Location",
        };
        setMarkers((prev) => [...prev, newMarker]);

        toast({
          title: 'Location Found',
          description: "Your current location has been marked on the map.",
        });
        setIsLocating(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        toast({
          variant: 'destructive',
          title: 'Could not get location',
          description:
            'Please ensure location services are enabled and permissions are granted.',
        });
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const handlePanToMarker = (position: LatLngExpression) => {
    setView({ center: position, zoom: 17 });
  };
  
  const handleDeleteMarker = (id: string) => {
    setMarkers((prev) => prev.filter((m) => m.id !== id));
    toast({
        title: "Marker Removed",
        description: "The marker has been removed from the map.",
    });
  };

  const handleExport = () => {
    if (markers.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No markers to export',
        description: 'Add some markers to the map first.',
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
    onLocateMe: handleLocateMe,
    isLocating,
    markers,
    onPanToMarker: handlePanToMarker,
    onDeleteMarker: handleDeleteMarker,
    onExport: handleExport,
  };

  return (
    <div className="h-screen w-screen flex bg-background font-body">
      <div className="hidden md:block md:w-80 lg:w-96 border-r">
        <SidebarContent {...sidebarProps} />
      </div>
      <main className="flex-1 flex flex-col">
        <header className="md:hidden p-2 border-b flex items-center">
            <Sheet>
                <SheetTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <Menu />
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-80">
                    <SidebarContent {...sidebarProps} />
                </SheetContent>
            </Sheet>
            <h1 className="text-lg font-bold ml-4">Map Explorer</h1>
        </header>
        <div className="flex-1 relative">
            <Map
              center={view.center}
              zoom={view.zoom}
              markers={markers}
              onMapClick={handleMapClick}
            />
        </div>
      </main>

      <Dialog open={!!pendingMarker} onOpenChange={(isOpen) => !isOpen && setPendingMarker(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Marker</DialogTitle>
            <DialogDescription>
              Enter a label for the point you've selected on the map.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddMarker}>
            <div className="grid gap-4 py-4">
              <Input
                ref={addMarkerInputRef}
                id="marker-label"
                placeholder="e.g., Favorite Coffee Shop"
                required
                autoFocus
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
