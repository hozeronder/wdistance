import { useState } from "react";
import { MapContainer, TileLayer, Marker, Polygon, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

const MAPBOX_ACCESS_TOKEN = "pk.eyJ1Ijoib3plcm9uZGVyIiwiYSI6IlZWdkNxRWMifQ.UBJXKskXlY5DfdXfUUQ9ow";
const API_URL = "https://api.mapbox.com/directions/v5/mapbox/driving";

function LocationMarker({ setIsochrone }) {
    const [position, setPosition] = useState([40.73061, -73.935242]);

    useMapEvents({
        click(e) {
            const newPosition = [e.latlng.lat, e.latlng.lng];
            setPosition(newPosition);
            fetchIsochrone(newPosition, setIsochrone);
        },
    });

    return <Marker position={position} />;
}

async function fetchIsochrone(position, setIsochrone) {
    try {
        const response = await fetch(
            `${API_URL}/${position[1]},${position[0]};${position[1] + 0.005},${position[0] + 0.005}?geometries=geojson&access_token=${MAPBOX_ACCESS_TOKEN}`
        );
        if (!response.ok) throw new Error("Failed to fetch route");
        const data = await response.json();
        const coordinates = data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
        setIsochrone(coordinates);
    } catch (error) {
        console.error("Error fetching isochrone:", error);
    }
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
