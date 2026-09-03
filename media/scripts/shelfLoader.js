/**
 * 通用 NeoDB Shelf 加载器（一次请求多个分类，混合排序）
 */
function initShelfLoader({ containerId, loadMoreBtnId, categories, workerBase }) {
  const container = document.getElementById(containerId);
  const loadMoreBtn = document.getElementById(loadMoreBtnId);
  if (!container || !loadMoreBtn) return;

  let currentPage = 1;
  let isLoading = false;
  let hasMore = true;
  const renderedItems = new Set();

  function normalizedLanguage(language) {
    return String(language || '').trim().toLowerCase().replace(/_/g, '-');
  }

  function preferredTitle(item) {
    const localizedTitles = Array.isArray(item && item.localized_title)
      ? item.localized_title
      : [];
    // NeoDB 的 display_title 目前可能采用英文；主动选取中文本地化标题。
    // 同一语言有多个别名时，NeoDB 通常把主标题放在最前面。
    const languagePriority = [
      'zh-cn', 'zh-hans', 'zh-sg', 'zh-my',
      'zh', 'zh-hant', 'zh-tw', 'zh-hk'
    ];

    for (const language of languagePriority) {
      const match = localizedTitles.find(title =>
        normalizedLanguage(title && title.lang) === language &&
        typeof title.text === 'string' && title.text.trim()
      );
      if (match) return match.text.trim();
    }

    const fallback = [item && item.display_title, item && item.title]
      .find(title => typeof title === 'string' && title.trim());
    return fallback ? fallback.trim() : '未命名条目';
  }

  function safeHttpUrl(value) {
    try {
      const url = new URL(value, window.location.href);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch (_) {
      return '';
    }
  }

  function itemKey(entry, index) {
    const item = entry && entry.item;
    return String(
      (item && (item.uuid || item.id || item.api_url)) ||
      (entry && entry.post_id) || `${currentPage}-${index}`
    );
  }

  async function loadList() {
    if (isLoading || !hasMore) return;
    isLoading = true;
    loadMoreBtn.disabled = true;
    loadMoreBtn.textContent = '正在加载';

    try {
      const query = new URLSearchParams();
      categories.forEach(category => query.append('category', category));
      query.append('page', currentPage);

      const response = await fetch(`${workerBase}?${query.toString()}`, {
        headers: { 'Accept': 'application/json', 'Accept-Language': 'zh-CN,zh;q=0.9' }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const payload = await response.json();
      if (!payload || !Array.isArray(payload.data)) {
        throw new Error('NeoDB 返回了无法识别的数据格式');
      }

      if (payload.data.length === 0) {
        hasMore = false;
      } else {
        const sortedItems = payload.data.slice().sort((a, b) => {
          const firstDate = a.updated_at || a.created_time;
          const secondDate = b.updated_at || b.created_time;
          const firstTime = firstDate ? new Date(firstDate).getTime() : 0;
          const secondTime = secondDate ? new Date(secondDate).getTime() : 0;
          return secondTime - firstTime;
        });
        render(sortedItems);
        hasMore = payload.data.length >= 20;
        currentPage += 1;
      }

      if (!hasMore) loadMoreBtn.style.display = 'none';
      else loadMoreBtn.textContent = '加载更多';
    } catch (error) {
      console.error('NeoDB 观影记录加载失败：', error);
      // 页码只在成功后递增，因此点击重试不会跳过失败的那一页。
      loadMoreBtn.textContent = '加载失败，点击重试';
    } finally {
      isLoading = false;
      loadMoreBtn.disabled = false;
    }
  }

  function render(entries) {
    const fragment = document.createDocumentFragment();

    entries.forEach((entry, index) => {
      const item = entry && entry.item;
      if (!item) return;

      const key = itemKey(entry, index);
      if (renderedItems.has(key)) return;
      renderedItems.add(key);

      const title = preferredTitle(item);
      const itemElement = document.createElement('div');
      itemElement.className = 'shelf-item';

      const link = document.createElement('a');
      const detailUrl = safeHttpUrl(item.id);
      if (detailUrl) {
        link.href = detailUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }

      const cover = document.createElement('img');
      cover.className = 'item-cover';
      cover.alt = title;
      cover.loading = 'lazy';
      cover.decoding = 'async';
      const coverUrl = safeHttpUrl(item.cover_image_url);
      if (coverUrl) cover.src = coverUrl;
      link.appendChild(cover);

      const info = document.createElement('div');
      info.className = 'item-info';
      const titleElement = document.createElement('div');
      titleElement.className = 'item-title';
      titleElement.textContent = title;

      const meta = document.createElement('div');
      meta.className = 'item-meta';
      const rating = Number(item.rating);
      const ratingCount = Number(item.rating_count);
      meta.textContent = Number.isFinite(rating) && rating > 0
        ? `${rating}★（${Number.isFinite(ratingCount) ? ratingCount : 0} 人）`
        : '暂无评分';

      info.append(titleElement, meta);
      itemElement.append(link, info);
      fragment.appendChild(itemElement);
    });

    container.appendChild(fragment);
  }

  loadMoreBtn.addEventListener('click', loadList);
  loadList();
}
