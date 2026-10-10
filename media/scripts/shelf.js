(async () => {
const apiBase = 'https://neodb.yyl125.cc/';
let currentPage = 1;
let isLoading = false;
let hasMore = true;

const listEl = document.getElementById('shelfList');
const loadMoreBtn = document.getElementById('loadMoreBtn');

loadMoreBtn.addEventListener('click', () => {
  if (isLoading || !hasMore) return;
  currentPage++;
  loadList();
});

async function loadList() {
  isLoading = true;
  loadMoreBtn.textContent = '正在加载';
  try {
    const res = await fetch(`https://neodb.yyl125.cc/shelf?page=${currentPage}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (!Array.isArray(data.data) || data.data.length === 0) {
      hasMore = false;
    } else {
      renderList(data.data);
      hasMore = true;  // 如果返回了数据，则认为可能还有下一页
    }
      
    // 判断是否还有更多
    if (!hasMore || data.data.length < 20) {
      loadMoreBtn.style.display = 'none';
    } else {
      loadMoreBtn.style.removeProperty('display'); // 回归 CSS 控制
      loadMoreBtn.textContent = '加载更多';
    }
      
  } catch (err) {
   console.error(err);
   loadMoreBtn.textContent = '加载失败，点击重试';
   loadMoreBtn.disabled = false;
 } finally {
   isLoading = false;
 }
}

function renderList(items) {
  items.forEach(v => {
    const it = v.item;
    const cardHtml = `
      <div class="shelf-item">
      <a href="${it.id}" target="_blank" rel="noreferrer">
        <img class="item-cover" src="${it.cover_image_url}" alt="${it.display_title}">
      </a>
      <div class="item-info">
        <div class="item-title">${it.display_title}</div>
        <div class="item-meta">
          ${it.rating ? `${it.rating}★（${it.rating_count} 人）` : `暂无评分`}
        </div>
      </div>
    </div>`;
    listEl.insertAdjacentHTML('beforeend', cardHtml);
  });
}

  loadList();
})();