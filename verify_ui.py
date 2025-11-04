import time
from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch()
    context = browser.new_context()
    page = context.new_page()

    # Set a consistent window size for repeatable screenshots
    page.set_viewport_size({"width": 1280, "height": 800})

    # Go to the test page
    page.goto("file:///app/packages/shell/browser/ui/webui.html?test=true")

    # Let the UI render
    time.sleep(1)

    # 1. Baseline screenshot
    page.screenshot(path="verify-01-initial-state.png")

    # 2. Hover over the first tab
    first_tab = page.query_selector('.tab')
    if first_tab:
        first_tab.hover()
        time.sleep(0.5)
        page.screenshot(path="verify-02-tab-hover.png")

    # 3. Interact with the New Tab button
    new_tab_button = page.query_selector('#createtab')
    if new_tab_button:
        new_tab_button.hover()
        time.sleep(0.5)
        page.screenshot(path="verify-03-new-tab-button-hover.png")

        new_tab_button.click()
        time.sleep(0.5)
        page.screenshot(path="verify-04-new-tab-created.png")

    # 4. Interact with toolbar controls
    back_button = page.query_selector('#goback')
    if back_button:
        back_button.hover()
        time.sleep(0.5)
        page.screenshot(path="verify-05-back-button-hover.png")

    forward_button = page.query_selector('#goforward')
    if forward_button:
        forward_button.hover()
        time.sleep(0.5)
        page.screenshot(path="verify-06-forward-button-hover.png")

    reload_button = page.query_selector('#reload')
    if reload_button:
        reload_button.hover()
        time.sleep(0.5)
        page.screenshot(path="verify-07-reload-button-hover.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
