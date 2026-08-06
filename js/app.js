/**
 * app.js
 * 검색창, 업태(category) 필터, 브랜드(brand) 필터, 도보거리 필터, 리스트 렌더링 및 지도 연동
 */

const state = {
  query: "",
  category: "전체",  // 업태구분명 기준 (커피숍/다방/편의점/백화점 등)
  brand: "전체",     // 브랜드명 기준 (스타벅스/투썸플레이스/... /독립)
  maxWalk: null      // null = 전체, 5 또는 10
};

const listEl = document.getElementById("restaurant-list");
const countEl = document.getElementById("result-count");
const searchInput = document.getElementById("search-input");
const searchForm = document.getElementById("search-form");
const categoryChips = document.querySelectorAll("[data-category]");
const walkChips = document.querySelectorAll("[data-walk]");
const brandSelect = document.getElementById("brand-select");

function getFilteredList() {
  let list = searchRestaurants(state.query);
  list = filterByCategory(list, state.category);
  list = filterByBrand(list, state.brand);
  list = filterByWalkMinutes(list, state.maxWalk);
  return list.slice().sort((a, b) => a.walkMinutes - b.walkMinutes);
}

function buildBrandTagHtml(r) {
  if (!r.brand || r.brand === "독립") return "";
  return `<div class="card__room"><span class="brand-tag">${r.brand}</span></div>`;
}

function buildCardLinksHtml(r) {
  const links = [];
  if (r.website) {
    links.push(
      `<a class="card__icon-link" href="${r.website}" target="_blank" rel="noopener noreferrer" title="웹사이트" onclick="event.stopPropagation()">${ICON_WEBSITE}</a>`
    );
  }
  if (r.reviewLink) {
    links.push(
      `<a class="card__link" href="${r.reviewLink}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">추가 정보 보기</a>`
    );
  }
  return links.length ? `<div class="card__links">${links.join("")}</div>` : "";
}

function highlight(text, query) {
  if (!query || !text) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    text.slice(0, idx) +
    `<mark>${text.slice(idx, idx + query.length)}</mark>` +
    text.slice(idx + query.length)
  );
}

function renderList() {
  const list = getFilteredList();
  countEl.textContent = list.length;

  if (list.length === 0) {
    listEl.innerHTML = `<li class="empty">조건에 맞는 곳이 없어요. 검색어나 필터를 바꿔보세요.</li>`;
  } else {
    listEl.innerHTML = list
      .map((r, i) => {
        const color = CATEGORY_COLORS[r.category] || DEFAULT_CATEGORY_COLOR;
        return `
        <li class="card" data-id="${r.id}" tabindex="0">
          <div class="card__top">
            <span class="card__badge" style="background:${color}">${r.category}</span>
            <span class="card__walk">도보 ${r.walkMinutes}분</span>
          </div>
          ${buildCardLinksHtml(r)}
          <h3 class="card__name"><span class="card__index">${i + 1}.</span> ${highlight(r.name, state.query)}</h3>
          ${buildBrandTagHtml(r)}
          <p class="card__address">${highlight(r.address, state.query)}</p>
          ${r.phone ? `<p class="card__menu">${r.phone}</p>` : ""}
        </li>`;
      })
      .join("");
  }

  updateMapMarkers(list);
  bindCardEvents();
}

function bindCardEvents() {
  listEl.querySelectorAll(".card").forEach((card) => {
    const id = Number(card.dataset.id);
    const trigger = () => focusRestaurant(id);
    card.addEventListener("click", trigger);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter") trigger();
    });
  });
}

// ── 이벤트 바인딩 ─────────────────────────────

searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  state.query = searchInput.value;
  renderList();
});

searchInput.addEventListener("input", () => {
  state.query = searchInput.value;
  renderList();
});

categoryChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    categoryChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    state.category = chip.dataset.category;
    renderList();
  });
});

walkChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    walkChips.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const val = chip.dataset.walk;
    state.maxWalk = val === "all" ? null : Number(val);
    renderList();
  });
});

if (brandSelect) {
  brandSelect.addEventListener("change", () => {
    state.brand = brandSelect.value;
    renderList();
  });
}

document.addEventListener("DOMContentLoaded", renderList);
