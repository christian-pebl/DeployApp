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
    GeometryUtil
} from 'leaflet';

declare global {
  var L: {
    map: (element: string | HTMLElement, options?: MapOptions) => LeafletMap;
    tileLayer: (urlTemplate: string, options?: TileLayerOptions) => TileLayer;
    marker: (latlng: LatLngExpression, options?: MarkerOptions) => LeafletMarker;
    latLng: (latitude: number, longitude: number) => LatLng;
    divIcon: (options: DivIconOptions) => DivIcon;
    control: {
        zoom: (options: { position: string }) => Control.Zoom
    };
    GeometryUtil: GeometryUtil;
  };
}
