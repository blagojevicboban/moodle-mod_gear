# Changelog

All notable changes to mod_gear will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[Unreleased]: https://github.com/blagojevicboban/moodle-mod_gear/compare/v1.2.1...HEAD
[1.2.1]: https://github.com/blagojevicboban/moodle-mod_gear/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/blagojevicboban/moodle-mod_gear/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/blagojevicboban/moodle-mod_gear/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/blagojevicboban/moodle-mod_gear/compare/v0.2.0...v1.0.0
[0.2.0]: https://github.com/blagojevicboban/moodle-mod_gear/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/blagojevicboban/moodle-mod_gear/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/blagojevicboban/moodle-mod_gear/releases/tag/v0.1.0
