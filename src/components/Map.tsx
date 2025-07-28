
'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { LatLngExpression, Map as LeafletMap, Marker as LeafletMarker, LatLng, DivIconOptions, CircleMarker, Polyline, LayerGroup, Popup, LocationEvent, LeafletMouseEvent } from 'leaflet';

type Pin = { id: string; lat: number; lng: number; label: string };
type Line = { id: string; path: { lat: number; lng: number }[]; label: string };

interface MapProps {
    mapRef: React.MutableRefObject<LeafletMap | null>;
    center: LatLngExpression;
    zoom: number;
    pins: Pin[];
    setPins: React.Dispatch<React.SetStateAction<Pin[]>>;
    lines: Line[];
    setLines: React.Dispatch<React.SetStateAction<Line[]>>;
    currentLocation: LatLng | null;
    onLocationFound: (latlng: LatLng) => void;
    onLocationError: (error: any) => void;
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

const Map = ({ mapRef, center, zoom, pins, setPins, lines, setLines, currentLocation, onLocationFound, onLocationError }: MapProps) => {
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const pinLayerRef = useRef<LayerGroup | null>(null);
    const lineLayerRef = useRef<LayerGroup | null>(null);
    const currentLocationMarkerRef = useRef<CircleMarker | null>(null);
    const popupRef = useRef<Popup | null>(null);
    
    const [linePoints, setLinePoints] = useState<LatLng[]>([]);

    useEffect(() => {
        if (typeof window.L === 'undefined') return;

        if (mapContainerRef.current && !mapRef.current) {
            const map = L.map(mapContainerRef.current, {
                center: center,
                zoom: zoom,
                zoomControl: false 
            });
            mapRef.current = map;

            L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                subdomains: 'abcd',
                maxZoom: 20
            }).addTo(map);
            
            const pane = map.createPane('currentLocationPane');
            pane.style.zIndex = '650';
            
            pinLayerRef.current = L.layerGroup().addTo(map);
            lineLayerRef.current = L.layerGroup().addTo(map);

            map.on('click', (e: LeafletMouseEvent) => {
                if (popupRef.current && popupRef.current.isOpen()) return;

                const formId = `pin-form-${Date.now()}`;
                const content = `
                    <form id="${formId}" class="flex flex-col gap-2">
                        <input type="text" name="label" placeholder="Enter pin label" required class="p-2 border rounded-md text-sm bg-background text-foreground border-border" />
                        <div class="flex justify-end gap-2">
                            <button type="button" class="cancel-btn px-3 py-1 text-sm rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80">Cancel</button>
                            <button type="submit" class="px-3 py-1 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90">Save</button>
                        </div>
                    </form>
                `;
                
                popupRef.current = L.popup({ closeButton: false, closeOnClick: false, className: 'p-0' })
                    .setLatLng(e.latlng)
                    .setContent(content)
                    .openOn(map);

                const handleCancel = () => {
                    map.closePopup();
                };
                
                popupRef.current.on('remove', handleCancel);

                setTimeout(() => {
                    const form = document.getElementById(formId);
                    const cancelButton = form?.querySelector('.cancel-btn');

                    form?.addEventListener('submit', (ev) => {
                        ev.preventDefault();
                        const input = (ev.target as HTMLFormElement).elements.namedItem('label') as HTMLInputElement;
                        const newPin: Pin = {
                            id: `pin-${Date.now()}`,
                            lat: e.latlng.lat,
                            lng: e.latlng.lng,
                            label: input.value
                        };
                        setPins(prev => [...prev, newPin]);
                        map.closePopup();
                    });

                    cancelButton?.addEventListener('click', handleCancel);
                }, 0);
            });
            
            map.on('dblclick', (e: LeafletMouseEvent) => {
                const newPoints = [...linePoints, e.latlng];
                setLinePoints(newPoints);
                
                if (newPoints.length === 2) {
                    const lineId = `line-${Date.now()}`;
                    const midPoint = L.latLng(
                        (newPoints[0].lat + newPoints[1].lat) / 2,
                        (newPoints[0].lng + newPoints[1].lng) / 2
                    );

                    const formId = `line-form-${Date.now()}`;
                    const content = `
                        <form id="${formId}" class="flex flex-col gap-2">
                            <input type="text" name="label" placeholder="Enter line label" required class="p-2 border rounded-md text-sm bg-background text-foreground border-border" />
                            <div class="flex justify-end gap-2">
                                <button type="button" class="cancel-btn px-3 py-1 text-sm rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80">Cancel</button>
                                <button type="submit" class="px-3 py-1 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90">Save</button>
                            </div>
                        </form>
                    `;

                    popupRef.current = L.popup({ closeButton: false, closeOnClick: false, className: 'p-0' })
                        .setLatLng(midPoint)
                        .setContent(content)
                        .openOn(map);
                    
                    const handleCancel = () => {
                       map.closePopup();
                       setLinePoints([]);
                    };

                    popupRef.current.on('remove', handleCancel);

                    setTimeout(() => {
                        const form = document.getElementById(formId);
                        const cancelButton = form?.querySelector('.cancel-btn');

                        form?.addEventListener('submit', (ev) => {
                            ev.preventDefault();
                            const input = (ev.target as HTMLFormElement).elements.namedItem('label') as HTMLInputElement;
                            const newLine: Line = {
                                id: lineId,
                                path: newPoints.map(p => ({ lat: p.lat, lng: p.lng })),
                                label: input.value,
                            };
                            setLines(prev => [...prev, newLine]);
                            map.closePopup();
                            setLinePoints([]);
                        });

                        cancelButton?.addEventListener('click', handleCancel);
                    }, 0);
                }
            });


            map.locate({ watch: true, setView: false });

            map.on('locationfound', (e: LocationEvent) => { onLocationFound(e.latlng); });
            map.on('locationerror', (e: any) => { onLocationError(e); });
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
            mapRef.current.setView(center, zoom, { animate: true, pan: { duration: 1 } });
        }
    }, [center, zoom]);


    useEffect(() => {
        if (pinLayerRef.current && typeof window.L !== 'undefined') {
            const layer = pinLayerRef.current;
            layer.clearLayers();
            const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent');
            const markerIcon = createCustomIcon(`hsl(${accentColor})`);

            pins.forEach(pin => {
                L.marker([pin.lat, pin.lng], { icon: markerIcon })
                  .bindTooltip(pin.label, { permanent: true, direction: 'top', offset: [0, -36], className: 'font-sans font-bold' })
                  .addTo(layer);
            });
        }
    }, [pins]);

    useEffect(() => {
        if (lineLayerRef.current && typeof window.L !== 'undefined') {
            const layer = lineLayerRef.current;
            layer.clearLayers();
            const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary');

            lines.forEach(line => {
                const latlngs = line.path.map(p => [p.lat, p.lng] as LatLngExpression);
                if (latlngs.length < 2) return;

                const poly = L.polyline(latlngs, {
                    color: `hsl(${primaryColor})`,
                    weight: 4,
                    opacity: 0.8
                }).addTo(layer);

                if(line.label) {
                    const midIndex = Math.floor(latlngs.length / 2);
                    L.tooltip({
                        permanent: true,
                        direction: 'center',
                        className: 'font-sans font-bold text-primary-foreground bg-primary/80 border-0',
                    })
                    .setLatLng(latlngs[midIndex] as LatLng)
                    .setContent(line.label)
                    .addTo(layer);
                }
            });
        }
    }, [lines]);


    useEffect(() => {
        if (mapRef.current && typeof window.L !== 'undefined' && currentLocation) {
            const map = mapRef.current;
            const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary');
            const circleOptions = {
                radius: 8,
                color: `hsl(${primaryColor})`,
                weight: 3,
                fillColor: `hsl(${primaryColor})`,
                fillOpacity: 0.2,
                pane: 'currentLocationPane'
            };

            if (!currentLocationMarkerRef.current) {
                currentLocationMarkerRef.current = L.circleMarker(currentLocation, circleOptions).addTo(map);
            } else {
                currentLocationMarkerRef.current.setLatLng(currentLocation);
            }
        } else if (mapRef.current && !currentLocation && currentLocationMarkerRef.current) {
            currentLocationMarkerRef.current.remove();
            currentLocationMarkerRef.current = null;
        }
    }, [currentLocation]);


    return <div ref={mapContainerRef} className="h-full w-full z-0" />;
};

export default Map;

    