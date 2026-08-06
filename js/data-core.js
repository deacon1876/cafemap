/**
 * data-core.js
 * data-part1.js ~ data-part7.js 에서 채워진 RAW_CHUNKS를 조립해 restaurants 배열을 만듭니다.
 * index.html에서 반드시 data-part*.js 파일들을 이 파일보다 먼저 로드해야 합니다.
 */

// 지도 기준점 — 삼성본관
const HQ = {
  name: "삼성본관",
  lat: 37.5623686,
  lng: 126.9755254,
  address: "서울 중구 세종대로 67 (태평로2가 250)"
};

const CATEGORY_COLORS = {
  "커피숍": "#B83B5E",
  "다방": "#8C2F49",
  "기타 휴게음식점": "#9A6B7A",
  "과자점": "#6E4B5E",
  "아이스크림": "#C9738A",
  "전통찻집": "#5B3A46",
  "패스트푸드": "#D98C4A",
  "편의점": "#4A6B6E",
  "백화점": "#5A6E8C",
  "일반조리판매": "#8A8A5A",
  "푸드트럭": "#C97A3B"
};
const DEFAULT_CATEGORY_COLOR = "#7A4A56";
const BRAND_TAG_COLOR = "#C9A227";

class Restaurant {
  constructor(id, name, category, brand, address, lat, lng, phone) {
    this.id = id;
    this.name = name;
    this.category = category;
    this.brand = brand || "독립";
    this.address = address;
    this.lat = lat;
    this.lng = lng;
    this.phone = phone || "";
    this.menu = "";
    this.hours = "";
    this.website = null;
    this.reviewLink = null;
    this.distanceMeters = null;
  }

  get walkMinutes() {
    const R = 6371000;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(this.lat - HQ.lat);
    const dLng = toRad(this.lng - HQ.lng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(HQ.lat)) * Math.cos(toRad(this.lat)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.max(1, Math.round((R * c) / 67));
  }
}

const restaurants = (window.RAW_CHUNKS || []).map((r) => new Restaurant(...r));

function addRestaurant(restaurant) {
  restaurants.push(restaurant);
  return restaurants;
}

function removeRestaurant(id) {
  const idx = restaurants.findIndex((r) => r.id === id);
  if (idx > -1) restaurants.splice(idx, 1);
  return restaurants;
}

function searchRestaurants(query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return restaurants;
  return restaurants.filter((r) =>
    [r.name, r.address, r.category, r.brand].join(" ").toLowerCase().includes(q)
  );
}

function filterByCategory(list, category) {
  if (!category || category === "전체") return list;
  return list.filter((r) => r.category === category);
}

function filterByBrand(list, brand) {
  if (!brand || brand === "전체") return list;
  return list.filter((r) => r.brand === brand);
}

function filterByWalkMinutes(list, maxMinutes) {
  if (!maxMinutes) return list;
  return list.filter((r) => r.walkMinutes <= maxMinutes);
}
