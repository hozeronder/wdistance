import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polygon, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const API_URL = "https://your-backend-url.com/isochrone"; // Backend API URL

// eslint-disable-next-line react/prop-types
function LocationMarker({ setIsochrone }) {
    const [position, setPosition] = useState([40.73061, -73.935242]); // Varsayılan konum (New York)

    useMapEvents({
        click(e) {
            setPosition([e.latlng.lat, e.latlng.lng]);
        },
    });

    useEffect(() => {
        async function fetchIsochrone() {
            if (!position) return;
            try {
                const response = await fetch(`${API_URL}?lat=${position[0]}&lng=${position[1]}`);
                if (!response.ok) throw new Error("Failed to fetch isochrone data");
                const data = await response.json();
                if (data.geometry && data.geometry.coordinates) {
                    setIsochrone(data.geometry.coordinates[0]);
                }
            } catch (error) {
                console.error("Error fetching isochrone:", error);
            }
        }

        fetchIsochrone();
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
