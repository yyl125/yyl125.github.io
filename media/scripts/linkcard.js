(function() {
  var favicon = document.querySelector('link[rel~="icon"]');
  var defaultImg = favicon ? favicon.href : new URL('/favicon.ico', location.href).href;
  var externalFallbackImg = 'https://personalblogmedia.oss-cn-hangzhou.aliyuncs.com/img/about/Linkcard.png';
  // Personal sites use the blog favicon for every page under these origins.
  var personalProjectUrls = [
    new URL(defaultImg, location.href).origin,
    location.origin,
    'https://podcast.yyl125.top/',
    'https://newsroom.yyl125.top/',
    'https://navigation.yyl125.top/'
  ];

  function isPersonalContent(url) {
    var target = new URL(url);
    return personalProjectUrls.some(function(value) {
      var project = new URL(value);
      return target.origin === project.origin && (project.pathname === '/' || target.pathname === project.pathname || target.pathname.indexOf(project.pathname.replace(/\/$/, '') + '/') === 0);
    });
  }

  function previewImage(value) {
    try {
      var parsed = new URL(value);
      return /^https?:$/.test(parsed.protocol) ? parsed.href : null;
    } catch (error) { return null; }
  }

  var contentArea = document.getElementById('post-content');
  if (!contentArea) return;

  var cache = {};
  try { cache = JSON.parse(sessionStorage.getItem('linkCardCache') || '{}') || {}; } catch (error) {}
  var requests = {};

  function fullUrl(value) {
    if (!/^https?:\/\/[^\s<>]+$/i.test(value)) return null;
    try {
      var url = new URL(value);
      return url.hostname ? url.href : null;
    } catch (error) { return null; }
  }

  // Process the innermost standalone block only; never replace a layout container.
  function standaloneUrl(block) {
    if (block.closest('pre, code, a.linkcard, .memo-quote-card, .bb-cont')) return null;
    var nodes = Array.prototype.filter.call(block.childNodes, function(node) {
      return node.nodeType !== 8 && !(node.nodeType === 3 && !node.textContent.trim());
    });
    // HTML may include a trailing line break in an otherwise standalone paragraph.
    nodes = nodes.filter(function(node) { return node.nodeName !== 'BR'; });
    if (nodes.length !== 1) return null;
    var node = nodes[0];
    if (node.nodeType === 3) return fullUrl(node.textContent.trim());
    if (node.nodeName !== 'A' || node.children.length) return null;
    return fullUrl(node.getAttribute('href') || '');
  }

  function metadata(url) {
    if (cache[url]) return Promise.resolve(cache[url]);
    if (requests[url]) return requests[url];
    requests[url] = fetch('https://api.microlink.io/?url=' + encodeURIComponent(url))
      .then(function(response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function(data) {
        if (data.status !== 'success' || !data.data) throw new Error('Invalid link preview');
        cache[url] = data.data;
        try { sessionStorage.setItem('linkCardCache', JSON.stringify(cache)); } catch (error) {}
        return data.data;
      });
    return requests[url];
  }

  function enhance(block, url) {
    if (!url) return;
    // Preserve the dedicated live Memos quotation renderer.
    var parsed = new URL(url);
    if (parsed.origin === 'https://memos.yyl125.cc' && /^\/m\/[1-9]\d*\/?$/.test(parsed.pathname)) return;
    // Render immediately, even when the metadata service is unavailable.
    var title = block.textContent.trim() || url;
    var card = createCard(block, url, title, {});
    metadata(url).then(function(info) {
      if (contentArea.contains(card)) createCard(card, url, title, info);
    }).catch(function(error) { console.warn('Link preview metadata unavailable for', url, error); });
  }

  Array.prototype.forEach.call(contentArea.querySelectorAll('p, div'), function(block) {
    if (contentArea.contains(block)) enhance(block, standaloneUrl(block));
  });
  function isolatedAtRoot(node) {
    return ['previousSibling', 'nextSibling'].every(function(direction) {
      var sibling = node[direction];
      while (sibling && (sibling.nodeType === 8 || (sibling.nodeType === 3 && !sibling.textContent.trim()))) sibling = sibling[direction];
      return !sibling || (sibling.nodeType === 1 && /^(BR|P|DIV|SECTION|BLOCKQUOTE|UL|OL|PRE|H[1-6]|HR|TABLE)$/.test(sibling.tagName));
    });
  }

  // Raw HTML can place an anchor or bare URL directly inside the article root.
  Array.prototype.slice.call(contentArea.childNodes).forEach(function(node) {
    if (!isolatedAtRoot(node)) return;
    if (node.nodeType === 3 && fullUrl(node.textContent.trim())) {
      enhance(node, fullUrl(node.textContent.trim()));
    } else if (node.nodeName === 'A' && !node.children.length && !node.classList.contains('linkcard')) {
      enhance(node, fullUrl(node.getAttribute('href') || ''));
    }
  });

  // Use DOM text nodes so remote metadata is never interpreted as HTML.
  function createCard(p, url, title, info) {
    var card = document.createElement('a');
    card.href = url;
    card.target = '_blank';
    card.rel = 'noopener noreferrer';
    card.className = 'linkcard';

    var image = document.createElement('img');
    image.className = 'linkcard-image';
    var personal = isPersonalContent(url);
    // External previews retain the previous metadata logo and default-image fallback.
    image.src = personal ? defaultImg : (previewImage(info.logo && info.logo.url) || externalFallbackImg);
    if (!personal) image.classList.add('linkcard-image-external');
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.addEventListener('error', function() {
      if (!personal && image.src !== externalFallbackImg) image.src = externalFallbackImg;
      else image.hidden = true;
    });

    var content = document.createElement('span');
    content.className = 'linkcard-content';
    var heading = document.createElement('strong');
    heading.className = 'linkcard-title';
    heading.textContent = info.title || title || url;
    content.appendChild(heading);
    if (info.description) {
      var description = document.createElement('span');
      description.className = 'linkcard-description';
      description.textContent = info.description;
      content.appendChild(description);
    }
    var meta = document.createElement('span');
    meta.className = 'linkcard-meta';
    meta.textContent = new URL(url).hostname.replace(/^www\./, '');
    content.appendChild(meta);
    var arrow = document.createElement('i');
    arrow.className = 'ri-arrow-right-up-line linkcard-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    card.appendChild(image);
    card.appendChild(content);
    card.appendChild(arrow);
    p.parentNode.replaceChild(card, p);
    return card;
  }
})();
