/** GitHub-inspired, one-way reactions for Rocky Memos. */
(function () {
  'use strict'

  if (!window.customElements || customElements.get('emoji-reaction')) return

  const reactions = [
    { name: 'thumbs-up', emoji: '👍', label: '赞同' },
    { name: 'thumbs-down', emoji: '👎', label: '不赞同' },
    { name: 'smile-face', emoji: '😄', label: '开心' },
    { name: 'party-popper', emoji: '🎉', label: '庆祝' },
    { name: 'confused-face', emoji: '😕', label: '疑惑' },
    { name: 'red-heart', emoji: '❤️', label: '喜欢' },
    { name: 'rocket', emoji: '🚀', label: '起飞' },
    { name: 'eyes', emoji: '👀', label: '关注' }
  ]

  class EmojiReaction extends HTMLElement {
    static get observedAttributes() { return ['endpoint', 'target-id', 'debug'] }

    constructor() {
      super()
      this.attachShadow({ mode: 'open' })
      this.counts = new Map()
      this.loaded = false
      this.loading = false
      this.open = false
      this.pending = ''
      this.onDocumentClick = this.onDocumentClick.bind(this)
      this.onDocumentKeydown = this.onDocumentKeydown.bind(this)
    }

    connectedCallback() {
      this.render()
      document.addEventListener('click', this.onDocumentClick)
      document.addEventListener('keydown', this.onDocumentKeydown)
      if ('IntersectionObserver' in window) {
        this.observer = new IntersectionObserver((entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return
          this.observer.disconnect()
          this.load()
        }, { rootMargin: '240px 0px' })
        this.observer.observe(this)
      } else this.load()
    }

    disconnectedCallback() {
      if (this.observer) this.observer.disconnect()
      document.removeEventListener('click', this.onDocumentClick)
      document.removeEventListener('keydown', this.onDocumentKeydown)
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue || !this.isConnected) return
      this.loaded = false
      this.counts.clear()
      this.render()
      this.load()
    }

    get endpoint() {
      const value = this.getAttribute('endpoint') || 'https://memos-reaction.yyl125.cc'
      try { return new URL(value).toString() } catch (error) { return 'https://memos-reaction.yyl125.cc/' }
    }

    get targetId() { return String(this.getAttribute('target-id') || location.pathname).replace(/\/$/, '') }

    get debug() { return this.hasAttribute('debug') }

    get clientId() {
      const key = 'rocky_reaction_client_id'
      try {
        let value = localStorage.getItem(key)
        if (!value) {
          value = window.crypto && typeof window.crypto.randomUUID === 'function'
            ? window.crypto.randomUUID()
            : 'client-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2)
          localStorage.setItem(key, value)
        }
        return value
      } catch (error) {
        if (!this.temporaryClientId) this.temporaryClientId = 'session-' + Math.random().toString(36).slice(2)
        return this.temporaryClientId
      }
    }

    requestUrl(name) {
      const url = new URL(this.endpoint)
      if (this.debug) url.pathname = '/api/debug/reaction'
      url.searchParams.set('key', this.reactionKey(name))
      url.searchParams.set('clientId', this.clientId)
      return url
    }

    reactionKey(name) { return this.targetId + '/reaction/' + name }

    storageKey(name) { return 'rocky_memo_reacted:' + this.reactionKey(name) }

    hasReacted(name) {
      try { return localStorage.getItem(this.storageKey(name)) === '1' } catch (error) { return false }
    }

    rememberReaction(name, reacted) {
      try {
        if (reacted === false) localStorage.removeItem(this.storageKey(name))
        else localStorage.setItem(this.storageKey(name), '1')
      } catch (error) {}
    }

    async load() {
      if (this.loading || this.loaded || !this.targetId) return
      this.loading = true
      this.render()
      const results = await Promise.all(reactions.map(async (reaction) => {
        try {
          const url = this.requestUrl(reaction.name)
          const response = await fetch(url.toString(), { credentials: 'omit' })
          if (!response.ok) throw new Error('HTTP ' + response.status)
          const data = await response.json()
          const reacted = typeof data.reacted === 'boolean' ? data.reacted : this.hasReacted(reaction.name)
          return [reaction.name, Math.max(0, Number(data.count) || 0), reacted]
        } catch (error) {
          console.warn('[Rocky Reaction] Unable to read ' + reaction.name + '.', error)
          return [reaction.name, 0, this.hasReacted(reaction.name)]
        }
      }))
      results.forEach(([name, count, reacted]) => {
        this.counts.set(name, count)
        this.rememberReaction(name, reacted)
      })
      this.loading = false
      this.loaded = true
      this.render()
    }

    async react(name) {
      if (this.pending) return
      const reaction = reactions.find((item) => item.name === name)
      if (!reaction) return
      this.pending = name
      this.open = false
      this.render()
      const removing = this.hasReacted(name)
      try {
        const url = this.requestUrl(name)
        const response = await fetch(url.toString(), { method: removing ? 'DELETE' : 'POST', credentials: 'omit' })
        if (!response.ok) throw new Error('HTTP ' + response.status)
        const data = await response.json().catch(() => ({}))
        const nextCount = Number(data.count)
        const fallback = Math.max(0, (this.counts.get(name) || 0) + (removing ? -1 : 1))
        this.counts.set(name, Number.isFinite(nextCount) ? nextCount : fallback)
        const reacted = typeof data.reacted === 'boolean' ? data.reacted : !removing
        this.rememberReaction(name, reacted)
        this.setStatus(removing ? '已撤回：' + reaction.label : '已反馈：' + reaction.label)
      } catch (error) {
        console.warn('[Rocky Reaction] Unable to submit ' + name + '.', error)
        this.setStatus('反馈提交失败，请稍后再试')
      } finally {
        this.pending = ''
        this.render(false)
      }
    }

    setStatus(message) { this.statusMessage = message }

    onDocumentClick(event) {
      if (!this.open || event.composedPath().includes(this)) return
      this.open = false
      this.render()
    }

    onDocumentKeydown(event) {
      if (event.key !== 'Escape' || !this.open) return
      this.open = false
      this.render()
      const trigger = this.shadowRoot.querySelector('.add')
      if (trigger) trigger.focus()
    }

    render(clearStatus) {
      if (clearStatus !== false) this.statusMessage = this.statusMessage || ''
      const visible = reactions.filter((reaction) => (this.counts.get(reaction.name) || 0) > 0 || this.hasReacted(reaction.name))
      this.shadowRoot.innerHTML = '<style>' + this.styles() + '</style>' +
        '<div class="reactions" part="reactions">' +
          visible.map((reaction) => this.reactionButton(reaction)).join('') +
          '<div class="add-wrap">' +
            '<button class="add" type="button" aria-label="添加反馈" aria-haspopup="true" aria-expanded="' + this.open + '">' + this.addIcon() + '</button>' +
            (this.open ? '<div class="picker" role="menu" aria-label="选择反馈">' + reactions.map((reaction) => this.pickerButton(reaction)).join('') + '</div>' : '') +
          '</div>' +
          '<span class="status" aria-live="polite">' + this.escape(this.statusMessage || '') + '</span>' +
        '</div>'
      this.shadowRoot.querySelectorAll('[data-reaction]').forEach((button) => {
        button.addEventListener('click', () => this.react(button.dataset.reaction))
      })
      const add = this.shadowRoot.querySelector('.add')
      if (add) add.addEventListener('click', () => { this.open = !this.open; this.render() })
    }

    reactionButton(reaction) {
      const selected = this.hasReacted(reaction.name)
      const count = this.counts.get(reaction.name) || 0
      const busy = this.pending === reaction.name
      const title = selected ? '撤回' + reaction.label : reaction.label
      return '<button class="pill' + (selected ? ' selected' : '') + '" type="button" data-reaction="' + reaction.name + '" aria-label="' + title + '，' + count + ' 次" aria-pressed="' + selected + '"' + (busy ? ' disabled' : '') + '><span class="emoji" aria-hidden="true">' + reaction.emoji + '</span><span class="count">' + count + '</span></button>'
    }

    pickerButton(reaction) {
      const selected = this.hasReacted(reaction.name)
      const busy = this.pending === reaction.name
      return '<button class="choice' + (selected ? ' selected' : '') + '" type="button" role="menuitem" data-reaction="' + reaction.name + '" aria-label="' + (selected ? '撤回' : '') + reaction.label + '"' + (busy ? ' disabled' : '') + '><span aria-hidden="true">' + reaction.emoji + '</span></button>'
    }

    addIcon() {
      return '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm3.82 1.64a.75.75 0 0 1 1.04.17c.1.12.22.23.35.32.26.18.68.37 1.29.37.6 0 1.02-.19 1.29-.37.13-.09.24-.2.35-.32a.75.75 0 0 1 1.22.87 3.6 3.6 0 0 1-.73.69c-.63.42-1.37.64-2.13.63-.95 0-1.65-.31-2.13-.63a3.33 3.33 0 0 1-.72-.66.75.75 0 0 1 .18-1.07ZM12 7a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM6 7a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/></svg>'
    }

    escape(value) {
      return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]))
    }

    styles() {
      return `
:host {
  --reaction-text: #57606a;
  --reaction-border: #d0d7de;
  --reaction-button: #f6f8fa;
  --reaction-hover: #eaeef2;
  --reaction-panel: #fff;
  --reaction-accent: #0969da;
  --reaction-selected: #ddf4ff;
  --reaction-selected-border: #54aeff;
  display: block;
  margin-top: .75rem;
  color: var(--reaction-text);
  font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.reactions {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: .45rem;
  min-height: 1.75rem;
}
.pill, .add, .choice {
  appearance: none;
  box-sizing: border-box;
  border: 1px solid var(--reaction-border);
  background: var(--reaction-button);
  color: var(--reaction-text);
  font: inherit;
  cursor: pointer;
  box-shadow: none;
  transition: background-color .15s ease, border-color .15s ease, color .15s ease, transform .15s ease;
}
.pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: .42rem;
  height: 1.75rem;
  min-width: 2.85rem;
  padding: 0 .55rem;
  border-radius: 999px;
}
.pill .emoji {
  font-size: 15px;
  line-height: 1;
}
.count {
  min-width: .7em;
  color: inherit;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.add-wrap {
  position: relative;
  order: -1;
}
.add {
  display: grid;
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  place-items: center;
  border-radius: 50%;
}
.pill:hover:not(:disabled), .add:hover, .choice:hover:not(:disabled) {
  border-color: #afb8c1;
  background: var(--reaction-hover);
  color: #24292f;
}
.pill.selected, .choice.selected {
  border-color: var(--reaction-selected-border);
  background: var(--reaction-selected);
  color: var(--reaction-accent);
}
.pill:focus-visible, .add:focus-visible, .choice:focus-visible {
  outline: 2px solid var(--reaction-accent);
  outline-offset: 2px;
}
.picker {
  position: absolute;
  z-index: 12;
  top: calc(100% + .4rem);
  left: 0;
  display: flex;
  align-items: center;
  gap: .4rem;
  width: max-content;
  max-width: min(32rem, calc(100vw - 3rem));
  padding: .45rem .6rem;
  border: 1px solid var(--reaction-border);
  border-radius: .7rem;
  background: var(--reaction-panel);
  box-shadow: 0 8px 24px rgba(140, 149, 159, .24);
  animation: reaction-picker-in .16s ease-out;
}
.choice {
  display: grid;
  width: 1.75rem;
  height: 1.75rem;
  flex: 0 0 auto;
  padding: 0;
  place-items: center;
  border-color: transparent;
  border-radius: .5rem;
  background: transparent;
  font-size: 17px;
}
.choice.selected {
  border-color: transparent;
}
.status {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
.pill:disabled, .choice:disabled {
  cursor: wait;
  opacity: .65;
}
@keyframes reaction-picker-in {
  from { opacity: 0; transform: translateY(-4px) scale(.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@media (prefers-color-scheme: dark) {
  :host {
    --reaction-text: #adbac7;
    --reaction-border: #444c56;
    --reaction-button: #2d333b;
    --reaction-hover: #373e47;
    --reaction-panel: #2d333b;
    --reaction-accent: #539bf5;
    --reaction-selected: rgba(65, 132, 228, .15);
    --reaction-selected-border: #316dca;
  }
  .pill:hover:not(:disabled), .add:hover, .choice:hover:not(:disabled) {
    border-color: #545d68;
    color: #cdd9e5;
  }
  .picker {
    box-shadow: 0 8px 24px rgba(0, 0, 0, .38);
  }
}
@media (max-width: 640px) {
  .picker {
    flex-wrap: wrap;
    width: 8.7rem;
    gap: .35rem;
    padding: .45rem .55rem;
  }
}
@media (prefers-reduced-motion: reduce) {
  .pill, .add, .choice { transition: none; }
  .picker { animation: none; }
}`
    }
  }

  customElements.define('emoji-reaction', EmojiReaction)
})()
