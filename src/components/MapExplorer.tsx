'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { LatLng, LatLngExpression, Map as LeafletMap, LeafletMouseEvent } from 'leaflet';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from "@/hooks/use-toast";
import { geocodeAddress } from '@/ai/flows/geocode-address';
import { Loader2, Crosshair, MapPin, Check, Menu, ZoomIn, ZoomOut, Plus, Eye, Pencil, Trash2, X, Search, FolderPlus, FolderKanban } from 'lucide-react';
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
  DropdownMenuCheckboxItem,
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


const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-muted flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>,
});

type Project = { id: string; name: string; description?: string; createdAt: string; };
type Pin = { id: string; lat: number; lng: number; label: string; labelVisible?: boolean; notes?: string; projectId?: string; };
type Line = { id: string; path: { lat: number; lng: number }[]; label: string; labelVisible?: boolean; notes?: string; projectId?: string; };
type Area = { id: string; path: { lat: number; lng: number }[]; label: string; labelVisible?: boolean; notes?: string; fillVisible?: boolean; projectId?: string; };

type PendingAction = 'pin' | 'line' | 'area' | null;


export default function MapExplorer() {
  const [log, setLog] = useState<string[]>(['App Initialized']);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [pins, setPins] = useState<Pin[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
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
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(['all']);

  const [isAssignProjectDialogOpen, setIsAssignProjectDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const { toast } = useToast();
  
  const initialLocationFound = useRef(false);
  const mapRef = useRef<LeafletMap | null>(null);
  const newProjectFormRef = useRef<HTMLFormElement>(null);
  const editProjectFormRef = useRef<HTMLFormElement>(null);

  const addLog = (entry: string) => {
    setLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${entry}`]);
  };
  
  useEffect(() => {
      addLog('Attempting to get user location.');
      setIsLocating(true);
  }, []);

  const executePendingAction = () => {
    if (!pendingAction) return;

    if (pendingAction === 'pin') {
        if (mapRef.current) {
            const center = mapRef.current.getCenter();
            setPendingPin(center);
        }
    } else if (pendingAction === 'line') {
        if (mapRef.current) {
            const center = mapRef.current.getCenter();
            setLineStartPoint(center);
            setIsDrawingLine(true);
        }
    } else if (pendingAction === 'area') {
        setIsDrawingArea(true);
        setPendingAreaPath([]);
    }

    setPendingAction(null);
};

useEffect(() => {
    if (activeProjectId && pendingAction) {
        executePendingAction();
    }
}, [activeProjectId, pendingAction]);


  const handleLocationFound = (latlng: LatLng) => {
    setCurrentLocation(latlng);
    if (!initialLocationFound.current) {
      addLog(`Initial location found: ${latlng.lat}, ${latlng.lng}`);
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
    const logContent = log.join('\n');
    toast({
        title: "Event Log",
        description: <pre className="text-xs whitespace-pre-wrap max-h-60 overflow-y-auto">{logContent}</pre>,
        duration: 10000,
    });
  }

  const handleZoomIn = () => {
    mapRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapRef.current?.zoomOut();
  };

  const handleAddPin = () => {
    if (!activeProjectId) {
      setPendingAction('pin');
      setIsAssignProjectDialogOpen(true);
      return;
    }
    if (mapRef.current) {
        const center = mapRef.current.getCenter();
        setPendingPin(center);
    }
  };

  const handleDrawLine = () => {
     if (!activeProjectId) {
      setPendingAction('line');
      setIsAssignProjectDialogOpen(true);
      return;
    }
    if (mapRef.current) {
        const center = mapRef.current.getCenter();
        setLineStartPoint(center);
        setIsDrawingLine(true);
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
    if (!activeProjectId) {
      setPendingAction('area');
      setIsAssignProjectDialogOpen(true);
      return;
    }
    setIsDrawingArea(true);
    setPendingAreaPath([]);
  }
  
  const handleAddAreaCorner = () => {
    if(currentMapCenter) {
      setPendingAreaPath(prev => [...prev, currentMapCenter]);
    }
  }

  const handleConfirmArea = () => {
    if(pendingAreaPath.length < 3) {
        toast({ variant: "destructive", title: "Area Incomplete", description: "An area must have at least 3 points."});
        return;
    }
    setPendingArea({ path: pendingAreaPath });
    setIsDrawingArea(false);
    setPendingAreaPath([]);
  }

  const handleMapClick = (e: LeafletMouseEvent) => {
    if (isDrawingArea) {
      setPendingAreaPath(prev => [...prev, e.latlng]);
    }
  };

  const handlePinSave = (id: string, label: string, lat: number, lng: number, notes: string, projectId?: string) => {
    const newPin: Pin = { id, lat, lng, label, labelVisible: true, notes, projectId: projectId ?? activeProjectId ?? undefined };
    setPins(prev => [...prev, newPin]);
    setPendingPin(null);
  };

  const handleLineSave = (id: string, label: string, path: LatLng[], notes: string, projectId?: string) => {
      const newLine: Line = {
          id,
          path: path.map(p => ({ lat: p.lat, lng: p.lng })),
          label,
          labelVisible: true,
          notes,
          projectId: projectId ?? activeProjectId ?? undefined
      };
      setLines(prev => [...prev, newLine]);
      setPendingLine(null);
  };
  
  const handleAreaSave = (id: string, label: string, path: LatLng[], notes: string, projectId?: string) => {
      const newArea: Area = {
          id,
          path: path.map(p => ({ lat: p.lat, lng: p.lng })),
          label,
          labelVisible: true,
          fillVisible: true,
          notes,
          projectId: projectId ?? activeProjectId ?? undefined
      };
      setAreas(prev => [...prev, newArea]);
      setPendingArea(null);
  };

  const handleUpdatePin = (id: string, label: string, notes: string, projectId?: string) => {
    setPins(prev => prev.map(p => p.id === id ? { ...p, label, notes, projectId } : p));
    setItemToEdit(null);
  };

  const handleDeletePin = (id: string) => {
    setPins(prev => prev.filter(p => p.id !== id));
    setItemToEdit(null);
  };
  
  const handleUpdateLine = (id: string, label: string, notes: string, projectId?: string) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, label, notes, projectId } : l));
    setItemToEdit(null);
  };
  
  const handleDeleteLine = (id: string) => {
    setLines(prev => prev.filter(l => l.id !== id));
    setItemToEdit(null);
  };

  const handleUpdateArea = (id: string, label: string, notes: string, path: {lat: number, lng: number}[], projectId?: string) => {
    setAreas(prev => prev.map(a => a.id === id ? { ...a, label, notes, path, projectId } : a));
    setItemToEdit(null);
  };

  const handleDeleteArea = (id: string) => {
    setAreas(prev => prev.filter(a => a.id !== id));
    setItemToEdit(null);
  };

  const handleToggleLabel = (id: string, type: 'pin' | 'line' | 'area') => {
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
    setAreas(areas.map(a => a.id === id ? { ...a, fillVisible: !(a.fillVisible ?? true) } : a));
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
    const item = [...pins, ...lines, ...areas].find(i => i.label.toLowerCase() === lowerCaseQuery);
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

  const handleCreateNewProject = (e: React.FormEvent) => {
    e.preventDefault();
    const form = newProjectFormRef.current;
    if (!form) return;
    const formData = new FormData(form);
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    
    if (name) {
        const newProject: Project = {
            id: `proj-${Date.now()}`,
            name,
            description,
            createdAt: new Date().toISOString(),
        };
        setProjects(prev => [...prev, newProject]);
        setActiveProjectId(newProject.id);
        setIsNewProjectDialogOpen(false);
        toast({ title: "Project Created", description: `"${name}" has been created and set as active.` });
        if (pendingAction) {
          executePendingAction();
        }
    }
  };
  
  const handleUpdateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectToEdit) return;
    const form = editProjectFormRef.current;
    if (!form) return;

    const formData = new FormData(form);
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;

    if (name) {
        setProjects(projects.map(p => p.id === projectToEdit.id ? { ...p, name, description } : p));
        setProjectToEdit(null);
        toast({ title: "Project Updated", description: `"${name}" has been updated.` });
    }
  }
  
  const handleDeleteProject = (projectId: string) => {
      const project = projects.find(p => p.id === projectId);
      if(!project) return;
      
      setProjects(prev => prev.filter(p => p.id !== projectId));
      setPins(prev => prev.filter(p => p.projectId !== projectId));
      setLines(prev => prev.filter(l => l.projectId !== projectId));
      setAreas(prev => prev.filter(a => a.projectId !== projectId));
      
      if (activeProjectId === projectId) {
          setActiveProjectId(null);
      }
      setSelectedProjectIds(prev => prev.filter(id => id !== projectId));
      
      toast({ title: "Project Deleted", description: `"${project.name}" and all its objects have been deleted.` });
  }

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
  
  const activeProject = projects.find(p => p.id === activeProjectId);

  const handleProjectSelection = (id: string) => {
    setSelectedProjectIds(currentSelection => {
        let newSelection;

        const isAllSelected = currentSelection.includes('all');

        if (id === 'all') {
            return isAllSelected ? [] : ['all'];
        }

        if (isAllSelected) {
             newSelection = [id];
        } else {
            if (currentSelection.includes(id)) {
                newSelection = currentSelection.filter(pId => pId !== id);
            } else {
                newSelection = [...currentSelection, id];
            }
        }
        
        const allProjectIds = projects.map(p => p.id);
        const allPossibleSelections = unassignedObjectCount > 0 ? [...allProjectIds, 'unassigned'] : allProjectIds;

        if (newSelection.length === allPossibleSelections.length) {
            return ['all'];
        }
        
        if (newSelection.length === 0) {
            return ['all'];
        }

        return newSelection;
    });
};


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
            />
            
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000] pointer-events-none">
                <Plus className="h-8 w-8 text-blue-500" />
            </div>

            <div className="absolute top-4 left-4 z-[1001] flex flex-col gap-2">
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
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-6 w-6">
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
                </TooltipProvider>
            </div>

            {isObjectListOpen && (
              <Card className="absolute top-4 left-20 z-[1002] w-[350px] sm:w-[400px] h-[calc(100%-2rem)] flex flex-col bg-card/90 backdrop-blur-sm">
                <div className="p-4 border-b flex justify-between items-center">
                    <h2 className="text-lg font-semibold">Map Objects</h2>
                    <Button variant="ghost" size="icon" onClick={() => setIsObjectListOpen(false)} className="h-8 w-8">
                        <X className="h-4 w-4" />
                    </Button>
                </div>
                
                <div className="p-4 border-b space-y-2">
                    <div className='flex justify-between items-center'>
                        <h3 className="text-md font-semibold">Projects</h3>
                        <Button variant="outline" size="sm" onClick={() => setIsNewProjectDialogOpen(true)}>
                            <FolderPlus className="mr-2 h-4 w-4"/> New
                        </Button>
                    </div>
                     <div className="border-t -mx-4 px-4 pt-4 mt-2">
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
                                All Projects
                            </label>
                        </div>
                    </div>
                    <ScrollArea className="h-32 -mx-4 px-4">
                        <ul className="space-y-2 pt-2">
                            {projects.map(project => (
                                <li key={project.id} className="flex items-center justify-between p-2 rounded-md border bg-card/50">
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
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                                            setProjectToEdit(project)
                                        }}><Pencil className="h-4 w-4"/></Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4"/></Button>
                                            </AlertDialogTrigger>
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
                <div className="flex gap-2 justify-end">
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

                  <div className="flex flex-col gap-1 bg-background rounded-full shadow-lg border">
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
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>
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
      
      <Dialog open={isNewProjectDialogOpen} onOpenChange={setIsNewProjectDialogOpen}>
        <DialogContent className="z-[1003]">
            <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
                <DialogDescription>Enter a name and optional description for your new project.</DialogDescription>
            </DialogHeader>
            <form ref={newProjectFormRef} onSubmit={handleCreateNewProject} className="space-y-4">
                <Input name="name" placeholder="Project Name" required />
                <Textarea name="description" placeholder="Project Description (optional)" />
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
            <form ref={editProjectFormRef} onSubmit={handleUpdateProject} className="space-y-4">
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
        <DialogContent className="z-[1003]">
          <DialogHeader>
            <DialogTitle>Assign to Project</DialogTitle>
            <DialogDescription>Select a project to assign this new object to, or create a new one.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            {projects.map(project => (
              <Button
                key={project.id}
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  setActiveProjectId(project.id);
                  setIsAssignProjectDialogOpen(false);
                }}
              >
                {project.name}
              </Button>
            ))}
            {projects.length === 0 && <p className="text-sm text-muted-foreground text-center">No projects exist yet.</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => { setIsAssignProjectDialogOpen(false); setPendingAction(null); }}>Cancel</Button>
            <Button
              onClick={() => {
                setIsAssignProjectDialogOpen(false);
                setIsNewProjectDialogOpen(true);
              }}>
              <FolderPlus className="mr-2 h-4 w-4" /> Create New Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
