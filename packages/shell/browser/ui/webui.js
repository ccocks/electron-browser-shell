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
      addressUrl: $('#addressurl'),

      browserActions: $('#actions'),

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

  addEventListeners() {
    this.$.createTabButton.addEventListener('click', () => chrome.tabs.create())
    this.$.goBackButton.addEventListener('click', () => chrome.tabs.goBack())
    this.$.goForwardButton.addEventListener('click', () => chrome.tabs.goForward())
    this.$.reloadButton.addEventListener('click', () => chrome.tabs.reload())
    this.$.addressUrl.addEventListener('keypress', this.onAddressUrlKeyPress.bind(this))
    this.$.addressUrl.addEventListener('click', () => this.$.addressUrl.select())

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
      },
      windows: {
        get: (id, cb) => cb({ id, state: 'normal' }),
        update: (...args) => console.log('chrome.windows.update', ...args),
        remove: () => console.log('chrome.windows.remove'),
      },
    }

    // now that chrome is mocked, add the listeners
    this.addEventListeners()

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
        this.tabList.splice(tabIndex, 1)
        const tabNode = this.$.tabList.querySelector(`[data-tab-id="${tabId}"]`)
        if (tabNode) {
          tabNode.classList.add('closing')
          tabNode.addEventListener('animationend', () => tabNode.remove())
        }
      }
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
    }
  }

  createTabNode(tab) {
    const tabElem = this.$.tabTemplate.content.cloneNode(true).firstElementChild
    tabElem.dataset.tabId = tab.id

    tabElem.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', tab.id)
      this.draggedTab = tabElem
      tabElem.classList.add('dragging')
    })
    tabElem.addEventListener('dragend', () => {
      this.draggedTab.classList.remove('dragging')
      this.draggedTab = null
    })
    tabElem.addEventListener('dragover', (e) => {
      e.preventDefault()
      if (tabElem !== this.draggedTab) {
        const rect = tabElem.getBoundingClientRect()
        const isAfter = e.clientX > rect.left + rect.width / 2
        if (isAfter) {
          tabElem.parentNode.insertBefore(this.draggedTab, tabElem.nextSibling)
        } else {
          tabElem.parentNode.insertBefore(this.draggedTab, tabElem)
        }
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

      // Animate the tab in
      setTimeout(() => {
        tabElem.style.animation = `tab-grow-in var(--transition-duration)`
      }, 0)
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
