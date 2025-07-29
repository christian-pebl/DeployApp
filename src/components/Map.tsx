
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
    lines: Line[];
    currentLocation: LatLng | null;
    onLocationFound: (latlng: LatLng) => void;
    onLocationError: (error: any) => void;
    onMove: (center: LatLng) => void;
    isDrawingLine: boolean;
    lineStartPoint: LatLng | null;
    pendingPin: LatLng | null;
    onPinSave: (id: string, label: string, lat: number, lng: number) => void;
    onPinCancel: () => void;
    pendingLine: { path: LatLng[] } | null;
    onLineSave: (id: string, label: string, path: LatLng[]) => void;
    onLineCancel: () => void;
    onUpdatePin: (id: string, label: string) => void;
    onDeletePin: (id: string) => void;
    onUpdateLine: (id: string, label: string) => void;
    onDeleteLine: (id: string) => void;
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

const Map = ({ 
    mapRef, center, zoom, pins, lines, currentLocation, 
    onLocationFound, onLocationError, onMove, isDrawingLine, lineStartPoint,
    pendingPin, onPinSave, onPinCancel,
    pendingLine, onLineSave, onLineCancel,
    onUpdatePin, onDeletePin, onUpdateLine, onDeleteLine
}: MapProps) => {
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const pinLayerRef = useRef<LayerGroup | null>(null);
    const lineLayerRef = useRef<LayerGroup | null>(null);
    const previewLineRef = useRef<Polyline | null>(null);
    const currentLocationMarkerRef = useRef<CircleMarker | null>(null);
    const popupRef = useRef<Popup | null>(null);

    const showEditPopup = (item: Pin | Line) => {
        const map = mapRef.current;
        if (!map) return;

        if (popupRef.current && popupRef.current.isOpen()) {
            map.closePopup();
        }

        const isPin = 'lat' in item;
        const latlng = isPin ? L.latLng(item.lat, item.lng) : L.latLng((item.path[0].lat + item.path[1].lat) / 2, (item.path[0].lng + item.path[1].lng) / 2);
        
        const formId = `edit-form-${item.id}`;
        
        let coordsHtml = '';
        if (isPin) {
            coordsHtml = `<p class="text-xs text-muted-foreground">Lat: ${item.lat.toFixed(4)}, Lng: ${item.lng.toFixed(4)}</p>`;
        } else {
            coordsHtml = `<div class="text-xs text-muted-foreground">
                <p>Start: ${item.path[0].lat.toFixed(4)}, ${item.path[0].lng.toFixed(4)}</p>
                <p>End: ${item.path[1].lat.toFixed(4)}, ${item.path[1].lng.toFixed(4)}</p>
            </div>`;
        }

        const content = `
            <form id="${formId}" class="flex flex-col gap-2">
                <input type="text" name="label" value="${item.label}" required class="p-2 border rounded-md text-sm bg-background text-foreground border-border" />
                ${coordsHtml}
                <div class="flex justify-end gap-2">
                    <button type="button" class="delete-btn px-3 py-1 text-sm rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/80">Delete</button>
                    <button type="submit" class="px-3 py-1 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90">Save</button>
                </div>
            </form>
        `;

        popupRef.current = L.popup({ closeButton: true, closeOnClick: true, className: 'p-0' })
            .setLatLng(latlng)
            .setContent(content)
            .openOn(map);
        
        setTimeout(() => {
            const form = document.getElementById(formId);
            const deleteButton = form?.querySelector('.delete-btn');

            form?.addEventListener('submit', (ev) => {
                ev.preventDefault();
                const input = (ev.target as HTMLFormElement).elements.namedItem('label') as HTMLInputElement;
                if (isPin) {
                    onUpdatePin(item.id, input.value);
                } else {
                    onUpdateLine(item.id, input.value);
                }
                map.closePopup();
            });

            deleteButton?.addEventListener('click', () => {
                if (isPin) {
                    onDeletePin(item.id);
                } else {
                    onDeleteLine(item.id);
                }
                map.closePopup();
            });
        }, 0);
    };

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
            
            map.on('move', () => {
                if (mapRef.current) {
                    onMove(mapRef.current.getCenter());
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
                const marker = L.marker([pin.lat, pin.lng], { icon: markerIcon })
                  .bindTooltip(pin.label, { permanent: true, direction: 'top', offset: [0, -36], className: 'font-sans font-bold' })
                  .addTo(layer);
                marker.on('click', () => showEditPopup(pin));
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

                const polyline = L.polyline(latlngs, {
                    color: `hsl(${primaryColor})`,
                    weight: 4,
                    opacity: 0.8
                }).addTo(layer);

                if(line.label) {
                    polyline.bindTooltip(line.label, {
                        permanent: true,
                        direction: 'center',
                        className: 'font-sans font-bold text-primary-foreground bg-primary/80 border-0',
                    });
                }
                polyline.on('click', () => showEditPopup(line));
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

    useEffect(() => {
        const map = mapRef.current;
        if (map && isDrawingLine && lineStartPoint) {
            const updatePreviewLine = () => {
                const center = map.getCenter();
                if (previewLineRef.current) {
                    previewLineRef.current.setLatLngs([lineStartPoint, center]);
                } else {
                    previewLineRef.current = L.polyline([lineStartPoint, center], {
                        color: 'hsl(var(--primary))',
                        weight: 4,
                        opacity: 0.8,
                        dashArray: '5, 10',
                    }).addTo(map);
                }
            };
            
            map.on('move', updatePreviewLine);
            updatePreviewLine(); // Initial draw

            return () => {
                map.off('move', updatePreviewLine);
            };
        } else if (previewLineRef.current) {
            previewLineRef.current.remove();
            previewLineRef.current = null;
        }
    }, [isDrawingLine, lineStartPoint]);

    const showPopup = (latlng: LatLng, type: 'pin' | 'line', path?: LatLng[]) => {
        const map = mapRef.current;
        if (!map) return;

        if (popupRef.current && popupRef.current.isOpen()) {
            map.closePopup();
        }

        const formId = `form-${Date.now()}`;
        const content = `
            <form id="${formId}" class="flex flex-col gap-2">
                <input type="text" name="label" placeholder="Enter label" required class="p-2 border rounded-md text-sm bg-background text-foreground border-border" />
                <div class="flex justify-end gap-2">
                    <button type="button" class="cancel-btn px-3 py-1 text-sm rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80">Cancel</button>
                    <button type="submit" class="px-3 py-1 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90">Save</button>
                </div>
            </form>
        `;

        popupRef.current = L.popup({ closeButton: false, closeOnClick: false, className: 'p-0' })
            .setLatLng(latlng)
            .setContent(content)
            .openOn(map);

        const handleCancel = () => {
            map.closePopup();
            if (type === 'pin') onPinCancel();
            if (type === 'line') onLineCancel();
        };

        const cleanup = () => {
            popupRef.current?.off('remove', handleCancel);
        }

        popupRef.current.on('remove', handleCancel);


        setTimeout(() => {
            const form = document.getElementById(formId);
            const cancelButton = form?.querySelector('.cancel-btn');

            form?.addEventListener('submit', (ev) => {
                ev.preventDefault();
                cleanup();
                const input = (ev.target as HTMLFormElement).elements.namedItem('label') as HTMLInputElement;
                const newId = `${type}-${Date.now()}`;
                
                if (type === 'pin') {
                    onPinSave(newId, input.value, latlng.lat, latlng.lng);
                } else if (type === 'line' && path) {
                    onLineSave(newId, input.value, path);
                }
                map.closePopup();
            });

            cancelButton?.addEventListener('click', () => {
                cleanup();
                handleCancel();
            });
        }, 0);
    };

    useEffect(() => {
        if (pendingPin && mapRef.current) {
            const markerIcon = createCustomIcon(`hsl(var(--primary))`);
            const tempMarker = L.marker(pendingPin, { icon: markerIcon }).addTo(mapRef.current);
            
            showPopup(pendingPin, 'pin');

            const cleanup = () => {
                tempMarker.remove();
                popupRef.current?.off('remove', cleanup);
            }
            popupRef.current?.on('remove', cleanup);
        }
    }, [pendingPin]);

    useEffect(() => {
        if (pendingLine && mapRef.current) {
            const midPoint = L.latLng(
                (pendingLine.path[0].lat + pendingLine.path[1].lat) / 2,
                (pendingLine.path[0].lng + pendingLine.path[1].lng) / 2
            );
            showPopup(midPoint, 'line', pendingLine.path);
        }
    }, [pendingLine]);

    return <div ref={mapContainerRef} className="h-full w-full z-0" />;
};

export default Map;
