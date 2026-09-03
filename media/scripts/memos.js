/** Rocky renderer for the Memos v0.18.2 API used by memos.yyl125.cc. */
(function () {
  'use strict'

  const defaults = {
    memos: 'https://demo.usememos.com/',
    limit: 10,
    creatorId: 1,
    domId: '#memos',
    reactions: false,
    reactionEndpoint: 'https://memos-reaction.yyl125.cc'
  }
  const supplied = typeof window.bbMemos === 'object' && window.bbMemos ? window.bbMemos : {}
  const config = Object.assign({}, defaults)
  Object.keys(supplied).forEach(function (key) {
    if (supplied[key] !== '' && supplied[key] !== null && supplied[key] !== undefined) config[key] = supplied[key]
  })
  config.memos = String(config.memos).replace(/\/?$/, '/')
  config.limit = Math.max(1, parseInt(config.limit, 10) || defaults.limit)
  config.creatorId = parseInt(config.creatorId, 10) || defaults.creatorId
  config.reactions = !(config.reactions === false || config.reactions === 'false' || config.reactions === 0 || config.reactions === '0')

  const root = document.querySelector(config.domId)
  if (!root) return

  const state = { apiPrefix: 'v1/', offset: 0, loading: false, finished: false, reactionWarningShown: false }
  const memoCache = new Map()
  injectStyles()
  root.setAttribute('aria-live', 'polite')
  root.setAttribute('aria-busy', 'true')
  root.innerHTML = loadingMarkup()
  start()

  async function start() {
    const embedded = getMemoQuery()
    if (embedded) return renderEmbeddedMemo(embedded)
    try {
      state.apiPrefix = await detectApiPrefix()
      await loadNextPage()
      loadStats()
    } catch (error) {
      renderError('暂时无法读取随想，请稍后再试。', error)
    }
  }

  async function detectApiPrefix() {
    try {
      const response = await fetch(config.memos + 'api/v1/ping', { credentials: 'omit' })
      if (response.ok) return 'v1/'
    } catch (error) {
      console.warn('[Rocky Memos] v0.18.2 ping failed; trying the legacy route.', error)
    }
    return ''
  }

  function endpoint(path, params) {
    const url = new URL('api/' + state.apiPrefix + path, config.memos)
    Object.keys(params || {}).forEach(function (key) { url.searchParams.set(key, params[key]) })
    return url.toString()
  }

  async function requestJson(url) {
    const response = await fetch(url, { credentials: 'omit' })
    if (!response.ok) throw new Error('HTTP ' + response.status + ' ' + response.statusText)
    return response.json()
  }

  async function loadNextPage() {
    if (state.loading || state.finished) return
    state.loading = true
    setLoadButton(true)
    try {
      const data = await requestJson(endpoint('memo', {
        creatorId: config.creatorId, rowStatus: 'NORMAL', limit: config.limit, offset: state.offset
      }))
      if (!Array.isArray(data)) throw new Error('Unexpected memo response')
      removeLoader()
      if (!data.length && state.offset === 0) {
        root.innerHTML = '<p class="bb-empty">这里暂时还没有公开的随想。</p>'
        state.finished = true
        return
      }
      await appendMemos(data)
      state.offset += data.length
      state.finished = data.length < config.limit
      ensureLoadButton()
    } catch (error) {
      if (state.offset === 0) renderError('暂时无法读取随想，请稍后再试。', error)
      else showLoadError(error)
    } finally {
      state.loading = false
      root.setAttribute('aria-busy', 'false')
      setLoadButton(false)
    }
  }

  async function loadStats() {
    try {
      const stats = await requestJson(endpoint('memo/stats', { creatorId: config.creatorId }))
      if (!Array.isArray(stats)) return
      let footer = document.getElementById('bb-footer')
      if (!footer) {
        footer = document.createElement('div')
        footer.id = 'bb-footer'
        root.insertAdjacentElement('afterend', footer)
      }
      footer.innerHTML = '<p class="bb-allnums">共 ' + stats.length + ' 条动态</p>'
    } catch (error) {
      console.warn('[Rocky Memos] Unable to load statistics.', error)
    }
  }

  async function appendMemos(memos) {
    let timeline = root.querySelector('.bb-timeline')
    let list = timeline && timeline.querySelector('.bb-list-ul')
    if (!timeline) {
      timeline = document.createElement('section')
      timeline.className = 'bb-timeline'
      timeline.setAttribute('aria-label', '随想时间线')
      list = document.createElement('ul')
      list.className = 'bb-list-ul'
      timeline.appendChild(list)
      root.appendChild(timeline)
    }
    memos.forEach(function (memo) { memoCache.set(Number(memo.id), memo) })
    const items = await Promise.all(memos.map(renderMemo))
    const fragment = document.createDocumentFragment()
    items.forEach(function (item) { fragment.appendChild(item) })
    list.appendChild(fragment)
    enhanceContent()
  }

  async function renderMemo(memo) {
    const id = Number(memo.id)
    const item = document.createElement('li')
    item.className = 'memo-' + id
    const card = document.createElement('article')
    card.className = 'bb-item'
    card.setAttribute('aria-labelledby', 'memo-time-' + id)
    const content = document.createElement('div')
    content.className = 'bb-cont'
    content.appendChild(markdownFragment(String(memo.content || '')))
    const neodbCards = await buildNeoDBCards(content)
    neodbCards.forEach(function (node) { card.appendChild(node) })
    card.appendChild(content)
    const resources = buildResources(Array.isArray(memo.resourceList) ? memo.resourceList : [])
    if (resources) card.appendChild(resources)
    const relationPreview = await buildRelationPreview(memo)
    if (relationPreview) card.appendChild(relationPreview)
    const reaction = buildMemoReactionElement(id)
    if (reaction) card.appendChild(reaction)

    const info = document.createElement('footer')
    info.className = 'bb-info'
    const time = document.createElement('time')
    time.className = 'datatime'
    time.id = 'memo-time-' + id
    const timestamp = Number(memo.displayTs || memo.createdTs) * 1000
    if (Number.isFinite(timestamp)) time.dateTime = new Date(timestamp).toISOString()
    time.textContent = Number.isFinite(timestamp) ? new Date(timestamp).toLocaleString() : '时间未知'
    info.append('发布于 ', time)
    card.appendChild(info)
    item.appendChild(card)
    return item
  }

  function markdownFragment(markdown) {
    const result = document.createDocumentFragment()
    if (!markdown.trim()) return result
    if (!window.marked || typeof window.marked.parse !== 'function') {
      const p = document.createElement('p'); p.textContent = markdown; result.appendChild(p); return result
    }
    const template = document.createElement('template')
    template.innerHTML = window.marked.parse(markdown, {
      gfm: true, breaks: true, headerIds: false, mangle: false, langPrefix: 'language-'
    })
    sanitizeMarkdown(template.content)
    decorateMarkdown(template.content)
    result.appendChild(template.content)
    return result
  }

  function sanitizeMarkdown(fragment) {
    fragment.querySelectorAll('script,style,iframe,object,embed,form,button,textarea,select,meta,link,base').forEach(function (node) { node.remove() })
    const allowedTags = new Set(['P', 'BR', 'HR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'UL', 'OL', 'LI', 'INPUT', 'PRE', 'CODE', 'EM', 'STRONG', 'DEL', 'A', 'IMG', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD', 'SUP', 'SUB'])
    const allowedAttributes = {
      A: ['href', 'title'], IMG: ['src', 'alt', 'title'], CODE: ['class'],
      INPUT: ['type', 'checked', 'disabled'], OL: ['start'], TD: ['colspan', 'rowspan'], TH: ['colspan', 'rowspan']
    }
    Array.from(fragment.querySelectorAll('*')).forEach(function (element) {
      if (!allowedTags.has(element.tagName)) {
        element.replaceWith.apply(element, Array.from(element.childNodes))
        return
      }
      Array.from(element.attributes).forEach(function (attribute) {
        const allowed = allowedAttributes[element.tagName] || []
        if (!allowed.includes(attribute.name.toLowerCase())) element.removeAttribute(attribute.name)
      })
      if (element.tagName === 'A') secureLink(element)
      if (element.tagName === 'IMG') secureImage(element)
      if (element.tagName === 'INPUT') {
        if (element.type !== 'checkbox') element.remove()
        else element.disabled = true
      }
    })
  }

  function secureLink(link) {
    const url = safeUrl(link.getAttribute('href'), false)
    if (!url) return link.replaceWith(document.createTextNode(link.textContent || ''))
    link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'
  }

  function secureImage(image) {
    const url = safeUrl(image.getAttribute('src'), true)
    if (!url) return image.remove()
    image.src = url; image.loading = 'lazy'; image.decoding = 'async'; image.classList.add('img')
    if (!image.alt) image.alt = '随想图片'
  }

  function safeUrl(value, image) {
    if (!value) return ''
    try {
      const url = new URL(value, config.memos)
      const allowed = image ? ['http:', 'https:', 'data:'] : ['http:', 'https:', 'mailto:']
      if (!allowed.includes(url.protocol)) return ''
      if (url.protocol === 'data:' && !/^data:image\/(?:png|gif|jpe?g|webp|svg\+xml);/i.test(value)) return ''
      return url.toString()
    } catch (error) { return '' }
  }

  function decorateMarkdown(fragment) {
    fragment.querySelectorAll('table').forEach(function (table) {
      const wrap = document.createElement('div'); wrap.className = 'bb-table-wrap'
      table.parentNode.insertBefore(wrap, table); wrap.appendChild(table)
    })
    fragment.querySelectorAll('pre').forEach(function (pre) {
      pre.tabIndex = 0
      const code = pre.querySelector('code')
      const cls = code && Array.from(code.classList).find(function (name) { return name.indexOf('language-') === 0 })
      if (cls) pre.dataset.language = cls.replace('language-', '')
    })
    fragment.querySelectorAll('img').forEach(function (image) {
      const figure = document.createElement('figure'); figure.className = 'bb-markdown-image'
      image.parentNode.insertBefore(figure, image); figure.appendChild(image)
      if (image.alt && image.alt !== '随想图片') {
        const caption = document.createElement('figcaption'); caption.textContent = image.alt; figure.appendChild(caption)
      }
    })
    decorateTags(fragment)
  }

  function decorateTags(fragment) {
    const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT)
    const nodes = []
    while (walker.nextNode()) nodes.push(walker.currentNode)
    nodes.forEach(function (node) {
      if (!node.parentElement || node.parentElement.closest('a,code,pre,.tag-span')) return
      const regex = /(^|\s)#([^#\s!.,;:?"'()[\]{}<>，。！？；：、“”‘’]+)/g
      if (!regex.test(node.nodeValue)) return
      regex.lastIndex = 0
      const replacement = document.createDocumentFragment()
      let last = 0, match
      while ((match = regex.exec(node.nodeValue))) {
        replacement.append(document.createTextNode(node.nodeValue.slice(last, match.index) + match[1]))
        const tag = document.createElement('span'); tag.className = 'tag-span'; tag.textContent = '#' + match[2]
        replacement.appendChild(tag); last = match.index + match[0].length
      }
      replacement.append(document.createTextNode(node.nodeValue.slice(last)))
      node.replaceWith(replacement)
    })
  }

  async function buildNeoDBCards(content) {
    const links = Array.from(content.querySelectorAll('a[href]')).filter(function (link) {
      try {
        const url = new URL(link.href)
        return /(^|\.)douban\.com$/.test(url.hostname) && /\/(?:game|subject)\/\d+\/?/.test(url.pathname)
      } catch (error) { return false }
    })
    const cards = await Promise.all(links.map(async function (link) {
      try {
        const response = await fetch('https://neodb-api.yyl125.cc/?url=' + encodeURIComponent(link.href), { credentials: 'omit' })
        if (!response.ok) return null
        const compactData = await response.json()
        return createNeoDBCard(await enrichNeoDBData(compactData), link.href)
      } catch (error) {
        console.warn('[Rocky Memos] NeoDB card failed; keeping the original link.', error); return null
      }
    }))
    return cards.filter(Boolean)
  }

  function normalizedLanguage(language) {
    return String(language || '').trim().toLowerCase().replace(/_/g, '-')
  }

  function preferredNeoDBTitle(data) {
    const localizedTitles = Array.isArray(data && data.localized_title) ? data.localized_title : []
    const languagePriority = ['zh-cn', 'zh-hans', 'zh-sg', 'zh-my', 'zh', 'zh-hant', 'zh-tw', 'zh-hk']
    for (const language of languagePriority) {
      const match = localizedTitles.find(function (title) {
        return normalizedLanguage(title && title.lang) === language && typeof title.text === 'string' && title.text.trim()
      })
      if (match) return match.text.trim()
    }
    const fallback = [data && data.display_title, data && data.title].find(function (title) {
      return typeof title === 'string' && title.trim()
    })
    return fallback ? fallback.trim() : '未命名条目'
  }

  async function enrichNeoDBData(compactData) {
    if (!compactData || typeof compactData !== 'object') return {}
    const path = compactData.api_url || (typeof compactData.url === 'string' ? '/api' + compactData.url : '')
    try {
      const url = new URL(path, 'https://neodb.social')
      if (url.origin !== 'https://neodb.social' || !url.pathname.startsWith('/api/')) return compactData
      const response = await fetch(url.toString(), {
        credentials: 'omit',
        headers: { Accept: 'application/json', 'Accept-Language': 'zh-CN,zh;q=0.9' }
      })
      if (!response.ok) return compactData
      const fullData = await response.json()
      return Object.assign({}, compactData, fullData)
    } catch (error) {
      console.warn('[Rocky Memos] Unable to load localized NeoDB data; using the proxy title.', error)
      return compactData
    }
  }

  function createNeoDBCard(data, sourceUrl) {
    const displayTitle = preferredNeoDBTitle(data)
    const card = document.createElement('a'); card.className = 'db-card'; card.href = sourceUrl; card.target = '_blank'; card.rel = 'noopener noreferrer'
    card.setAttribute('aria-label', '查看条目：' + displayTitle)
    const subject = document.createElement('div'); subject.className = 'db-card-subject'
    const coverUrl = safeUrl(data.cover_image_url, true)
    if (coverUrl) {
      const cover = document.createElement('div'); cover.className = 'db-card-post'
      const image = document.createElement('img'); image.src = coverUrl; image.alt = displayTitle + '封面'; image.loading = 'lazy'
      cover.appendChild(image); subject.appendChild(cover)
    }
    const body = document.createElement('div'); body.className = 'db-card-content'
    const title = document.createElement('div'); title.className = 'db-card-title'
    title.textContent = displayTitle
    body.appendChild(title)
    const rating = Number(data.rating)
    const ratingRow = document.createElement('div'); ratingRow.className = 'rating'
    const stars = document.createElement('span'); stars.className = 'allstardark'
    const fill = document.createElement('span'); fill.className = 'allstarlight'; fill.style.width = Number.isFinite(rating) ? Math.max(0, Math.min(100, rating * 10)) + '%' : '0%'
    stars.append(document.createTextNode('★★★★★'))
    fill.textContent = '★★★★★'
    stars.appendChild(fill)
    const ratingText = document.createElement('span'); ratingText.className = 'rating_nums'; ratingText.textContent = Number.isFinite(rating) ? rating.toFixed(1) : '暂无评分'
    ratingRow.append(stars, ratingText); body.appendChild(ratingRow)
    if (data.brief) { const brief = document.createElement('div'); brief.className = 'db-card-abstract'; brief.textContent = String(data.brief); body.appendChild(brief) }
    subject.appendChild(body)
    if (data.category) { const category = document.createElement('div'); category.className = 'db-card-cate'; category.textContent = String(data.category); subject.appendChild(category) }
    card.appendChild(subject); return card
  }

  function buildResources(resources) {
    if (!resources.length) return null
    const wrapper = document.createElement('div'); wrapper.className = 'bb-resources'
    const gallery = document.createElement('div'); gallery.className = 'resimg'
    const files = document.createElement('p'); files.className = 'bb-source'
    let imageCount = 0, hasVisual = false, hasFiles = false
    resources.forEach(function (resource) {
      const type = String(resource.type || ''), url = resourceUrl(resource)
      if (!url) return
      if (type.indexOf('image') === 0) {
        const figure = document.createElement('figure'); figure.className = 'gallery-thumbnail'
        const image = document.createElement('img'); image.className = 'img thumbnail-image'; image.src = url; image.alt = String(resource.filename || '随想图片'); image.loading = 'lazy'; image.decoding = 'async'
        figure.appendChild(image); gallery.appendChild(figure); imageCount++; hasVisual = true
      } else if (type.indexOf('video') === 0) {
        const wrap = document.createElement('div'); wrap.className = 'video-wrapper'
        const video = document.createElement('video'); video.controls = true; video.preload = 'metadata'; video.src = url
        wrap.appendChild(video); gallery.appendChild(wrap); hasVisual = true
      } else if (type.indexOf('audio') === 0) {
        const audio = document.createElement('audio'); audio.controls = true; audio.preload = 'metadata'; audio.src = url
        gallery.appendChild(audio); hasVisual = true
      } else {
        const link = document.createElement('a'); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = String(resource.filename || '下载附件')
        files.appendChild(link); hasFiles = true
      }
    })
    if (imageCount > 1) gallery.classList.add('grid', 'grid-' + Math.min(imageCount, 4))
    if (hasVisual) wrapper.appendChild(gallery)
    if (hasFiles) wrapper.appendChild(files)
    return wrapper.childNodes.length ? wrapper : null
  }

  function resourceUrl(resource) {
    if (resource.externalLink) return safeUrl(resource.externalLink, String(resource.type || '').indexOf('image') === 0)
    if (!resource.id) return ''
    return new URL('o/r/' + encodeURIComponent(resource.id) + '/' + encodeURIComponent(resource.publicId || resource.filename || 'resource'), config.memos).toString()
  }

  function outgoingRelations(memo) {
    if (!Array.isArray(memo.relationList)) return []
    return Array.from(new Set(memo.relationList.filter(function (r) {
      return Number(r.memoId) === Number(memo.id) && r.relatedMemoId
    }).map(function (r) { return Number(r.relatedMemoId) }).filter(Number.isFinite)))
  }

  function buildMemoReactionElement(memoId) {
    if (!config.reactions) return null
    if (!window.customElements || !customElements.get('emoji-reaction')) {
      if (!state.reactionWarningShown) {
        console.warn('[Rocky Memos] Reactions are enabled, but the emoji-reaction component is unavailable.')
        state.reactionWarningShown = true
      }
      return null
    }
    const reaction = document.createElement('emoji-reaction')
    reaction.setAttribute('endpoint', config.reactionEndpoint || defaults.reactionEndpoint)
    reaction.setAttribute('target-id', memoReactionTarget(memoId))
    reaction.setAttribute('aria-label', '对此条随想作出反馈')
    return reaction
  }

  function memoReactionTarget(memoId) {
    let instance = 'memos'
    try { instance = new URL(config.memos).hostname } catch (error) {}
    return '/memos/' + instance + '/' + memoId
  }

  async function buildRelationPreview(memo) {
    const relatedIds = outgoingRelations(memo)
    if (!relatedIds.length) return null
    const container = document.createElement('div')
    container.className = 'bb-relations'
    container.setAttribute('aria-label', '关联随想')

    const previews = await Promise.all(relatedIds.map(async function (relatedId) {
      const relatedMemo = await getRelatedMemo(relatedId)
      const link = document.createElement('a')
      link.className = 'bb-relation-preview'
      link.href = new URL('m/' + relatedId, config.memos)
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      link.title = '查看关联随想'

      const icon = document.createElement('i')
      icon.className = 'ri-link'
      icon.setAttribute('aria-hidden', 'true')
      const excerpt = document.createElement('span')
      excerpt.className = 'bb-relation-excerpt'
      excerpt.textContent = relationExcerpt(relatedMemo)
      link.append(icon, excerpt)
      return link
    }))
    previews.forEach(function (preview) { container.appendChild(preview) })
    return container
  }

  async function getRelatedMemo(id) {
    if (memoCache.has(id)) return memoCache.get(id)
    try {
      const memo = await requestJson(endpoint('memo/' + id))
      if (memo && typeof memo === 'object') memoCache.set(id, memo)
      return memo
    } catch (error) {
      console.warn('[Rocky Memos] Unable to load related memo #' + id + '.', error)
      return null
    }
  }

  function relationExcerpt(memo) {
    if (!memo) return '关联内容暂时无法读取'
    const markdown = String(memo.content || '').trim()
    if (!markdown) return Array.isArray(memo.resourceList) && memo.resourceList.length ? '包含附件的随想' : '这条随想没有文字内容'
    const template = document.createElement('template')
    if (window.marked && typeof window.marked.parse === 'function') template.innerHTML = window.marked.parse(markdown, { gfm: true, breaks: false })
    else template.textContent = markdown
    const plain = (template.content.textContent || '').replace(/\s+/g, ' ').trim()
    const characters = Array.from(plain)
    return characters.length > 82 ? characters.slice(0, 82).join('') + '…' : plain
  }

  function enhanceContent() {
    if (window.ViewImage && typeof window.ViewImage.init === 'function') window.ViewImage.init('.bb-cont img, .bb-resources img, .db-card img')
    if (window.Lately && typeof window.Lately.init === 'function') window.Lately.init({ target: '.datatime' })
    if (window.lazyLoadInstance && typeof window.lazyLoadInstance.update === 'function') window.lazyLoadInstance.update()
  }

  function ensureLoadButton() {
    let load = document.querySelector('.bb-load')
    if (state.finished) { if (load) load.remove(); return }
    if (!load) {
      load = document.createElement('div'); load.className = 'bb-load'
      const button = document.createElement('button'); button.className = 'load-btn button-load'; button.type = 'button'; button.textContent = '加载更多'; button.addEventListener('click', loadNextPage)
      load.appendChild(button); root.insertAdjacentElement('afterend', load)
    }
  }

  function setLoadButton(loading) {
    const button = document.querySelector('.button-load')
    if (button) { button.disabled = loading; button.textContent = loading ? '加载中…' : '加载更多' }
  }
  function showLoadError(error) {
    console.error('[Rocky Memos] Unable to load more.', error)
    const button = document.querySelector('.button-load'); if (button) button.textContent = '加载失败，点击重试'
  }
  function removeLoader() { const loader = root.querySelector('.loader'); if (loader) loader.remove() }
  function loadingMarkup() { return '<div class="loader" role="status"><span class="sr-only">正在加载随想</span><svg class="circular" viewBox="25 25 50 50" aria-hidden="true"><circle class="path" cx="50" cy="50" r="20" fill="none" stroke-width="2"></circle></svg></div>' }

  function renderError(message, error) {
    console.error('[Rocky Memos] ' + message, error)
    root.setAttribute('aria-busy', 'false')
    root.innerHTML = '<div class="bb-error" role="alert"><p>' + message + '</p><button type="button" class="bb-retry">重新加载</button></div>'
    root.querySelector('.bb-retry').addEventListener('click', function () {
      state.offset = 0; state.finished = false; root.setAttribute('aria-busy', 'true'); root.innerHTML = loadingMarkup(); start()
    })
  }

  function getMemoQuery() {
    const value = new URLSearchParams(window.location.search).get('memo')
    if (!value) return ''
    try { const url = new URL(value, config.memos); return url.origin === new URL(config.memos).origin ? url.toString() : '' } catch (error) { return '' }
  }
  function renderEmbeddedMemo(url) {
    root.innerHTML = ''
    const iframe = document.createElement('iframe'); iframe.className = 'bb-memo-frame'; iframe.src = url; iframe.title = 'Memos 随想详情'; iframe.loading = 'lazy'
    root.appendChild(iframe); root.setAttribute('aria-busy', 'false')
  }

  function injectStyles() {
    if (document.getElementById('rocky-memos-styles')) return
    const style = document.createElement('style'); style.id = 'rocky-memos-styles'
    style.textContent = `
#memos{margin-top:1rem;width:auto!important}.bb-timeline ul.bb-list-ul{margin:0;padding:1.25rem}.bb-timeline ul.bb-list-ul>li{margin:0 0 1.25rem;list-style:none}.bb-timeline ul.bb-list-ul>li::before{content:none}.bb-timeline .bb-item{padding:.8rem 1rem;border:1px solid rgba(0,0,0,.125);border-radius:.5rem;background:rgb(250,249,247);box-shadow:0 6px 14px rgba(0,0,0,.04);font-size:16px}.bb-cont{overflow-wrap:anywhere}.bb-cont>:first-child{margin-top:0}.bb-cont>:last-child{margin-bottom:0}.bb-cont p{margin:0 0 .7rem;letter-spacing:.02em;line-height:1.75}.bb-cont ul,.bb-cont ol{margin:.5rem 0 .75rem;padding-left:1.6rem}.bb-cont li{margin:.25rem 0;list-style:revert}.bb-cont li::before{content:none}.bb-cont .task-list-item{list-style:none}.bb-cont input[type=checkbox]{margin:0 .5rem 0 -1.4rem;accent-color:#0f61ff}.bb-cont h1,.bb-cont h2,.bb-cont h3,.bb-cont h4,.bb-cont h5,.bb-cont h6{margin:1rem 0 .55rem;color:#333;font-weight:600;line-height:1.45}.bb-cont h1{font-size:1.55rem}.bb-cont h2{font-size:1.4rem}.bb-cont h3{font-size:1.25rem}.bb-cont h4,.bb-cont h5,.bb-cont h6{font-size:1.1rem}.bb-cont blockquote{position:relative;margin:.75rem 0;padding:.35rem 1rem .35rem 2.25rem;border:0;border-radius:0 .35rem .35rem 0;background:rgba(0,0,0,.035);font-family:KaiTi,STKaiti,STFangsong,serif}.bb-cont blockquote::before{position:absolute;top:.2rem;left:.7rem;content:'“';color:#999;font:700 28px/1.4 Georgia,serif}.bb-cont a,.bb-relations a{border-bottom:.2rem solid rgba(15,97,255,.1);color:#0f61ff;text-decoration:none}.bb-cont a:hover,.bb-relations a:hover{border-color:rgba(15,97,255,.5)}.bb-cont code{padding:.1em .35em;border-radius:.25rem;background:rgba(0,0,0,.06);font-size:.9em}.bb-cont pre{position:relative;margin:.75rem 0;padding:1rem;overflow:auto;border-radius:.4rem;background:#282c34;color:#abb2bf;line-height:1.55;tab-size:2}.bb-cont pre code{padding:0;background:transparent;color:inherit;white-space:pre}.bb-cont pre[data-language]::before{position:absolute;top:.3rem;right:.55rem;content:attr(data-language);color:#777;font:11px monospace}.bb-table-wrap{max-width:100%;margin:.75rem 0;overflow-x:auto;border:1px solid rgba(0,0,0,.1);border-radius:.4rem}.bb-table-wrap table{width:100%;border-collapse:collapse}.bb-table-wrap th,.bb-table-wrap td{padding:.55rem .7rem;border:1px solid rgba(0,0,0,.08);text-align:left;white-space:nowrap}.bb-table-wrap th{background:rgba(0,0,0,.045)}.tag-span{display:inline-block;margin:.15rem .25rem .15rem 0;padding:.08rem .5rem;border-radius:999px;background:rgba(15,97,255,.08);color:#0f61ff;font-size:.9em}.bb-markdown-image{margin:.75rem 0;text-align:center}.bb-markdown-image img{display:block;max-width:100%;max-height:70vh;margin:auto;border-radius:.35rem;cursor:zoom-in}.bb-markdown-image figcaption{margin-top:.35rem;color:#888;font-size:.85rem}.bb-info{margin-top:.7rem;color:#888;font-size:14px}.bb-load{margin:1rem auto;text-align:center}.bb-load button,.bb-retry{padding:.65rem 1.25rem;border:1px solid #d1d5db;border-radius:4px;background:#f3f4f6;color:#333;cursor:pointer}.bb-load button:disabled{cursor:wait;opacity:.65}.resimg{display:flex;flex-wrap:wrap;gap:4px;margin:.7rem 0}.resimg figure{margin:0}.resimg img{display:block;max-width:100%;max-height:70vh;border-radius:4px;cursor:zoom-in}.resimg.grid{display:grid;width:min(100%,680px);grid-template-columns:repeat(2,minmax(0,1fr))}.resimg.grid figure{position:relative;padding-top:100%;height:0}.resimg.grid img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.resimg.grid-3{grid-template-columns:repeat(3,minmax(0,1fr))}.bb-resources audio{width:100%}.video-wrapper{position:relative;width:100%;margin:.7rem 0;padding-bottom:56.25%;height:0}.video-wrapper video{position:absolute;inset:0;width:100%;height:100%}.bb-source{display:flex;flex-wrap:wrap;gap:.45rem}.bb-source a{padding:.2rem .6rem;border:0;border-radius:.3rem;background:#3b3d42;color:#fafafa}#bb-footer,.bb-empty,.bb-error{margin:1rem auto;text-align:center}.bb-allnums,.bb-empty,.bb-error{color:#888}.bb-memo-frame{width:100%;height:100vh;border:0}.loader{position:relative;width:64px;margin:3rem auto}.loader::before{display:block;padding-top:100%;content:''}.circular{position:absolute;inset:0;width:100%;height:100%;animation:bb-rotate 2s linear infinite}.path{animation:bb-dash 1.5s ease-in-out infinite;stroke:#0f61ff;stroke-dasharray:1,200}@keyframes bb-rotate{to{transform:rotate(360deg)}}@keyframes bb-dash{50%{stroke-dasharray:89,200;stroke-dashoffset:-35px}100%{stroke-dasharray:89,200;stroke-dashoffset:-124px}}.sr-only{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0,0,0,0)}.db-card{margin:-.8rem -1rem .8rem;border-bottom:1px solid #eaeaea}.db-card-subject{position:relative;display:flex;padding:12px}.db-card-post{flex:0 0 96px;margin-right:15px}.db-card-post img{width:96px!important;height:96px!important;border-radius:4px;object-fit:cover}.db-card-content{min-width:0}.db-card-title{font-size:18px}.db-card-abstract{max-height:3rem;overflow:hidden;font-size:14px}.db-card-cate{position:absolute;top:0;right:0;padding:1px 8px;border-radius:0 .5rem 0 .5rem;background:#f99b01;color:#111;font-size:small}.rating{display:flex;align-items:center;font-size:14px}.allstardark{position:relative;width:80px;height:16px;margin-right:8px;background:#ddd;mask:repeating-linear-gradient(90deg,#000 0 12px,transparent 12px 16px)}.allstarlight{position:absolute;inset:0 auto 0 0;background:#f99b01}@media(max-width:640px){.bb-timeline ul.bb-list-ul{padding:.75rem}.bb-timeline .bb-item{padding:.7rem .8rem}.resimg.grid-3{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(prefers-color-scheme:dark){.bb-timeline .bb-item{border-color:#3b3d42;background:#333;box-shadow:none}.bb-cont h1,.bb-cont h2,.bb-cont h3,.bb-cont h4,.bb-cont h5,.bb-cont h6{color:#ccc}.bb-cont blockquote{background:rgba(255,255,255,.04)}.bb-cont a,.bb-relations a,.tag-span{color:#81a5f8}.tag-span{background:rgba(129,165,248,.1)}.bb-cont code{background:rgba(255,255,255,.08)}.bb-load button,.bb-retry{border-color:#5a5a5a;background:#4a4a4a;color:#eee}.db-card{border-color:rgba(0,0,0,.125)}}@media(prefers-reduced-motion:reduce){.circular,.path{animation:none}}
.bb-relations{display:flex;flex-direction:column;align-items:flex-start;gap:.35rem;margin-top:.65rem}.bb-relations a.bb-relation-preview{display:inline-flex;align-items:center;box-sizing:border-box;max-width:100%;padding:.18rem .55rem;border:1px solid rgba(0,0,0,.11);border-radius:.35rem;background:rgba(255,255,255,.45);color:#777;text-decoration:none;font-size:13px;line-height:1.45;transition:border-color .2s,background-color .2s,color .2s}.bb-relations a.bb-relation-preview:hover{border-color:rgba(15,97,255,.28);background:rgba(15,97,255,.04);color:#555}.bb-relation-preview i{flex:0 0 auto;margin-right:.3rem;color:#999;font-size:14px}.bb-relation-excerpt{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bb-reactions{display:flex;flex-wrap:wrap;align-items:center;gap:.4rem;margin-top:.75rem}.bb-reaction{display:inline-flex;align-items:center;justify-content:center;min-width:3.05rem;height:1.8rem;padding:0 .55rem;border:1px solid rgba(0,0,0,.12);border-radius:999px;background:rgba(255,255,255,.55);color:#777;font:inherit;font-size:13px;line-height:1;cursor:pointer;box-shadow:none;transition:transform .16s ease,background-color .16s ease,border-color .16s ease,color .16s ease}.bb-reaction:hover:not(:disabled),.bb-reaction:focus-visible{border-color:rgba(0,0,0,.22);background:#fff;color:#444}.bb-reaction:focus-visible{outline:2px solid rgba(15,97,255,.34);outline-offset:2px}.bb-reaction-emoji{font-size:15px;line-height:1}.bb-reaction-count{min-width:.8em;margin-left:.32rem;font-variant-numeric:tabular-nums}.bb-reaction.is-reacted{border-color:rgba(255,190,0,.58);background:rgba(255,214,2,.14);color:#665100;cursor:default}.bb-reaction:disabled:not(.is-reacted){cursor:wait;opacity:.55}.bb-reaction.is-loading{opacity:.7}.bb-reaction.is-bouncing{animation:bb-reaction-bounce .34s ease}@keyframes bb-reaction-bounce{0%,100%{transform:scale(1)}45%{transform:scale(1.13)}}.bb-timeline a.db-card{display:block;color:inherit;text-decoration:none;border-bottom:1px solid #eaeaea;transition:background-color .2s ease}.bb-timeline a.db-card:hover,.bb-timeline a.db-card:focus-visible{color:inherit;text-decoration:none;border-bottom-color:#eaeaea;background:rgba(0,0,0,.025)}.bb-timeline a.db-card:focus-visible{outline:2px solid rgba(15,97,255,.45);outline-offset:-2px}.db-card-title{color:inherit}.rating .allstardark{position:relative;display:inline-block;width:auto;height:auto;margin-right:.5rem;background:none;mask:none;-webkit-mask:none;color:#d4d4d4;font:15px/1 Arial,sans-serif;letter-spacing:1px;white-space:nowrap}.rating .allstarlight{position:absolute;top:0;bottom:auto;left:0;display:block;height:1em;overflow:hidden;background:none;color:#f99b01;line-height:1;white-space:nowrap}.rating_nums{color:#777;font-size:13px;line-height:1}@media(prefers-color-scheme:dark){.bb-relations a.bb-relation-preview{border-color:rgba(255,255,255,.13);background:rgba(255,255,255,.035);color:#aaa}.bb-relations a.bb-relation-preview:hover{border-color:rgba(129,165,248,.35);background:rgba(129,165,248,.07);color:#ccc}.bb-relation-preview i{color:#999}.bb-reaction{border-color:rgba(255,255,255,.13);background:rgba(255,255,255,.035);color:#aaa}.bb-reaction:hover:not(:disabled),.bb-reaction:focus-visible{border-color:rgba(255,255,255,.25);background:rgba(255,255,255,.075);color:#ddd}.bb-reaction.is-reacted{border-color:rgba(255,214,2,.42);background:rgba(255,214,2,.09);color:#e4cf70}.bb-timeline a.db-card{border-bottom-color:rgba(0,0,0,.125)}.bb-timeline a.db-card:hover,.bb-timeline a.db-card:focus-visible{border-bottom-color:rgba(0,0,0,.125);background:rgba(255,255,255,.035)}.db-card-title{color:inherit}.rating .allstardark{color:#666}.rating_nums{color:#aaa}}@media(max-width:640px){.bb-relations a.bb-relation-preview{width:100%}.bb-reactions{gap:.35rem}.bb-reaction{min-width:2.85rem;padding:0 .45rem}}@media(prefers-reduced-motion:reduce){.bb-reaction{transition:none}.bb-reaction.is-bouncing{animation:none}}
`
    document.head.appendChild(style)
  }
})()
