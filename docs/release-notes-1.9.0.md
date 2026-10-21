# GEAR 1.9.0

Requires Moodle 4.5 LTS or later (tested on 4.5, 5.0, 5.1, 5.2 and 5.3) and PHP 8.2 or later. There are no database changes.

## New

- **Snapshot PNG Export:** Teachers and students can download a clean, high-resolution PNG screenshot of the current 3D viewport at any time using the camera button in the left controls. The file is saved as `gear-[cmid]-[timestamp].png`.
- **Cross-Section / Clipping Plane:** Inspect the internal architecture of complex 3D objects (such as mechanical engines, biological specimens, or architectural structures). Choose the slicing axis (X, Y, or Z), adjust depth via a percentage slider, or invert the cut direction. Teachers can save the active cross-section as part of the default view.
- **3D Measurement Tool:** Measure exact real-world distances between any two surface points on the 3D model. Raycasts surface coordinates, places start and end markers, draws a connecting line, and displays a floating distance badge formatted in metric units (mm, cm, or m).
- **Direct Hotspot Audio/Video Upload:** Teachers can now upload MP3/WAV/OGG audio and MP4/WebM video files directly from the hotspot creation form without needing external hosting. Uploaded media is securely stored in Moodle's `hotspot_media` file area, streamed inline via `gear_pluginfile()`, and cleanly preserved during course backup and restore.
- **Scene JSON Export and Import:** Teachers can export complete scene definitions—including camera viewpoints, clipping planes, hotspots, quiz parameters, and prerequisite unlocking chains—into a portable `.gear.json` file. The scene can then be imported into any other GEAR activity with automatic ID and dependency remapping.

## Improved

- **Modular Architecture:** Extracted 3D scene measurement, clipping, and snapshot tools into `amd/src/tools.js` (`SceneTools`).
- **File Management & Cleanup:** Deleting a hotspot or deleting an entire GEAR activity properly cleans up all associated media files in `mdl_files`.
- **Backup & Restore:** Full support for `hotspot_media` file areas with automatic URL rewriting upon restoration to new course contexts.

## Verified

- Automated tests on Moodle 5.3 in WSL with MariaDB 11.4 and PHP 8.3 (`test-gear-190.php`, `test-gear-lifecycle.sh`, `test-gear-security.sh`).
- PHPCS Moodle coding standards: 0 errors, 0 warnings.
- ESLint and Grunt AMD compilation: 0 errors.

Full list of changes: [CHANGELOG.md](../CHANGELOG.md).

