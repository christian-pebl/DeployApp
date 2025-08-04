'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { LatLng, LatLngExpression, Map as LeafletMap, LeafletMouseEvent } from 'leaflet';
import type { User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  writeBatch,
  query,
  where,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  setLogLevel,
  setDoc,
} from 'firebase/firestore';
import { db, auth, app as firebaseApp } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from "@/hooks/use-toast";
import { geocodeAddress } from '@/ai/flows/geocode-address';
import { Loader2, Crosshair, MapPin, Check, Menu, ZoomIn, ZoomOut, Plus, Eye, Pencil, Trash2, X, Search, FolderPlus, User as UserIcon, LogOut, Settings, Star, Copy, Share2, Download, Tag } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ProjectData, PinData, LineData, AreaData, TagData } from '@/ai/flows/share-project';
import { useSettings } from '@/hooks/use-settings';

const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-muted flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>,
});

type Project = ProjectData;
type Pin = PinData;
type Line = LineData;
type Area = AreaData;
type Tag = TagData;

type PendingAction = 'pin' | 'line' | 'area' | null;


export default function MapExplorer({ user }: { user: User }) {
  const [log, setLog] = useState<string[]>(['App Initialized']);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [pins, setPins] = useState<Pin[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [view, setView] = useState<{ center: LatLngExpression; zoom: number }>({
    center: [48.8584, 2.2945],
    zoom: 13,
  });
  const [isLocating, setIsLocating] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<LatLng | null>(null);

  const [pendingPin, setPendingPin] = useState<LatLng | null>(null);
  const [pendingLine, setPendingLine] = useState<{ path: LatLng[] } | null>(null);
  const [pendingArea, setPendingArea] = useState<{ path: LatLng[] } | null>(null);

  const [isDrawingLine, setIsDrawingLine] = useState(false);
  const [lineStartPoint, setLineStartPoint] = useState<LatLng | null>(null);
  
  const [isDrawingArea, setIsDrawingArea] = useState(false);
  const [pendingAreaPath, setPendingAreaPath] = useState<LatLng[]>([]);

  const [currentMapCenter, setCurrentMapCenter] = useState<LatLng | null>(null);
  const [isObjectListOpen, setIsObjectListOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<Pin | Line | Area | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');

  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(['all']);

  const [isAssignProjectDialogOpen, setIsAssignProjectDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [isLogDialogOpen, setIsLogDialogOpen] = useState(false);
  const [isImportProjectDialogOpen, setIsImportProjectDialogOpen] = useState(false);
  const [importCode, setImportCode] = useState('');
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [shareCode, setShareCode] = useState('');
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isManageTagsDialogOpen, setIsManageTagsDialogOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#ff0000');
  const [tagToEdit, setTagToEdit] = useState<Tag | null>(null);
  const { settings } = useSettings();

  const router = useRouter();
  const { toast } = useToast();
  
  const initialLocationFound = useRef(false);
  const mapRef = useRef<LeafletMap | null>(null);

  const addLog = (entry: string) => {
    console.log(entry);
    setLog(prev => [`${new Date().toLocaleTimeString()}: ${entry}`, ...prev]);
  };

  const loadData = async () => {
      if (!user) return;
      addLog(`Loading data for user: ${user.uid}`);
      setDataLoading(true);
      try {
          const projectsQuery = query(collection(db, "projects"), where("userId", "==", user.uid));
          const projectsSnapshot = await getDocs(projectsQuery);
          const loadedProjects = projectsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
          setProjects(loadedProjects);
          addLog(`Loaded ${loadedProjects.length} projects.`);

          const pinsQuery = query(collection(db, "pins"), where("userId", "==", user.uid));
          const pinsSnapshot = await getDocs(pinsQuery);
          const loadedPins = pinsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pin));
          setPins(loadedPins);
          addLog(`Loaded ${loadedPins.length} pins.`);

          const linesQuery = query(collection(db, "lines"), where("userId", "==", user.uid));
          const linesSnapshot = await getDocs(linesQuery);
          const loadedLines = linesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Line));
          setLines(loadedLines);
          addLog(`Loaded ${loadedLines.length} lines.`);

          const areasQuery = query(collection(db, "areas"), where("userId", "==", user.uid));
          const areasSnapshot = await getDocs(areasQuery);
          const loadedAreas = areasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Area));
          setAreas(loadedAreas);
          addLog(`Loaded ${loadedAreas.length} areas.`);
          
          const tagsQuery = query(collection(db, "tags"), where("userId", "==", user.uid));
          const tagsSnapshot = await getDocs(tagsQuery);
          const loadedTags = tagsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tag));
          setTags(loadedTags);
          addLog(`Loaded ${loadedTags.length} tags.`);


      } catch (error: any) {
          addLog(`❌ Error loading data: ${error.message}`);
          toast({ variant: 'destructive', title: "Error loading data", description: "Could not load map data from the server."});
      } finally {
          setDataLoading(false);
          addLog("Finished loading all data.");
      }
  };

  useEffect(() => {
    loadData();
  }, [user]);
  
  useEffect(() => {
      addLog('Attempting to get user location.');
      setIsLocating(true);
  }, []);

 const executePendingAction = () => {
    const action = pendingAction;
    setPendingAction(null);
    addLog(`Executing pending action: ${action}`);
    if (!action || !mapRef.current) {
        if(action) addLog(`Action execution cancelled: map not ready or action cleared.`);
        return;
    }

    const center = mapRef.current.getCenter();
    
    if (action === 'pin') {
        addLog(`Executing pending pin at: ${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`);
        setPendingPin(center);
    } else if (action === 'line') {
        addLog(`Executing pending line from: ${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`);
        setLineStartPoint(center);
        setIsDrawingLine(true);
    } else if (action === 'area') {
        addLog(`Executing pending area.`);
        setIsDrawingArea(true);
        setPendingAreaPath([]);
    }
  };

  const handleLocationFound = (latlng: LatLng) => {
    setCurrentLocation(latlng);
    if (!initialLocationFound.current) {
      addLog(`Initial location found: ${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`);
      setView({ center: latlng, zoom: 15 });
      setIsLocating(false);
      initialLocationFound.current = true;
    }
  };

  const handleLocationError = (error: any) => {
    let errorMsg = `Geolocation error: ${error.message}`;
    if (error.code === 1) { // PERMISSION_DENIED
      errorMsg = "Location access denied. Please enable it in your browser settings.";
    }
    addLog(`Error: ${errorMsg}`);
    if (isLocating) setIsLocating(false);
    toast({ variant: "destructive", title: "Geolocation Error", description: errorMsg });
  };

  const handleLocateMe = () => {
    addLog('Locate me button clicked.');
    if (currentLocation) {
        addLog('Centering view on current location.');
        mapRef.current?.setView(currentLocation, 15, { animate: true });
    } else if (mapRef.current) {
        addLog('Current location not available, re-attempting location.');
        setIsLocating(true);
        mapRef.current.locate({ setView: true, maxZoom: 15 });
    }
  };
  
  const handleShowLog = () => {
    setIsLogDialogOpen(true);
  }
  
  const handleCopyLog = () => {
    navigator.clipboard.writeText(log.join('\n'));
    toast({ title: 'Log Copied', description: 'The event log has been copied to your clipboard.' });
  };

  const handleZoomIn = () => {
    addLog('Zoom in.');
    mapRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    addLog('Zoom out.');
    mapRef.current?.zoomOut();
  };
  
  const handleAddPin = () => {
    addLog('Add Pin action initiated.');
    if (!activeProjectId) {
        addLog('No active project. Prompting to create/select project.');
        setPendingAction('pin');
        setIsAssignProjectDialogOpen(true);
        return;
    }
    if (mapRef.current) {
        const center = mapRef.current.getCenter();
        addLog(`Setting pending pin at: ${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`);
        setPendingPin(center);
    }
  };

  const handleDrawLine = () => {
    addLog('Draw Line action initiated.');
    if (!activeProjectId) {
        addLog('No active project. Prompting to create/select project.');
        setPendingAction('line');
        setIsAssignProjectDialogOpen(true);
        return;
    }
    if (mapRef.current) {
        const center = mapRef.current.getCenter();
        addLog(`Setting line start point at: ${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`);
        setLineStartPoint(center);
        setIsDrawingLine(true);
    }
  };
  
  const handleDrawArea = () => {
    addLog('Draw Area action initiated.');
    if (!activeProjectId) {
        addLog('No active project. Prompting to create/select project.');
        setPendingAction('area');
        setIsAssignProjectDialogOpen(true);
        return;
    }
    addLog('Starting area drawing mode.');
    setIsDrawingArea(true);
    setPendingAreaPath([]);
  }

  const handleConfirmLine = () => {
    if (lineStartPoint && currentMapCenter) {
      addLog(`Confirming line from ${lineStartPoint.lat.toFixed(4)} to ${currentMapCenter.lat.toFixed(4)}.`);
      setPendingLine({ path: [lineStartPoint, currentMapCenter] });
      setIsDrawingLine(false);
      setLineStartPoint(null);
    }
  };
  
  const handleAddAreaCorner = () => {
    if(currentMapCenter) {
      addLog(`Adding area corner at: ${currentMapCenter.lat.toFixed(4)}, ${currentMapCenter.lng.toFixed(4)}`);
      setPendingAreaPath(prev => [...prev, currentMapCenter]);
    }
  }

  const handleConfirmArea = () => {
    if(pendingAreaPath.length < 3) {
        addLog('Area confirmation failed: less than 3 points.');
        toast({ variant: "destructive", title: "Area Incomplete", description: "An area must have at least 3 points."});
        return;
    }
    addLog(`Confirming area with ${pendingAreaPath.length} points.`);
    setPendingArea({ path: pendingAreaPath });
    setIsDrawingArea(false);
    setPendingAreaPath([]);
  }

  const handleMapClick = (e: LeafletMouseEvent) => {
    if (isDrawingArea) {
      addLog(`Area corner added by map click at: ${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`);
      setPendingAreaPath(prev => [...prev, e.latlng]);
    }
  };

  const handlePinSave = async (id: string, label: string, lat: number, lng: number, notes: string, tagId?: string) => {
    if (!activeProjectId) {
        addLog(`❌ [ERROR] Pin save failed: No project ID provided or active.`);
        toast({variant: 'destructive', title: 'Cannot save pin', description: 'No active project selected.'});
        return;
    }

    const newPinData: Omit<Pin, 'id'| 'createdAt'> = { 
      lat, 
      lng, 
      label, 
      labelVisible: true, 
      notes, 
      userId: user.uid, 
      projectId: activeProjectId, 
      tagIds: tagId ? [tagId] : [] 
    };
    
    addLog(`[AWAIT] About to await addDoc(pins)`);
    try {
      addLog(`[DATA] Pin data: ${JSON.stringify(newPinData)}`);
      const docRef = await addDoc(collection(db, "pins"), { ...newPinData, createdAt: serverTimestamp() });
      addLog(`✅ [SUCCESS] Pin saved with ID: ${docRef.id}`);
      const newPin = { ...newPinData, id: docRef.id, createdAt: new Date().toISOString() } as Pin;
      setPins(prev => [...prev, newPin]);
      setPendingPin(null);
      toast({title: 'Pin Saved'});
    } catch(e: any) {
      addLog(`❌ [ERROR] Error saving pin: ${e.message}`);
      toast({variant: 'destructive', title: 'Failed to save pin', description: e.message});
    }
  };

  const handleLineSave = async (id: string, label: string, path: LatLng[], notes: string, tagId?: string) => {
      if (!activeProjectId) {
        addLog(`❌ [ERROR] Line save failed: No project ID provided or active.`);
        toast({variant: 'destructive', title: 'Cannot save line', description: 'No active project selected.'});
        return;
      }

      const pathData = path.map(p => ({ lat: p.lat, lng: p.lng }));
      const newLineData: Omit<Line, 'id' | 'createdAt'> = { 
        path: pathData, 
        label, 
        labelVisible: true, 
        notes, 
        userId: user.uid, 
        projectId: activeProjectId, 
        tagIds: tagId ? [tagId] : [] 
      };

      addLog(`[AWAIT] About to await addDoc(lines)`);
      try {
        addLog(`[DATA] Line data: ${JSON.stringify(newLineData)}`);
        const docRef = await addDoc(collection(db, "lines"), { ...newLineData, createdAt: serverTimestamp() });
        addLog(`✅ [SUCCESS] Line saved with ID: ${docRef.id}`);
        const newLine = { ...newLineData, id: docRef.id, createdAt: new Date().toISOString() } as Line;
        setLines(prev => [...prev, newLine]);
        setPendingLine(null);
        toast({title: 'Line Saved'});
      } catch (e: any) {
        addLog(`❌ [ERROR] Error saving line: ${e.message}`);
        toast({variant: 'destructive', title: 'Failed to save line', description: e.message});
      }
  };
  
  const handleAreaSave = async (id: string, label: string, path: LatLng[], notes: string, tagId?: string) => {
    if (!activeProjectId) {
      addLog(`❌ [ERROR] Area save failed: No project ID provided or active.`);
      toast({variant: 'destructive', title: 'Cannot save area', description: 'No active project selected.'});
      return;
    }
    const pathData = path.map(p => ({ lat: p.lat, lng: p.lng }));
    const newAreaData: Omit<Area, 'id'| 'createdAt'> = { 
      path: pathData, 
      label, 
      labelVisible: true, 
      fillVisible: true, 
      notes, 
      userId: user.uid, 
      projectId: activeProjectId,
      tagIds: tagId ? [tagId] : []
    };
    
    addLog(`[AWAIT] About to await addDoc(areas)`);
    try {
      addLog(`[DATA] Area data: ${JSON.stringify(newAreaData)}`);
      const docRef = await addDoc(collection(db, "areas"), { ...newAreaData, createdAt: serverTimestamp() });
      addLog(`✅ [SUCCESS] Area saved with ID: ${docRef.id}`);
      const newArea = { ...newAreaData, id: docRef.id, createdAt: new Date().toISOString() } as Area;
      setAreas(prev => [...prev, newArea]);
      setPendingArea(null);
      toast({title: 'Area Saved'});
    } catch (e: any) {
      addLog(`❌ [ERROR] Error saving area: ${e.message}`);
      toast({variant: 'destructive', title: 'Failed to save area', description: e.message});
    }
  };

  const handleUpdatePin = async (id: string, label: string, notes: string, projectId?: string, tagIds?: string[]) => {
    const pinRef = doc(db, "pins", id);
    const updatedData: any = { label, notes };
    if (projectId || projectId === '') {
      updatedData.projectId = projectId;
    }
    if (tagIds) {
      updatedData.tagIds = tagIds;
    }
    
    addLog(`[AWAIT] About to await updateDoc(pins) for ID: ${id}`);
    try {
      await updateDoc(pinRef, updatedData);
      addLog(`✅ [SUCCESS] Pin updated for ID: ${id}`);
      setPins(prev => prev.map(p => p.id === id ? { ...p, label, notes, projectId: projectId, tagIds } : p));
      setItemToEdit(null);
      toast({title: 'Pin Updated'});
    } catch (e: any) {
      addLog(`❌ [ERROR] Error updating pin: ${e.message}`);
      toast({variant: 'destructive', title: 'Failed to update pin', description: e.message});
    }
  };

  const handleDeletePin = async (id: string) => {
    addLog(`[AWAIT] About to await deleteDoc(pins) for ID: ${id}`);
    try {
      await deleteDoc(doc(db, "pins", id));
      addLog(`✅ [SUCCESS] Pin deleted for ID: ${id}`);
      setPins(prev => prev.filter(p => p.id !== id));
      setItemToEdit(null);
      toast({title: 'Pin Deleted'});
    } catch(e: any) {
      addLog(`❌ [ERROR] Error deleting pin: ${e.message}`);
      toast({variant: 'destructive', title: 'Failed to delete pin', description: e.message});
    }
  };
  
  const handleUpdateLine = async (id: string, label: string, notes: string, projectId?: string, tagIds?: string[]) => {
    const lineRef = doc(db, "lines", id);
    const updatedData: any = { label, notes };
     if (projectId || projectId === '') {
      updatedData.projectId = projectId;
    }
    if (tagIds) {
      updatedData.tagIds = tagIds;
    }

    addLog(`[AWAIT] About to await updateDoc(lines) for ID: ${id}`);
    try {
      await updateDoc(lineRef, updatedData);
      addLog(`✅ [SUCCESS] Line updated for ID: ${id}`);
      setLines(prev => prev.map(l => l.id === id ? { ...l, label, notes, projectId: projectId, tagIds } : l));
      setItemToEdit(null);
      toast({title: 'Line Updated'});
    } catch(e: any) {
      addLog(`❌ [ERROR] Error updating line: ${e.message}`);
      toast({variant: 'destructive', title: 'Failed to update line', description: e.message});
    }
  };
  
  const handleDeleteLine = async (id: string) => {
    addLog(`[AWAIT] About to await deleteDoc(lines) for ID: ${id}`);
    try {
      await deleteDoc(doc(db, "lines", id));
      addLog(`✅ [SUCCESS] Line deleted for ID: ${id}`);
      setLines(prev => prev.filter(l => l.id !== id));
      setItemToEdit(null);
      toast({title: 'Line Deleted'});
    } catch (e: any) {
      addLog(`❌ [ERROR] Error deleting line: ${e.message}`);
      toast({variant: 'destructive', title: 'Failed to delete line', description: e.message});
    }
  };

  const handleUpdateArea = async (id: string, label: string, notes: string, path: {lat: number, lng: number}[], projectId?: string, tagIds?: string[]) => {
    const areaRef = doc(db, "areas", id);
    const updatedData: any = { label, notes, path };
    if (projectId || projectId === '') {
      updatedData.projectId = projectId;
    }
    if (tagIds) {
      updatedData.tagIds = tagIds;
    }

    addLog(`[AWAIT] About to await updateDoc(areas) for ID: ${id}`);
    try {
      await updateDoc(areaRef, updatedData);
      addLog(`✅ [SUCCESS] Area updated for ID: ${id}`);
      setAreas(prev => prev.map(a => a.id === id ? { ...a, label, notes, path, projectId: projectId, tagIds } : a));
      setItemToEdit(null);
      toast({title: 'Area Updated'});
    } catch (e: any) {
      addLog(`❌ [ERROR] Error updating area: ${e.message}`);
      toast({variant: 'destructive', title: 'Failed to update area', description: e.message});
    }
  };

  const handleDeleteArea = async (id: string) => {
    addLog(`[AWAIT] About to await deleteDoc(areas) for ID: ${id}`);
    try {
      await deleteDoc(doc(db, "areas", id));
      addLog(`✅ [SUCCESS] Area deleted for ID: ${id}`);
      setAreas(prev => prev.filter(a => a.id !== id));
      setItemToEdit(null);
      toast({title: 'Area Deleted'});
    } catch(e: any) {
       addLog(`❌ [ERROR] Error deleting area: ${e.message}`);
       toast({variant: 'destructive', title: 'Failed to delete area', description: e.message});
    }
  };

  const handleToggleLabel = (id: string, type: 'pin' | 'line' | 'area') => {
    addLog(`Toggling label visibility for ${type} ID: ${id}`);
    if (type === 'pin') {
      setPins(pins.map(p => p.id === id ? { ...p, labelVisible: !(p.labelVisible ?? true) } : p));
    } else if (type === 'line') {
      setLines(lines.map(l => l.id === id ? { ...l, labelVisible: !(l.labelVisible ?? true) } : l));
    } else {
      setAreas(areas.map(a => a.id === id ? { ...a, labelVisible: !(a.labelVisible ?? true) } : a));
    }
    setItemToEdit(null);
  };
  
  const handleToggleFill = (id: string) => {
    addLog(`Toggling fill visibility for area ID: ${id}`);
    setAreas(areas.map(a => a.id === id ? { ...a, fillVisible: !(a.fillVisible ?? true) } : a));
    setItemToEdit(null);
  };

  const handleViewItem = (item: Pin | Line | Area) => {
    addLog(`Viewing item: "${item.label}" (ID: ${item.id})`);
    const map = mapRef.current;
    if (!map) return;
    if ('lat' in item) {
      map.setView([item.lat, item.lng], 17);
    } else {
       map.fitBounds(item.path.map(p => [p.lat, p.lng]) as [[number, number]]);
    }
    setIsObjectListOpen(false);
  }

  const handleEditItem = (item: Pin | Line | Area | null) => {
    addLog(item ? `Editing item: "${item.label}" (ID: ${item.id})` : 'Closing edit popup.');
    setItemToEdit(item);
  }

  const handleSearch = async () => {
    if (!searchQuery) return;
    addLog(`Searching for: ${searchQuery}`);
    setIsSearching(true);
    const map = mapRef.current;
    if (!map) {
        addLog('Search failed: Map not ready.');
        setIsSearching(false);
        return;
    }

    const latLngRegex = /^(-?\d{1,3}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)$/;
    const match = searchQuery.match(latLngRegex);
    if (match) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            addLog(`Found coordinates in search query. Panning to ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
            map.setView([lat, lng], 15);
            setIsSearching(false);
            return;
        }
    }

    const lowerCaseQuery = searchQuery.toLowerCase();
    const item = [...pins, ...lines, ...areas].find(i => i.label.toLowerCase() === lowerCaseQuery);
    if (item) {
        addLog(`Found object by label: "${item.label}"`);
        handleViewItem(item);
        setIsSearching(false);
        return;
    }

    try {
        addLog(`No object found locally. Attempting to geocode address: "${searchQuery}"`);
        const result = await geocodeAddress({ address: searchQuery });
        if (result.latitude && result.longitude) {
            addLog(`Geocoding successful. Panning to ${result.latitude.toFixed(4)}, ${result.longitude.toFixed(4)}`);
            map.setView([result.latitude, result.longitude], 15);
        } else {
            throw new Error('Geocoding failed to return coordinates.');
        }
    } catch (error: any) {
        addLog(`Error during geocoding: ${error.message}`);
        toast({
            variant: "destructive",
            title: "Search Failed",
            description: `Could not find a location or object for "${searchQuery}".`,
        });
    } finally {
        setIsSearching(false);
    }
  };

  const handleCreateNewProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName) {
        toast({variant: 'destructive', title: 'Project Name Required'});
        return;
    }
    
    setLogLevel('debug');
    
    const projectsRef = collection(db, 'projects');
    
    const payload: Omit<Project, 'id' | 'createdAt'> = {
        name: newProjectName,
        description: newProjectDescription,
        userId: auth.currentUser!.uid,
    };
    
    try {
      addLog("[AWAIT] About to await addDoc(projects)");
      const docRef = await addDoc(projectsRef, { ...payload, createdAt: serverTimestamp() });
      addLog(`✅ [SUCCESS] doc written, ID = ${docRef.id}`);
      
      const newProject = { ...payload, id: docRef.id, createdAt: new Date().toISOString() } as Project;
      setProjects(prev => [...prev, newProject]);
      setActiveProjectId(docRef.id);
      setIsNewProjectDialogOpen(false);
      setNewProjectName('');
      setNewProjectDescription('');
      toast({ title: "Project Created", description: `"${newProjectName}" has been created and set as active.` });

      if (pendingAction) {
        executePendingAction();
      }
    } catch (err: any) {
      addLog(`❌ [ERROR] addDoc failed: ${err.message}`);
      toast({variant: 'destructive', title: 'Failed to create project', description: err.message});
    }
  };
  
  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectToEdit) return;

    const name = (e.currentTarget.elements.namedItem('name') as HTMLInputElement).value;
    const description = (e.currentTarget.elements.namedItem('description') as HTMLTextAreaElement).value;
    
    if (!name) {
      toast({variant: 'destructive', title: 'Project Name Required'});
      return;
    }
    
    const projectRef = doc(db, "projects", projectToEdit.id);
    addLog(`[AWAIT] About to await updateDoc(projects) for ID: ${projectToEdit.id}`);
    try {
      await updateDoc(projectRef, { name, description });
      addLog(`✅ [SUCCESS] Project updated for ID: ${projectToEdit.id}`);
      setProjects(projects.map(p => p.id === projectToEdit.id ? { ...p, name, description } : p));
      setProjectToEdit(null);
      toast({ title: "Project Updated", description: `"${name}" has been updated.` });
    } catch (e: any) {
      addLog(`❌ [ERROR] Error updating project: ${e.message}`);
      toast({variant: 'destructive', title: 'Failed to update project', description: e.message});
    }
  }
  
  const handleDeleteProject = async (projectId: string) => {
      const project = projects.find(p => p.id === projectId);
      if(!project) return;
      
      addLog(`[AWAIT] About to await batch commit for project deletion, ID: ${projectId}`);
      try {
        const batch = writeBatch(db);
        
        batch.delete(doc(db, "projects", projectId));
        addLog(` - Marked project for deletion.`);

        const associatedPins = pins.filter(p => p.projectId === projectId);
        associatedPins.forEach(p => batch.delete(doc(db, "pins", p.id)));
        addLog(` - Marked ${associatedPins.length} pins for deletion.`);

        const associatedLines = lines.filter(l => l.projectId === projectId);
        associatedLines.forEach(l => batch.delete(doc(db, "lines", l.id)));
        addLog(` - Marked ${associatedLines.length} lines for deletion.`);

        const associatedAreas = areas.filter(a => a.projectId === projectId);
        associatedAreas.forEach(a => batch.delete(doc(db, "areas", a.id)));
        addLog(` - Marked ${associatedAreas.length} areas for deletion.`);
        
        const associatedTags = tags.filter(t => t.projectId === projectId);
        associatedTags.forEach(t => batch.delete(doc(db, "tags", t.id)));
        addLog(` - Marked ${associatedTags.length} tags for deletion.`);

        await batch.commit();
        addLog(`✅ [SUCCESS] Batch commit successful.`);

        setProjects(prev => prev.filter(p => p.id !== projectId));
        setPins(prev => prev.filter(p => p.projectId !== projectId));
        setLines(prev => prev.filter(l => l.projectId !== projectId));
        setAreas(prev => prev.filter(a => a.projectId !== projectId));
        setTags(prev => prev.filter(t => t.projectId !== projectId));
        
        if (activeProjectId === projectId) {
            setActiveProjectId(null);
        }
        setSelectedProjectIds(prev => prev.filter(id => id !== projectId));
        
        toast({ title: "Project Deleted", description: `"${project.name}" and all its objects have been deleted.` });

      } catch (e: any) {
        addLog(`❌ [ERROR] Error deleting project: ${e.message}`);
        toast({variant: 'destructive', title: 'Failed to delete project', description: e.message});
      }
  }
  
  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName || !activeProjectId) return;

    const payload: Omit<Tag, 'id'> = {
        name: newTagName,
        color: newTagColor,
        projectId: activeProjectId,
        userId: user.uid,
    };
    
    try {
      const docRef = await addDoc(collection(db, "tags"), payload);
      const newTag = { ...payload, id: docRef.id };
      setTags(prev => [...prev, newTag]);
      setNewTagName('');
      setNewTagColor('#ff0000');
      toast({ title: "Tag Created" });
    } catch(e: any) {
      toast({ variant: 'destructive', title: 'Failed to create tag' });
    }
  }
  
  const handleUpdateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagToEdit) return;

    const name = (e.currentTarget.elements.namedItem('name') as HTMLInputElement).value;
    const color = (e.currentTarget.elements.namedItem('color') as HTMLInputElement).value;

    const tagRef = doc(db, "tags", tagToEdit.id);
    try {
      await updateDoc(tagRef, { name, color });
      setTags(tags.map(t => t.id === tagToEdit.id ? { ...t, name, color } : t));
      setTagToEdit(null);
      toast({ title: "Tag Updated" });
    } catch (e: any) {
       toast({ variant: 'destructive', title: 'Failed to update tag' });
    }
  };
  
  const handleDeleteTag = async (tagId: string) => {
    try {
        const batch = writeBatch(db);
        
        // Delete the tag itself
        batch.delete(doc(db, "tags", tagId));

        // Remove the tagId from all objects in the same project
        const projectId = tags.find(t => t.id === tagId)?.projectId;
        if(projectId) {
            const projectPins = pins.filter(p => p.projectId === projectId && p.tagIds?.includes(tagId));
            projectPins.forEach(p => {
                const newTagIds = p.tagIds?.filter(id => id !== tagId);
                batch.update(doc(db, "pins", p.id), { tagIds: newTagIds });
            });

            const projectLines = lines.filter(l => l.projectId === projectId && l.tagIds?.includes(tagId));
            projectLines.forEach(l => {
                const newTagIds = l.tagIds?.filter(id => id !== tagId);
                batch.update(doc(db, "lines", l.id), { tagIds: newTagIds });
            });

            const projectAreas = areas.filter(a => a.projectId === projectId && a.tagIds?.includes(tagId));
            projectAreas.forEach(a => {
                const newTagIds = a.tagIds?.filter(id => id !== tagId);
                batch.update(doc(db, "areas", a.id), { tagIds: newTagIds });
            });
        }
        
        await batch.commit();

        setTags(prev => prev.filter(t => t.id !== tagId));
        await loadData(); // Reload data to get updated objects
        toast({ title: "Tag Deleted" });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Failed to delete tag' });
    }
  };


  const getObjectCountForProject = (projectId: string) => {
      return pins.filter(p => p.projectId === projectId).length +
             lines.filter(l => l.projectId === projectId).length +
             areas.filter(a => a.projectId === projectId).length;
  }
  
  const unassignedObjectCount = useMemo(() => {
    return pins.filter(p => !p.projectId).length +
           lines.filter(l => !l.projectId).length +
           areas.filter(a => !a.projectId).length;
  }, [pins, lines, areas]);

  const displayedPins = useMemo(() => {
    if (selectedProjectIds.includes('all')) return pins;
    return pins.filter(p => (p.projectId && selectedProjectIds.includes(p.projectId)) || (!p.projectId && selectedProjectIds.includes('unassigned')));
  }, [pins, selectedProjectIds]);

  const displayedLines = useMemo(() => {
    if (selectedProjectIds.includes('all')) return lines;
    return lines.filter(l => (l.projectId && selectedProjectIds.includes(l.projectId)) || (!l.projectId && selectedProjectIds.includes('unassigned')));
  }, [lines, selectedProjectIds]);

  const displayedAreas = useMemo(() => {
    if (selectedProjectIds.includes('all')) return areas;
    return areas.filter(a => (a.projectId && selectedProjectIds.includes(a.projectId)) || (!a.projectId && selectedProjectIds.includes('unassigned')));
  }, [areas, selectedProjectIds]);
  
  const handleProjectSelection = (id: string) => {
    setSelectedProjectIds(currentSelection => {
        let newSelection;

        const isAllSelected = currentSelection.includes('all');
        addLog(`Project visibility change. Current: [${currentSelection.join(', ')}]. Toggled: ${id}`);

        if (id === 'all') {
            newSelection = isAllSelected ? [] : ['all'];
        } else {
            if (isAllSelected) {
                 newSelection = [id];
            } else {
                if (currentSelection.includes(id)) {
                    newSelection = currentSelection.filter(pId => pId !== id);
                } else {
                    newSelection = [...currentSelection, id];
                }
            }
        }
        
        const allProjectIds = projects.map(p => p.id);
        const allPossibleSelections = unassignedObjectCount > 0 ? [...allProjectIds, 'unassigned'] : allProjectIds;

        if (newSelection.length === allPossibleSelections.length && !isAllSelected) {
            newSelection = ['all'];
        }
        
        if (newSelection.length === 0 && !isAllSelected) {
            newSelection = ['all'];
        }
        
        addLog(`New visibility selection: [${newSelection.join(', ')}]`);
        return newSelection;
    });
};

const handleLogout = async () => {
    addLog('User logging out.');
    await signOut(auth);
    router.push('/login');
};

const handleGenerateShareCode = async (projectId: string) => {
  setIsGeneratingCode(true);
  addLog(`[SHARE_CLIENT] 1. Starting code generation for project ID: ${projectId}`);
  
  const sharePayload = {
    projectId: projectId,
    originalOwnerId: user.uid,
    createdAt: serverTimestamp(),
  };

  const shareLookupPayload = {
      createdAt: serverTimestamp(),
  };

  try {
    addLog(`[SHARE_CLIENT] 2. Attempting to write to 'shares' and 'shares_by_project' collections`);
    const batch = writeBatch(db);
    
    // Create the share document
    const shareRef = doc(collection(db, 'shares'));
    batch.set(shareRef, sharePayload);
    addLog(`   - Queued write to /shares/${shareRef.id}`);
    
    // Create the lookup document for security rules
    const shareLookupRef = doc(db, 'shares_by_project', projectId);
    batch.set(shareLookupRef, shareLookupPayload);
    addLog(`   - Queued write to /shares_by_project/${projectId}`);
    
    await batch.commit();

    addLog(`[SHARE_CLIENT] 3. ✅ Successfully created share document with ID: ${shareRef.id}`);
    setShareCode(shareRef.id);
    setIsShareDialogOpen(true);
  } catch (error: any) {
    addLog(`[SHARE_CLIENT] 4. ❌ Error generating share code: ${error.message}`);
    toast({ variant: 'destructive', title: 'Could not generate share code', description: error.message });
  } finally {
    addLog(`[SHARE_CLIENT] 5. Finished code generation attempt.`);
    setIsGeneratingCode(false);
  }
};


const handleImportProject = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!importCode) return;
  setIsImporting(true);
  addLog(`[IMPORT_CLIENT] 1. Starting import for share code: ${importCode}`);
  
  try {
    const shareRef = doc(db, 'shares', importCode);
    addLog(`[IMPORT_CLIENT] 2. Fetching share document: /shares/${importCode}`);
    const shareSnap = await getDoc(shareRef);

    if (!shareSnap.exists()) {
      addLog(`[IMPORT_CLIENT] ❌ Share code not found.`);
      throw new Error('Invalid share code. Please check the code and try again.');
    }
    addLog(`[IMPORT_CLIENT] 3. ✅ Share document found.`);
    
    const shareData = shareSnap.data();
    const projectId = shareData.projectId;
    addLog(`[IMPORT_CLIENT] 4. Original project ID from share: ${projectId}`);

    // Get project
    addLog(`[IMPORT_CLIENT] 5. Fetching original project document: /projects/${projectId}`);
    const projectRef = doc(db, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);
    if (!projectSnap.exists()) {
      addLog(`[IMPORT_CLIENT] ❌ Original project with ID ${projectId} not found. It may have been deleted by the owner.`);
      throw new Error('Original project not found. It may have been deleted by the owner.');
    }
    const project = { id: projectSnap.id, ...projectSnap.data() } as Project;
    addLog(`[IMPORT_CLIENT] 6. ✅ Successfully fetched project: "${project.name}"`);

    // Get associated objects
    addLog(`[IMPORT_CLIENT] 7. Fetching associated data for project ${projectId}...`);
    const pinsQuery = query(collection(db, 'pins'), where('projectId', '==', projectId));
    const linesQuery = query(collection(db, 'lines'), where('projectId', '==', projectId));
    const areasQuery = query(collection(db, 'areas'), where('projectId', '==', projectId));
    const tagsQuery = query(collection(db, 'tags'), where('projectId', '==', projectId));
    
    const [pinsSnapshot, linesSnapshot, areasSnapshot, tagsSnapshot] = await Promise.all([
        getDocs(pinsQuery),
        getDocs(linesQuery),
        getDocs(areasQuery),
        getDocs(tagsQuery),
    ]);
    
    const importedPins = pinsSnapshot.docs.map(d => ({id: d.id, ...d.data()}) as Pin);
    const importedLines = linesSnapshot.docs.map(d => ({id: d.id, ...d.data()}) as Line);
    const importedAreas = areasSnapshot.docs.map(d => ({id: d.id, ...d.data()}) as Area);
    const importedTags = tagsSnapshot.docs.map(d => ({id: d.id, ...d.data()}) as Tag);
    addLog(`   - Found ${importedPins.length} pins, ${importedLines.length} lines, ${importedAreas.length} areas, ${importedTags.length} tags.`);

    addLog(`[IMPORT_CLIENT] 8. Creating batch write for import...`);
    const batch = writeBatch(db);

    const newProjectRef = doc(collection(db, 'projects'));
    batch.set(newProjectRef, {
      name: `Copy of ${project.name}`,
      description: project.description,
      userId: user.uid,
      createdAt: serverTimestamp(),
    });
    addLog(`   - Queued new project for creation with ID: ${newProjectRef.id}`);

    const newTagIdMap = new Map<string, string>();
    
    importedTags.forEach(tag => {
      const { id, userId, ...rest } = tag;
      const newTagRef = doc(collection(db, 'tags'));
      newTagIdMap.set(id, newTagRef.id);
      batch.set(newTagRef, { ...rest, projectId: newProjectRef.id, userId: user.uid });
    });
    addLog(`   - Queued ${importedTags.length} tags for creation.`);

    importedPins.forEach(pin => {
      const { id, userId, createdAt, ...rest } = pin;
      const newTagIds = pin.tagIds?.map(oldId => newTagIdMap.get(oldId)).filter(Boolean) as string[];
      batch.set(doc(collection(db, 'pins')), { ...rest, projectId: newProjectRef.id, userId: user.uid, tagIds: newTagIds || [], createdAt: serverTimestamp() });
    });
    addLog(`   - Queued ${importedPins.length} pins for creation.`);
    
    importedLines.forEach(line => {
      const { id, userId, createdAt, ...rest } = line;
      const newTagIds = line.tagIds?.map(oldId => newTagIdMap.get(oldId)).filter(Boolean) as string[];
      batch.set(doc(collection(db, 'lines')), { ...rest, projectId: newProjectRef.id, userId: user.uid, tagIds: newTagIds || [], createdAt: serverTimestamp() });
    });
     addLog(`   - Queued ${importedLines.length} lines for creation.`);

    importedAreas.forEach(area => {
       const { id, userId, createdAt, ...rest } = area;
       const newTagIds = area.tagIds?.map(oldId => newTagIdMap.get(oldId)).filter(Boolean) as string[];
      batch.set(doc(collection(db, 'areas')), { ...rest, projectId: newProjectRef.id, userId: user.uid, tagIds: newTagIds || [], createdAt: serverTimestamp() });
    });
    addLog(`   - Queued ${importedAreas.length} areas for creation.`);

    addLog(`[IMPORT_CLIENT] 9. Committing batch write...`);
    await batch.commit();
    addLog(`[IMPORT_CLIENT] 10. ✅ Batch commit successful.`);
    
    await loadData();
    addLog(`[IMPORT_CLIENT] 11. ✅ Data reloaded.`);
    
    toast({ title: 'Project Imported', description: `Successfully imported "${project.name}".` });
    setIsImportProjectDialogOpen(false);
    setImportCode('');
  } catch (error: any) {
    addLog(`[IMPORT_CLIENT] ❌ Import failed: ${error.message}`);
    toast({ variant: 'destructive', title: 'Import Failed', description: error.message });
  } finally {
    setIsImporting(false);
  }
};


if (dataLoading || !settings) {
    return (
      <div className="w-full h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
}

  const activeProjectTags = tags.filter(t => t.projectId === activeProjectId);

  return (
    <div className="h-screen w-screen flex bg-background font-body relative overflow-hidden">
       
      <main className="flex-1 flex flex-col relative h-full">
        <div className="flex-1 relative">
            <Map
              mapRef={mapRef}
              center={view.center}
              zoom={view.zoom}
              pins={displayedPins}
              lines={displayedLines}
              areas={displayedAreas}
              projects={projects}
              tags={tags}
              settings={settings}
              currentLocation={currentLocation}
              onLocationFound={handleLocationFound}
              onLocationError={handleLocationError}
              onMove={(center) => setCurrentMapCenter(center)}
              isDrawingLine={isDrawingLine}
              lineStartPoint={lineStartPoint}
              isDrawingArea={isDrawingArea}
              onMapClick={handleMapClick}
              pendingAreaPath={pendingAreaPath}
              pendingPin={pendingPin}
              onPinSave={handlePinSave}
              onPinCancel={() => { addLog('Pin creation cancelled.'); setPendingPin(null);}}
              pendingLine={pendingLine}
              onLineSave={handleLineSave}
              onLineCancel={() => {addLog('Line creation cancelled.'); setIsDrawingLine(false); setLineStartPoint(null); setPendingLine(null);}}
              pendingArea={pendingArea}
              onAreaSave={handleAreaSave}
              onAreaCancel={() => {addLog('Area creation cancelled.'); setIsDrawingArea(false); setPendingAreaPath([]); setPendingArea(null);}}
              onUpdatePin={handleUpdatePin}
              onDeletePin={handleDeletePin}
              onUpdateLine={handleUpdateLine}
              onDeleteLine={handleDeleteLine}
              onUpdateArea={handleUpdateArea}
              onDeleteArea={handleDeleteArea}
              onToggleLabel={handleToggleLabel}
              onToggleFill={handleToggleFill}
              itemToEdit={itemToEdit}
              onEditItem={handleEditItem}
              activeProjectId={activeProjectId}
            />
            
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000] pointer-events-none">
                <Plus className="h-8 w-8 text-blue-500" />
            </div>

            <div className="absolute top-4 left-4 z-[1001] flex flex-col gap-2">
              <div className="flex w-full max-w-sm items-center space-x-2 bg-background/90 backdrop-blur-sm p-2 rounded-lg shadow-lg border">
                  <Input
                      type="text"
                      placeholder="Search address or label..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      className="border-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
                  />
                  <Button type="submit" size="icon" onClick={handleSearch} disabled={isSearching} className="h-9 w-9 flex-shrink-0">
                      {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
                 <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="default" size="icon" className="h-12 w-12 rounded-full shadow-lg" onClick={handleAddPin}>
                                <MapPin className="h-6 w-6" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Add a Pin</p></TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="default" size="icon" className="h-12 w-12 rounded-full shadow-lg" onClick={handleDrawLine}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 stroke-current">
                                    <path d="M4 20L20 4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    <circle cx="3.5" cy="20.5" r="2.5" fill="currentColor" stroke="currentColor" strokeWidth="1.5"/>
                                    <circle cx="20.5" cy="3.5" r="2.5" fill="currentColor" stroke="currentColor" strokeWidth="1.5"/>
                                </svg>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Draw a Line</p></TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                             <Button variant="default" size="icon" className="h-12 w-12 rounded-full shadow-lg" onClick={handleDrawArea}>
                                <svg width="24" height="24" viewBox="0 0 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-6 w-6">
                                    <path d="M2.57141 6.28571L8.2857 2.57143L20.5714 8.28571L14.8571 21.4286L2.57141 15.7143L2.57141 6.28571Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                                </svg>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Draw an Area</p></TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="default" size="icon" className="h-12 w-12 rounded-full shadow-lg" onClick={() => setIsObjectListOpen(true)}>
                                <Menu className="h-6 w-6" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>List Objects</p></TooltipContent>
                    </Tooltip>
                     <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="default" 
                            size="icon" 
                            className="h-12 w-12 rounded-full shadow-lg"
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

            {isObjectListOpen && (
              <Card className="absolute top-4 left-20 z-[1002] w-[450px] h-[calc(100%-2rem)] flex flex-col bg-card/90 backdrop-blur-sm">
                <div className="p-4 border-b flex justify-between items-center">
                    <h2 className="text-lg font-semibold">Map Objects</h2>
                    <Button variant="ghost" size="icon" onClick={() => setIsObjectListOpen(false)} className="h-8 w-8">
                        <X className="h-4 w-4" />
                    </Button>
                </div>
                
                <div className="p-4 border-b space-y-2">
                    <div className='flex justify-between items-center'>
                        <h3 className="text-md font-semibold">Projects</h3>
                        <div className='flex items-center gap-2'>
                           <Button variant="outline" size='sm' onClick={() => setActiveProjectId(null)} disabled={!activeProjectId}>Clear Active</Button>
                            <Button variant="outline" size="sm" onClick={() => setIsNewProjectDialogOpen(true)}>
                                <FolderPlus className="mr-2 h-4 w-4"/> New
                            </Button>
                             <Button variant="outline" size="sm" onClick={() => setIsImportProjectDialogOpen(true)}>
                                <Download className="mr-2 h-4 w-4"/> Import
                            </Button>
                        </div>
                    </div>
                     <div className="flex justify-between items-center border-t -mx-4 px-4 pt-4 mt-2">
                        <div className="flex items-center space-x-2">
                            <Checkbox 
                                id="toggle-all-visibility" 
                                checked={selectedProjectIds.includes('all')}
                                onCheckedChange={() => handleProjectSelection('all')}
                            />
                            <label
                                htmlFor="toggle-all-visibility"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                                All Projects Visible
                            </label>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => {if (activeProjectId) { setIsManageTagsDialogOpen(true); } else { toast({ variant: 'destructive', title: 'No Active Project', description: 'Please select an active project to manage its tags.'})}}}>
                            <Tag className="mr-2 h-4 w-4"/> Manage Tags
                        </Button>
                    </div>
                    <ScrollArea className="h-32 -mx-4 px-4">
                        <ul className="space-y-2 pt-2">
                            {projects.map(project => (
                                <li key={project.id} className={cn("flex items-center justify-between p-2 rounded-md border", activeProjectId === project.id ? 'bg-primary/10' : 'bg-card/50')}>
                                    <div className="flex items-center gap-3 truncate pr-2">
                                        <Checkbox
                                            id={`vis-${project.id}`}
                                            checked={selectedProjectIds.includes('all') || selectedProjectIds.includes(project.id)}
                                            onCheckedChange={() => handleProjectSelection(project.id)}
                                        />
                                        <div className="space-y-0.5">
                                            <label htmlFor={`vis-${project.id}`} className="font-medium text-sm cursor-pointer">{project.name}</label>
                                            <p className="text-xs text-muted-foreground">{getObjectCountForProject(project.id)} objects</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button variant={activeProjectId === project.id ? "default" : "ghost"} size="icon" className="h-7 w-7" onClick={() => { addLog(`Setting active project to: "${project.name}"`); setActiveProjectId(project.id);}}>
                                                <Star className={cn("h-4 w-4", activeProjectId === project.id ? "text-primary-foreground" : "")}/>
                                              </Button>
                                            </TooltipTrigger>
                                            <TooltipContent side="top"><p>Set Active</p></TooltipContent>
                                          </Tooltip>
                                          <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleGenerateShareCode(project.id)} disabled={isGeneratingCode}>
                                                        {isGeneratingCode ? <Loader2 className="h-4 w-4 animate-spin"/> : <Share2 className="h-4 w-4"/>}
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent side="top"><p>Share</p></TooltipContent>
                                            </Tooltip>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                               <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setProjectToEdit(project) }}><Pencil className="h-4 w-4"/></Button>
                                            </TooltipTrigger>
                                            <TooltipContent side="top"><p>Edit</p></TooltipContent>
                                          </Tooltip>
                                          <AlertDialog>
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <AlertDialogTrigger asChild>
                                                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4"/></Button>
                                                  </AlertDialogTrigger>
                                                </TooltipTrigger>
                                                <TooltipContent side="top"><p>Delete</p></TooltipContent>
                                              </Tooltip>
                                              <AlertDialogContent className="z-[1004]">
                                                  <AlertDialogHeader>
                                                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                      <AlertDialogDescription>
                                                          This will permanently delete the project "{project.name}" and all {getObjectCountForProject(project.id)} of its associated map objects. This action cannot be undone.
                                                      </AlertDialogDescription>
                                                  </AlertDialogHeader>
                                                  <AlertDialogFooter>
                                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                      <AlertDialogAction onClick={() => handleDeleteProject(project.id)}>Delete</AlertDialogAction>
                                                  </AlertDialogFooter>
                                              </AlertDialogContent>
                                          </AlertDialog>
                                        </TooltipProvider>
                                    </div>
                                </li>
                            ))}
                             {unassignedObjectCount > 0 && (
                                <li className="flex items-center justify-between p-2 rounded-md border bg-card/50">
                                    <div className="flex items-center gap-3 truncate pr-2">
                                        <Checkbox
                                            id="vis-unassigned"
                                            checked={selectedProjectIds.includes('all') || selectedProjectIds.includes('unassigned')}
                                            onCheckedChange={() => handleProjectSelection('unassigned')}
                                        />
                                        <div className="space-y-0.5">
                                            <label htmlFor="vis-unassigned" className="font-medium text-sm cursor-pointer">Unassigned</label>
                                            <p className="text-xs text-muted-foreground">{unassignedObjectCount} objects</p>
                                        </div>
                                    </div>
                                </li>
                            )}
                            {projects.length === 0 && unassignedObjectCount === 0 && (
                                <div className="text-center text-muted-foreground py-4">
                                    <p>No projects yet.</p>
                                </div>
                            )}
                        </ul>
                    </ScrollArea>
                </div>
                
                <TooltipProvider>
                  <ScrollArea className="flex-1">
                      <div className="p-4 space-y-4">
                          <div>
                            <h3 className="text-lg font-semibold mb-2">Pins</h3>
                            {displayedPins.length > 0 ? (
                                <ul className="space-y-2">
                                    {displayedPins.map(pin => (
                                        <li key={pin.id} className="flex items-center justify-between p-2 rounded-md border bg-card">
                                            <span className="font-medium truncate pr-2">{pin.label}</span>
                                            <div className="flex items-center gap-1">
                                                <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleViewItem(pin)}><Eye className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent><p>View</p></TooltipContent></Tooltip>
                                                <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditItem(pin)}><Pencil className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent><p>Edit</p></TooltipContent></Tooltip>
                                                <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeletePin(pin.id)}><Trash2 className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent><p>Delete</p></TooltipContent></Tooltip>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : <p className="text-sm text-muted-foreground">No pins found.</p>}
                          </div>
                          
                          <Separator />

                          <div>
                            <h3 className="text-lg font-semibold mb-2">Lines</h3>
                            {displayedLines.length > 0 ? (
                                <ul className="space-y-2">
                                    {displayedLines.map(line => (
                                        <li key={line.id} className="flex items-center justify-between p-2 rounded-md border bg-card">
                                            <span className="font-medium truncate pr-2">{line.label}</span>
                                            <div className="flex items-center gap-1">
                                                <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleViewItem(line)}><Eye className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent><p>View</p></TooltipContent></Tooltip>
                                                <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditItem(line)}><Pencil className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent><p>Edit</p></TooltipContent></Tooltip>
                                                <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteLine(line.id)}><Trash2 className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent><p>Delete</p></TooltipContent></Tooltip>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : <p className="text-sm text-muted-foreground">No lines found.</p>}
                          </div>
                          
                          <Separator />

                          <div>
                            <h3 className="text-lg font-semibold mb-2">Areas</h3>
                             {displayedAreas.length > 0 ? (
                                <ul className="space-y-2">
                                    {displayedAreas.map(area => (
                                        <li key={area.id} className="flex items-center justify-between p-2 rounded-md border bg-card">
                                            <span className="font-medium truncate pr-2">{area.label}</span>
                                            <div className="flex items-center gap-1">
                                                <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleViewItem(area)}><Eye className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent><p>View</p></TooltipContent></Tooltip>
                                                <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditItem(area)}><Pencil className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent><p>Edit</p></TooltipContent></Tooltip>
                                                <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteArea(area.id)}><Trash2 className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent><p>Delete</p></TooltipContent></Tooltip>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : <p className="text-sm text-muted-foreground">No areas found.</p>}
                          </div>
                      </div>
                  </ScrollArea>
                </TooltipProvider>
              </Card>
            )}
            
            {isDrawingLine && (
                <Button 
                    className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] h-12 rounded-md shadow-lg bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={handleConfirmLine}
                >
                    <Check className="mr-2 h-5 w-5" /> Confirm Line
                </Button>
            )}

            {isDrawingArea && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] flex gap-2">
                    <Button 
                        className="h-12 rounded-md shadow-lg bg-secondary text-secondary-foreground hover:bg-secondary/80"
                        onClick={handleAddAreaCorner}
                    >
                        <Plus className="mr-2 h-5 w-5" /> Add Corner
                    </Button>
                    <Button 
                        className="h-12 rounded-md shadow-lg bg-primary text-primary-foreground hover:bg-primary/90"
                        onClick={handleConfirmArea}
                        disabled={pendingAreaPath.length < 3}
                    >
                        <Check className="mr-2 h-5 w-5" /> Finish Area
                    </Button>
                </div>
            )}

            <div className="absolute top-4 right-4 z-[1000] flex flex-col items-end gap-2">
                 <TooltipProvider>
                    <DropdownMenu>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" size="icon" className="h-12 w-12 rounded-full shadow-lg bg-card/90">
                                    <UserIcon className="h-6 w-6"/>
                                  </Button>
                                </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent><p>Account</p></TooltipContent>
                        </Tooltip>
                        <DropdownMenuContent className="w-56" align="end">
                            <DropdownMenuLabel className="font-normal">
                                <div className="flex flex-col space-y-1">
                                    <p className="text-sm font-medium leading-none">My Account</p>
                                    <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => router.push('/settings')}>
                                <Settings className="mr-2 h-4 w-4" />
                                <span>Settings</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={handleLogout}>
                                <LogOut className="mr-2 h-4 w-4" />
                                <span>Log out</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                  <div className="flex flex-col gap-1 bg-background/90 backdrop-blur-sm rounded-full shadow-lg border p-1">
                     <Tooltip>
                      <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" onClick={handleZoomIn}>
                              <ZoomIn className="h-5 w-5" />
                          </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left"><p>Zoom In</p></TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" onClick={handleZoomOut}>
                            <ZoomOut className="h-5 w-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left"><p>Zoom Out</p></TooltipContent>
                    </Tooltip>
                  </div>
              </TooltipProvider>
            </div>

            <div className="absolute bottom-4 right-4 z-[1000] flex flex-col gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                      <Button
                          variant="outline"
                          size="icon"
                          onClick={handleShowLog}
                          className="h-12 w-12 rounded-full shadow-lg bg-card"
                      >
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>
                      </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                      <p>Show Event Log</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
        </div>
      </main>
      
      <Dialog open={isLogDialogOpen} onOpenChange={setIsLogDialogOpen}>
        <DialogContent className="max-w-2xl h-3/4 flex flex-col z-[1003]">
          <DialogHeader>
            <DialogTitle>Event Log</DialogTitle>
            <DialogDescription>
              Recent events from the application, useful for debugging.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 relative">
            <ScrollArea className="h-full absolute w-full">
              <pre className="text-xs p-4 bg-muted rounded-md">{log.join('\n')}</pre>
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={handleCopyLog}>
              <Copy className="mr-2 h-4 w-4" /> Copy Log
            </Button>
            <DialogClose asChild>
              <Button type="button">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isNewProjectDialogOpen} onOpenChange={(open) => {
        if(!open) {
          setNewProjectName('');
          setNewProjectDescription('');
          setPendingAction(null);
        }
        setIsNewProjectDialogOpen(open);
      }}>
        <DialogContent className="z-[1003]">
            <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
                <DialogDescription>A project is a container for your map objects.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateNewProject} className="space-y-4">
                <Input name="name" placeholder="Project Name" required value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} />
                <Textarea name="description" placeholder="Project Description (optional)" value={newProjectDescription} onChange={(e) => setNewProjectDescription(e.target.value)} />
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                    <Button type="submit">Create Project</Button>
                </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>
      
      <Dialog open={!!projectToEdit} onOpenChange={(open) => !open && setProjectToEdit(null)}>
        <DialogContent className="z-[1003]">
            <DialogHeader>
                <DialogTitle>Edit Project</DialogTitle>
                <DialogDescription>Update the name and description for "{projectToEdit?.name}".</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdateProject} className="space-y-4">
                <Input name="name" defaultValue={projectToEdit?.name} placeholder="Project Name" required />
                <Textarea name="description" defaultValue={projectToEdit?.description} placeholder="Project Description (optional)" />
                <DialogFooter>
                    <Button type="button" variant="secondary" onClick={() => setProjectToEdit(null)}>Cancel</Button>
                    <Button type="submit">Save Changes</Button>
                </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isAssignProjectDialogOpen} onOpenChange={setIsAssignProjectDialogOpen}>
        <DialogContent className="z-[1003] sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>No Active Project</DialogTitle>
            <DialogDescription>
              To add items to the map, you need to create a project first or set an existing one as active.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setIsAssignProjectDialogOpen(false); setPendingAction(null); }}>Cancel</Button>
            <Button
              onClick={() => {
                setIsAssignProjectDialogOpen(false);
                setIsNewProjectDialogOpen(true);
              }}>
              <FolderPlus className="mr-2 h-4 w-4" /> Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isManageTagsDialogOpen} onOpenChange={setIsManageTagsDialogOpen}>
          <DialogContent className="z-[1004] max-w-md">
              <DialogHeader>
                  <DialogTitle>Manage Tags for "{projects.find(p => p.id === activeProjectId)?.name}"</DialogTitle>
                  <DialogDescription>Create, edit, or delete tags for this project.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                  <form onSubmit={handleCreateTag} className="flex items-end gap-2">
                      <div className="flex-1">
                          <label htmlFor="new-tag-name" className="text-sm font-medium">New Tag</label>
                          <Input id="new-tag-name" value={newTagName} onChange={e => setNewTagName(e.target.value)} placeholder="Tag name" required/>
                      </div>
                      <div>
                          <label htmlFor="new-tag-color" className="text-sm font-medium">Color</label>
                          <Input id="new-tag-color" type="color" value={newTagColor} onChange={e => setNewTagColor(e.target.value)} className="p-1 h-10"/>
                      </div>
                      <Button type="submit">Add</Button>
                  </form>
                  <Separator/>
                  <ScrollArea className="h-64">
                      <div className="space-y-2 pr-4">
                          {activeProjectTags.map(tag => (
                            tagToEdit?.id === tag.id ? (
                               <form key={tag.id} onSubmit={handleUpdateTag} className="flex items-end gap-2 p-2 border rounded-lg">
                                  <Input name="name" defaultValue={tag.name} className="h-9"/>
                                  <Input name="color" type="color" defaultValue={tag.color} className="p-1 h-9"/>
                                  <Button type="submit" size="sm">Save</Button>
                                  <Button type="button" variant="ghost" size="sm" onClick={() => setTagToEdit(null)}>Cancel</Button>
                               </form>
                            ) : (
                              <div key={tag.id} className="flex items-center justify-between p-2 rounded-md border bg-card">
                                  <div className="flex items-center gap-2">
                                      <div className="w-4 h-4 rounded-full" style={{backgroundColor: tag.color}}/>
                                      <span className="font-medium">{tag.name}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setTagToEdit(tag)}><Pencil className="h-4 w-4"/></Button>
                                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteTag(tag.id)}><Trash2 className="h-4 w-4"/></Button>
                                  </div>
                              </div>
                            )
                          ))}
                           {activeProjectTags.length === 0 && <p className="text-sm text-center text-muted-foreground py-4">No tags created yet.</p>}
                      </div>
                  </ScrollArea>
              </div>
          </DialogContent>
      </Dialog>

       <Dialog open={isImportProjectDialogOpen} onOpenChange={setIsImportProjectDialogOpen}>
        <DialogContent className="z-[1003]">
          <DialogHeader>
            <DialogTitle>Import Shared Project</DialogTitle>
            <DialogDescription>
              Paste a share code below to import a project and all its objects.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleImportProject} className="space-y-4">
            <Input
              name="importCode"
              placeholder="Enter share code..."
              required
              value={importCode}
              onChange={(e) => setImportCode(e.target.value)}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isImporting}>
                {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Import Project
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent className="z-[1003]">
          <DialogHeader>
            <DialogTitle>Share Project</DialogTitle>
            <DialogDescription>
              Anyone with this code can import a copy of your project.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2">
            <Input value={shareCode} readOnly />
            <Button size="icon" onClick={() => { navigator.clipboard.writeText(shareCode); toast({title: "Copied!"}); }}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button">Done</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
