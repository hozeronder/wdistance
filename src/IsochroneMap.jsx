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
                const points = new Set();
                const visitedSegments = new Set();

                // Başlangıç noktasından çevredeki yolları bulmak için
                // 8 farklı yönde 500m uzaklıkta noktalar oluşturup rota hesaplayalım
                const directions = 8;
                const searchRadius = 0.005; // yaklaşık 500m

                for (let i = 0; i < directions; i++) {
                    const angle = (2 * Math.PI * i) / directions;
                    const destLng = position[1] + searchRadius * Math.cos(angle);
                    const destLat = position[0] + searchRadius * Math.sin(angle);

                    // Her yön için rota al
                    const response = await fetch(
                        `${API_URL}/${position[1]},${position[0]};${destLng},${destLat}?geometries=geojson&access_token=${ACCESS_TOKEN}`
                    );

                    if (!response.ok) continue;
                    const data = await response.json();

                    if (!data.routes || !data.routes.length) continue;

                    // Her rotayı işle
                    for (const route of data.routes) {
                        const coordinates = route.geometry.coordinates;
                        let cumulativeDistance = 0;
                        let prevCoord = null;

                        for (const coord of coordinates) {
                            if (prevCoord) {
                                const segmentKey = `${prevCoord[0]},${prevCoord[1]}-${coord[0]},${coord[1]}`;
                                
                                // Bu segment daha önce ziyaret edildi mi?
                                if (visitedSegments.has(segmentKey)) continue;
                                visitedSegments.add(segmentKey);

                                const segmentDistance = L.latLng(prevCoord[1], prevCoord[0])
                                    .distanceTo(L.latLng(coord[1], coord[0]));
                                cumulativeDistance += segmentDistance;

                                if (cumulativeDistance <= 500) {
                                    points.add(JSON.stringify(coord));

                                    // Yol kesişim noktalarını kontrol et
                                    const intersectionResponse = await fetch(
                                        `${API_URL}/${coord[0]},${coord[1]};${coord[0] + searchRadius},${coord[1]}?geometries=geojson&access_token=${ACCESS_TOKEN}`
                                    );

                                    if (intersectionResponse.ok) {
                                        const intersectionData = await intersectionResponse.json();
                                        if (intersectionData.routes && intersectionData.routes.length > 0) {
                                            // Kesişim noktasından çıkan yolları işle
                                            const remainingDistance = 500 - cumulativeDistance;
                                            const intersectionCoords = intersectionData.routes[0].geometry.coordinates;
                                            
                                            let intersectionPrevCoord = coord;
                                            let intersectionDistance = 0;

                                            for (const intersectionCoord of intersectionCoords) {
                                                const intersectionSegmentKey = `${intersectionPrevCoord[0]},${intersectionPrevCoord[1]}-${intersectionCoord[0]},${intersectionCoord[1]}`;
                                                
                                                if (!visitedSegments.has(intersectionSegmentKey)) {
                                                    visitedSegments.add(intersectionSegmentKey);
                                                    
                                                    const segDist = L.latLng(intersectionPrevCoord[1], intersectionPrevCoord[0])
                                                        .distanceTo(L.latLng(intersectionCoord[1], intersectionCoord[0]));
                                                    intersectionDistance += segDist;

                                                    if (intersectionDistance <= remainingDistance) {
                                                        points.add(JSON.stringify(intersectionCoord));
                                                    } else {
                                                        const ratio = (remainingDistance - (intersectionDistance - segDist)) / segDist;
                                                        const finalLng = intersectionPrevCoord[0] + (intersectionCoord[0] - intersectionPrevCoord[0]) * ratio;
                                                        const finalLat = intersectionPrevCoord[1] + (intersectionCoord[1] - intersectionPrevCoord[1]) * ratio;
                                                        points.add(JSON.stringify([finalLng, finalLat]));
                                                        break;
                                                    }
                                                }
                                                intersectionPrevCoord = intersectionCoord;
                                            }
                                        }
                                    }
                                } else {
                                    // Son geçerli noktayı interpolasyon ile bul
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
