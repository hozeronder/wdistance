import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polygon, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "leaflet-routing-machine";

const API_URL = "https://api.mapbox.com/directions/v5/mapbox/driving"; // Ücretli API servisini burada kullan
const ACCESS_TOKEN = "pk.eyJ1Ijoib3plcm9uZGVyIiwiYSI6IlZWdkNxRWMifQ.UBJXKskXlY5DfdXfUUQ9ow"; // Mapbox veya başka bir hizmetin erişim anahtarı

function LocationMarker({ setIsochrone }) {
    const [position, setPosition] = useState([40.73061, -73.935242]); // Varsayılan konum

    useMapEvents({
        click(e) {
            setPosition([e.latlng.lat, e.latlng.lng]);
        },
    });

    useEffect(() => {
        async function fetchRoadsAndComputeIsochrone() {
            if (!position) return;
            try {
                const points = new Set(); // Tekrarlayan noktaları önlemek için Set kullan
                const searchRadius = 0.005; // Yaklaşık 500m
                
                // Çevrede 16 farklı yönde noktalar oluştur (daha fazla yol yakalamak için)
                const directions = 16;
                for (let i = 0; i < directions; i++) {
                    const angle = (2 * Math.PI * i) / directions;
                    const destLng = position[1] + searchRadius * Math.cos(angle);
                    const destLat = position[0] + searchRadius * Math.sin(angle);
                    
                    // Her yön için rota hesapla
                    const response = await fetch(
                        `${API_URL}/${position[1]},${position[0]};${destLng},${destLat}?geometries=geojson&access_token=${ACCESS_TOKEN}`
                    );

                    if (!response.ok) throw new Error("Failed to fetch route data");
                    const data = await response.json();

                    if (data.routes && data.routes.length > 0) {
                        const coordinates = data.routes[0].geometry.coordinates;
                        let cumulativeDistance = 0;
                        let prevCoord = null;

                        for (const coord of coordinates) {
                            if (prevCoord) {
                                const segmentDistance = L.latLng(prevCoord[1], prevCoord[0])
                                    .distanceTo(L.latLng(coord[1], coord[0]));
                                cumulativeDistance += segmentDistance;

                                if (cumulativeDistance <= 500) {
                                    points.add(JSON.stringify(coord));
                                } else {
                                    // 500m sınırındaki noktayı interpolasyon ile bul
                                    const ratio = (500 - (cumulativeDistance - segmentDistance)) / segmentDistance;
                                    const finalLng = prevCoord[0] + (coord[0] - prevCoord[0]) * ratio;
                                    const finalLat = prevCoord[1] + (coord[1] - prevCoord[1]) * ratio;
                                    points.add(JSON.stringify([finalLng, finalLat]));
                                    break;
                                }
                            }
                            prevCoord = coord;
                        }
                    }
                }

                // Set'ten array'e çevir ve parse et
                const uniquePoints = Array.from(points).map(p => JSON.parse(p));

                // Noktaları saat yönünde sırala
                if (uniquePoints.length > 0) {
                    const center = [
                        uniquePoints.reduce((sum, p) => sum + p[1], 0) / uniquePoints.length,
                        uniquePoints.reduce((sum, p) => sum + p[0], 0) / uniquePoints.length
                    ];
                    
                    uniquePoints.sort((a, b) => {
                        const angleA = Math.atan2(a[1] - center[0], a[0] - center[1]);
                        const angleB = Math.atan2(b[1] - center[0], b[0] - center[1]);
                        return angleA - angleB;
                    });
                }

                setIsochrone(uniquePoints);
            } catch (error) {
                console.error("Error fetching road data:", error);
            }
        }

        fetchRoadsAndComputeIsochrone();
    }, [position, setIsochrone]);

    return <Marker position={position} />;
}

export default function IsochroneMap() {
    const [isochrone, setIsochrone] = useState([]);

    return (
        <MapContainer center={[40.73061, -73.935242]} zoom={13} style={{ height: "100vh", width: "100%" }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <LocationMarker setIsochrone={setIsochrone} />
            {isochrone.length > 0 && <Polygon positions={isochrone.map(coord => [coord[1], coord[0]])} color="blue" />}
        </MapContainer>
    );
}
