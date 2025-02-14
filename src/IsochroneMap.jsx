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
                
                // 16 farklı yönde 500m mesafede noktalar oluştur
                const directions = 16;
                const radius = 0.005; // yaklaşık 500m

                for (let i = 0; i < directions; i++) {
                    const angle = (2 * Math.PI * i) / directions;
                    const destLng = position[1] + radius * Math.cos(angle);
                    const destLat = position[0] + radius * Math.sin(angle);
                    
                    // OSRM ile rota hesapla
                    const response = await fetch(
                        `https://router.project-osrm.org/route/v1/driving/${position[1]},${position[0]};${destLng},${destLat}?geometries=geojson&overview=full`
                    );

                    if (!response.ok) continue;
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

                        // Yol kesişimlerini kontrol et
                        const nearbyResponse = await fetch(
                            `https://router.project-osrm.org/nearest/v1/driving/${coordinates[Math.floor(coordinates.length/2)][0]},${coordinates[Math.floor(coordinates.length/2)][1]}?number=3`
                        );
                        
                        if (nearbyResponse.ok) {
                            const nearbyData = await nearbyResponse.json();
                            if (nearbyData.waypoints) {
                                for (const waypoint of nearbyData.waypoints) {
                                    points.add(JSON.stringify([waypoint.location[0], waypoint.location[1]]));
                                }
                            }
                        }
                    }
                }

                // Set'ten array'e çevir ve parse et
                const uniquePoints = Array.from(points).map(p => JSON.parse(p));

                // Convex Hull hesaplama
                const hull = computeConvexHull(uniquePoints);

                // Sınır noktalarını yumuşat
                const smoothedHull = smoothPoints(hull, 0.3);

                setIsochrone(smoothedHull);
            } catch (error) {
                console.error("Error fetching road data:", error);
            }
        }

        fetchRoadsAndComputeIsochrone();
    }, [position, setIsochrone]);

    return <Marker position={position} />;
}

// Convex Hull hesaplama (Graham Scan algoritması)
function computeConvexHull(points) {
    if (points.length < 3) return points;

    // En düşük y koordinatlı noktayı bul
    let bottomPoint = points[0];
    for (let i = 1; i < points.length; i++) {
        if (points[i][1] < bottomPoint[1] || 
            (points[i][1] === bottomPoint[1] && points[i][0] < bottomPoint[0])) {
            bottomPoint = points[i];
        }
    }

    // Noktaları açıya göre sırala
    const sortedPoints = points
        .filter(p => p !== bottomPoint)
        .sort((a, b) => {
            const angleA = Math.atan2(a[1] - bottomPoint[1], a[0] - bottomPoint[0]);
            const angleB = Math.atan2(b[1] - bottomPoint[1], b[0] - bottomPoint[0]);
            return angleA - angleB;
        });

    // Graham Scan
    const hull = [bottomPoint];
    for (const point of sortedPoints) {
        while (hull.length >= 2) {
            const p1 = hull[hull.length - 2];
            const p2 = hull[hull.length - 1];
            if (crossProduct(p1, p2, point) > 0) break;
            hull.pop();
        }
        hull.push(point);
    }

    return hull;
}

// Çapraz çarpım
function crossProduct(p1, p2, p3) {
    return (p2[0] - p1[0]) * (p3[1] - p1[1]) - 
           (p2[1] - p1[1]) * (p3[0] - p1[0]);
}

// Noktaları yumuşatma
function smoothPoints(points, tension = 0.3) {
    if (points.length < 3) return points;

    const smoothed = [];
    const len = points.length;

    for (let i = 0; i < len; i++) {
        const p0 = points[(i - 1 + len) % len];
        const p1 = points[i];
        const p2 = points[(i + 1) % len];
        const p3 = points[(i + 2) % len];

        // Catmull-Rom spline
        for (let t = 0; t < 1; t += 0.1) {
            const t2 = t * t;
            const t3 = t2 * t;

            const x = 0.5 * ((2 * p1[0]) +
                (-p0[0] + p2[0]) * t +
                (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
                (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);

            const y = 0.5 * ((2 * p1[1]) +
                (-p0[1] + p2[1]) * t +
                (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
                (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);

            smoothed.push([x, y]);
        }
    }

    return smoothed;
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
