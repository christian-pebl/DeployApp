
'use client';

import React, { useEffect, useRef } from 'react';
import type { LatLngExpression, Map as LeafletMap, Marker as LeafletMarker, LatLng, DivIconOptions, CircleMarker } from 'leaflet';

interface MapProps {
    center: LatLngExpression;
    zoom: number;
    markers: { id: string; position: LatLngExpression; label: string }[];
    currentLocation: LatLngExpression | null;
    onMapClick: (latlng: LatLng) => void;
}

const createCustomIcon = (color: string) => {
    const iconHtml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="36" height="36" class="drop-shadow-lg"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`;
    
    const iconOptions: DivIconOptions = {
      html: iconHtml,
      className: 'border-0 bg-transparent',
      iconSize: [36, 36],
      iconAnchor: [18, 36],
      popupAnchor: [0, -38]
    };

    return L.divIcon(iconOptions as any);
};

const Map = ({ center, zoom, markers, currentLocation, onMapClick }: MapProps) => {
    const mapRef = useRef<LeafletMap | null>(null);
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const markersRef = useRef<{ [key: string]: LeafletMarker }>({});
    const currentLocationMarkerRef = useRef<CircleMarker | null>(null);

    useEffect(() => {
        if (typeof window.L === 'undefined') return;

        if (mapContainerRef.current && !mapRef.current) {
            mapRef.current = L.map(mapContainerRef.current, {
                center: center,
                zoom: zoom,
                zoomControl: false 
            });

            L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                subdomains: 'abcd',
                maxZoom: 20
            }).addTo(mapRef.current);
            
            const pane = mapRef.current.createPane('currentLocationPane');
            pane.style.zIndex = '1000';

            L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);

            mapRef.current.on('click', (e) => {
                onMapClick(e.latlng);
            });
        }

        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, []); 

    useEffect(() => {
        if (mapRef.current) {
            mapRef.current.setView(center, zoom, { animate: true, pan: { duration: 0.5 } });
        }
    }, [center, zoom]);

    useEffect(() => {
        if (mapRef.current && typeof window.L !== 'undefined') {
            const map = mapRef.current;
            const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent');
            const markerIcon = createCustomIcon(`hsl(${accentColor})`);

            const existingMarkerIds = Object.keys(markersRef.current);
            const newMarkerIds = markers.map(m => m.id);

            existingMarkerIds.forEach(markerId => {
                if (!newMarkerIds.includes(markerId)) {
                    markersRef.current[markerId].remove();
                    delete markersRef.current[markerId];
                }
            });

            markers.forEach(markerData => {
                if (!markersRef.current[markerData.id]) {
                    const newMarker = L.marker(markerData.position, { icon: markerIcon }).addTo(map);
                    newMarker.bindPopup(`<b class="font-sans">${markerData.label}</b>`);
                    markersRef.current[markerData.id] = newMarker;
                } else {
                    const existingMarker = markersRef.current[markerData.id];
                    existingMarker.setLatLng(markerData.position);
                    existingMarker.getPopup()?.setContent(`<b class="font-sans">${markerData.label}</b>`);
                }
            });
        }
    }, [markers]);

    useEffect(() => {
        if (mapRef.current && typeof window.L !== 'undefined') {
            const map = mapRef.current;
            if (currentLocation) {
                if (!currentLocationMarkerRef.current) {
                    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary');
                    currentLocationMarkerRef.current = L.circleMarker(currentLocation, {
                        radius: 5.2,
                        color: `hsl(${primaryColor})`,
                        weight: 2,
                        fillColor: `hsl(${primaryColor})`,
                        fillOpacity: 0.8,
                        pane: 'currentLocationPane'
                    }).addTo(map);
                } else {
                    currentLocationMarkerRef.current.setLatLng(currentLocation);
                }
                 currentLocationMarkerRef.current?.bringToFront();
            } else {
                if (currentLocationMarkerRef.current) {
                    currentLocationMarkerRef.current.remove();
                    currentLocationMarkerRef.current = null;
                }
            }
        }
    }, [currentLocation]);

    return <div ref={mapContainerRef} className="h-full w-full z-0" />;
};

export default Map;
