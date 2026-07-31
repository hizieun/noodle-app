import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';

// Leaflet 기본 마커 이미지 경로 수정 (Vite 빌드 환경 대응)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const userMarkerIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:14px;height:14px;
    background:#3b82f6;
    border:3px solid white;
    border-radius:50%;
    box-shadow:0 0 0 3px rgba(59,130,246,0.3);
  "></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

// 카테고리별 마커 색상
const markerIcon = (category) => {
  const color = category === '야장' ? '#fb923c' : '#f43f5e';
  return L.divIcon({
    className: '',
    html: `<div style="
      width:12px;height:12px;
      background:${color};
      border:2px solid white;
      border-radius:50%;
      box-shadow:0 1px 4px rgba(0,0,0,0.5);
    "></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
};

// 필터 변경 시 지도 중심 이동
function MapController({ restaurants }) {
  const map = useMap();
  useEffect(() => {
    if (restaurants.length === 0) return;
    const validCoords = restaurants
      .filter(r => r.lat && r.lng)
      .map(r => [r.lat, r.lng]);
    if (validCoords.length > 0) {
      map.fitBounds(validCoords, { padding: [40, 40], maxZoom: 14 });
    }
  }, [restaurants, map]);
  return null;
}

export default function MapView({ restaurants, onCardClick, userLocation, nearbyRadius, category }) {
  const [activeMarker, setActiveMarker] = useState(null);

  const mapped = restaurants.filter(r => r.lat && r.lng);
  const missing = restaurants.length - mapped.length;

  return (
    <div className="map-wrapper">
      {missing > 0 && (
        <div className="map-notice">
          📍 {mapped.length}개 표시 중 ({missing}개는 좌표 없음)
        </div>
      )}
      <MapContainer
        center={[37.5665, 126.9780]}
        zoom={12}
        className="leaflet-map"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
        />
        <MapController restaurants={mapped} />
        {userLocation && (
          <>
            <Marker position={[userLocation.lat, userLocation.lng]} icon={userMarkerIcon}>
              <Popup>📍 내 위치</Popup>
            </Marker>
            {nearbyRadius < Infinity && (
              <Circle
                center={[userLocation.lat, userLocation.lng]}
                radius={nearbyRadius * 1000}
                pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.08 }}
              />
            )}
          </>
        )}
        <MarkerClusterGroup
          chunkedLoading
          maxClusterRadius={50}
          showCoverageOnHover={false}
          iconCreateFunction={(cluster) => {
            const count = cluster.getChildCount();
            const size = count < 10 ? 32 : count < 50 ? 38 : 44;
            const color = category === '야장' ? 'rgba(251,146,60,0.88)' : 'rgba(244,63,94,0.88)';
            return L.divIcon({
              className: '',
              html: `<div style="
                width:${size}px;height:${size}px;
                background:${color};
                border:2px solid rgba(255,255,255,0.8);
                border-radius:50%;
                display:flex;align-items:center;justify-content:center;
                color:white;font-size:${count < 100 ? 12 : 10}px;font-weight:700;
                box-shadow:0 2px 8px rgba(0,0,0,0.4);
              ">${count}</div>`,
              iconSize: [size, size],
              iconAnchor: [size / 2, size / 2],
            });
          }}
        >
          {mapped.map((r, i) => (
            <Marker
              key={`${r.상호명}-${i}`}
              position={[r.lat, r.lng]}
              icon={markerIcon(r.카테고리)}
              eventHandlers={{
                click: () => setActiveMarker(activeMarker === i ? null : i),
              }}
            >
              <Popup className="map-popup">
                <div className="map-popup-inner">
                  <strong>{r.emoji} {r.cleanName}</strong>
                  <span className="map-popup-region">{r.지역}</span>
                  {r.평점 !== '정보 없음' && (
                    <span className="map-popup-rating">⭐ {r.평점}</span>
                  )}
                  {r.대표메뉴 && (
                    <span className="map-popup-menu">{r.대표메뉴.split(',').slice(0, 2).join(', ')}</span>
                  )}
                  <button
                    className="map-popup-btn"
                    onClick={() => onCardClick(r)}
                  >
                    자세히 보기 →
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}
