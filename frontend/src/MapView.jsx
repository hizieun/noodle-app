import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

// Leaflet 기본 마커 이미지 경로 수정 (Vite 빌드 환경 대응)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
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

export default function MapView({ restaurants, onCardClick }) {
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
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapController restaurants={mapped} />
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
      </MapContainer>
    </div>
  );
}
