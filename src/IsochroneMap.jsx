import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Polygon, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

const ACCESS_TOKEN = "pk.eyJ1Ijoib3plcm9uZGVyIiwiYSI6IlZWdkNxRWMifQ.UBJXKskXlY5DfdXfUUQ9ow";

function LocationMarker({ setRoads, setPolygon }) {
    const [position, setPosition] = useState([39.89709760852835, 32.84208856284894]);

    useMapEvents({
        click(e) {
            setPosition([e.latlng.lat, e.latlng.lng]);
        },
    });

    useEffect(() => {
        async function fetchRoadsAndCompute() {
            if (!position) return;
            try {
                // Yaya yollarını içeren genişletilmiş sorgu
                const query = `
                    [out:json][timeout:25];
                    (
                        way(around:500,${position[0]},${position[1]})["highway"~"^(footway|pedestrian|path|steps|corridor|crossing|sidewalk|residential|service|unclassified|living_street|track|cycleway|bridleway|tertiary|secondary|primary|tertiary_link|secondary_link|primary_link|trunk|trunk_link|motorway_link)$"];
                        way(around:500,${position[0]},${position[1]})["foot"="yes"];
                        way(around:500,${position[0]},${position[1]})["foot"="designated"];
                        way(around:500,${position[0]},${position[1]})["access"="yes"];
                        way(around:500,${position[0]},${position[1]})["sidewalk"="both"];
                        way(around:500,${position[0]},${position[1]})["sidewalk"="left"];
                        way(around:500,${position[0]},${position[1]})["sidewalk"="right"];
                    );
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
                const processedWays = new Set(); // İşlenmiş yolları takip et

                // Önce tüm node'ları map'e ekle
                data.elements.filter(e => e.type === 'node').forEach(node => {
                    nodeMap.set(node.id, [node.lat, node.lon]);
                });

                // Her yol için en yakın başlangıç noktasını bul
                const ways = data.elements.filter(e => e.type === 'way');
                for (const way of ways) {
                    if (processedWays.has(way.id)) continue;
                    processedWays.add(way.id);

                    // Yolun tüm noktalarını al
                    const wayPoints = way.nodes.map(nodeId => nodeMap.get(nodeId)).filter(Boolean);
                    if (wayPoints.length < 2) continue;

                    // Yolu küçük segmentlere ayır ve her segmenti kontrol et
                    for (let i = 0; i < wayPoints.length - 1; i++) {
                        const startPoint = wayPoints[i];
                        const endPoint = wayPoints[i + 1];
                        
                        // Her iki noktanın da merkeze olan uzaklığını kontrol et
                        const startDist = L.latLng(position).distanceTo(L.latLng(startPoint));
                        const endDist = L.latLng(position).distanceTo(L.latLng(endPoint));

                        // Eğer her iki nokta da 500m'den uzaksa, bu segmenti atla
                        if (startDist > 500 && endDist > 500) continue;

                        // Eğer bir nokta içeride bir nokta dışarıdaysa, kesişim noktasını bul
                        if ((startDist <= 500 && endDist > 500) || (startDist > 500 && endDist <= 500)) {
                            const segmentLength = L.latLng(startPoint).distanceTo(L.latLng(endPoint));
                            const ratio = (500 - startDist) / segmentLength;
                            
                            const intersectionLat = startPoint[0] + (endPoint[0] - startPoint[0]) * ratio;
                            const intersectionLng = startPoint[1] + (endPoint[1] - startPoint[1]) * ratio;
                            const intersectionPoint = [intersectionLat, intersectionLng];

                            if (startDist <= 500) {
                                roads.push([startPoint, intersectionPoint]);
                                boundaryPoints.push(intersectionPoint);
                            } else {
                                roads.push([intersectionPoint, endPoint]);
                                boundaryPoints.push(intersectionPoint);
                            }
                        }
                        // Eğer her iki nokta da 500m içindeyse, segmenti olduğu gibi ekle
                        else if (startDist <= 500 && endDist <= 500) {
                            roads.push([startPoint, endPoint]);
                        }
                    }
                }

                // Sınır noktalarından polygon oluştur
                if (boundaryPoints.length > 2) {
                    const concaveHull = computeConcaveHull(boundaryPoints);
                    const smoothedBoundary = smoothPoints(concaveHull);
                    setPolygon(smoothedBoundary);
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

// Alpha shape algoritması için yardımcı fonksiyon
function computeConcaveHull(points, alpha = 20) {
    if (points.length < 3) return points;

    // Noktaları saat yönünde sırala
    const center = points.reduce((acc, p) => [acc[0] + p[0]/points.length, acc[1] + p[1]/points.length], [0, 0]);
    points.sort((a, b) => {
        const angleA = Math.atan2(a[1] - center[1], a[0] - center[0]);
        const angleB = Math.atan2(b[1] - center[1], b[0] - center[0]);
        return angleA - angleB;
    });

    // Alpha shape algoritması
    const hull = [];
    let prev = points[0];
    hull.push(prev);

    for (let i = 1; i < points.length; i++) {
        const curr = points[i];
        const dist = L.latLng(prev).distanceTo(L.latLng(curr));
        
        if (dist < alpha) {
            hull.push(curr);
            prev = curr;
        }
    }

    // Son nokta ile ilk noktayı bağla
    if (hull.length > 2) {
        const dist = L.latLng(hull[hull.length-1]).distanceTo(L.latLng(hull[0]));
        if (dist < alpha) {
            hull.push(hull[0]);
        }
    }

    return hull;
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
        <MapContainer center={[39.89709760852835, 32.84208856284894]} zoom={13} style={{ height: "100vh", width: "100%" }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <LocationMarker setRoads={setRoads} setPolygon={setPolygon} />
            
            {/* Yolları mavi çizgilerle göster */}
            {roads.map((road, i) => (
                <Polyline 
                    key={i} 
                    positions={road} 
                    color="blue" 
                    weight={4} 
                    opacity={0.8}
                    dashArray="5, 10" 
                />
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
