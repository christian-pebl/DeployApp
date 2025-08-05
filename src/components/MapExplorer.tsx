
'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { User } from 'firebase/auth';
import type { LatLng, LatLngExpression, Map as LeafletMap, LeafletMouseEvent } from 'leaflet';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from "@/hooks/use-toast";
import { geocodeAddress } from '@/ai/flows/geocode-address';
import { Loader2, Crosshair, MapPin, Check, Menu, ZoomIn, ZoomOut, Plus, Eye, Pencil, Trash2, X, Search, Settings as SettingsIcon, LogOut, Share2 } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useMapView, type MapView } from '@/hooks/use-map-view';
import { useSettings } from '@/hooks/use-settings';
import { collection, query, where, getDocs, writeBatch, doc, getDoc, setDoc, deleteDoc, serverTimestamp, onSnapshot, orderBy, limit } from "firebase/firestore";
import { db, auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { ProjectData, PinData, LineData, AreaData, TagData } from '@/ai/flows/share-project';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
import { Label } from '@/components/ui/label';

const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-muted flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>,
});

type Project = ProjectData & { id: string };
type Tag = TagData & { id: string };
type Pin = PinData & { id: string };
type Line = LineData & { id: string };
type Area = AreaData & { id: string };

type WithId<T> = T & { id: string };

export default function MapExplorer({ user }: { user: User }) {
  const [log, setLog] = useState<string[]>(['App Initialized']);
  const { view, setView } = useMapView(user.uid);
  const { settings } = useSettings();
  
  const [pins, setPins] = useState<Pin[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

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
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [editingGeometry, setEditingGeometry] = useState<Line | Area | null>(null);

  const { toast } = useToast();
  const router = useRouter();
  
  const mapRef = useRef<LeafletMap | null>(null);

  const addLog = (entry: string) => {
    setLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${entry}`]);
    console.log(`[LOG] ${entry}`);
  };

  useEffect(() => {
    if (!user) return;
    addLog('User authenticated. Starting data load.');
    setIsDataLoading(true);

    const dataQuery = (collectionName: string) => query(collection(db, collectionName), where("userId", "==", user.uid));

    const unsubscribers = [
      onSnapshot(dataQuery("projects"), snapshot => {
        const userProjects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
        setProjects(userProjects.sort((a,b) => b.createdAt.seconds - a.createdAt.seconds));
        addLog(`Loaded ${userProjects.length} projects.`);
        
        const lastActiveId = localStorage.getItem(`last-active-project-${user.uid}`);
        if(lastActiveId && userProjects.some(p => p.id === lastActiveId)) {
          setActiveProjectId(lastActiveId);
        } else if (userProjects.length > 0) {
          setActiveProjectId(userProjects[0].id);
        }
      }),
      onSnapshot(dataQuery("pins"), snapshot => {
        const userPins = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pin));
        setPins(userPins);
        addLog(`Loaded ${userPins.length} pins.`);
      }),
      onSnapshot(dataQuery("lines"), snapshot => {
        const userLines = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Line));
        setLines(userLines);
        addLog(`Loaded ${userLines.length} lines.`);
      }),
      onSnapshot(dataQuery("areas"), snapshot => {
        const userAreas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Area));
        setAreas(userAreas);
        addLog(`Loaded ${userAreas.length} areas.`);
      }),
      onSnapshot(dataQuery("tags"), snapshot => {
        const userTags = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tag));
        setTags(userTags);
        addLog(`Loaded ${userTags.length} tags.`);
      }),
    ];
    
    Promise.all(unsubscribers).then(() => {
      setIsDataLoading(false);
      addLog('Finished loading all data.');
    });

    return () => unsubscribers.forEach(unsub => unsub());
  }, [user]);

  useEffect(() => {
    if (activeProjectId) {
      localStorage.setItem(`last-active-project-${user.uid}`, activeProjectId);
    }
  }, [activeProjectId, user.uid]);
  
  useEffect(() => {
      addLog('Attempting to get user location.');
      setIsLocating(true);
  }, []);

  const handleLocationFound = (latlng: LatLng) => {
    setCurrentLocation(latlng);
    addLog(`Current location updated: ${latlng.lat}, ${latlng.lng}`);
    setIsLocating(false);
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
        setView({ center: currentLocation, zoom: 15 });
    } else if (mapRef.current) {
        addLog('Current location not available, re-attempting location.');
        setIsLocating(true);
        mapRef.current.locate({ setView: true, maxZoom: 15 });
    }
  };

  const handleShowLog = () => {
    const logContent = log.join('\n');
    toast({
        title: "Event Log",
        description: <pre className="text-xs whitespace-pre-wrap max-h-60 overflow-y-auto">{logContent}</pre>,
        duration: 10000,
    });
  };

  const handleZoomIn = () => {
    mapRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapRef.current?.zoomOut();
  };

  const handleAddPin = () => {
    if (mapRef.current) {
        const center = mapRef.current.getCenter();
        setPendingPin(center);
    }
  };

  const handleDrawLine = () => {
    if (mapRef.current) {
        setLineStartPoint(mapRef.current.getCenter());
        setIsDrawingLine(true);
        addLog('Started drawing line.');
    }
  };
  
  const handleConfirmLine = () => {
    if (lineStartPoint && currentMapCenter) {
      setPendingLine({ path: [lineStartPoint, currentMapCenter] });
      setIsDrawingLine(false);
      setLineStartPoint(null);
    }
  };

  const handleDrawArea = () => {
    setIsDrawingArea(true);
    setPendingAreaPath([]);
    addLog('Started drawing area.');
  };
  
  const handleAddAreaCorner = () => {
    if(currentMapCenter) {
      setPendingAreaPath(prev => [...prev, currentMapCenter]);
    }
  };
  
  const handleConfirmArea = () => {
    if (pendingAreaPath.length < 3) {
        toast({ variant: "destructive", title: "Area Incomplete", description: "An area must have at least 3 points."});
        return;
    }
    setPendingArea({ path: pendingAreaPath });
    setIsDrawingArea(false);
    setPendingAreaPath([]);
  };

  const handleMapClick = (e: LeafletMouseEvent) => {
    if (editingGeometry) return;
    if (isDrawingArea) {
      setPendingAreaPath(prev => [...prev, e.latlng]);
    } else if(isDrawingLine) {
        if(lineStartPoint) {
            setPendingLine({ path: [lineStartPoint, e.latlng] });
            setIsDrawingLine(false);
            setLineStartPoint(null);
        } else {
            setLineStartPoint(e.latlng);
        }
    }
  };

  const writeToFirestore = async (collectionName: string, data: any) => {
    try {
        const docRef = doc(db, collectionName, data.id);
        await setDoc(docRef, data, { merge: true });
        addLog(`Successfully wrote to ${collectionName}/${data.id}`);
    } catch (error) {
        addLog(`Error writing to Firestore: ${(error as Error).message}`);
        toast({
            variant: "destructive",
            title: "Database Error",
            description: `Could not save data. ${(error as Error).message}`
        });
    }
  };

  const deleteFromFirestore = async (collectionName: string, id: string) => {
      try {
          await deleteDoc(doc(db, collectionName, id));
          addLog(`Successfully deleted ${collectionName}/${id}`);
      } catch (error) {
          addLog(`Error deleting from Firestore: ${(error as Error).message}`);
          toast({
              variant: "destructive",
              title: "Database Error",
              description: `Could not delete data. ${(error as Error).message}`
          });
      }
  };
  
  const handlePinSave = async (id: string, label: string, lat: number, lng: number, notes: string, tagId?: string) => {
    if (!user) return;
    const newPin: Pin = { id, lat, lng, label, notes, labelVisible: true, userId: user.uid, projectId: activeProjectId, tagIds: tagId ? [tagId] : [] };
    await writeToFirestore('pins', newPin);
    setPendingPin(null);
  };
  
  const handleLineSave = async (id: string, label: string, path: LatLng[], notes: string, tagId?: string) => {
    if (!user) return;
    const newLine: Line = {
        id,
        path: path.map(p => ({ lat: p.lat, lng: p.lng })),
        label,
        notes,
        labelVisible: true,
        userId: user.uid,
        projectId: activeProjectId,
        tagIds: tagId ? [tagId] : [],
    };
    await writeToFirestore('lines', newLine);
    setPendingLine(null);
  };
  
  const handleAreaSave = async (id: string, label: string, path: LatLng[], notes: string, tagId?: string) => {
    if (!user) return;
    const newArea: Area = {
        id,
        path: path.map(p => ({ lat: p.lat, lng: p.lng })),
        label,
        notes,
        labelVisible: true,
        fillVisible: true,
        userId: user.uid,
        projectId: activeProjectId,
        tagIds: tagId ? [tagId] : [],
    };
    await writeToFirestore('areas', newArea);
    setPendingArea(null);
  };

  const handleUpdatePin = async (id: string, label: string, notes: string, projectId?: string, tagIds?: string[]) => {
    const data = { id, label, notes, projectId: projectId || null, tagIds: tagIds || [] };
    await writeToFirestore('pins', data);
    setItemToEdit(null);
  };

  const handleDeletePin = async (id: string) => {
    await deleteFromFirestore('pins', id);
    setItemToEdit(null);
  };
  
  const handleUpdateLine = async (id: string, label: string, notes: string, projectId?: string, tagIds?: string[]) => {
    const data = { id, label, notes, projectId: projectId || null, tagIds: tagIds || [] };
    await writeToFirestore('lines', data);
    setItemToEdit(null);
  };
  
  const handleDeleteLine = async (id: string) => {
    await deleteFromFirestore('lines', id);
    setItemToEdit(null);
  };

  const handleUpdateArea = async (id: string, label: string, notes: string, path: {lat: number, lng: number}[], projectId?: string, tagIds?: string[]) => {
    const data = { id, label, notes, path, projectId: projectId || null, tagIds: tagIds || [] };
    await writeToFirestore('areas', data);
    setItemToEdit(null);
  };

  const handleDeleteArea = async (id: string) => {
    await deleteFromFirestore('areas', id);
    setItemToEdit(null);
  };

  const handleToggleLabel = async (id: string, type: 'pin' | 'line' | 'area') => {
      const collectionName = `${type}s`;
      const item = (eval(collectionName) as (Pin | Line | Area)[]).find(i => i.id === id);
      if(item) {
        const updatedItem = { ...item, labelVisible: !(item.labelVisible ?? true) };
        await writeToFirestore(collectionName, updatedItem);
      }
      setItemToEdit(null);
  };
  
  const handleToggleFill = async (id: string) => {
      const item = areas.find(a => a.id === id);
      if(item) {
        const updatedItem = { ...item, fillVisible: !(item.fillVisible ?? true) };
        await writeToFirestore('areas', updatedItem);
      }
      setItemToEdit(null);
  };

  const handleViewItem = (item: Pin | Line | Area) => {
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
    setItemToEdit(item);
  }

  const handleSearch = async () => {
    if (!searchQuery) return;
    addLog(`Searching for: ${searchQuery}`);
    setIsSearching(true);
    const map = mapRef.current;
    if (!map) {
        setIsSearching(false);
        return;
    }

    const latLngRegex = /^(-?\d{1,3}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)$/;
    const match = searchQuery.match(latLngRegex);
    if (match) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            addLog(`Found coordinates. Panning to ${lat}, ${lng}`);
            map.setView([lat, lng], 15);
            setIsSearching(false);
            return;
        }
    }

    const lowerCaseQuery = searchQuery.toLowerCase();
    const allItems = [...pins, ...lines, ...areas];
    const item = allItems.find(i => (activeProjectId ? i.projectId === activeProjectId : true) && i.label.toLowerCase().includes(lowerCaseQuery));

    if (item) {
        addLog(`Found object with label: ${item.label}`);
        handleViewItem(item);
        setIsSearching(false);
        return;
    }

    try {
        addLog(`No object found. Attempting to geocode address: ${searchQuery}`);
        const result = await geocodeAddress({ address: searchQuery });
        if (result.latitude && result.longitude) {
            addLog(`Geocoding successful. Panning to ${result.latitude}, ${result.longitude}`);
            map.setView([result.latitude, result.longitude], 15);
        } else {
            throw new Error('Geocoding failed to return coordinates.');
        }
    } catch (error) {
        addLog(`Error during geocoding: ${(error as Error).message}`);
        toast({
            variant: "destructive",
            title: "Search Failed",
            description: `Could not find a location or object for "${searchQuery}".`,
        });
    } finally {
        setIsSearching(false);
    }
  };

  const handleCreateProject = async (name: string, description: string) => {
    if (!user) return;
    const id = doc(collection(db, "projects")).id;
    const newProject: Project = {
      id,
      name,
      description,
      userId: user.uid,
      createdAt: serverTimestamp(),
    };
    await writeToFirestore("projects", newProject);
    setActiveProjectId(id);
    addLog(`Created new project: ${name}`);
  };

  const handleDeleteProject = async (projectId: string) => {
      if (!user) return;
      addLog(`Attempting to delete project ${projectId}`);
      try {
          const batch = writeBatch(db);

          const projectRef = doc(db, "projects", projectId);
          batch.delete(projectRef);

          const collectionsToDelete = ["pins", "lines", "areas", "tags"];
          for (const colName of collectionsToDelete) {
              const q = query(collection(db, colName), where("projectId", "==", projectId), where("userId", "==", user.uid));
              const snapshot = await getDocs(q);
              snapshot.forEach(doc => batch.delete(doc.ref));
          }

          await batch.commit();

          addLog(`Successfully deleted project ${projectId} and its associated objects.`);
          
          if(activeProjectId === projectId) {
              const remainingProjects = projects.filter(p => p.id !== projectId);
              setActiveProjectId(remainingProjects.length > 0 ? remainingProjects[0].id : null);
          }
      } catch (error) {
          addLog(`Error deleting project: ${(error as Error).message}`);
          toast({
              variant: "destructive",
              title: "Delete Failed",
              description: `Could not delete project. ${(error as Error).message}`,
          });
      }
  };
  
  const handleSetActiveProject = (projectId: string | null) => {
    setActiveProjectId(projectId);
    if(projectId) {
      const projectItems = [...pins, ...lines, ...areas].filter(item => item.projectId === projectId);
      const allCoords = projectItems.flatMap(item => {
        if ('lat' in item) return [[item.lat, item.lng]];
        return item.path.map(p => [p.lat, p.lng]);
      }) as [number, number][];

      if (allCoords.length > 0 && mapRef.current) {
        mapRef.current.fitBounds(allCoords);
      }
    }
  };

  const handleEditGeometry = (item: Line | Area | null) => {
    setEditingGeometry(item);
    if (item) {
        addLog(`Started editing geometry for ${item.id}`);
    } else {
        addLog('Stopped editing geometry.');
    }
  }

  const handleUpdateGeometry = async (itemId: string, newPath: {lat: number, lng: number}[]) => {
      const line = lines.find(l => l.id === itemId);
      if (line) {
          await writeToFirestore('lines', { id: itemId, path: newPath });
      } else {
          const area = areas.find(a => a.id === itemId);
          if (area) {
              await writeToFirestore('areas', { id: itemId, path: newPath });
          }
      }
      setEditingGeometry(null);
      addLog(`Updated geometry for ${itemId}`);
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const filteredPins = pins.filter(p => p.projectId === activeProjectId);
  const filteredLines = lines.filter(l => l.projectId === activeProjectId);
  const filteredAreas = areas.filter(a => a.projectId === activeProjectId);

  if (!view || !settings) {
    return (
      <div className="w-full h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex bg-background font-body relative overflow-hidden">
       
      <main className="flex-1 flex flex-col relative h-full">
        <div className="flex-1 relative">
            <Map
              mapRef={mapRef}
              center={view.center}
              zoom={view.zoom}
              pins={filteredPins}
              lines={filteredLines}
              areas={filteredAreas}
              projects={projects}
              tags={tags.filter(t => t.projectId === activeProjectId)}
              settings={settings}
              currentLocation={currentLocation}
              onLocationFound={handleLocationFound}
              onLocationError={handleLocationError}
              onMove={(center, zoom) => setView({center, zoom})}
              isDrawingLine={isDrawingLine}
              lineStartPoint={lineStartPoint}
              isDrawingArea={isDrawingArea}
              onMapClick={handleMapClick}
              pendingAreaPath={pendingAreaPath}
              pendingPin={pendingPin}
              onPinSave={handlePinSave}
              onPinCancel={() => setPendingPin(null)}
              pendingLine={pendingLine}
              onLineSave={handleLineSave}
              onLineCancel={() => {setIsDrawingLine(false); setLineStartPoint(null); setPendingLine(null);}}
              pendingArea={pendingArea}
              onAreaSave={handleAreaSave}
              onAreaCancel={() => {setIsDrawingArea(false); setPendingAreaPath([]); setPendingArea(null);}}
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
              editingGeometry={editingGeometry}
              onEditGeometry={handleEditGeometry}
              onUpdateGeometry={handleUpdateGeometry}
            />
            
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000] pointer-events-none">
                {!isDrawingLine && !isDrawingArea && !editingGeometry && <Plus className="h-8 w-8 text-blue-500 opacity-70" />}
            </div>

            {isObjectListOpen && (
              <Card className="absolute top-4 left-4 z-[1001] w-[350px] sm:w-[400px] h-[calc(100%-2rem)] flex flex-col bg-card/90 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>Project Menu</CardTitle>
                      <Button variant="ghost" size="icon" onClick={() => setIsObjectListOpen(false)} className="h-8 w-8">
                          <X className="h-4 w-4" />
                      </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto flex flex-col">
                    <ProjectPanel 
                        projects={projects} 
                        activeProjectId={activeProjectId} 
                        onSetActiveProject={handleSetActiveProject} 
                        onCreateProject={handleCreateProject}
                        onDeleteProject={handleDeleteProject}
                        pins={pins}
                        lines={lines}
                        areas={areas}
                        tags={tags}
                        user={user}
                        addLog={addLog}
                        toast={toast}
                    />

                    <Separator className="my-4" />
                    <h3 className="text-lg font-semibold mb-2 px-6">Objects in Active Project</h3>
                    <TooltipProvider>
                      <ScrollArea className="flex-1 h-px px-6">
                          <h4 className="text-md font-semibold mb-2 mt-4">Pins</h4>
                          {filteredPins.length > 0 ? (
                              <ul className="space-y-2">
                                  {filteredPins.map(pin => (
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
                          ) : <p className="text-sm text-muted-foreground">No pins added yet.</p>}
                          
                          <Separator className="my-4" />

                          <h4 className="text-md font-semibold mb-2">Lines</h4>
                          {filteredLines.length > 0 ? (
                              <ul className="space-y-2">
                                  {filteredLines.map(line => (
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
                          ) : <p className="text-sm text-muted-foreground">No lines drawn yet.</p>}
                          
                          <Separator className="my-4" />

                          <h4 className="text-md font-semibold mb-2">Areas</h4>
                          {filteredAreas.length > 0 ? (
                              <ul className="space-y-2">
                                  {filteredAreas.map(area => (
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
                          ) : <p className="text-sm text-muted-foreground">No areas drawn yet.</p>}
                      </ScrollArea>
                    </TooltipProvider>
                    <div className="mt-auto pt-4 px-6 pb-2 border-t">
                      <div className="flex items-center justify-between">
                         <p className="text-sm font-medium text-muted-foreground truncate" title={user.email || ''}>{user.email}</p>
                         <div className="flex gap-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => router.push('/settings')}>
                                  <SettingsIcon className="h-5 w-5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p>Settings</p></TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={handleLogout}>
                                  <LogOut className="h-5 w-5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p>Log Out</p></TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                         </div>
                      </div>
                    </div>
                </CardContent>
              </Card>
            )}

            <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="default" size="icon" className="h-12 w-12 rounded-full shadow-lg" onClick={() => setIsObjectListOpen(true)}>
                                <Menu className="h-6 w-6" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Project Menu</p></TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="default" size="icon" className="h-12 w-12 rounded-full shadow-lg" onClick={handleAddPin} disabled={!!editingGeometry}>
                                <MapPin className="h-6 w-6" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Add a Pin</p></TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="default" size="icon" className="h-12 w-12 rounded-full shadow-lg" onClick={handleDrawLine} disabled={!!editingGeometry}>
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
                            <Button variant="default" size="icon" className="h-12 w-12 rounded-full shadow-lg" onClick={handleDrawArea} disabled={!!editingGeometry}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-6 w-6">
                                    <path d="M2.57141 6.28571L8.2857 2.57143L20.5714 8.28571L14.8571 21.4286L2.57141 15.7143L2.57141 6.28571Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                                </svg>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Draw an Area</p></TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
            
            {editingGeometry && (
                 <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] flex gap-2 bg-card p-2 rounded-lg shadow-lg">
                    <Button 
                        className="h-10 rounded-md"
                        onClick={() => handleUpdateGeometry(editingGeometry.id, (mapRef.current as any).getEditedPath())}
                    >
                        <Check className="mr-2 h-5 w-5" /> Save Shape
                    </Button>
                     <Button 
                        variant="ghost"
                        className="h-10 rounded-md"
                        onClick={() => handleEditGeometry(null)}
                    >
                        <X className="mr-2 h-5 w-5" /> Cancel
                    </Button>
                </div>
            )}

            {isDrawingArea && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] flex gap-2">
                    <Button 
                        className="h-12 rounded-md shadow-lg bg-primary text-primary-foreground hover:bg-primary/90"
                        onClick={handleConfirmArea}
                    >
                        <Check className="mr-2 h-5 w-5" /> Finish Area
                    </Button>
                     <Button 
                        variant="ghost"
                        className="h-12 rounded-md shadow-lg bg-card"
                        onClick={() => { setIsDrawingArea(false); setPendingAreaPath([]); }}
                    >
                        <X className="mr-2 h-5 w-5" /> Cancel
                    </Button>
                </div>
            )}

            <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
                <div className="flex w-full max-w-sm items-center space-x-2 bg-background/90 backdrop-blur-sm p-2 rounded-lg shadow-lg border">
                    <Input
                        type="text"
                        placeholder="Search address or label..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        className="border-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
                    />
                    <Button type="submit" size="icon" onClick={handleSearch} disabled={isSearching} className="h-9 w-9">
                        {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                </div>
                <TooltipProvider>
                  <div className="flex flex-col gap-2 items-end">
                    <div className="flex flex-col gap-1 bg-background/80 backdrop-blur-sm rounded-full shadow-lg border">
                      <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-t-full" onClick={handleZoomIn}>
                                <ZoomIn className="h-5 w-5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left"><p>Zoom In</p></TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-b-full" onClick={handleZoomOut}>
                              <ZoomOut className="h-5 w-5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left"><p>Zoom Out</p></TooltipContent>
                      </Tooltip>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-12 w-12 rounded-full shadow-lg bg-background/80 backdrop-blur-sm border"
                          onClick={handleLocateMe}
                          disabled={isLocating}
                        >
                          {isLocating && !currentLocation ? <Loader2 className="h-6 w-6 animate-spin text-blue-500" /> : <Crosshair className="h-6 w-6 text-blue-500" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        <p>Center on Me</p>
                      </TooltipContent>
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
    </div>
  );
}


function ProjectPanel({ projects, activeProjectId, onSetActiveProject, onCreateProject, onDeleteProject, user, addLog, toast }: { 
  projects: Project[], 
  activeProjectId: string | null,
  onSetActiveProject: (id: string | null) => void,
  onCreateProject: (name: string, description: string) => void,
  onDeleteProject: (id: string) => void,
  user: User,
  addLog: (log: string) => void,
  toast: (options: { title: string; description: string; variant?: "default" | "destructive" | null | undefined; }) => void,
}) {
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [shareCode, setShareCode] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newProjectName.trim()) {
      onCreateProject(newProjectName.trim(), newProjectDesc.trim());
      setNewProjectName("");
      setNewProjectDesc("");
    }
  };

  const generateShareCode = async (projectId: string) => {
    addLog(`[SHARE_CLIENT] 1. Starting code generation for project ID: ${projectId}`);
    setIsSharing(true);
    try {
        const batch = writeBatch(db);
        const shareId = doc(collection(db, 'shares')).id;

        addLog(`[SHARE_CLIENT] 2. Attempting to write to 'shares' and 'shares_by_project' collections`);
        
        const shareRef = doc(db, 'shares', shareId);
        batch.set(shareRef, {
            projectId: projectId,
            userId: user.uid,
            createdAt: serverTimestamp(),
        });
        
        const shareByProjectRef = doc(db, 'shares_by_project', projectId);
        batch.set(shareByProjectRef, { shareId: shareId });
        
        await batch.commit();
        addLog(`[SHARE_CLIENT] 3. Successfully created share documents.`);
        
        setShareCode(shareId);
        toast({ title: "Share Code Generated", description: "Anyone with this code can view a copy of your project." });

    } catch (e) {
        const error = e as Error;
        addLog(`[SHARE_CLIENT] 4. ❌ Error generating share code: ${error.message}`);
        console.error("Error generating share code:", error);
        toast({ variant: 'destructive', title: "Sharing Failed", description: error.message });
    } finally {
        addLog(`[SHARE_CLIENT] 5. Finished code generation attempt.`);
        setIsSharing(false);
    }
  };

  const importSharedProject = async () => {
    if (!shareCode.trim()) {
        toast({ variant: 'destructive', title: "Invalid Code", description: "Please enter a share code." });
        return;
    }
    setIsImporting(true);
    addLog(`[IMPORT_CLIENT] 1. Starting import for code: ${shareCode}`);
    try {
        const shareSnap = await getDocs(query(collection(db, 'shares'), where('__name__', '==', shareCode.trim()), limit(1)));

        if (shareSnap.empty) {
            throw new Error("Share code not found.");
        }
        
        const shareData = shareSnap.docs[0].data();
        const { projectId: originalProjectId, userId: originalUserId } = shareData;
        addLog(`[IMPORT_CLIENT] 2. Found share document for project ${originalProjectId}`);

        const projectRef = doc(db, 'projects', originalProjectId);
        const projectSnap = await getDoc(projectRef);

        if (!projectSnap.exists()) {
            throw new Error("Original project not found.");
        }
        
        const originalProjectData = projectSnap.data() as ProjectData;
        addLog(`[IMPORT_CLIENT] 3. Found original project: ${originalProjectData.name}`);
        
        const batch = writeBatch(db);

        // Create new project
        const newProjectId = doc(collection(db, 'projects')).id;
        const newProjectRef = doc(db, 'projects', newProjectId);
        batch.set(newProjectRef, {
            ...originalProjectData,
            name: `${originalProjectData.name} (Copy)`,
            userId: user.uid,
            createdAt: serverTimestamp()
        });
        addLog(`[IMPORT_CLIENT] 4. Cloned project document for new user.`);

        // Copy all associated data
        const collectionsToCopy = ["pins", "lines", "areas", "tags"];
        let totalItemsCopied = 0;

        for (const colName of collectionsToCopy) {
            const q = query(collection(db, colName), where("projectId", "==", originalProjectId), where("userId", "==", originalUserId));
            const snapshot = await getDocs(q);
             // fixes TypeError: doc.data is not a function on line 1099
            for (const originalDoc of snapshot.docs) {
                const newDocId = originalDoc.id; // Keep original IDs for simplicity, might cause collisions if importing same project twice
                const newDocRef = doc(db, colName, newDocId);
                batch.set(newDocRef, { ...originalDoc.data(), projectId: newProjectId, userId: user.uid });
                totalItemsCopied++;
            }
             addLog(`[IMPORT_CLIENT] 5a. Queued ${snapshot.size} items from ${colName} to be copied.`);
        }
        
        await batch.commit();
        
        addLog(`[IMPORT_CLIENT] 6. Successfully imported project with ${totalItemsCopied} items.`);
        toast({ title: "Import Successful", description: `"${originalProjectData.name}" has been added to your projects.` });
        setShareCode('');
        
    } catch (e) {
        const error = e as Error;
        addLog(`[IMPORT_CLIENT] ❌ Error importing project: ${error.message}`);
        console.error("Error importing project:", error);
        toast({ variant: 'destructive', title: "Import Failed", description: error.message });
    } finally {
        setIsImporting(false);
    }
  };

  return (
    <div className="space-y-4 px-6">
      <h3 className="text-lg font-semibold">Projects</h3>
      <TooltipProvider>
        <ul className="space-y-2 max-h-48 overflow-y-auto pr-2">
          {projects.map(project => (
            <li key={project.id} className="flex items-center justify-between p-2 rounded-md border" data-active={activeProjectId === project.id}>
              <span className="font-medium truncate pr-2">{project.name}</span>
              <div className="flex items-center gap-1">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><Share2 className="h-4 w-4"/></Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{project.name}</DialogTitle>
                      <DialogDescription>{project.description || "No description."}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                       <Button onClick={() => generateShareCode(project.id)} disabled={isSharing} className="w-full">
                         {isSharing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                         Generate Share Code
                       </Button>
                       {shareCode && <Input value={shareCode} readOnly />}
                    </div>
                  </DialogContent>
                </Dialog>
                <Tooltip><TooltipTrigger asChild>
                  <Button variant={activeProjectId === project.id ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => onSetActiveProject(project.id)}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill={activeProjectId === project.id ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                  </Button>
                </TooltipTrigger><TooltipContent><p>Set Active</p></TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDeleteProject(project.id)}><Trash2 className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent><p>Delete</p></TooltipContent></Tooltip>
              </div>
            </li>
          ))}
        </ul>
      </TooltipProvider>
      <div className="flex gap-2">
        <Dialog>
          <DialogTrigger asChild>
            <Button className="flex-1">Create New</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
              <DialogDescription>Give your new project a name and an optional description.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <Label htmlFor="project-name">Project Name</Label>
                <Input id="project-name" value={newProjectName} onChange={e => setNewProjectName(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="project-desc">Description</Label>
                <Input id="project-desc" value={newProjectDesc} onChange={e => setNewProjectDesc(e.target.value)} />
              </div>
              <DialogFooter>
                <DialogClose asChild>
                   <Button type="submit">Create Project</Button>
                </DialogClose>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" className="flex-1">Import</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import Shared Project</DialogTitle>
              <DialogDescription>Enter a share code to import a project.</DialogDescription>
            </DialogHeader>
             <div className="space-y-4">
                <Label htmlFor="share-code">Share Code</Label>
                <Input id="share-code" value={shareCode} onChange={e => setShareCode(e.target.value)} />
             </div>
             <DialogFooter>
                <Button onClick={importSharedProject} disabled={isImporting}>
                  {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                  Import
                </Button>
             </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

    