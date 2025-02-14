import { useState } from "react";
import { MapContainer, TileLayer, Marker, Polygon, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "leaflet-routing-machine";

// METRE CİNSİNDEN UZAKLIK LİMİTİ (Örneğin: 1000 metre = 1 km)
const DISTANCE_LIMIT = 500;

export default function IsochroneMap() {
    const [routeCoords, setRouteCoords] = useState([]);
    const [position, setPosition] = useState([40.73061, -73.935242]);

    function LocationMarker() {
        useMapEvents({
            click(e) {
                setPosition([e.latlng.lat, e.latlng.lng]);
                const targetPoint = calculateOffsetPoint(e.latlng.lat, e.latlng.lng, DISTANCE_LIMIT);
                calculateRoute(e.latlng.lat, e.latlng.lng, targetPoint);
            },
        });

        return <Marker position={position} />;
    }

    function calculateOffsetPoint(lat, lng, distance) {
        // Basit küresel hesaplama ile belirli bir mesafede nokta üretme
        const earthRadius = 6371000; // Dünya yarıçapı (metre)
        const dLat = distance / earthRadius * (180 / Math.PI);
        const dLng = dLat / Math.cos(lat * Math.PI / 180);

        return [lat + dLat, lng + dLng]; // Yeni hedef noktayı döndür
    }

    async function calculateRoute(lat, lng, targetPoint) {
        const map = L.map(document.createElement("div"));

        const routingControl = L.Routing.control({
            waypoints: [L.latLng(lat, lng), L.latLng(targetPoint[0], targetPoint[1])],
            routeWhileDragging: false,
            createMarker: () => null,
            addWaypoints: false,
        }).addTo(map);

        routingControl.on("routesfound", function (e) {
            const coords = e.routes[0].coordinates.map((coord) => [coord.lat, coord.lng]);
            setRouteCoords(coords);
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