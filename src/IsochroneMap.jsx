import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polygon, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "leaflet-routing-machine";

const MAX_DISTANCE = 500; // 500 metre

function LocationMarker({ setIsochrone }) {
    const [position, setPosition] = useState([40.73061, -73.935242]); // Varsayılan konum (New York)

    useMapEvents({
        click(e) {
            setPosition([e.latlng.lat, e.latlng.lng]);
        },
    });

    useEffect(() => {
        async function fetchRoutes() {
            if (!position) return;

            const map = L.map(document.createElement("div"));
            const routingControl = L.Routing.control({
                waypoints: [L.latLng(position[0], position[1])],
                createMarker: () => null,
                router: L.Routing.osrmv1({
                    serviceUrl: "https://router.project-osrm.org/route/v1"
                }),
            }).addTo(map);

            routingControl.on("routesfound", function (e) {
                const routes = e.routes[0].coordinates;
                const filteredPoints = routes.filter(point => {
                    const distance = L.latLng(position).distanceTo([point.lat, point.lng]);
                    return distance <= MAX_DISTANCE;
                });
                setIsochrone(filteredPoints.map(p => [p.lat, p.lng]));
            });

            return () => map.remove();
        }

        fetchRoutes();
    }, [position, setIsochrone]);

    return <Marker position={position} />;
}

export default function IsochroneMap() {
    const [isochrone, setIsochrone] = useState([]);

    return (
        <MapContainer center={[40.73061, -73.935242]} zoom={13} style={{ height: "100vh", width: "100%" }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <LocationMarker setIsochrone={setIsochrone} />
            {isochrone.length > 0 && <Polygon positions={isochrone} color="blue" />}
        </MapContainer>
    );
}
