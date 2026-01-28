/**
 * 通用 NeoDB Shelf 加载器（一次请求多个分类，混合排序）
 */
function initShelfLoader({ containerId, loadMoreBtnId, categories, workerBase }) {
  const container = document.getElementById(containerId);
  const loadMoreBtn = document.getElementById(loadMoreBtnId);
  let currentPage = 1;
  let isLoading = false;
  let hasMore = true;

  async function loadList() {
    if (isLoading || !hasMore) return;
    isLoading = true;
    loadMoreBtn.textContent = '正在加载';

    try {
      const query = new URLSearchParams();
      categories.forEach(cat => query.append('category', cat));
      query.append('page', currentPage);

      const res = await fetch(`${workerBase}?${query.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (!Array.isArray(data.data) || data.data.length === 0) {
        hasMore = false;
      } else {
        // 按标记时间混合排序（降序）
        const allData = data.data.sort((a,b) => {
          const t1 = a.updated_at ? new Date(a.updated_at).getTime() : 0;
          const t2 = b.updated_at ? new Date(b.updated_at).getTime() : 0;
          return t2 - t1;
        });
        render(allData);
        hasMore = data.data.length >= 20;
      }

      if (!hasMore) loadMoreBtn.style.display = 'none';
      else loadMoreBtn.textContent = '加载更多';

    } catch (err) {
      console.error(err);
      loadMoreBtn.textContent = '加载失败，点击重试';
    } finally {
      isLoading = false;
    }
  }

  function render(items) {
    items.forEach(v => {
      const it = v.item;
      const el = document.createElement('div');
      el.className = 'shelf-item';
      el.innerHTML = `
        <a href="${it.id}" target="_blank" rel="noreferrer">
          <img class="item-cover" src="${it.cover_image_url}" alt="${it.display_title}">
        </a>
        <div class="item-info">
          <div class="item-title">${it.display_title}</div>
          <div class="item-meta">
            ${it.rating ? `${it.rating}★（${it.rating_count} 人）` : '暂无评分'}
          </div>
        </div>
      `;
      container.appendChild(el);
    });
  }

  loadMoreBtn.addEventListener('click', () => {
    if (!isLoading && hasMore) {
      currentPage++;
      loadList();
    }
  });

  // 初次加载
  loadList();
}