import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Polygon, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

const ACCESS_TOKEN = "pk.eyJ1Ijoib3plcm9uZGVyIiwiYSI6IlZWdkNxRWMifQ.UBJXKskXlY5DfdXfUUQ9ow";

function LocationMarker({ setRoads, setPolygon }) {
    const [position, setPosition] = useState([40.73061, -73.935242]);

    useMapEvents({
        click(e) {
            setPosition([e.latlng.lat, e.latlng.lng]);
        },
    });

    useEffect(() => {
        async function fetchRoadsAndCompute() {
            if (!position) return;
            try {
                // Overpass API sorgusu - çevredeki yolları al
                const query = `
                    [out:json][timeout:25];
                    way(around:500,${position[0]},${position[1]})["highway"];
                    (._;>;);
                    out body;
                `;

                const response = await fetch('https://overpass-api.de/api/interpreter', {
                    method: 'POST',
                    body: query
                });

                if (!response.ok) throw new Error("Failed to fetch roads");
                const data = await response.json();

                const roads = [];
                const boundaryPoints = [];
                const nodeMap = new Map();

                // Önce tüm node'ları map'e ekle
                data.elements.filter(e => e.type === 'node').forEach(node => {
                    nodeMap.set(node.id, [node.lat, node.lon]);
                });

                // Yolları işle
                const ways = data.elements.filter(e => e.type === 'way');
                for (const way of ways) {
                    const roadPoints = [];
                    let cumulativeDistance = 0;
                    let prevPoint = [position[0], position[1]]; // Başlangıç noktası

                    // Yoldaki her node'u kontrol et
                    for (const nodeId of way.nodes) {
                        const point = nodeMap.get(nodeId);
                        if (!point) continue;

                        const distance = L.latLng(prevPoint).distanceTo(L.latLng(point));
                        cumulativeDistance += distance;

                        if (cumulativeDistance <= 500) {
                            roadPoints.push(point);
                        } else {
                            // 500m sınırındaki noktayı interpolasyon ile bul
                            const ratio = (500 - (cumulativeDistance - distance)) / distance;
                            const finalLat = prevPoint[0] + (point[0] - prevPoint[0]) * ratio;
                            const finalLng = prevPoint[1] + (point[1] - prevPoint[1]) * ratio;
                            const finalPoint = [finalLat, finalLng];
                            
                            roadPoints.push(finalPoint);
                            boundaryPoints.push(finalPoint);
                            break;
                        }

                        prevPoint = point;
                    }

                    if (roadPoints.length > 1) {
                        roads.push(roadPoints);
                    }
                }

                // Sınır noktalarından polygon oluştur
                if (boundaryPoints.length > 2) {
                    const center = [
                        boundaryPoints.reduce((sum, p) => sum + p[0], 0) / boundaryPoints.length,
                        boundaryPoints.reduce((sum, p) => sum + p[1], 0) / boundaryPoints.length
                    ];

                    // Noktaları saat yönünde sırala
                    boundaryPoints.sort((a, b) => {
                        const angleA = Math.atan2(a[1] - center[1], a[0] - center[0]);
                        const angleB = Math.atan2(b[1] - center[1], b[0] - center[0]);
                        return angleA - angleB;
                    });

                    setPolygon(boundaryPoints);
                }

                setRoads(roads);
            } catch (error) {
                console.error("Error:", error);
            }
        }

        fetchRoadsAndCompute();
    }, [position, setRoads, setPolygon]);

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
    const [roads, setRoads] = useState([]);
    const [polygon, setPolygon] = useState([]);

    return (
        <MapContainer center={[40.73061, -73.935242]} zoom={13} style={{ height: "100vh", width: "100%" }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <LocationMarker setRoads={setRoads} setPolygon={setPolygon} />
            
            {/* Yolları mavi çizgilerle göster */}
            {roads.map((road, i) => (
                <Polyline key={i} positions={road} color="blue" weight={3} />
            ))}
            
            {/* Sınır polygonunu sarı renkle göster */}
            {polygon.length > 0 && (
                <Polygon 
                    positions={polygon} 
                    color="yellow" 
                    weight={2}
                    fill={false}
                />
            )}
        </MapContainer>
    );
}
