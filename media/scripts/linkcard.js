(function() {
  var defaultImg = 'https://oss.yyl125.cc/blog/img/about/Linkcard.png';
  var contentArea = document.querySelector('.post-content, .entry-content, article, .content') || document.body;
  var paragraphs = contentArea.querySelectorAll('p, div');

  var cache = JSON.parse(sessionStorage.getItem('linkCardCache') || '{}');

  // 判断段落是否单独包含一个链接或纯 URL
  function isSingleLinkParagraph(p) {
    var children = Array.prototype.filter.call(p.childNodes, function(n) {
      return !(n.nodeType === 3 && n.textContent.trim() === '');
    });

    if (children.length === 1 && children[0].tagName && children[0].tagName.toUpperCase() === 'A') {
      return true;
    }

    var text = p.textContent.trim();
    return /^https?:\/\/[^\s]+$/.test(text);
  }

  // 遍历段落
  for (var i = 0; i < paragraphs.length; i++) {
    var p = paragraphs[i];

    if (!isSingleLinkParagraph(p)) continue;

    var url = null;
    var title = null;

    if (p.children.length === 1 && p.children[0].tagName && p.children[0].tagName.toUpperCase() === 'A') {
      url = p.children[0].href;
      title = p.children[0].textContent.trim() || url;
    } else {
      url = p.textContent.trim();
      title = url;
    }

    if (!url) continue;

    // 使用缓存
    var info = cache[url];
    (function(p, url, title) {
      if (info) {
        createCard(p, url, title, info);
      } else {
        var api = 'https://api.microlink.io/?url=' + encodeURIComponent(url);
        fetch(api)
          .then(function(res) { return res.json(); })
          .then(function(data) {
            if (!data.status || !data.data) return;
            info = data.data;
            cache[url] = info;
            sessionStorage.setItem('linkCardCache', JSON.stringify(cache));
            createCard(p, url, title, info);
          })
          .catch(function(err) { console.warn('Link card failed for', url, err); });
      }
    })(p, url, title);
  }

  // 创建卡片
  function createCard(p, url, title, info) {
    // 使用网站标题直接作为卡片标题
    var cardTitle = info.title || url;
    
    // 只去掉 www 前缀
    var hostname = new URL(url).hostname;
    var domain = hostname.startsWith('www.') ? hostname.slice(4) : hostname;
    
    var image = info.image && info.image.url ? info.image.url : defaultImg;
    var icon = info.logo && info.logo.url ? info.logo.url : defaultImg;
    var backdrop = image || defaultImg;
    
    var card = document.createElement('a');
    card.href = url;
    card.target = '_blank';
    card.className = 'linkcard';
    card.innerHTML = ''
      + '<span class="linkcard-backdrop" style="background-image:url(\'' + backdrop + '\')"></span>'
      + '<span class="linkcard-content">'
      +   '<span class="linkcard-text">'
      +     '<span class="linkcard-title">' + cardTitle + '</span>'
      +     '<span class="linkcard-meta">'
      +       '<span style="display:inline-flex;align-items:center">'
      +         '<i class="ri-link"></i>&nbsp;'
      +       '</span>' + domain
      +     '</span>'
      +   '</span>'
      +   '<span class="linkcard-imageCell">'
      +     '<img class="linkcard-image" alt="link-icon" src="' + icon + '">'
      +   '</span>'
      + '</span>';
    
    p.parentNode.replaceChild(card, p);
  }
})();