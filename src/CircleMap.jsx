import { useState } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

function LocationMarker({ setCenter, setIsMarkerSet }) {
    const [position, setPosition] = useState([39.89709760852835, 32.84208856284894]);

    useMapEvents({
        click(e) {
            setPosition([e.latlng.lat, e.latlng.lng]);
            setCenter([e.latlng.lat, e.latlng.lng]);
            setIsMarkerSet(true);
        },
    });

    return <Marker position={position} />;
}

export default function CircleMap() {
    const [center, setCenter] = useState([39.89709760852835, 32.84208856284894]);
    const [isMarkerSet, setIsMarkerSet] = useState(false);

    return (
        <MapContainer 
            center={center} 
            zoom={13} 
            style={{ height: "100vh", width: "100%" }}
        >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <LocationMarker 
                setCenter={setCenter} 
                setIsMarkerSet={setIsMarkerSet} 
            />
            
            {/* 500 metre yarıçaplı daire */}
            {isMarkerSet && (
                <Circle 
                    center={center}
                    radius={500}
                    color="red"
                    weight={2}
                    fill={false}
                    dashArray="5, 10"
                />
            )}
        </MapContainer>
    );
} 