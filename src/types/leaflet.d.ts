import type { 
    Map as LeafletMap, 
    MapOptions,
    TileLayer, 
    TileLayerOptions,
    Marker as LeafletMarker, 
    MarkerOptions,
    Control,
    LatLng,
    LatLngExpression, 
    DivIcon,
    DivIconOptions,
    LeafletEvent,
    Popup,
    LatLngTuple,
    Polyline,
    Polygon,
    LeafletMouseEvent
} from 'leaflet';

declare module 'leaflet' {
    namespace GeometryUtil {
        function geodesicArea(latlngs: LatLng[]): number;
    }
}

declare global {
  var L: {
    map: (element: string | HTMLElement, options?: MapOptions) => LeafletMap;
    tileLayer: (urlTemplate: string, options?: TileLayerOptions) => TileLayer;
    marker: (latlng: LatLngExpression, options?: MarkerOptions) => LeafletMarker;
    latLng: (latitude: number, longitude: number) => LatLng;
    divIcon: (options: DivIconOptions) => DivIcon;
    polyline: (latlngs: LatLngExpression[] | LatLngExpression[][], options?: any) => Polyline;
    polygon: (latlngs: LatLngExpression[] | LatLngExpression[][] | LatLngExpression[][][], options?: any) => Polygon;
    control: {
        zoom: (options: { position: string }) => Control.Zoom
    };
    GeometryUtil?: typeof import('leaflet').GeometryUtil;
    DomEvent: {
        stopPropagation(e: LeafletEvent): any;
    }
  };
}
