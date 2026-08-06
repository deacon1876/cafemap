/**
 * map.js
 * 카카오맵 초기화, 마커 렌더링, 인포윈도우 관리
 */

let map = null;
let markers = {}; // { restaurantId: kakao.maps.Marker }
let infowindows = {}; // { restaurantId: kakao.maps.InfoWindow }
let currentInfowindow = null;
let hqMarker = null;
let markerPositions = {}; // { restaurantId: {lat, lng} } — 겹치는 매장을 살짝 펼친 실제 표시 좌표

function initMap() {
  const mapContainer = document.getElementById("map");

  if (typeof kakao === "undefined" || !kakao.maps) {
    renderMapKeyNotice(mapContainer);
    return;
  }

  const mapOption = {
    center: new kakao.maps.LatLng(HQ.lat, HQ.lng),
    level: 4
  };

  map = new kakao.maps.Map(mapContainer, mapOption);
  map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);

  // 전체 데이터 기준으로 한 번만 계산 — 필터링 중에도 각 매장의 마커 위치가 흔들리지 않도록 함
  markerPositions = computeMarkerPositions(restaurants);

  drawWalkingRings();
  drawHQMarker();
  renderMarkers(restaurants);

  // 지도 빈 공간 클릭 시 열려있는 인포윈도우 닫기
  kakao.maps.event.addListener(map, "click", () => {
    closeCurrentInfowindow();
  });
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 같은 건물·같은 지점(호텔 상층부, 대형 몰 등)에 몰려있는 매장들은 좌표가 동일하거나
// 거의 같아 마커가 서로 가려 보이지 않는다. 15m 이내로 뭉친 매장들을 찾아 작은 원형으로
// 살짝 펼쳐서 모든 마커가 각각 보이도록 한다.
function computeMarkerPositions(list) {
  const CLUSTER_THRESHOLD_M = 15;
  const clusters = [];

  list.forEach((r) => {
    const cluster = clusters.find(
      (c) => haversineMeters(c.anchorLat, c.anchorLng, r.lat, r.lng) < CLUSTER_THRESHOLD_M
    );
    if (cluster) {
      cluster.members.push(r);
    } else {
      clusters.push({ anchorLat: r.lat, anchorLng: r.lng, members: [r] });
    }
  });

  const positions = {};
  clusters.forEach((cluster) => {
    const n = cluster.members.length;
    if (n === 1) {
      const r = cluster.members[0];
      positions[r.id] = { lat: r.lat, lng: r.lng };
      return;
    }
    // 매장 수가 많을수록 반경을 조금씩 넓혀 겹치지 않게 함
    const radiusMeters = 10 + n * 2.5;
    cluster.members.forEach((r, i) => {
      const angle = (2 * Math.PI * i) / n;
      const dLat = (radiusMeters * Math.cos(angle)) / 111320;
      const dLng =
        (radiusMeters * Math.sin(angle)) / (111320 * Math.cos((cluster.anchorLat * Math.PI) / 180));
      positions[r.id] = { lat: cluster.anchorLat + dLat, lng: cluster.anchorLng + dLng };
    });
  });

  return positions;
}

// 삼성본관 기준 도보 5분 / 10분 반경 원(점선) — 헤더의 시그니처 다이어그램과 동일한 개념을 지도 위에 그대로 표시
function drawWalkingRings() {
  [5, 10].forEach((minutes) => {
    const radiusMeters = minutes * 67;
    new kakao.maps.Circle({
      map,
      center: new kakao.maps.LatLng(HQ.lat, HQ.lng),
      radius: radiusMeters,
      strokeWeight: 1.5,
      strokeColor: "#2A1C3C",
      strokeOpacity: 0.35,
      strokeStyle: "shortdash",
      fillColor: "#2A1C3C",
      fillOpacity: 0.02
    });
  });
}

function drawHQMarker() {
  const position = new kakao.maps.LatLng(HQ.lat, HQ.lng);
  const content = `
    <div class="hq-marker">
      <span class="hq-marker__dot"></span>
      <span class="hq-marker__label">${HQ.name}</span>
    </div>`;
  hqMarker = new kakao.maps.CustomOverlay({
    map,
    position,
    content,
    yAnchor: 1.05,
    zIndex: 10
  });
}

function markerImageForCategory(category) {
  const color = CATEGORY_COLORS[category] || DEFAULT_CATEGORY_COLOR;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 30 40">
      <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 25 15 25s15-14.5 15-25C30 6.7 23.3 0 15 0z" fill="${color}"/>
      <circle cx="15" cy="15" r="6.5" fill="#EFE6F5"/>
    </svg>`;
  const src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
  return new kakao.maps.MarkerImage(src, new kakao.maps.Size(30, 40), {
    offset: new kakao.maps.Point(15, 40)
  });
}

function renderMarkers(list) {
  // 기존 마커 제거
  Object.values(markers).forEach((m) => m.setMap(null));
  markers = {};
  infowindows = {};

  list.forEach((r) => {
    const pos = markerPositions[r.id] || { lat: r.lat, lng: r.lng };
    const position = new kakao.maps.LatLng(pos.lat, pos.lng);
    const marker = new kakao.maps.Marker({
      map,
      position,
      image: markerImageForCategory(r.category),
      title: r.name
    });

    const infowindow = new kakao.maps.InfoWindow({
      content: buildInfowindowContent(r),
      removable: true
    });

    kakao.maps.event.addListener(marker, "click", () => {
      openInfowindow(r.id);
      map.panTo(position);
    });

    markers[r.id] = marker;
    infowindows[r.id] = infowindow;
  });
}

// 웹사이트 아이콘 (외부 링크)
const ICON_WEBSITE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.7-3.8-9s1.3-6.4 3.8-9z"/></svg>`;

function buildBrandTagHtml(r) {
  if (!r.brand || r.brand === "독립") return "";
  return `<div class="iw__room"><span class="brand-tag">${r.brand}</span></div>`;
}

function buildInfowindowContent(r) {
  const color = CATEGORY_COLORS[r.category] || DEFAULT_CATEGORY_COLOR;

  const actions = [];
  if (r.website) {
    actions.push(
      `<a class="iw__icon-btn" href="${r.website}" target="_blank" rel="noopener noreferrer" title="웹사이트">${ICON_WEBSITE}</a>`
    );
  }
  if (r.reviewLink) {
    actions.push(
      `<a class="iw__text-btn" href="${r.reviewLink}" target="_blank" rel="noopener noreferrer">추가 정보 보기</a>`
    );
  }
  const actionsHtml = actions.length ? `<div class="iw__actions">${actions.join("")}</div>` : "";

  return `
    <div class="iw">
      <div class="iw__top">
        <div class="iw__category" style="color:${color}">${r.category} · 도보 ${r.walkMinutes}분</div>
        ${actionsHtml}
      </div>
      <div class="iw__name">${r.name}</div>
      ${buildBrandTagHtml(r)}
      <div class="iw__address">${r.address}</div>
      ${r.phone ? `<div class="iw__phone">${r.phone}</div>` : ""}
    </div>`;
}

function openInfowindow(id) {
  closeCurrentInfowindow();
  const iw = infowindows[id];
  const marker = markers[id];
  if (!iw || !marker) return;
  iw.open(map, marker);
  currentInfowindow = iw;
}

function closeCurrentInfowindow() {
  if (currentInfowindow) {
    currentInfowindow.close();
    currentInfowindow = null;
  }
}

// 리스트 카드 클릭 시 호출: 지도 중심 이동 + 확대 + 인포윈도우 오픈 + 지도로 스크롤
function focusRestaurant(id) {
  const r = restaurants.find((x) => x.id === id);
  if (!r || !map) return;

  const pos = markerPositions[id] || { lat: r.lat, lng: r.lng };
  const position = new kakao.maps.LatLng(pos.lat, pos.lng);
  map.setLevel(3);
  map.panTo(position);
  openInfowindow(id);

  document.getElementById("map").scrollIntoView({ behavior: "smooth", block: "center" });
}

// 특정 목록만 지도에 표시(검색/필터 결과 반영)
function updateMapMarkers(list) {
  if (!map) return;
  closeCurrentInfowindow();
  renderMarkers(list);
}

function renderMapKeyNotice(container) {
  container.innerHTML = `
    <div class="map-notice">
      <strong>카카오맵 JavaScript 키가 필요합니다.</strong>
      <p>index.html 하단의 카카오맵 SDK &lt;script&gt; 태그 <code>appkey=</code> 값을
      발급받은 <b>JavaScript 키</b>로 교체하고, 카카오 개발자 콘솔의
      <b>내 애플리케이션 → 앱 설정 → 플랫폼</b>에서 사용 중인 도메인(로컬/배포 주소)을 등록해주세요.</p>
    </div>`;
}

window.addEventListener("DOMContentLoaded", () => {
  // kakao.maps.load는 index.html에서 autoload=false로 불러온 SDK가 준비된 뒤 실행됨
  if (typeof kakao !== "undefined" && kakao.maps) {
    kakao.maps.load(initMap);
  } else {
    initMap(); // 키 미설정 안내 메시지 출력
  }
});
