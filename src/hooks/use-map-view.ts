"use client";

import { useState, useEffect, useCallback } from 'react';
import type { LatLngExpression } from 'leaflet';

export type MapView = {
  center: LatLngExpression;
  zoom: number;
};

const defaultView: MapView = {
  center: [48.8584, 2.2945], // Eiffel Tower
  zoom: 13,
};

export function useMapView(userId: string) {
  const [view, setViewState] = useState<MapView | null>(null);

  useEffect(() => {
    if (!userId) return;
    try {
      const storedView = localStorage.getItem(`map-view-${userId}`);
      if (storedView) {
        setViewState(JSON.parse(storedView));
      } else {
        setViewState(defaultView);
      }
    } catch (error) {
      console.error("Failed to read map view from localStorage", error);
      setViewState(defaultView);
    }
  }, [userId]);

  const setView = useCallback((newView: MapView) => {
    if (!userId) return;
    try {
      localStorage.setItem(`map-view-${userId}`, JSON.stringify(newView));
      setViewState(newView);
    } catch (error) {
      console.error("Failed to save map view to localStorage", error);
    }
  }, [userId]);

  return { view, setView };
}
