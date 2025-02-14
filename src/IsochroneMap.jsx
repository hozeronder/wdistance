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
                const gridSize = 0.002; // Yaklaşık 200m grid aralığı
                const maxDistance = 500; // metre cinsinden
                
                // Çevredeki grid noktalarını oluştur
                const gridPoints = [];
                for (let lat = position[0] - 0.01; lat <= position[0] + 0.01; lat += gridSize) {
                    for (let lng = position[1] - 0.01; lng <= position[1] + 0.01; lng += gridSize) {
                        gridPoints.push([lng, lat]);
                    }
                }

                // Grid noktalarını 25'erli gruplar halinde işle (API limitleri için)
                for (let i = 0; i < gridPoints.length; i += 25) {
                    const batch = gridPoints.slice(i, i + 25);
                    const coordinates = batch.map(p => `${p[0]},${p[1]}`).join(';');
                    
                    // Matrix API ile mesafeleri hesapla
                    const response = await fetch(
                        `https://api.mapbox.com/directions-matrix/v1/mapbox/driving/${position[1]},${position[0]};${coordinates}?access_token=${ACCESS_TOKEN}`
                    );

                    if (!response.ok) continue;
                    const data = await response.json();

                    // Her grid noktası için mesafeyi kontrol et
                    for (let j = 1; j < data.durations[0].length; j++) {
                        const duration = data.durations[0][j];
                        // Ortalama hız 30 km/s varsayarak mesafeyi hesapla
                        const distance = duration * (30 * 1000 / 3600);
                        
                        if (distance <= maxDistance) {
                            points.add(JSON.stringify(batch[j - 1]));
                        }
                    }
                }

                // Set'ten array'e çevir ve parse et
                const uniquePoints = Array.from(points).map(p => JSON.parse(p));

                // Convex Hull hesaplama (Graham Scan algoritması)
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
