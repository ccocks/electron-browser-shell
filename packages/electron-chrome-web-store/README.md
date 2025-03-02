# electron-chrome-web-store

Install and update Chrome extensions from the Chrome Web Store for Electron.

## Usage

```
npm install electron-chrome-web-store
```

> [!TIP]
> To enable full support for Chrome extensions in Electron, install [electron-chrome-extensions](https://www.npmjs.com/package/electron-chrome-extensions).

### Enable downloading extensions from the Chrome Web Store

```js
const { app, BrowserWindow, session } = require('electron')
const { installChromeWebStore } = require('electron-chrome-web-store')

app.whenReady().then(async () => {
  const browserSession = session.defaultSession
  const browserWindow = new BrowserWindow({
    webPreferences: {
      session: browserSession,
    },
  })

  // Install Chrome web store and wait for extensions to load
  await installChromeWebStore({ session: browserSession })

  browserWindow.loadURL('https://chromewebstore.google.com/')
})
```

### Install and update extensions programmatically

```js
const { app, session } = require('electron')
const { installExtension, updateExtensions } = require('electron-chrome-web-store')

app.whenReady().then(async () => {
  // Install Dark Reader
  await installExtension('eimadpbcbfnmbkopoojfekhnkhdbieeh')

  // Install React Developer Tools with file:// access
  await installExtension('fmkadmapgofadopljbjfkapdkoienihi', {
    loadExtensionOptions: { allowFileAccess: true },
  })

  // Install uBlock Origin Lite to custom session
  await installExtension('ddkjiahejlhfcafbddmgiahcphecmpfh', {
    session: session.fromPartition('persist:browser'),
  })

  // Check and install updates for all loaded extensions
  await updateExtensions()
})
```

### Including the preload script

This module requires including its preload script. Be sure to copy it next to your app's entry
point script so it works in your packaged app.

```js
const fs = require('node:fs')
const path = require('node:path')

const preloadPath = require.resolve('electron-chrome-web-store/preload')
const buildPath = './path/to/entry/point'

fs.cp(preloadPath, path.join(buildPath, path.basename(preloadPath)))
```

For bundlers, you can try using [copy-webpack-plugin](https://github.com/webpack-contrib/copy-webpack-plugin), [vite-plugin-static-copy](https://github.com/sapphi-red/vite-plugin-static-copy), or [rollup-plugin-copy](https://github.com/vladshcherbin/rollup-plugin-copy).

The `modulePath` option can be used for loading the preload from elsewhere.

```js
installChromeWebStore({
  modulePath: path.resolve('./out', 'node_modules', 'electron-chrome-web-store'),
})
```

## API

### `installChromeWebStore`

Installs Chrome Web Store support in the specified session.

- `options`
  - `session`: The Electron session to enable the Chrome Web Store in. Defaults to `session.defaultSession`.
  - `modulePath`: The path to the 'electron-chrome-web-store' module.
  - `extensionsPath`: The path to the extensions directory. Defaults to 'Extensions/' in the app's userData path.
  - `autoUpdate`: Whether to auto-update web store extensions at startup and once every 5 hours. Defaults to true.
  - `loadExtensions`: A boolean indicating whether to load extensions installed by Chrome Web Store. Defaults to true.
  - `allowUnpackedExtensions`: A boolean indicating whether to allow loading unpacked extensions. Only loads if `loadExtensions` is also enabled. Defaults to false.
  - `allowlist`: An array of allowed extension IDs to install.
  - `denylist`: An array of denied extension IDs to install.
  - `beforeInstall`: A function which receives install details and returns a promise. Allows for prompting prior to install.

### `installExtension`

Installs Chrome extension from the Chrome Web Store.

- `extensionId`: The Chrome Web Store extension ID to install.
- `options`
  - `session`: The Electron session to load extensions in. Defaults to `session.defaultSession`.
  - `extensionsPath`: The path to the extensions directory. Defaults to 'Extensions/' in the app's userData path.
  - `loadExtensionOptions`: Extension options passed into `session.loadExtension`.

### `updateExtensions`

Checks loaded extensions for updates and installs any if available.

- `session`: The Electron session to load extensions in. Defaults to `session.defaultSession`.

### `loadAllExtensions`

Loads all extensions from the specified directory.

- `session`: The Electron session to load extensions in.
- `extensionsPath`: The path to the directory containing the extensions.
- `options`: An object with the following property:
  - `allowUnpacked`: A boolean indicating whether to allow loading unpacked extensions. Defaults to false.

> [!NOTE]
> The `installChromeWebStore` API will automatically load web store extensions by default.

## License

MIT
