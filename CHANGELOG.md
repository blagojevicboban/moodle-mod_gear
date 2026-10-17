# Changelog

All notable changes to mod_gear will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.8.0] - 2026-10-17

### Added
- **Heavy models and phones:** KTX2 (Basis Universal) textures are supported (self-hosted transcoder in `vendorjs/basis/`); the render resolution is capped at 1.5 on touch screens and at 1 for models above 500,000 triangles; teachers get a warning for models above 1 million triangles with a hint to simplify or compress them.
- The release workflow checks that the tag matches `$plugin->release` in `version.php`.
- **Questions from the question bank:** the quiz fields of the hotspot form have an *Import from question bank* button (single answer multiple choice and true/false questions of the course; Moodle 4.5 course context and the question banks of Moodle 5.x). The hotspot gets a copy of the text and the answers (images are not copied); options that contain commas are kept intact. New web service `mod_gear_get_bank_questions` (capability `mod/gear:manage`).
- **Report Builder source** *GEAR activity tracking*: custom reports (and aggregation, for example a count of hotspot views per student) over the tracked actions of the users, with the course, activity, user, action, time and duration. Tests for the source (`tests/reportbuilder`).
- **Animations:** the clips of a glTF model (play/pause, clip and speed selection, off by default under *reduced motion*); the teacher saves the default clip, speed and autoplay with *Save as default*.
- **Material variants** (`KHR_materials_variants`): a selector in the viewer; the teacher saves the default variant.
- **Guided tour:** the teacher walks the scene and adds steps (title, text and the current camera view); students follow them with *Previous/Next*, the camera flies to each view (jumps under *reduced motion*), the step text is read out by screen readers. Steps are stored in the scene configuration (no database change, included in backups) and validated on the server (at most 30 steps). A step can also open a hotspot, play an animation clip and show a material variant when the student reaches it (a hotspot that is still locked for the student is skipped).
- `mod_gear_save_scene_config` accepts the optional `animation`, `variant` and `tour` parameters next to `camera`.
- **Text alternative for the 3D scene:** a *Scene description* field in the activity settings (stored in the scene configuration); the canvas label uses it, or the activity name and the number of hotspots, and a visually hidden list of hotspots lets screen reader and keyboard users open every hotspot.
- Developer tooling: end-to-end chat check with a local PeerJS server (`devtools/check-gear-chat.mjs`), modal and scene description checks.

### Changed
- Accessibility, checked with axe-core on the viewer, tour, help dialog and hotspot form (0 violations, `devtools/check-gear-axe.mjs`): the hotspot color and size controls have accessible names, hotspot popup and form headings are `h3` (no skipped heading level).
- Browser pop-ups are replaced by Moodle dialogs: the delete confirmation (`Notification.deleteCancelPromise`) and the topic dialog of the AI assistant (`core/modal_save_cancel`, focus in the field, Enter confirms).
- Chat messages show the user that the server lists for the sending peer ("User 7") instead of a name the message claims; the label and the viewer texts that were hard coded in English (error title, points awarded, hotspot fallback name, canvas label) are language strings now.
- The viewer source has no ESLint warnings any more; the hotspot list code is split into smaller methods.

### Verified
- Chat between two browsers over WebRTC with a local PeerJS server (message delivered, sender label correct, PeerJS loaded lazily).

## [1.7.1] - 2026-10-16

### Added
- PHPUnit test suite (`lib_test`, `external_test`, `privacy/provider_test`, `backup_restore_test`), data generator (`mod_gear_generator`), and Behat feature tests.
- Activity events (`quiz_submitted`, `hotspot_created`, `hotspot_updated`, `hotspot_deleted`, `model_updated`, `report_viewed`) and scheduled task `cleanup_sessions`.
- Course reset callbacks (`gear_reset_userdata`) and user outline/complete reports.
- `thirdpartylibs.xml` and `readme_moodle.txt` metadata for bundled Three.js and PeerJS.
- Accessibility: help, leaderboard and hotspot popups are real dialogs (`role="dialog"`, labelled, Escape closes, Tab stays inside, focus returns to the opener); icon buttons have accessible names; the chat is a live log; keyboard navigation announces the focused hotspot through a status region.
- `prefers-reduced-motion` is respected (no tooltip transition, hotspot blinking or pulsing).
- Teacher and student guides in `docs/`.
- **AR on iPhone and iPad:** upload a `.usdz` file with the same name as the model (for example `engine.glb` and `engine.usdz`) and Safari opens it in AR Quick Look (Apple does not offer WebXR AR on iOS). Experimental: it has been tested with a simulated Safari only, not on a device.
- **Completion rules** (Moodle custom completion API): *open every hotspot* (teleport points and still locked hotspots do not count) and *earn at least N quiz points*; they are evaluated when a hotspot is opened or a quiz answered and are shown on the course page.
- **Group mode** (`FEATURE_GROUPS`, `FEATURE_GROUPINGS`): with separate groups the leaderboard and the shared session show only members of the user's groups.
- Compressed models: **Draco** and **Meshopt** compressed glTF/GLB files load (the Draco decoder is self-hosted in `vendorjs/draco/`).
- Loading progress in percent and a visible error message when a model cannot be loaded (before, a blue placeholder cube replaced it silently).
- **Several models in one scene**: the transform of every model is saved with *Save Current View* (before, only the first one), and hotspots can be placed on any of them.
- The AI assistant now uses the **Moodle AI subsystem** (`core_ai`, `generate_text` action): the administrator configures providers, models, rate limits and logging in Site administration > General > AI, and every user has to accept the Moodle AI usage policy once. The button is shown only when the assistant is enabled in the GEAR settings, a provider supports text generation and the AI tools are not switched off for the course. Quiz answers are cut out of the model's text even when it adds markdown or a sentence around the JSON.
- Admin settings `collab_enabled` (collaborative mode, off for new installs) and `peerjs_server` (optional own PeerJS server); on upgrade the mode stays enabled where it was already in use.
- `gear_sessions.peerid`: every browser session uses a random WebRTC peer id that is shared only through the session list.

### Security
- `track_event` accepts only `ar_start`, `vr_start` and `hotspot_click` (size-limited JSON, no guests); quiz scores can no longer be forged, as they come from `submit_quiz` only.
- `save_hotspot` verifies that the hotspot and model belong to the activity, validates the type and JSON fields and cleans the content.
- The correct quiz answer is no longer sent to users who cannot manage the activity; hotspot content is cleaned on output.
- `report.php` takes hotspot titles from the hotspot table and escapes all output (stored XSS).
- `gear_pluginfile` requires `mod/gear:view`, serves only the `model` area as a download and no longer sends a CORS wildcard.
- Viewer: chat messages, quiz feedback and tooltips no longer insert untrusted text as HTML.
- Hotspots that require a quiz are no longer sent to students until the quiz is solved (before, the content was in the network response and unlocking was lost on reload); `submit_quiz` refuses locked quizzes.
- WebRTC: peer ids are random instead of `mod_gear_<activity>_<user>`, incoming calls and chat connections are accepted only from participants of the session list, and guests cannot join.

### Fixed
- **The AR and VR buttons were always disabled**, even in browsers with WebXR: the support flags were never stored, and the buttons were wired before WebXR was checked.
- Editing the activity settings no longer resets the saved camera and the hotspot checkboxes.
- The viewer is no longer started for an activity without a model.
- Grades are scaled so that the points of all quiz hotspots equal the full grade; the grade item and sessions are removed with the activity.
- Restore remaps `requires_id` of hotspots and skips tracking rows of users that were not restored; backup annotates the users.
- Missing `error:*` and Serbian `hotspotscale_help` strings; declared PeerJS in privacy metadata and fixed session export subcontext.
- The model file picker accepts only `.glb`, `.gltf`, `.bin` and images (20 files).
- Grades counted only one quiz submission per user (the query returned one row per user); every submission is now considered and the best score per hotspot is kept.
- Leaderboard and collaborative session list selected too few user name fields for `fullname()`.
- Quiz feedback used a core string that does not exist (`incorrect`); the plugin's own strings are used.
- Tooltip was a live region that was re-announced on every mouse move.

### Changed
- **Upgrade note:** the plugin's own OpenAI API key and model settings (`ai_apikey`, `ai_model`) were removed. After the upgrade configure an AI provider with text generation in Moodle's AI settings; the GEAR setting *Enable AI Assistant* stays as it was.
- Requires Moodle 4.5 or later (supported 4.5 to 5.3). Templates use Bootstrap 5 classes.
- Removed the unimplemented custom completion rules flag and unused `completion_type` column; added `timecreated` to `gear_hotspots` and `userid` foreign keys.
- Performance: the 3D scene is not rendered while the tab is hidden or the canvas is scrolled out of view, session polling pauses in a hidden tab, GPU resources and listeners are released when the page is left, and PeerJS is loaded only when a second participant joins the session.
- CI now runs PostgreSQL 16 (required by Moodle 5.2+) and tests Moodle 4.5 and 5.0 to 5.3.
- The viewer source is split into modules: `amd/src/viewer.js` (scene), `sync.js` (collaborative mode and WebRTC) and `dom.js` (safe text, dialogs); all are bundled into `amd/build/viewer.min.js`. ESLint warnings went from 43 to 21 (the rest are `window.confirm/prompt` and promise style).
- Moved `peerjs.min.js` out of `amd/src/` into `vendorjs/`; scoped CSS variables and rules to `.path-mod-gear` / `.gear-activity`.

## [1.7.0] - 2026-04-14

### Added
- **Hotspot Scale Control**: Teachers can now configure default hotspot diameter via activity settings form (0.1 to 3.0 scale)
- **Keyboard Navigation**: Full keyboard accessibility for 3D viewer - Tab to focus, Arrow keys to navigate hotspots, Enter/Space to activate, Escape to close tooltips
- **Screen Reader Support**: Tooltips now include `role="tooltip"`, `aria-live="polite"`, and `aria-label` attributes for proper screen reader announcements
- **Touch/Long-Press Support**: Mobile users can long-press (0.5s) on hotspots to view tooltips with haptic feedback on supported devices
- **Tooltip Animations**: Smooth fade-in/fade-out transitions with scale animation (200ms duration) for improved user experience
- **Visual Focus Indicator**: Canvas shows outline highlight when focused for keyboard users

### Changed
- Canvas is now focusable with `tabindex="0"` and `role="application"` for better accessibility
- Tooltip icons marked as `aria-hidden="true"` to prevent screen reader redundancy

## [1.6.0] - 2026-04-09

### Changed
- **Three.js Upgrade**: Migrated from Three.js r128.0 (2021) to r160.0 (2024), gaining 3+ years of security patches, performance improvements, and WebXR enhancements
- **ES Module Architecture**: Replaced legacy global `THREE` object with modern ES module imports (`import * as THREE from 'three'`)
- **Self-Hosted Dependencies**: Eliminated CDN dependencies for Three.js - now bundled locally via Rollup for improved reliability and performance
- **Build System**: Added Rollup bundler to convert ES modules to AMD format for Moodle compatibility
- **Deprecated APIs**: Updated `THREE.sRGBEncoding` to `THREE.SRGBColorSpace` (r152+ standard)
- **Hotspot Visibility**: Increased default hotspot scale from `1.0` to `1.5` and geometry from `0.08` to `0.12` radius for better visibility

### Added
- **Hover Tooltips**: Interactive tooltips showing hotspot type icon, title, and description on hover (see `docs/TOOLTIP_SYSTEM.md`)
- **Smart Positioning**: Tooltips follow mouse cursor with automatic edge detection to stay on-screen
- **Type-Specific Icons**: Font Awesome icons for each hotspot type (info, quiz, audio, video, teleport)
- Rollup configuration (`rollup.config.js`) for ES module bundling
- New build dependencies: `three`, `@rollup/plugin-node-resolve`, `@rollup/plugin-commonjs`, `rollup`, `grunt-rollup`
- Documentation: `docs/TOOLTIP_SYSTEM.md` with tooltip system details

### Removed
- CDN script loading for Three.js core, OrbitControls, TransformControls, and GLTFLoader from `view.php`

### Migration Notes
- See `MIGRATION_COMPLETE.md` for detailed migration guide and testing checklist
- No database changes required - fully backward compatible
- Run `npm install && npx grunt amd` to rebuild after updating

## [1.5.0] - 2026-04-05

### Added
- **WebXR Controllers**: Full hand tracking and laser pointer support for VR headsets to interact manually with hotspots.
- **Text Chat**: Added real-time Peer-to-Peer text chat using WebRTC Data Channels in the collaborative mode, alongside the existing voice chat.
- **Analytics Dashboard**: Added `report.php` offering visual bar charts and tabular tracking metrics (hotspot clicks, VR starts, etc.) for teachers with `mod/gear:manage` capabilities.
- Added Analytics button dynamically to the viewer header interface if the user has management permissions.

## [1.4.0] - 2026-04-05

### Added
- **Visual Authoring Gizmo**: Integrated `THREE.TransformControls` so teachers can move and position hotspots seamlessly dragging them along X/Y/Z axes in the 3D space, instead of manually clicking points.
- **WebRTC Spatial Voice Chat**: Integrated PeerJS for serverless P2P voice communication. Users' microphones are automatically spatialized as `THREE.PositionalAudio` attached to their collaborative avatars.
- **Auto Text-to-Speech (TTS)**: Added a native browser-based Speech Synthesis engine. Users can click the speaker icon on any Info hotspot to have its content narrated aloud automatically.
- **Gamification & Branching Scenarios**: Hotspots can now be locked until a specific quiz is completed correctly. This enables "Escape Room" style learning where solving puzzles unlocks new areas or information.
- **Teleport Waypoints**: A new hotspot type that doesn't show a popup but instead seamlessly flies the camera to a new location in the 3D scene, ideal for guided navigation.
- **Popup Animation**: Unlocked hotspots now appear with a smooth scaling "pop" animation when their condition is met.

### Changed
- **Performance Optimization**: Significant framerate improvements for mobile devices and WebXR by dynamically capping device pixel ratios and hinting `high-performance` power preference to the GPU.

## [1.3.0] - 2026-04-04

### Added
- **Video hotspot type**: authors can now attach a video URL to any hotspot, supporting both direct video files (`.mp4`, `.webm`, `.ogg`) and embedded iframes (YouTube, Vimeo, etc.)
- Video playback rendered inside the hotspot popup via a responsive `<video>` element or `<iframe>` depending on the URL type
- New language strings (`video_url`, `video_url_help`, `hotspot_type_video`) in English and Serbian

## [1.2.2] - 2026-04-03

### Fixed
- Removed `Zone.Identifier` Windows metadata file from the plugin package that caused `core_plugin/corrupted_archive_structure` validation error during Moodle plugin installation
- Improved ZIP build process to exclude all Windows/macOS metadata files

## [1.2.1] - 2026-03-29

### Changed
- Removed dev-only `vendor/` and `node_modules/` from the published plugin package
- Updated GitHub Actions release workflow to exclude dev dependencies and configuration files
- Added `.gitattributes` to ignore development files in `git archive` exports

## [1.2.0] - 2026-03-18

### Added
- Fully implemented Privacy Provider (GDPR) for mod_gear (metadata, export, and deletion of user tracking and session data)
- Declared external location link (OpenAI) in Privacy Provider for transparency

### Changed
- Replaced direct PHP `curl_init()` with Moodle's `\curl` wrapper for OpenAI API calls to support site proxy and security settings
- Reordered language strings (English and Serbian) alphabetically per Moodle standards
- Successfully minified `viewer.js` with correct `async/await` syntax in AMD modules
- Updated plugin version to 2026031800

### Fixed
- HTML validation error in `hotspot_popup.mustache` (moved `div` out of `h4`)
- Repaired `async/await` scope issues in `viewer.js` that was preventing minification

## [1.1.0] - 2026-03-11

### Added
- Localized editor instructions for adding hotspots (Shift + Click)
- Enhanced Instructions modal with localized strings for all controls
- New language strings for help modal categories

### Changed
- Improved "Save Current View" label to "Save Current View (Set as default)" for clarity
- Minified viewer.js and updated sourcemaps

## [1.0.0] - 2026-03-10

### Added
- Real-time Multi-user Collaborative mode with avatars
- Spatial Audio Guides (Three.js PositionalAudio)
- In-world Quiz functionality with automated grading
- Global Leaderboard system
- AI Content Assistant (OpenAI integration)
- Admin settings for AI configuration (API key, Model)
- User interaction tracking system

### Fixed
- Quiz results aggregation logic in Leaderboard
- Missing trackEvent calls in viewer.js
- Database field access in grading logic
- Security: Removed sensitive files and API keys from repository

## [0.2.0] - 2026-02-05

### Added
- Moodle 5.0/5.1 support
- MariaDB support in CI testing
- Source maps for AMD modules

### Changed
- Updated CI workflow to test multiple Moodle versions
- Language strings ordered alphabetically per Moodle standards

### Fixed
- ESLint errors (THREE.js global, curly spacing, case declarations)
- Stylelint CSS errors
- Mustache template example context
- PHPDoc documentation

## [0.1.0] - 2026-02-04

### Added
- Initial release
- 3D model viewer with Three.js
- AR mode support (WebXR)
- VR mode support (WebXR)
- Interactive hotspots
- Auto-rotate functionality
- Fullscreen mode
- English and Serbian language support
- Activity completion tracking
- Course module integration
- GitHub Actions CI/CD
- Moodle 4.4+ compatibility

[Unreleased]: https://github.com/blagojevicboban/moodle-mod_gear/compare/v1.7.1...HEAD
[1.7.1]: https://github.com/blagojevicboban/moodle-mod_gear/compare/v1.7.0...v1.7.1
[1.7.0]: https://github.com/blagojevicboban/moodle-mod_gear/compare/v1.6.0...v1.7.0
[1.6.0]: https://github.com/blagojevicboban/moodle-mod_gear/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/blagojevicboban/moodle-mod_gear/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/blagojevicboban/moodle-mod_gear/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/blagojevicboban/moodle-mod_gear/compare/v1.2.2...v1.3.0
[1.2.2]: https://github.com/blagojevicboban/moodle-mod_gear/compare/v1.2.1...v1.2.2
[1.2.1]: https://github.com/blagojevicboban/moodle-mod_gear/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/blagojevicboban/moodle-mod_gear/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/blagojevicboban/moodle-mod_gear/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/blagojevicboban/moodle-mod_gear/compare/v0.2.0...v1.0.0
[0.2.0]: https://github.com/blagojevicboban/moodle-mod_gear/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/blagojevicboban/moodle-mod_gear/releases/tag/v0.1.0
