"use client";

import { useState, useEffect, useCallback } from 'react';

export type Settings = {
  units: 'metric' | 'imperial';
  coordFormat: 'decimal' | 'dms';
};

const defaultSettings: Settings = {
  units: 'metric',
  coordFormat: 'decimal',
};

export function useSettings() {
  const [settings, setSettingsState] = useState<Settings | null>(null);

  useEffect(() => {
    try {
      const storedSettings = localStorage.getItem('map-settings');
      if (storedSettings) {
        setSettingsState(JSON.parse(storedSettings));
      } else {
        setSettingsState(defaultSettings);
      }
    } catch (error) {
      console.error("Failed to read settings from localStorage", error);
      setSettingsState(defaultSettings);
    }
  }, []);

  const setSettings = useCallback((newSettings: Settings) => {
    try {
      localStorage.setItem('map-settings', JSON.stringify(newSettings));
      setSettingsState(newSettings);
    } catch (error) {
      console.error("Failed to save settings to localStorage", error);
    }
  }, []);

  return { settings, setSettings };
}
