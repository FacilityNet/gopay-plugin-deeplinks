# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Cordova plugin (`@facilitynet/gopay-plugin-deeplinks`) that adds Universal Links (iOS) and Deep Links (Android) support to Cordova apps, including custom URL schemes. It is a fork of `cordova-plugin-deeplinks`, itself forked from `cordova-universal-links-plugin` (nordnet). There is no app to run here — this repo is a Cordova plugin consumed by other Cordova projects via `cordova plugin add`.

There is no test suite, linter, or build step in this repo. There's nothing to `npm install && npm test`.

## Commands

- `npm run release` — runs `standard-version` to bump the version in `package.json`, generate `CHANGELOG.md` entries from Conventional Commit messages, and tag the release.
- After running `npm run release`, **manually sync the version number into `plugin.xml`** (the `<plugin version="...">` attribute) in a separate commit — `standard-version` does not touch `plugin.xml`. Check `git log` for the pattern: a `chore(release): X.Y.Z` commit is immediately followed by a `Sync version in plugin.xml` commit.
- There is no automated test/build/lint command. Validation happens by consuming the plugin from a real Cordova project (`cordova plugin add <path-or-repo>`, then `cordova prepare`/`cordova build` for `ios`/`android`) and checking the generated platform artifacts described below.

## Architecture

The plugin has three parts that run at different times in a consuming Cordova project's lifecycle:

### 1. Cordova hooks (`hooks/`) — build-time code generation (Node.js)

These run when the *consuming app* runs `cordova prepare`/`build`/`plugin add`. This is where most of the actual logic lives — reading the `<universal-links>` block from the consumer's `config.xml` and generating/patching platform-native files.

- `beforePluginInstallHook.js` (`before_plugin_install`) — installs this plugin's own npm dependencies (`node-version-compare`, `plist`, `xml2js`) into the plugin folder inside the consumer's `plugins/` directory, since Cordova doesn't run `npm install` for plugins itself. Guards against re-running via a `.npmInstalled` flag file.
- `iosBeforePrepareHook.js` (iOS `before_prepare`) — detects if the Xcode project folder was renamed and renames the `.entitlements` file to match (skipped for cordova-ios 8.x, where the folder is always `App`).
- `afterPrepareHook.js` (`after_prepare`, all platforms) — the main orchestrator. Reads plugin preferences via `hooks/lib/configXmlParser.js`, then dispatches per platform:
  - **Android**: `hooks/lib/android/manifestWriter.js` injects intent filters into `AndroidManifest.xml`; `hooks/lib/android/webSiteHook.js` generates `ul_web_hooks/android/android_web_hook.html` with the `<link rel="alternate" href="android-app://...">` tags the consumer must add to their website.
  - **iOS**: `hooks/lib/ios/customSchemes.js` generates custom URL scheme entries; `hooks/lib/ios/xcodePreferences.js` enables the "Associated Domains" capability in the Xcode project; `hooks/lib/ios/projectEntitlements.js` generates the `.entitlements` file; `hooks/lib/ios/appleAppSiteAssociationFile.js` generates `<hostname>#apple-app-site-association` files under `ul_web_hooks/ios/` for the consumer to upload to their web server.
- `hooks/lib/xmlHelper.js` / `hooks/lib/configXmlParser.js` / `hooks/lib/configXmlHelper.js` — shared XML parsing utilities used across the hooks (parsing `config.xml`, extracting package name/project name via Cordova's own `ConfigParser`, falling back between `cordova-common` and `cordova-lib` depending on the installed Cordova version).

If a consumer's `config.xml` has no `<universal-links>` hosts defined, `afterPrepareHook.js` logs a warning and exits without generating anything.

### 2. Native plugin sources (`src/`) — runtime link handling

- `src/android/com/nordnetab/cordova/ul/` — Java plugin (`UniversalLinksPlugin.java`) that receives the Android `Intent` when the app is launched via a deep link, matches it against the parsed config (`model/`), and dispatches JS events.
- `src/ios/` — Objective-C plugin (`CULPlugin.m`/`.h`) plus `AppDelegate+CULPlugin`/`SceneDelegate+CULPlugin` categories that hook into iOS's `continueUserActivity` (Universal Links) and custom URL scheme callbacks, match against parsed config (`Model/`, `Parser/XML/`, `Parser/JSON/`), and forward events to JS.
- Both platforms mirror the same conceptual model: config data (hosts/paths/schemes) is parsed once at prepare-time on the JS/hooks side into native config files, then re-parsed natively at runtime to match incoming URLs against configured hosts/paths/schemes and fire the right named event.

### 3. JS bridge (`www/universal_links.js`)

Exposes the `universalLinks` global (`clobbers` target in `plugin.xml`) with `subscribe(eventName, callback)` / `unsubscribe(eventName)`, used by the consuming app to listen for the events the native side dispatches.

### `plugin.xml`

The plugin manifest — lists every native source/header file per platform, JS module, hooks, and the `<feature>` config-file injection for each platform. Any new native source file added under `src/` must be registered here explicitly, or Cordova won't include it when installing the plugin.

## Key facts worth knowing before changing things

- Config schema (`<universal-links>`, `<scheme>`, `<host>`, `<path>`, `<ios-team-id>`) is documented in detail in `README.md` — read it before changing parsing logic in `hooks/lib/configXmlParser.js` or the native parsers, since behavior (wildcards, default event names, per-host scheme defaults) is part of the plugin's public contract.
- iOS and Android each maintain their own independent copy of the config model and matching logic (Objective-C vs Java, plus the JS-side hook generators) — a change to matching semantics (e.g. how `*` wildcards work in paths) needs to be replicated in three places: `hooks/lib/`, `src/android/.../parser/`, and `src/ios/Parser/`.
- Versioning is release-please/standard-version driven from Conventional Commits, but `plugin.xml`'s version is a separate, manually-maintained field — don't forget it when cutting a release.
