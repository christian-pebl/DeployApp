
'use client';

import React, { useState, useRef, useId, useEffect } from 'react';
import type { LatLng, LatLngExpression } from 'leaflet';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { useToast } from "@/hooks/use-toast";
import { geocodeAddress } from '@/ai/flows/geocode-address';
import { Loader2, Crosshair, Notebook } from 'lucide-react';
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

export default function MapExplorer() {
  const [log, setLog] = useState<string[]>(['App Initialized']);
  const [markers, setMarkers] = useState<MarkerData[]>([]);
  const [view, setView] = useState<{ center: LatLngExpression; zoom: number }>({
    center: [48.8584, 2.2945], // Default to Paris
    zoom: 13,
  });
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isLocating, setIsLocating] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<LatLng | null>(null);
  
  const { toast } = useToast();
  const componentId = useId();
  const watchIdRef = useRef<number | null>(null);

  const addLog = (entry: string) => {
    setLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${entry}`]);
  };

  useEffect(() => {
    addLog('Attempting to get user location.');
    if (typeof window === 'undefined' || !navigator.geolocation) {
        setIsLocating(false);
        const errorMsg = "Geolocation not supported by your browser.";
        addLog(`Error: ${errorMsg}`);
        toast({
            variant: "destructive",
            title: "Geolocation Error",
            description: errorMsg,
        });
        return;
    }

    let initialLocationFound = false;

    const handleSuccess = (position: GeolocationPosition) => {
        const { latitude, longitude } = position.coords;
        const newPosition: LatLng = L.latLng(latitude, longitude);
        setCurrentLocation(newPosition);
        addLog(`Location updated: ${latitude}, ${longitude}`);
        if (!initialLocationFound) {
            addLog('Centering map on initial location.');
            setView({ center: newPosition, zoom: 15 });
            setIsLocating(false);
            initialLocationFound = true;
        }
    };

    const handleError = (error: GeolocationPositionError) => {
        const errorMsg = error.code === error.PERMISSION_DENIED
            ? "Location access denied."
            : `Geolocation error (code ${error.code}): ${error.message}`;
        addLog(`Error: ${errorMsg}`);
        if (isLocating) setIsLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
            toast({
                variant: "destructive",
                title: "Geolocation Error",
                description: "Location access denied. Please enable it in your browser settings.",
            });
        }
    };
    
    addLog('Setting up geolocation watcher.');
    watchIdRef.current = navigator.geolocation.watchPosition(
        handleSuccess,
        handleError,
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    return () => {
        if (watchIdRef.current !== null) {
            addLog('Cleaning up geolocation watcher.');
            navigator.geolocation.clearWatch(watchIdRef.current);
        }
    };
  }, [toast]);


  const handleMapClick = (latlng: LatLng) => {
    addLog(`Map clicked at: ${latlng.lat}, ${latlng.lng}`);
  };
  
  const handleGeocode = async (address: string) => {
    addLog(`Geocoding address: "${address}"`);
    setIsGeocoding(true);
    try {
      const result = await geocodeAddress({ address });
      if (result.latitude && result.longitude) {
        const position: LatLngExpression = [result.latitude, result.longitude];
        addLog(`Geocode success: ${result.latitude}, ${result.longitude}`);
        setView({ center: position, zoom: 17 });
        const newMarker: MarkerData = {
          id: `marker-${componentId}-${Date.now()}`,
          position,
          label: address,
        };
        setMarkers((prev) => [...prev, newMarker]);
      } else {
         addLog(`Geocode failed for: "${address}"`);
      }
    } catch (error) {
      addLog(`Geocode error: ${error}`);
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
    addLog('Locate me button clicked.');
    if (currentLocation) {
        addLog('Centering view on current location.');
        setView({ center: currentLocation, zoom: 15 });
    } else {
        addLog('Current location not available, attempting to locate.');
        setIsLocating(true); 
    }
  };

  const handleShowLog = () => {
    const lastEntry = log[log.length - 1] || 'Log is empty.';
    toast({
        title: "Latest Log Entry",
        description: <pre className="text-xs whitespace-pre-wrap">{lastEntry}</pre>
    });
  }

  return (
    <div className="h-screen w-screen flex bg-background font-body relative overflow-hidden">
       <div className="absolute top-4 left-4 z-30 flex flex-col gap-2">
            <TooltipProvider>
                 <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={handleShowLog}
                            className="h-12 w-12 rounded-full shadow-lg"
                        >
                            <Notebook className="h-6 w-6" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                        <p>Show Last Log</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>


      <main className="flex-1 flex flex-col relative h-full">
        <div className="flex-1 relative">
            <Map
              center={view.center}
              zoom={view.zoom}
              markers={markers}
              lines={[]}
              onMapClick={handleMapClick}
              currentLocation={currentLocation}
            />
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000] pointer-events-none">
                <Crosshair className="h-8 w-8 text-primary opacity-80" />
            </div>
           
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
        </div>
      </main>
    </div>
  );
}
