import { useState } from "react";
import { MapContainer, TileLayer, Marker, Polygon, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "leaflet-routing-machine";

export default function IsochroneMap() {
    const [routeCoords, setRouteCoords] = useState([]); // Rota koordinatları
    const [position, setPosition] = useState([40.73061, -73.935242]); // Varsayılan konum (New York)

    function LocationMarker() {
        useMapEvents({
            click(e) {
                setPosition([e.latlng.lat, e.latlng.lng]); // Tıklanan noktayı al
                calculateRoute(e.latlng.lat, e.latlng.lng); // Rota hesapla
            },
        });

        return <Marker position={position} />;
    }

    async function calculateRoute(lat, lng) {
        // Leaflet Routing Machine ile güzergah oluştur
        const routingControl = L.Routing.control({
            waypoints: [L.latLng(lat, lng), L.latLng(lat + 0.01, lng + 0.01)], // Örnek güzergah
            routeWhileDragging: true,
            createMarker: () => null, // Fazladan marker eklenmesini önler
            addWaypoints: false,
        }).addTo(map);

        routingControl.on("routesfound", function (e) {
            const coords = e.routes[0].coordinates.map((coord) => [coord.lat, coord.lng]);
            setRouteCoords(coords); // Hesaplanan güzergahı kaydet
        });
    }

    return (
        <MapContainer center={position} zoom={13} style={{ height: "100vh", width: "100%" }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <LocationMarker />
            {routeCoords.length > 0 && <Polygon positions={routeCoords} color="blue" />}
        </MapContainer>
    );
}