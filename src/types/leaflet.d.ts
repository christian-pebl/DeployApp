import 'leaflet';

declare module 'leaflet' {
    // This empty declaration is enough to allow the project to compile.
    // The `leaflet-geometryutil` package doesn't have great TS support,
    // so we import it directly where needed and accept the dynamic nature.
}
