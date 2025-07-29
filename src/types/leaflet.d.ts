import 'leaflet';
import 'leaflet-geometryutil';

declare module 'leaflet' {
    namespace GeometryUtil {
        function geodesicArea(latlngs: LatLng[]): number;
        // Add other functions from leaflet-geometryutil if needed
    }
}
