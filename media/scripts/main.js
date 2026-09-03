new Vue({
  el: '#app',
  data() {
    return {
      scrolled: false,
      showToc: false,
      tocPinned: false,
      tocClosing: false,
      tocCloseTimer: null,
      tocCollapseTimer: null,
      showMenu: false,
    } 
  },
  computed: {
    text() {
      return encodeURIComponent(document.title) 
    },
    url() {
      return encodeURIComponent(window.location.href)
    }
  },
  mounted() {
    window.addEventListener('scroll', this.navOnScroll)
    this.initToc()
  },
  methods: {
    oepnUrl(url) {
      window.open(url, '_blank')
    },
    navOnScroll() {
      if (window.scrollY > 20) {
        this.scrolled = true
      } else {
        this.scrolled = false
      }
    },
    backToUp() {
      window.scrollTo(0, 0)
    },
    isMousePointer(event) {
      return event && event.pointerType === 'mouse'
    },
    cancelTocClose() {
      window.clearTimeout(this.tocCloseTimer)
      window.clearTimeout(this.tocCollapseTimer)
      this.tocClosing = false
    },
    openToc(event) {
      if (!this.isMousePointer(event)) return
      this.cancelTocClose()
      if (this.showToc) return
      this.showToc = true
      this.$nextTick(this.refreshTocIndicator)
    },
    closeToc(event) {
      if (!this.isMousePointer(event) || this.tocPinned) return
      const tocPanel = event.currentTarget
      this.cancelTocClose()
      this.tocCloseTimer = window.setTimeout(() => {
        if (tocPanel && tocPanel.matches(':hover')) return
        this.tocClosing = true
        this.tocCollapseTimer = window.setTimeout(() => {
          if (tocPanel && tocPanel.matches(':hover')) {
            this.tocClosing = false
            return
          }
          this.showToc = false
          this.tocClosing = false
        }, 180)
      }, 160)
    },
    dismissToc() {
      this.cancelTocClose()
      this.tocPinned = false
      this.showToc = false
    },
    toggleToc() {
      this.cancelTocClose()
      this.showToc = !this.showToc
      if (this.showToc) this.$nextTick(this.refreshTocIndicator)
    },
    toggleTocPin() {
      this.cancelTocClose()
      this.tocPinned = !this.tocPinned
      this.showToc = this.tocPinned
      if (this.showToc) this.$nextTick(this.refreshTocIndicator)
    },
    refreshTocIndicator() {
      window.requestAnimationFrame(() => {
        const toc = document.querySelector('.post-toc-container')
        const tree = toc && toc.querySelector('.article-toc-tree')
        const basePath = tree && tree.querySelector('.article-toc-tree-base')
        const activePath = tree && tree.querySelector('.article-toc-tree-active')
        const activeLink = toc && toc.querySelector('a.is-active')
        const activeItem = activeLink && activeLink.closest('li')
        if (!toc || !tree || !basePath || !activePath ||
          !activeLink || !activeItem) return

        const tocRect = toc.getBoundingClientRect()
        const links = Array.from(toc.querySelectorAll('a[href^="#"]'))
        const nodeMap = new Map()
        links.forEach(link => {
          const item = link.closest('li')
          if (!item) return
          const itemRect = item.getBoundingClientRect()
          const linkRect = link.getBoundingClientRect()
          nodeMap.set(item, {
            item,
            link,
            x: itemRect.left - tocRect.left + toc.scrollLeft,
            y: linkRect.top - tocRect.top + toc.scrollTop +
              Math.max(14, Math.min(18, linkRect.height / 2)),
            height: linkRect.height,
          })
        })

        const nodes = links.map(link => nodeMap.get(link.closest('li'))).filter(Boolean)
        if (!nodes.length) return
        const geometrySignature = `${toc.clientWidth}:${toc.scrollHeight}:` + nodes
          .map(node => `${node.x.toFixed(1)},${node.y.toFixed(1)},${node.height.toFixed(1)}`)
          .join(';')
        let geometry = tree._tocGeometry
        if (!geometry || geometry.signature !== geometrySignature) {
          const connection = (from, to) => {
            if (from.x === to.x) return ` V ${to.y}`
            const middleY = from.y + (to.y - from.y) / 2
            const curveHalf = Math.min(20, Math.max(10, Math.abs(to.y - from.y) * .34))
            return ` V ${middleY - curveHalf} ` +
              `C ${from.x} ${middleY} ${to.x} ${middleY} ${to.x} ${middleY + curveHalf} ` +
              `V ${to.y}`
          }
          let spinePath = `M ${nodes[0].x} ${nodes[0].y - 10} V ${nodes[0].y}`
          for (let index = 1; index < nodes.length; index += 1) {
            spinePath += connection(nodes[index - 1], nodes[index])
          }
          spinePath += ` V ${nodes[nodes.length - 1].y + 10}`
          const sampler = document.createElementNS('http://www.w3.org/2000/svg', 'path')
          sampler.setAttribute('d', spinePath)
          const totalLength = sampler.getTotalLength()
          const samples = []
          const sampleCount = Math.max(2, Math.ceil(totalLength / 1.5))
          for (let index = 0; index <= sampleCount; index += 1) {
            const length = totalLength * index / sampleCount
            const point = sampler.getPointAtLength(length)
            samples.push({ length, x: point.x, y: point.y })
          }
          const nodeLengths = nodes.map(node => {
            return samples.reduce((closest, sample) => {
              const distance = Math.pow(sample.x - node.x, 2) + Math.pow(sample.y - node.y, 2)
              return distance < closest.distance ? { length: sample.length, distance } : closest
            }, { length: 0, distance: Infinity }).length
          })
          geometry = { signature: geometrySignature, spinePath, sampler, totalLength, nodeLengths }
          tree._tocGeometry = geometry
          basePath.setAttribute('d', spinePath)
        }
        const width = Math.max(toc.clientWidth, toc.scrollWidth)
        const height = Math.max(toc.clientHeight, toc.scrollHeight)
        tree.setAttribute('viewBox', `0 0 ${width} ${height}`)
        tree.setAttribute('width', width)
        tree.setAttribute('height', height)

        const activeNode = nodeMap.get(activeItem)
        const activeIndex = nodes.indexOf(activeNode)
        const { sampler, totalLength, nodeLengths } = geometry
        const targetMarker = nodeLengths[activeIndex]
        const targetStart = activeIndex === 0
          ? 0
          : (nodeLengths[activeIndex - 1] + targetMarker) / 2
        const targetEnd = activeIndex === nodes.length - 1
          ? totalLength
          : (targetMarker + nodeLengths[activeIndex + 1]) / 2
        const drawRange = (start, end) => {
          const rangeLength = Math.max(0, end - start)
          const steps = Math.max(2, Math.ceil(rangeLength / 1.5))
          let path = ''
          for (let index = 0; index <= steps; index += 1) {
            const point = sampler.getPointAtLength(start + rangeLength * index / steps)
            path += `${index ? ' L' : 'M'} ${point.x} ${point.y}`
          }
          return path
        }

        if (activePath._animationFrame) window.cancelAnimationFrame(activePath._animationFrame)
        const fromStart = Number.isFinite(activePath._rangeStart) ? activePath._rangeStart : targetStart
        const fromEnd = Number.isFinite(activePath._rangeEnd) ? activePath._rangeEnd : targetEnd
        const fromMarker = Number.isFinite(activePath._markerLength)
          ? activePath._markerLength
          : targetMarker
        const animationStart = performance.now()
        const distance = Math.abs(targetMarker - fromMarker)
        const averageGap = totalLength / Math.max(1, nodes.length - 1)
        const rushing = distance > Math.max(64, averageGap * 1.55)
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        const duration = distance < 1
          ? 0
          : reduceMotion
            ? 0
            : rushing
              ? Math.min(440, Math.max(240, distance * 1.75))
              : Math.min(500, Math.max(280, distance * 3.2))
        activePath.classList.toggle('is-rushing', rushing)
        const animateHighlight = now => {
          const progress = duration ? Math.min((now - animationStart) / duration, 1) : 1
          const eased = 1 - Math.pow(1 - progress, 3)
          const leading = rushing ? 1 - Math.pow(1 - progress, 4) : eased
          const trailingProgress = rushing
            ? Math.max(0, Math.min(1, (progress - .16) / .84))
            : progress
          const trailing = rushing ? 1 - Math.pow(1 - trailingProgress, 3) : eased
          const movingForward = targetMarker >= fromMarker
          const startProgress = rushing && !movingForward ? leading : trailing
          const endProgress = rushing && movingForward ? leading : trailing
          const rangeStart = fromStart + (targetStart - fromStart) * startProgress
          const rangeEnd = fromEnd + (targetEnd - fromEnd) * endProgress
          const markerLength = fromMarker + (targetMarker - fromMarker) * eased
          activePath._rangeStart = rangeStart
          activePath._rangeEnd = rangeEnd
          activePath._markerLength = markerLength
          activePath.setAttribute('d', drawRange(rangeStart, rangeEnd))
          if (progress < 1) activePath._animationFrame = window.requestAnimationFrame(animateHighlight)
          else {
            activePath._animationFrame = null
            activePath.classList.remove('is-rushing')
          }
        }
        activePath._animationFrame = window.requestAnimationFrame(animateHighlight)
      })
    },
    buildTocFromPage(toc) {
      const source = document.querySelector('.markdown')
      if (!source) return

      const headings = Array.from(source.querySelectorAll('h2, h3, h4'))
      if (!headings.length) return

      const headingSet = new Set(headings)
      const usedIds = new Set()
      Array.from(document.querySelectorAll('[id]')).forEach(element => {
        if (!headingSet.has(element) && element.id) usedIds.add(element.id)
      })

      headings.forEach((heading, index) => {
        const text = heading.textContent.trim()
        const slug = text
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9_\-\u3400-\u9fff]/g, '')
        const baseId = heading.id || slug || `section-${index + 1}`
        let uniqueId = baseId
        let suffix = 2
        while (usedIds.has(uniqueId)) {
          uniqueId = `${baseId}-${suffix}`
          suffix += 1
        }
        heading.id = uniqueId
        usedIds.add(uniqueId)
      })

      const outerList = document.createElement('ul')
      const outerItem = document.createElement('li')
      const rootList = document.createElement('ul')
      outerList.className = 'markdownIt-TOC'
      outerItem.appendChild(rootList)
      outerList.appendChild(outerItem)

      const firstLevel = Number(headings[0].tagName.slice(1))
      const listStack = [{ level: firstLevel, list: rootList }]
      let lastItem = null

      headings.forEach(heading => {
        const level = Number(heading.tagName.slice(1))
        let current = listStack[listStack.length - 1]

        if (level > current.level && lastItem) {
          const nestedList = document.createElement('ul')
          lastItem.appendChild(nestedList)
          current = { level, list: nestedList }
          listStack.push(current)
        } else {
          while (listStack.length > 1 && level < current.level) {
            listStack.pop()
            current = listStack[listStack.length - 1]
          }
        }

        const item = document.createElement('li')
        const link = document.createElement('a')
        link.href = `#${encodeURIComponent(heading.id)}`
        link.textContent = heading.textContent.trim()
        item.appendChild(link)
        current.list.appendChild(item)
        lastItem = item
      })

      toc.appendChild(outerList)
    },
    initToc() {
      const toc = document.querySelector('.post-toc-container')
      if (!toc) return

      const autoBuildToc = toc.getAttribute('data-toc-auto') === 'true'
      if (autoBuildToc) this.buildTocFromPage(toc)

      const links = Array.from(toc.querySelectorAll('a[href^="#"]'))
      if (!links.length) {
        const tocPanel = document.querySelector('.article-toc')
        const mobileTrigger = document.querySelector('.article-toc-mobile-trigger')
        if (tocPanel) tocPanel.style.display = 'none'
        if (mobileTrigger) mobileTrigger.style.display = 'none'
        return
      }
      const activePath = toc.querySelector('.article-toc-tree-active')
      const collapsedTrack = document.querySelector('.article-toc-collapsed-track')
      const collapsedMarkers = links.map(() => {
        const marker = document.createElement('i')
        if (collapsedTrack) collapsedTrack.appendChild(marker)
        return marker
      })
      const layoutCollapsedTrack = () => {
        if (!collapsedTrack || !collapsedMarkers.length) return
        const count = collapsedMarkers.length
        const availableHeight = Math.max(96, window.innerHeight * .68)
        let markerHeight = 8
        let markerGap = 5
        const naturalHeight = count * markerHeight + Math.max(0, count - 1) * markerGap

        if (naturalHeight > availableHeight) {
          markerGap = Math.max(2, Math.min(5, availableHeight / count * .34))
          markerHeight = Math.max(2, (availableHeight - Math.max(0, count - 1) * markerGap) / count)
        }

        collapsedTrack.style.gap = `${markerGap}px`
        collapsedMarkers.forEach(marker => {
          marker.style.height = `${markerHeight}px`
          marker.style.flexBasis = `${markerHeight}px`
        })
      }
      layoutCollapsedTrack()
      let scrollAnimationId = null
      let activeHeadingIndex = -1
      let tocScrollTicking = false
      const headings = links.map(link => {
        const id = decodeURIComponent(link.hash.slice(1))
        return document.getElementById(id)
      })

      const setActiveLink = activeIndex => {
        if (activeIndex === activeHeadingIndex) return
        activeHeadingIndex = activeIndex
        links.forEach((link, index) => {
          const isActive = index === activeIndex
          link.classList.toggle('is-active', isActive)
          if (collapsedMarkers[index]) collapsedMarkers[index].classList.toggle('is-active', isActive)
          const item = link.closest('li')
          if (item) item.classList.toggle('is-active', isActive)
          if (isActive) link.setAttribute('aria-current', 'location')
          else link.removeAttribute('aria-current')
        })
        if (activePath) this.refreshTocIndicator()
      }

      const scrollToHeading = heading => {
        if (scrollAnimationId) window.cancelAnimationFrame(scrollAnimationId)
        const start = window.pageYOffset
        const target = start + heading.getBoundingClientRect().top - 24
        const distance = target - start
        const duration = Math.min(760, Math.max(480, Math.abs(distance) * .16))
        const startTime = performance.now()

        const easeInOutCubic = progress => progress < .5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2

        const animateScroll = now => {
          const progress = Math.min((now - startTime) / duration, 1)
          window.scrollTo(0, start + distance * easeInOutCubic(progress))
          if (progress < 1) scrollAnimationId = window.requestAnimationFrame(animateScroll)
          else {
            scrollAnimationId = null
            updateActiveHeading()
          }
        }

        scrollAnimationId = window.requestAnimationFrame(animateScroll)
      }

      links.forEach((link, index) => {
        link.addEventListener('click', event => {
          const heading = headings[index]
          if (!heading) return
          event.preventDefault()
          if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            window.scrollTo(0, window.pageYOffset + heading.getBoundingClientRect().top - 24)
          } else {
            scrollToHeading(heading)
          }
          history.replaceState(null, '', link.hash)
          setActiveLink(index)
          if (window.matchMedia('(max-width: 767px)').matches) this.dismissToc()
        })
      })

      const updateActiveHeading = () => {
        let activeIndex = 0
        headings.forEach((heading, index) => {
          if (heading && heading.getBoundingClientRect().top <= 120) activeIndex = index
        })
        setActiveLink(activeIndex)
      }

      updateActiveHeading()
      if (autoBuildToc && window.location.hash) {
        window.requestAnimationFrame(() => {
          let initialId = window.location.hash.slice(1)
          try { initialId = decodeURIComponent(initialId) } catch (error) {}
          const initialHeading = document.getElementById(initialId)
          if (initialHeading) {
            window.scrollTo(0, window.pageYOffset + initialHeading.getBoundingClientRect().top - 24)
            updateActiveHeading()
          }
        })
      }
      window.addEventListener('resize', () => {
        this.refreshTocIndicator()
        layoutCollapsedTrack()
      }, { passive: true })
      window.addEventListener('scroll', () => {
        if (tocScrollTicking) return
        tocScrollTicking = true
        window.requestAnimationFrame(() => {
          if (!scrollAnimationId) updateActiveHeading()
          tocScrollTicking = false
        })
      }, { passive: true })
    },
    shareToTwitter() {
      window.open(`https://twitter.com/share?text=${this.text}&url=${this.url}`, '_blank', 'width=615,height=505')
    },
    shareToWeibo() {
      window.open(`https://service.weibo.com/share/share.php?title=${this.text}&url=${this.url}`, '_blank', 'width=615,height=505')
    },
    shareToTelegram() {
      window.open(`https://telegram.me/share/url?text=${this.text}&url=${this.url}`, '_blank', 'width=615,height=505')
    },
  },
})
