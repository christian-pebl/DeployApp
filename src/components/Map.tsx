
'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { LatLngExpression, Map as LeafletMap, LatLng, DivIconOptions, CircleMarker, Polyline, Polygon, LayerGroup, Popup, LocationEvent, LeafletMouseEvent, CircleMarkerOptions, Tooltip as LeafletTooltip, Marker } from 'leaflet';
import type { Settings } from '@/hooks/use-settings';

type Project = { id: string; name: string; description?: string; createdAt: any; };
type Tag = { id: string; name: string; color: string; projectId: string; };
type Pin = { id: string; lat: number; lng: number; label: string; labelVisible?: boolean; notes?: string; projectId?: string; tagIds?: string[]; };
type Line = { id:string; path: { lat: number; lng: number }[]; label: string; labelVisible?: boolean; notes?: string; projectId?: string; tagIds?: string[]; };
type Area = { id: string; path: { lat: number; lng: number }[]; label: string; labelVisible?: boolean; notes?: string; fillVisible?: boolean; projectId?: string; tagIds?: string[]; };


interface MapProps {
    mapRef: React.MutableRefObject<LeafletMap | null>;
    center: LatLngExpression;
    zoom: number;
    pins: Pin[];
    lines: Line[];
    areas: Area[];
    projects: Project[];
    tags: Tag[];
    settings: Settings;
    currentLocation: LatLng | null;
    onLocationFound: (latlng: LatLng) => void;
    onLocationError: (error: any) => void;
    onMove: (center: LatLng, zoom: number) => void;
    isDrawingLine: boolean;
    lineStartPoint: LatLng | null;
    isDrawingArea: boolean;
    onMapClick: (e: LeafletMouseEvent) => void;
    pendingAreaPath: LatLng[];
    pendingPin: LatLng | null;
    onPinSave: (id: string, label: string, lat: number, lng: number, notes: string, tagId?: string) => void;
    onPinCancel: () => void;
    pendingLine: { path: LatLng[] } | null;
    onLineSave: (id: string, label: string, path: LatLng[], notes: string, tagId?: string) => void;
    onLineCancel: () => void;
    pendingArea: { path: LatLng[] } | null;
    onAreaSave: (id: string, label: string, path: LatLng[], notes: string, tagId?: string) => void;
    onAreaCancel: () => void;
    onUpdatePin: (id: string, label: string, notes: string, projectId?: string, tagIds?: string[]) => void;
    onDeletePin: (id: string) => void;
    onUpdateLine: (id: string, label: string, notes: string, projectId?: string, tagIds?: string[]) => void;
    onDeleteLine: (id: string) => void;
    onUpdateArea: (id: string, label: string, notes: string, path: {lat: number, lng: number}[], projectId?: string, tagIds?: string[]) => void;
    onDeleteArea: (id: string) => void;
    onToggleLabel: (id: string, type: 'pin' | 'line' | 'area') => void;
    onToggleFill: (id: string) => void;
    itemToEdit: Pin | Line | Area | null;
    onEditItem: (item: Pin | Line | Area | null) => void;
    activeProjectId: string | null;
    editingGeometry: Line | Area | null;
    onEditGeometry: (item: Line | Area | null) => void;
    onUpdateGeometry: (itemId: string, newPath: {lat: number, lng: number}[]) => void;
}

// Coordinate and distance conversion helpers
const toFeet = (meters: number) => meters * 3.28084;

const toDMS = (deg: number, isLat: boolean) => {
  const absolute = Math.abs(deg);
  const degrees = Math.floor(absolute);
  const minutesNotTruncated = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesNotTruncated);
  const seconds = Math.floor((minutesNotTruncated - minutes) * 60);
  const direction = deg >= 0 ? (isLat ? 'N' : 'E') : (isLat ? 'S' : 'W');
  return `${degrees}° ${minutes}' ${seconds}" ${direction}`;
};


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

const createDraggableVertexIcon = () => {
    const iconHtml = `<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" style="background: hsl(var(--primary)); border-radius: 50%; border: 2px solid hsl(var(--primary-foreground)); box-shadow: 0 0 5px rgba(0,0,0,0.5);"><circle cx="8" cy="8" r="8" fill="transparent"/></svg>`;
    return L.divIcon({
        html: iconHtml,
        className: 'bg-transparent border-0',
        iconSize: [16, 16],
        iconAnchor: [8, 8]
    });
};

// Shoelace formula implementation for area calculation
function calculatePolygonArea(path: { lat: number; lng: number }[]): number {
    if (path.length < 3) {
      return 0;
    }

    const points = [...path];
    if (points[0].lat !== points[points.length - 1].lat || points[0].lng !== points[points.length - 1].lng) {
      points.push(points[0]);
    }

    let area = 0;
    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i+1];
        area += (p1.lng * p2.lat - p2.lng * p1.lat);
    }
    const areaSqDegrees = Math.abs(area / 2);

    const avgLatRad = (path.reduce((sum, p) => sum + p.lat, 0) / path.length) * (Math.PI / 180);
    const metersPerDegreeLat = 111132.954 - 559.822 * Math.cos(2 * avgLatRad) + 1.175 * Math.cos(4 * avgLatRad);
    const metersPerDegreeLng = 111320 * Math.cos(avgLatRad);
    const areaSqMeters = areaSqDegrees * metersPerDegreeLat * metersPerDegreeLng;
    
    return areaSqMeters / 10000; // Convert to hectares
}


const Map = ({ 
    mapRef, center, zoom, pins, lines, areas, projects, tags, settings, currentLocation, 
    onLocationFound, onLocationError, onMove, isDrawingLine, lineStartPoint,
    isDrawingArea, onMapClick, pendingAreaPath,
    pendingPin, onPinSave, onPinCancel,
    pendingLine, onLineSave, onLineCancel,
    pendingArea, onAreaSave, onAreaCancel,
    onUpdatePin, onDeletePin, onUpdateLine, onDeleteLine, onUpdateArea, onDeleteArea, onToggleLabel, onToggleFill,
    itemToEdit, onEditItem, activeProjectId,
    editingGeometry, onEditGeometry, onUpdateGeometry
}: MapProps) => {
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const pinLayerRef = useRef<LayerGroup | null>(null);
    const lineLayerRef = useRef<LayerGroup | null>(null);
    const areaLayerRef = useRef<LayerGroup | null>(null);
    const previewLineRef = useRef<Polyline | null>(null);
    const previewAreaRef = useRef<Polygon | null>(null);
    const previewAreaLineRef = useRef<Polyline | null>(null);
    const currentLocationMarkerRef = useRef<CircleMarker | null>(null);
    const popupRef = useRef<Popup | null>(null);
    const previewAreaPointsRef = useRef<LayerGroup | null>(null);
    const distanceTooltipRef = useRef<LeafletTooltip | null>(null);
    const editingLayerRef = useRef<LayerGroup | null>(null);
    const [editedPath, setEditedPath] = useState<{lat: number, lng: number}[] | null>(null);

    // Expose a method to save geometry via the mapRef
    useEffect(() => {
      if (mapRef.current) {
        (mapRef.current as any).getEditedPath = () => {
           return editedPath;
        };
      }
    }, [mapRef, editedPath]);


    const showEditPopup = (item: Pin | Line | Area) => {
        const map = mapRef.current;
        if (!map || typeof window.L === 'undefined') return;

        if (popupRef.current && popupRef.current.isOpen()) {
            map.closePopup();
        }

        const isPin = 'lat' in item;
        const isArea = 'path' in item && ('fillVisible' in item);
        const isLine = 'path' in item && !isArea;


        let latlng: LatLng;
        if (isPin) {
            latlng = L.latLng(item.lat, item.lng);
        } else if (isArea) {
            const polygon = L.polygon(item.path.map(p => L.latLng(p.lat, p.lng)));
            latlng = polygon.getBounds().getCenter();
        } else { // isLine
            const line = L.polyline((item as Line).path.map(p => L.latLng(p.lat, p.lng)));
            latlng = line.getBounds().getCenter();
        }
        
        const formId = `edit-form-${item.id}`;
        
        let coordsHtml = '';
        if (isPin) {
            const latD = settings.coordFormat === 'dms' ? toDMS(item.lat, true) : item.lat.toFixed(6);
            const lngD = settings.coordFormat === 'dms' ? toDMS(item.lng, false) : item.lng.toFixed(6);
            coordsHtml = `<p class="text-xs text-muted-foreground">Lat: ${latD}<br/>Lng: ${lngD}</p>`;
        } else if ('path' in item) {
            if (isArea) {
                const pointsHtml = item.path.map((p, i) => {
                    const latD = settings.coordFormat === 'dms' ? toDMS(p.lat, true) : p.lat.toFixed(4);
                    const lngD = settings.coordFormat === 'dms' ? toDMS(p.lng, false) : p.lng.toFixed(4);
                     return `
                        <div class="flex items-center gap-2">
                            <span class="font-semibold w-8">P${i+1}:</span>
                            <div class="text-xs">Lat: ${latD}, Lng: ${lngD}</div>
                        </div>
                    `
                }).join('');
                
                coordsHtml = `<div class="text-xs text-muted-foreground space-y-1 max-h-32 overflow-y-auto pr-2">
                    ${pointsHtml}
                </div>
                <div class="flex items-center gap-2 pt-2">
                    <button type="button" class="calculate-area-btn px-3 py-1 text-sm rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80">Calculate Area</button>
                    <p id="area-result" class="text-sm font-semibold"></p>
                </div>
                `;

            } else { // isLine
                const startPoint = L.latLng(item.path[0].lat, item.path[0].lng);
                const endPoint = L.latLng(item.path[item.path.length - 1].lat, item.path[item.path.length - 1].lng);
                const distanceMeters = startPoint.distanceTo(endPoint);
                const distance = settings.units === 'imperial' ? toFeet(distanceMeters) : distanceMeters;
                const unitLabel = settings.units === 'imperial' ? 'feet' : 'meters';

                const startLatD = settings.coordFormat === 'dms' ? toDMS(item.path[0].lat, true) : item.path[0].lat.toFixed(4);
                const startLngD = settings.coordFormat === 'dms' ? toDMS(item.path[0].lng, false) : item.path[0].lng.toFixed(4);
                const endLatD = settings.coordFormat === 'dms' ? toDMS(item.path[item.path.length - 1].lat, true) : item.path[item.path.length - 1].lat.toFixed(4);
                const endLngD = settings.coordFormat === 'dms' ? toDMS(item.path[item.path.length - 1].lng, false) : item.path[item.path.length - 1].lng.toFixed(4);


                coordsHtml = `<div class="text-xs text-muted-foreground space-y-1">
                    <p>Start: ${startLatD}, ${startLngD}</p>
                    <p>End: ${endLatD}, ${endLngD}</p>
                    <p class="font-semibold">Distance: ${distance.toFixed(2)} ${unitLabel}</p>
                </div>`;
            }
        }
        
        const projectOptions = projects.map(p => `<option value="${p.id}" ${item.projectId === p.id ? 'selected' : ''}>${p.name}</option>`).join('');
        const projectSelectorHtml = `
            <div class="flex flex-col gap-1 pt-2">
                <label for="project-selector" class="text-xs font-medium text-muted-foreground">Project</label>
                <select name="projectId" id="project-selector" class="p-2 border rounded-md text-sm bg-background text-foreground border-border">
                    <option value="">None</option>
                    ${projectOptions}
                </select>
            </div>
        `;
        
        const availableTags = tags.filter(t => t.projectId === item.projectId);
        const tagsHtml = availableTags.length > 0 ? `
            <div class="pt-2">
                 <label class="text-xs font-medium text-muted-foreground">Tags</label>
                 <div class="flex flex-wrap gap-2 pt-1">
                    ${availableTags.map(tag => `
                        <div class="flex items-center gap-1.5">
                           <input type="checkbox" id="tag-${tag.id}" name="tagIds" value="${tag.id}" ${item.tagIds?.includes(tag.id) ? 'checked' : ''} class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                           <label for="tag-${tag.id}" class="text-sm" style="color: ${tag.color};">${tag.name}</label>
                        </div>
                    `).join('')}
                 </div>
            </div>
        ` : '';

        const labelVisible = item.labelVisible !== false;
        const fillVisible = isArea ? (item as Area).fillVisible !== false : false;

        let fillButtonHtml = '';
        if(isArea) {
            fillButtonHtml = `<button type="button" class="toggle-fill-btn px-3 py-1 text-sm rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80">${fillVisible ? 'Hide' : 'Show'} Fill</button>`
        }
        
        let editShapeButtonHtml = '';
        if (isLine || isArea) {
            editShapeButtonHtml = `<button type="button" class="edit-shape-btn px-3 py-1 text-sm rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80">Edit Shape</button>`;
        }

        const content = `
            <form id="${formId}" class="flex flex-col gap-2">
                <input type="text" name="label" value="${item.label}" required class="p-2 border rounded-md text-sm bg-background text-foreground border-border" />
                <textarea name="notes" placeholder="Add notes..." class="p-2 border rounded-md text-sm bg-background text-foreground border-border min-h-[60px]">${item.notes || ''}</textarea>
                ${coordsHtml}
                ${projectSelectorHtml}
                ${tagsHtml}
                <div class="flex justify-between items-center gap-2 flex-wrap pt-2">
                    <div class="flex gap-2">
                        <button type="button" class="toggle-label-btn px-3 py-1 text-sm rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80">${labelVisible ? 'Hide' : 'Show'} Label</button>
                        ${fillButtonHtml}
                        ${editShapeButtonHtml}
                    </div>
                    <div class="flex gap-2">
                        <button type="button" class="delete-btn px-3 py-1 text-sm rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/80">Delete</button>
                        <button type="submit" class="px-3 py-1 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90">Save</button>
                    </div>
                </div>
            </form>
        `;

        popupRef.current = L.popup({ closeButton: true, closeOnClick: true, className: 'p-0 w-[320px]', maxHeight: 400 })
            .setLatLng(latlng)
            .setContent(content)
            .openOn(map);

        const handleCleanup = () => {
            onEditItem(null);
        };
        
        popupRef.current.on('remove', handleCleanup);

        setTimeout(() => {
            const form = document.getElementById(formId);
            const deleteButton = form?.querySelector('.delete-btn');
            const toggleLabelButton = form?.querySelector('.toggle-label-btn');
            const toggleFillButton = form?.querySelector('.toggle-fill-btn');
            const calculateAreaButton = form?.querySelector('.calculate-area-btn');
            const editShapeButton = form?.querySelector('.edit-shape-btn');

            form?.addEventListener('submit', (ev) => {
                ev.preventDefault();
                const formElements = (ev.target as HTMLFormElement).elements;
                const labelInput = formElements.namedItem('label') as HTMLInputElement;
                const notesInput = formElements.namedItem('notes') as HTMLTextAreaElement;
                const projectIdInput = formElements.namedItem('projectId') as HTMLSelectElement;
                
                const selectedTagIds = Array.from(formElements.namedItem('tagIds') as RadioNodeList | null ?? [])
                    .filter(i => (i as HTMLInputElement).checked)
                    .map(i => (i as HTMLInputElement).value);

                const projectId = projectIdInput.value || undefined;

                if (isPin) {
                    onUpdatePin(item.id, labelInput.value, notesInput.value, projectId, selectedTagIds);
                } else if (isArea) {
                    const newPath = (item as Area).path; // Path editing not supported in this simplified view
                    onUpdateArea(item.id, labelInput.value, notesInput.value, newPath, projectId, selectedTagIds);
                } else {
                    onUpdateLine(item.id, labelInput.value, notesInput.value, projectId, selectedTagIds);
                }
                map.closePopup();
            });

            deleteButton?.addEventListener('click', () => {
                if (isPin) {
                    onDeletePin(item.id);
                } else if (isArea) {
                    onDeleteArea(item.id);
                } else {
                    onDeleteLine(item.id);
                }
                map.closePopup();
            });

            toggleLabelButton?.addEventListener('click', () => {
                onToggleLabel(item.id, isPin ? 'pin' : isArea ? 'area' : 'line');
                map.closePopup();
            });
            
            calculateAreaButton?.addEventListener('click', () => {
                if (!isArea) return;
                const areaResultEl = document.getElementById('area-result');
                if (!areaResultEl) return;
                
                const areaHectares = calculatePolygonArea((item as Area).path);
                const areaAcres = areaHectares * 2.47105;
                const areaDisplay = settings.units === 'imperial' 
                    ? `${areaAcres.toFixed(4)} acres`
                    : `${areaHectares.toFixed(4)} ha`;
                areaResultEl.innerText = areaDisplay;
            });
            
            editShapeButton?.addEventListener('click', () => {
                onEditGeometry(item as Line | Area);
                map.closePopup();
            });

            if (isArea) {
                toggleFillButton?.addEventListener('click', () => {
                    onToggleFill(item.id);
                    map.closePopup();
                });
            }
        }, 0);
    };

    useEffect(() => {
        if(itemToEdit && mapRef.current) {
            showEditPopup(itemToEdit);
        } else if (!itemToEdit && mapRef.current && popupRef.current && popupRef.current.isOpen()) {
            mapRef.current.closePopup(popupRef.current);
        }
    }, [itemToEdit, projects, tags, settings])

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
            areaLayerRef.current = L.layerGroup().addTo(map);
            previewAreaPointsRef.current = L.layerGroup().addTo(map);
            editingLayerRef.current = L.layerGroup().addTo(map);


            map.on('click', onMapClick);
            
            map.on('moveend', () => {
                if (mapRef.current) {
                    onMove(mapRef.current.getCenter(), mapRef.current.getZoom());
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
        if (mapRef.current && (mapRef.current.getZoom() !== zoom || JSON.stringify(mapRef.current.getCenter()) !== JSON.stringify(center))) {
            mapRef.current.setView(center, zoom, { animate: true, pan: { duration: 1 } });
        }
    }, [center, zoom]);


    useEffect(() => {
        if (pinLayerRef.current && typeof window.L !== 'undefined') {
            const layer = pinLayerRef.current;
            layer.clearLayers();
            const defaultAccentColor = `hsl(${getComputedStyle(document.documentElement).getPropertyValue('--accent')})`;

            pins.forEach(pin => {
                const firstTagId = pin.tagIds?.[0];
                const tag = tags.find(t => t.id === firstTagId);
                const color = tag ? tag.color : defaultAccentColor;

                const markerIcon = createCustomIcon(color);

                const marker = L.marker([pin.lat, pin.lng], { icon: markerIcon }).addTo(layer);
                if (pin.labelVisible !== false) {
                     marker.bindTooltip(pin.label, { permanent: true, direction: 'top', offset: [0, -36], className: 'font-sans font-bold', interactive: true })
                        .on('click', (e) => {
                            L.DomEvent.stopPropagation(e);
                            onEditItem(pin);
                        });
                }
                marker.on('click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    onEditItem(pin)
                });
            });
        }
    }, [pins, onEditItem, tags]);

    useEffect(() => {
        if (lineLayerRef.current && typeof window.L !== 'undefined') {
            const layer = lineLayerRef.current;
            layer.clearLayers();
            const defaultPrimaryColor = `hsl(${getComputedStyle(document.documentElement).getPropertyValue('--primary')})`;

            lines.forEach(line => {
                const latlngs = line.path.map(p => [p.lat, p.lng] as LatLngExpression);
                if (latlngs.length < 2) return;

                const firstTagId = line.tagIds?.[0];
                const tag = tags.find(t => t.id === firstTagId);
                const color = tag ? tag.color : defaultPrimaryColor;

                const polyline = L.polyline(latlngs, {
                    color: color,
                    weight: 4,
                    opacity: 0.8
                }).addTo(layer);

                if(line.label && line.labelVisible !== false) {
                    const center = L.polyline(latlngs).getBounds().getCenter();
                    polyline.bindTooltip(line.label, {
                        permanent: true,
                        direction: 'center',
                        className: 'font-sans font-bold text-primary-foreground bg-primary/80 border-0',
                        interactive: true,
                    }).on('click', (e) => {
                        L.DomEvent.stopPropagation(e);
                        onEditItem(line);
                    }).openTooltip();
                }
                polyline.on('click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    onEditItem(line)
                });
            });
        }
    }, [lines, onEditItem, tags]);

    useEffect(() => {
        if (areaLayerRef.current && typeof window.L !== 'undefined' && mapRef.current) {
            const layer = areaLayerRef.current;
            layer.clearLayers();
            const defaultSecondaryFgColor = `hsl(${getComputedStyle(document.documentElement).getPropertyValue('--secondary-foreground')})`;
            const defaultSecondaryColor = `hsl(${getComputedStyle(document.documentElement).getPropertyValue('--secondary')})`;
    
            areas.forEach(area => {
                const latlngs = area.path.map(p => L.latLng(p.lat, p.lng));
                if (latlngs.length < 2) return;

                const firstTagId = area.tagIds?.[0];
                const tag = tags.find(t => t.id === firstTagId);
                const color = tag ? tag.color : defaultSecondaryFgColor;
    
                const fillOpacity = area.fillVisible !== false ? 0.2 : 0.0;
    
                const polygon = L.polygon(latlngs, {
                    color: color,
                    weight: 2,
                    fillColor: color,
                    fillOpacity: fillOpacity
                }).addTo(layer);
    
                polygon.on('click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    onEditItem(area);
                });
    
                 const cornerMarkerOptions: CircleMarkerOptions = {
                    radius: 6,
                    fillColor: tag ? tag.color : defaultSecondaryColor,
                    color: tag ? tag.color : defaultSecondaryFgColor,
                    weight: 2,
                    fillOpacity: 1
                };

                latlngs.forEach(latlng => {
                    const marker = L.circleMarker(latlng, cornerMarkerOptions).addTo(layer);
                    marker.on('click', (e) => {
                        L.DomEvent.stopPropagation(e);
                        onEditItem(area);
                    });
                });
    
                if (area.label && area.labelVisible !== false) {
                    const center = polygon.getBounds().getCenter();
                    polygon.bindTooltip(area.label, {
                        permanent: true,
                        direction: 'center',
                        className: 'font-sans font-bold text-secondary-foreground bg-secondary/80 border-0',
                        interactive: true,
                    }).on('click', (e) => {
                        L.DomEvent.stopPropagation(e);
                        onEditItem(area);
                    }).openTooltip(center);
                }
            });
        }
    }, [areas, onEditItem, tags]);


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
        if (!map) return;
    
        const cleanupDrawing = () => {
            if (previewLineRef.current) {
                previewLineRef.current.remove();
                previewLineRef.current = null;
            }
            if (distanceTooltipRef.current) {
                map.removeLayer(distanceTooltipRef.current);
                distanceTooltipRef.current = null;
            }
        };
    
        if (isDrawingLine && lineStartPoint) {
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
    
                const distanceMeters = lineStartPoint.distanceTo(center);
                const distance = settings.units === 'imperial' ? toFeet(distanceMeters) : distanceMeters;
                const unitLabel = settings.units === 'imperial' ? 'feet' : 'meters';
                const tooltipContent = `${distance.toFixed(2)} ${unitLabel}`;
    
                if (distanceTooltipRef.current) {
                    distanceTooltipRef.current.setLatLng(center).setContent(tooltipContent);
                } else {
                    distanceTooltipRef.current = L.tooltip({
                        permanent: true,
                        direction: 'right',
                        offset: [10, 0],
                        className: 'distance-tooltip'
                    })
                    .setLatLng(center)
                    .setContent(tooltipContent)
                    .addTo(map);
                }
            };
            
            map.on('move', updatePreviewLine);
            updatePreviewLine(); // Initial draw
    
            return () => {
                map.off('move', updatePreviewLine);
                cleanupDrawing();
            };
        } else {
            cleanupDrawing();
        }
    }, [isDrawingLine, lineStartPoint, settings]);
    
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
    
        const cleanupLayers = () => {
            if (previewAreaRef.current) {
                previewAreaRef.current.remove();
                previewAreaRef.current = null;
            }
            if (previewAreaLineRef.current) {
                previewAreaLineRef.current.remove();
                previewAreaLineRef.current = null;
            }
            if (previewAreaPointsRef.current) {
                previewAreaPointsRef.current.clearLayers();
            }
        };
    
        if (isDrawingArea) {
            const secondaryFgColor = getComputedStyle(document.documentElement).getPropertyValue('--secondary-foreground');
            const secondaryColor = getComputedStyle(document.documentElement).getPropertyValue('--secondary');
            const cornerMarkerOptions: CircleMarkerOptions = {
                radius: 6,
                fillColor: `hsl(${secondaryColor})`,
                color: `hsl(${secondaryFgColor})`,
                weight: 2,
                fillOpacity: 1
            };

            const updatePreview = () => {
                cleanupLayers();
                
                if (previewAreaPointsRef.current) {
                     pendingAreaPath.forEach(point => {
                        L.circleMarker(point, cornerMarkerOptions).addTo(previewAreaPointsRef.current!);
                    });
                }

                if (pendingAreaPath.length > 1) {
                     previewAreaRef.current = L.polygon(pendingAreaPath, {
                        color: `hsl(${secondaryFgColor})`,
                        weight: 2,
                        fillColor: `hsl(${secondaryFgColor})`,
                        fillOpacity: 0.2,
                    }).addTo(map);
                }
    
                const lastPoint = pendingAreaPath[pendingAreaPath.length - 1];
                if (lastPoint) {
                    const center = map.getCenter();
                    const linePath = [lastPoint, center];
                    previewAreaLineRef.current = L.polyline(linePath, {
                        color: `hsl(${secondaryFgColor})`,
                        weight: 2,
                        dashArray: '5, 5',
                    }).addTo(map);
                }
            };
    
            map.on('move', updatePreview);
            updatePreview();
    
            return () => {
                map.off('move', updatePreview);
                cleanupLayers();
            };
        } else {
            cleanupLayers();
        }
    }, [isDrawingArea, pendingAreaPath]);


    useEffect(() => {
        const map = mapRef.current;
        const layer = editingLayerRef.current;
        if (!map || !layer) return;

        layer.clearLayers();
        
        if (editingGeometry) {
            let currentPath = editingGeometry.path.map(p => L.latLng(p.lat, p.lng));
            setEditedPath(editingGeometry.path); // Initialize edited path state

            const isArea = 'fillVisible' in editingGeometry;

            const updateShape = () => {
                const shapeLayer = layer.getLayers().find(l => l instanceof L.Polyline || l instanceof L.Polygon);
                if (shapeLayer) {
                    (shapeLayer as any).setLatLngs(currentPath);
                }
            };
            
            const shape = isArea 
                ? L.polygon(currentPath, { color: 'hsl(var(--primary))', weight: 3, dashArray: '5, 5' }).addTo(layer)
                : L.polyline(currentPath, { color: 'hsl(var(--primary))', weight: 3, dashArray: '5, 5' }).addTo(layer);

            const vertexIcon = createDraggableVertexIcon();

            const markers = currentPath.map((latlng, index) => {
                const marker = L.marker(latlng, {
                    icon: vertexIcon,
                    draggable: true,
                }).addTo(layer);
            
                marker.on('drag', (e) => {
                    currentPath[index] = (e.target as Marker).getLatLng();
                    updateShape();
                });
            
                marker.on('dragend', () => {
                    const newPath = currentPath.map(p => ({ lat: p.lat, lng: p.lng }));
                    setEditedPath(newPath); // Update the state for saving
                });
            
                return marker;
            });
        }
        
        return () => {
            layer.clearLayers();
        }

    }, [editingGeometry]);


    const showPopup = (latlng: LatLng, type: 'pin' | 'line' | 'area', path?: LatLng[]) => {
        const map = mapRef.current;
        if (!map) return;
    
        if (popupRef.current && popupRef.current.isOpen()) {
            map.closePopup();
        }
    
        const formId = `form-${Date.now()}`;
        
        const activeProjectTags = tags.filter(t => t.projectId === activeProjectId);
        const tagOptions = activeProjectTags.map(tag => `<option value="${tag.id}">${tag.name}</option>`).join('');
    
        const content = `
            <form id="${formId}" class="flex flex-col gap-2">
                <input type="text" name="label" placeholder="Enter label" required class="p-2 border rounded-md text-sm bg-background text-foreground border-border" />
                <textarea name="notes" placeholder="Add notes..." class="p-2 border rounded-md text-sm bg-background text-foreground border-border min-h-[60px]"></textarea>
                
                ${tagOptions ? `
                <div class="space-y-1">
                    <label for="tag-select" class="text-xs font-medium text-muted-foreground">Tag</label>
                    <select name="tagId" id="tag-select" class="p-2 border rounded-md text-sm bg-background text-foreground border-border w-full">
                        <option value="">-- No Tag --</option>
                        ${tagOptions}
                    </select>
                </div>
                ` : ''}

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
            if (type === 'area') onAreaCancel();
        };
    
        const cleanup = () => {
            popupRef.current?.off('remove', handleCancel);
        };
    
        popupRef.current.on('remove', handleCancel);
    
        setTimeout(() => {
            const form = document.getElementById(formId);
            const cancelButton = form?.querySelector('.cancel-btn');

            form?.addEventListener('submit', (ev) => {
                ev.preventDefault();
                cleanup();
                const formElements = (ev.target as HTMLFormElement).elements;
                const labelInput = formElements.namedItem('label') as HTMLInputElement;
                const notesInput = formElements.namedItem('notes') as HTMLTextAreaElement;
                const tagSelect = formElements.namedItem('tagId') as HTMLSelectElement | null;
                
                const newId = `${type}-${Date.now()}`;
                const tagId = tagSelect?.value || undefined;
                
                if (type === 'pin') {
                    onPinSave(newId, labelInput.value, latlng.lat, latlng.lng, notesInput.value, tagId);
                } else if (type === 'line' && path) {
                    onLineSave(newId, labelInput.value, path, notesInput.value, tagId);
                } else if (type === 'area' && path) {
                    onAreaSave(newId, labelInput.value, path, notesInput.value, tagId);
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
    }, [pendingPin, tags, activeProjectId]);

    useEffect(() => {
        if (pendingLine && mapRef.current) {
            const midPoint = L.latLng(
                (pendingLine.path[0].lat + pendingLine.path[1].lat) / 2,
                (pendingLine.path[0].lng + pendingLine.path[1].lng) / 2
            );
            showPopup(midPoint, 'line', pendingLine.path);
        }
    }, [pendingLine, tags, activeProjectId]);
    
    useEffect(() => {
        if (pendingArea && mapRef.current) {
             const polygon = L.polygon(pendingArea.path);
             const center = polygon.getBounds().getCenter();
             showPopup(center, 'area', pendingArea.path);
        }
    }, [pendingArea, tags, activeProjectId]);


    return <div ref={mapContainerRef} className="h-full w-full z-0" />;
};

export default Map;
