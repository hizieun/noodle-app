import { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from 'react-leaflet';
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

// 프로그램적 이동 표시: ref를 true로 두고 애니메이션 시간 뒤 자동 해제(moveend 발생 여부에 의존 X).
function markProgrammatic(programmaticRef, ms) {
  programmaticRef.current = true;
  const t = setTimeout(() => { programmaticRef.current = false; }, ms);
  return () => clearTimeout(t);
}

// 필터 변경 시 지도 중심 이동
function MapController({ restaurants, programmaticRef }) {
  const map = useMap();
  useEffect(() => {
    if (restaurants.length === 0) return;
    const validCoords = restaurants
      .filter(r => r.lat && r.lng)
      .map(r => [r.lat, r.lng]);
    if (validCoords.length === 0) return;
    const clear = markProgrammatic(programmaticRef, 500);
    map.fitBounds(validCoords, { padding: [40, 40], maxZoom: 14 });
    return clear;
  }, [restaurants, map, programmaticRef]);
  return null;
}

// 하단 시트에서 항목 선택 시 해당 위치로 비행 (모션 감소 선호 시 즉시 이동)
function MapFocus({ focus, programmaticRef }) {
  const map = useMap();
  useEffect(() => {
    if (!focus) return;
    const z = Math.max(map.getZoom(), 15);
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const clear = markProgrammatic(programmaticRef, 800);
    if (reduced) map.setView([focus.lat, focus.lng], z, { animate: false });
    else map.flyTo([focus.lat, focus.lng], z, { duration: 0.6 });
    return clear;
  }, [focus, map, programmaticRef]);
  return null;
}

// 사용자가 지도를 움직이면 재검색 버튼 노출. 프로그램적 이동 창(window) 동안은 무시. 맵 인스턴스도 상위로 전달.
function MapEvents({ programmaticRef, onUserMove, onReady }) {
  const map = useMapEvents({
    moveend() {
      if (programmaticRef.current) return;
      onUserMove();
    },
  });
  useEffect(() => { onReady(map); }, [map, onReady]);
  return null;
}

const distanceLabel = (d) =>
  d == null ? null : d < 1 ? `${Math.round(d * 1000)}m` : `${d.toFixed(1)}km`;

const SHEET_MAX = 100; // ponytail: 상위 100개만 렌더(거리·평점 정렬이라 나머지는 지도로), 가상스크롤은 필요해지면

export default function MapView({ restaurants, onCardClick, userLocation, nearbyRadius, category }) {
  const [activeMarker, setActiveMarker] = useState(null);
  const [sheetExpanded, setSheetExpanded] = useState(true);
  const [focus, setFocus] = useState(null);
  const [moved, setMoved] = useState(false);   // 사용자가 지도를 움직였나 → 재검색 버튼
  const [bounds, setBounds] = useState(null);   // 활성 뷰포트 필터
  const programmaticRef = useRef(false);
  const mapRef = useRef(null);

  // 메모: mapped 참조가 매 렌더 새로 생기면 MapController가 계속 refit → 재검색 감지가 깨짐
  const mapped = useMemo(() => restaurants.filter(r => r.lat && r.lng), [restaurants]);
  const missing = restaurants.length - mapped.length;
  // 뷰포트 재검색이 켜지면 화면 영역 안 식당만 목록에
  const listed = useMemo(
    () => (bounds ? mapped.filter(r => bounds.contains([r.lat, r.lng])) : mapped),
    [bounds, mapped],
  );

  const handleRow = (r) => {
    setFocus({ lat: r.lat, lng: r.lng, k: `${r.상호명}-${r.lat}-${r.lng}` });
    onCardClick(r);
  };
  const research = () => {
    if (!mapRef.current) return;
    setBounds(mapRef.current.getBounds());
    setMoved(false);
  };
  // 데이터(필터) 바뀌면 뷰포트 필터 해제 — 렌더 중 조정(React 권장, effect 아님)
  const [prevRestaurants, setPrevRestaurants] = useState(restaurants);
  if (restaurants !== prevRestaurants) {
    setPrevRestaurants(restaurants);
    setBounds(null);
    setMoved(false);
  }

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
        <MapController restaurants={mapped} programmaticRef={programmaticRef} />
        <MapFocus focus={focus} programmaticRef={programmaticRef} />
        <MapEvents
          programmaticRef={programmaticRef}
          onUserMove={() => setMoved(true)}
          onReady={(m) => { mapRef.current = m; }}
        />
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

      {moved && (
        <button className="map-research" onClick={research}>
          <span aria-hidden="true">🔍</span> 이 지역 재검색
        </button>
      )}

      <div className={`map-sheet ${sheetExpanded ? 'expanded' : ''}`}>
        {bounds && (
          <button className="map-sheet-reset" onClick={() => setBounds(null)}>전체 보기</button>
        )}
        <button
          className="map-sheet-handle"
          onClick={() => setSheetExpanded(v => !v)}
          aria-expanded={sheetExpanded}
          aria-label={sheetExpanded ? '목록 접기' : '목록 펼치기'}
        >
          <span className="map-sheet-grip" />
          <span className="map-sheet-count">{bounds ? '이 지역 ' : ''}{listed.length.toLocaleString()}곳</span>
        </button>
        <div className="map-sheet-list">
          {listed.length === 0 && (
            <p className="map-sheet-more">이 지역에 표시할 맛집이 없어요. 지도를 옮겨보세요.</p>
          )}
          {listed.slice(0, SHEET_MAX).map((r, i) => {
            const dist = distanceLabel(r.distance);
            return (
              <button key={`${r.상호명}-${i}`} className="map-sheet-row" onClick={() => handleRow(r)}>
                <span className="map-sheet-emoji" aria-hidden="true">{r.emoji}</span>
                <span className="map-sheet-body">
                  <span className="map-sheet-name">{r.cleanName}</span>
                  <span className="map-sheet-meta">
                    <span>{r.지역}</span>
                    {r.평점 !== '정보 없음' && <span className="map-sheet-rating">★ {r.평점}</span>}
                    {dist && <span className="map-sheet-dist">{dist}</span>}
                  </span>
                </span>
              </button>
            );
          })}
          {listed.length > SHEET_MAX && (
            <p className="map-sheet-more">외 {(listed.length - SHEET_MAX).toLocaleString()}곳은 지도에서 확인하세요</p>
          )}
        </div>
      </div>
    </div>
  );
}
