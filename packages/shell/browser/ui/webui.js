class WebUI {
  windowId = -1
  activeTabId = -1
  /** @type {chrome.tabs.Tab[]} */
  tabList = []

  constructor() {
    const $ = document.querySelector.bind(document)

    this.$ = {
      tabList: $('#tabstrip .tab-list'),
      tabTemplate: $('#tabtemplate'),
      createTabButton: $('#createtab'),
      goBackButton: $('#goback'),
      goForwardButton: $('#goforward'),
      reloadButton: $('#reload'),
      homeButton: $('#home'),
      addressUrl: $('#addressurl'),
      suggestions: $('#suggestions'),

      browserActions: $('#actions'),
      settingsButton: $('#settings'),

      minimizeButton: $('#minimize'),
      maximizeButton: $('#maximize'),
      closeButton: $('#close'),
    }


    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('test') === 'true') {
      this.runTestMode()
    } else {
      this.addEventListeners()
      this.initTabs()
    }

    const platformClass = `platform-${navigator.userAgentData.platform.toLowerCase()}`
    document.body.classList.add(platformClass)
  }

  debounce(func, wait) {
    let timeout
    return function(...args) {
      const context = this
      clearTimeout(timeout)
      timeout = setTimeout(() => func.apply(context, args), wait)
    }
  }

  addEventListeners() {
    this.$.createTabButton.addEventListener('click', () => chrome.tabs.create())
    this.$.goBackButton.addEventListener('click', () => chrome.tabs.goBack())
    this.$.goForwardButton.addEventListener('click', () => chrome.tabs.goForward())
    this.$.reloadButton.addEventListener('click', () => chrome.tabs.reload())
    this.$.homeButton.addEventListener('click', () => chrome.tabs.update({ url: 'about:newtab' }))
    this.$.settingsButton.addEventListener('click', () => { /* TODO: Open settings menu */ alert('Settings clicked!') })
    this.$.addressUrl.addEventListener('keypress', this.onAddressUrlKeyPress.bind(this))
    this.$.addressUrl.addEventListener('click', () => this.$.addressUrl.select())
    this.$.addressUrl.addEventListener('keyup', this.onAddressUrlKeyUp.bind(this))
    this.$.addressUrl.addEventListener('blur', () => this.hideSuggestions())

    this.$.tabList.addEventListener('drop', (e) => {
      e.preventDefault()
      const placeholder = this.$.tabList.querySelector('.placeholder')
      if (placeholder) {
        const draggedTabId = parseInt(this.draggedTab.dataset.tabId, 10)
        const children = Array.from(this.$.tabList.children)
        const placeholderIndex = children.indexOf(placeholder)
        const draggedIndex = children.indexOf(this.draggedTab)

        let newIndex = placeholderIndex
        if (draggedIndex < placeholderIndex) {
          newIndex--
        }

        chrome.tabs.move(draggedTabId, { index: newIndex })
      }
    })

    this.$.minimizeButton.addEventListener('click', () =>
      chrome.windows.get(chrome.windows.WINDOW_ID_CURRENT, (win) => {
        chrome.windows.update(win.id, { state: win.state === 'minimized' ? 'normal' : 'minimized' })
      }),
    )
    this.$.maximizeButton.addEventListener('click', () =>
      chrome.windows.get(chrome.windows.WINDOW_ID_CURRENT, (win) => {
        chrome.windows.update(win.id, { state: win.state === 'maximized' ? 'normal' : 'maximized' })
      }),
    )
    this.$.closeButton.addEventListener('click', () => chrome.windows.remove())
  }

  runTestMode() {
    console.log('Running in test mode')
    // Mock chrome API to avoid errors in the console.
    window.chrome = {
      tabs: {
        onCreated: { addListener: (cb) => { this.onCreatedListener = cb } },
        onActivated: { addListener: (cb) => { this.onActivatedListener = cb } },
        onUpdated: { addListener: (cb) => { this.onUpdatedListener = cb } },
        onRemoved: { addListener: (cb) => { this.onRemovedListener = cb } },
        onMoved: { addListener: (cb) => { this.onMovedListener = cb } },
        create: () => {
          const newId = Math.max(0, ...this.tabList.map((t) => t.id)) + 1
          const newTab = { id: newId, title: 'New Tab', url: 'about:newtab', active: false }
          this.tabList.push(newTab)
          this.renderTab(newTab)
          this.setActiveTab(newTab)
        },
        goBack: () => console.log('chrome.tabs.goBack'),
        goForward: () => console.log('chrome.tabs.goForward'),
        reload: () => console.log('chrome.tabs.reload'),
        update: (tabId, options) => {
          const tab = this.tabList.find((t) => t.id === tabId)
          if (tab) {
            Object.assign(tab, options)
            this.renderTab(tab)
            if (options.active) {
              this.setActiveTab(tab)
            }
          }
        },
        remove: (tabId) => {
          const tabIndex = this.tabList.findIndex((tab) => tab.id === tabId)
          if (tabIndex > -1) {
            this.tabList.splice(tabIndex, 1)
            const tabNode = this.$.tabList.querySelector(`[data-tab-id="${tabId}"]`)
            if (tabNode) tabNode.remove()

            // if we removed the active tab, make another active
            if (this.activeTabId === tabId && this.tabList.length > 0) {
              this.setActiveTab(this.tabList[0])
            }
          }
        },
        move: (tabId, moveProperties) => {
          const fromIndex = this.tabList.findIndex(tab => tab.id === tabId)
          if (this.onMovedListener) {
            // Simulate the real browser behavior: the move happens, then the event is fired.
            // The listener is responsible for updating the UI's internal state.
            this.onMovedListener(tabId, { fromIndex, toIndex: moveProperties.index, windowId: this.windowId })
          }
        }
      },
      windows: {
        get: (id, cb) => cb({ id, state: 'normal' }),
        update: (...args) => console.log('chrome.windows.update', ...args),
        remove: () => console.log('chrome.windows.remove'),
      },
    }

    // now that chrome is mocked, add the listeners
    this.addEventListeners()
    this.setupBrowserListeners()

    this.tabList = [
      { id: 1, title: 'Google', url: 'https://google.com', active: true, favIconUrl: 'https://www.google.com/favicon.ico' },
      { id: 2, title: 'Github', url: 'https://github.com', active: false, favIconUrl: 'https://github.com/favicon.ico' },
      { id: 3, title: 'A very long title to see how it overflows and how the UI handles it', url: 'https://example.com', active: false, audible: true },
      { id: 4, title: 'Stack Overflow', url: 'https://stackoverflow.com', active: false, favIconUrl: 'https://cdn.sstatic.net/Sites/stackoverflow/Img/favicon.ico' },
    ]
    this.renderTabs()

    const activeTab = this.tabList.find((tab) => tab.active)
    if (activeTab) {
      this.setActiveTab(activeTab)
    }
  }

  async initTabs() {
    const tabs = await new Promise((resolve) => chrome.tabs.query({ windowId: -2 }, resolve))
    this.tabList = [...tabs]
    this.renderTabs()

    const activeTab = this.tabList.find((tab) => tab.active)
    if (activeTab) {
      this.setActiveTab(activeTab)
    }

    // Wait to setup tabs and windowId prior to listening for updates.
    this.setupBrowserListeners()
  }

  setupBrowserListeners() {
    if (!chrome.tabs.onCreated) {
      throw new Error(`chrome global not setup. Did the extension preload not get run?`)
    }

    const findTab = (tabId) => {
      const existingTab = this.tabList.find((tab) => tab.id === tabId)
      return existingTab
    }

    const findOrCreateTab = (tabId) => {
      const existingTab = findTab(tabId)
      if (existingTab) return existingTab

      const newTab = { id: tabId }
      this.tabList.push(newTab)
      return newTab
    }

    chrome.tabs.onCreated.addListener((tab) => {
      if (tab.windowId !== this.windowId) return
      const newTab = findOrCreateTab(tab.id)
      Object.assign(newTab, tab)
      this.renderTabs()
    })

    chrome.tabs.onActivated.addListener((activeInfo) => {
      if (activeInfo.windowId !== this.windowId) return

      this.setActiveTab(activeInfo)
    })

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, details) => {
      const tab = findTab(tabId)
      if (!tab) return
      Object.assign(tab, details)
      this.renderTabs()
      if (tabId === this.activeTabId) this.renderToolbar(tab)
    })

    chrome.tabs.onRemoved.addListener((tabId) => {
      const tabIndex = this.tabList.findIndex((tab) => tab.id === tabId)
      if (tabIndex > -1) {
        const tabNode = this.$.tabList.querySelector(`[data-tab-id="${tabId}"]`)
        if (tabNode) {
          tabNode.classList.add('new-tab') // This will trigger the shrink/fade animation
          tabNode.addEventListener('transitionend', () => {
            this.tabList.splice(tabIndex, 1)
            tabNode.remove()
          })
        } else {
          this.tabList.splice(tabIndex, 1)
        }
      }
    })

    chrome.tabs.onMoved.addListener((tabId, moveInfo) => {
      if (moveInfo.windowId !== this.windowId) return

      // Move tab in our internal list
      const [movedTab] = this.tabList.splice(moveInfo.fromIndex, 1)
      this.tabList.splice(moveInfo.toIndex, 0, movedTab)

      // Re-render tabs to reflect the new order
      this.renderTabs()
    })
  }

  setActiveTab(activeTab) {
    this.activeTabId = activeTab.id || activeTab.tabId
    this.windowId = activeTab.windowId

    for (const tab of this.tabList) {
      if (tab.id === this.activeTabId) {
        tab.active = true
        this.renderTab(tab)
        this.renderToolbar(tab)

        if (tab.url === 'about:newtab') {
          setTimeout(() => this.$.addressUrl.focus(), 0)
        }
      } else {
        if (tab.active) {
          tab.active = false
          this.renderTab(tab)
        }
      }
    }
  }

  onAddressUrlKeyPress(event) {
    if (event.code === 'Enter') {
      const url = this.$.addressUrl.value
      chrome.tabs.update({ url })
      this.hideSuggestions()
    }
  }

  createPlaceholder() {
    const placeholder = document.createElement('div')
    placeholder.classList.add('placeholder')
    placeholder.style.width = `${this.draggedTab.offsetWidth}px`
    placeholder.style.height = `${this.draggedTab.offsetHeight}px`
    return placeholder
  }

  onAddressUrlKeyUp() {
    const text = this.$.addressUrl.value
    if (text.length > 0) {
      // In a real implementation, we would get suggestions from the browser.
      // For the test mode, we'll just use some mock data.
      const mockSuggestions = [
        { title: 'Google', url: 'https://google.com' },
        { title: 'Github', url: 'https://github.com' },
      ].filter(s => s.url.includes(text) || s.title.toLowerCase().includes(text))
      this.renderSuggestions(mockSuggestions)
    } else {
      this.hideSuggestions()
    }
  }

  hideSuggestions() {
    this.$.suggestions.classList.remove('visible')
  }

  renderSuggestions(suggestions) {
    if (suggestions.length === 0) {
      this.hideSuggestions()
      return
    }

    this.$.suggestions.innerHTML = ''
    for (const suggestion of suggestions) {
      const div = document.createElement('div')
      div.classList.add('suggestion')
      div.textContent = `${suggestion.title} - ${suggestion.url}`
      div.addEventListener('mousedown', () => {
        chrome.tabs.update({ url: suggestion.url })
        this.hideSuggestions()
      })
      this.$.suggestions.appendChild(div)
    }
    this.$.suggestions.classList.add('visible')
  }

  createTabNode(tab) {
    const tabElem = this.$.tabTemplate.content.cloneNode(true).firstElementChild
    tabElem.dataset.tabId = tab.id

    tabElem.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', tab.id)
      this.draggedTab = tabElem
      // Add a class to the dragged tab to change its appearance.
      this.draggedTab.classList.add('dragging')
    })

    tabElem.addEventListener('dragend', () => {
      // Remove the dragging class when the drag operation ends.
      this.draggedTab.classList.remove('dragging')
      this.draggedTab = null

      const placeholder = this.$.tabList.querySelector('.placeholder')
      if (placeholder) {
        placeholder.remove()
      }
    })

    tabElem.addEventListener('dragover', (e) => {
      e.preventDefault()
    })

    tabElem.addEventListener('dragenter', (e) => {
      e.preventDefault()
      if (tabElem === this.draggedTab) return

      const placeholder = this.$.tabList.querySelector('.placeholder')
      if (placeholder) {
        placeholder.remove()
      }

      const rect = tabElem.getBoundingClientRect()
      // Check if the cursor is in the right half of the tab.
      const isAfter = e.clientX > rect.left + rect.width / 2
      if (isAfter) {
        // Insert the placeholder after the current tab.
        tabElem.parentNode.insertBefore(this.createPlaceholder(), tabElem.nextSibling)
      } else {
        // Insert the placeholder before the current tab.
        tabElem.parentNode.insertBefore(this.createPlaceholder(), tabElem)
      }
    })

    tabElem.addEventListener('click', (e) => {
      // middle click to close tab
      if (e.button === 1) {
        chrome.tabs.remove(tab.id)
      } else {
        chrome.tabs.update(tab.id, { active: true })
      }
    })
    tabElem.querySelector('.close').addEventListener('click', (e) => {
      e.stopPropagation()
      chrome.tabs.remove(tab.id)
    })
    const faviconElem = tabElem.querySelector('.favicon')
    faviconElem?.addEventListener('load', () => {
      faviconElem.classList.toggle('loaded', true)
    })
    faviconElem?.addEventListener('error', () => {
      faviconElem.classList.toggle('loaded', false)
    })

    this.$.tabList.appendChild(tabElem)
    return tabElem
  }

  renderTab(tab) {
    let tabElem = this.$.tabList.querySelector(`[data-tab-id="${tab.id}"]`)
    if (!tabElem) {
      tabElem = this.createTabNode(tab)
      tabElem.classList.add('new-tab')
      requestAnimationFrame(() => {
        tabElem.classList.remove('new-tab')
      })
    }

    if (tab.active) {
      tabElem.dataset.active = ''
    } else {
      delete tabElem.dataset.active
    }

    const favicon = tabElem.querySelector('.favicon')
    if (tab.favIconUrl) {
      favicon.src = tab.favIconUrl
    } else {
      delete favicon.src
    }

    tabElem.querySelector('.title').textContent = tab.title
    tabElem.querySelector('.audio').disabled = !tab.audible
  }

  renderTabs() {
    this.$.tabList.innerHTML = ''
    this.tabList.forEach((tab) => {
      this.renderTab(tab)
    })
  }

  renderToolbar(tab) {
    this.$.addressUrl.value = tab.url === 'about:newtab' ? '' : tab.url
    this.$.addressUrl.placeholder = 'Ask Deca or type a URL'
    // this.$.browserActions.tab = tab.id
  }
}

window.webui = new WebUI()
