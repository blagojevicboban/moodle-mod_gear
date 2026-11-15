# GEAR 4.0.0

Requires Moodle 4.5 LTS or later (tested on 4.5, 5.0, 5.1, 5.2 and 5.3) and PHP 8.2 or later.

## New

- **Built-in 3D Model Library (`assets/library/`):** Instant one-click setup on empty activities with 5 multi-part CC0-style educational models (*Mechanical Gearbox*, *Plant Cell*, *Water Molecule*, *Solar System*, *DC Electric Motor*) including starter hotspots and quizzes.
- **3D Pin-Drop, Sequence & Assembly Quizzes:**
  - **Pin-Drop (`pin`):** Students click directly on a 3D surface location; the server grades 3D Euclidean distance against a configurable `pinRadius`.
  - **Sequence (`sequence`) & Assembly / Reorder (`assembly`):** Multi-step spatial quizzes where students click 3D parts in exact order (`targetSequence`); in `assembly` mode the model auto-explodes and each clicked part snaps back into place.
- **3-Point Angle Measurement Tool:** Measure vertex angles (`A–B–C`) in degrees directly on 3D model surfaces alongside 2-point distance measurement.
- **Before / After Split View & Model Optimization Stats:** Scissor-based split comparison slider (solid vs. wireframe/X-ray/exploded) and live mesh, triangle, and material counts inside the Parts Inspector.
- **Studio Lighting Exposure & Presentation Mode:** PMREM studio lighting presets with an Exposure slider and fullscreen projector-ready Presentation Mode.
- **Student Study / Flashcard Mode & Study Sheet Export:** Mask hotspot labels for self-testing with Next/Reveal controls, and export a printable HTML/PDF Study Sheet (`templates/study_sheet.mustache`) with a 3D snapshot and unlocked notes.
- **Guided Tour View Capture & AI Tour Narration:** One-click *Capture current view* (camera + explode state), *Generate tour from hotspots*, and optional AI narration enrichment via Moodle's core AI subsystem.
- **3D Analytics Heatmap & Live Classroom 3D Surface Ink:** In-scene color-coded engagement halos and error-rate summaries (`mod_gear_get_heatmap_data`), plus real-time 3D surface ink drawing over PeerJS.

## Improved

- **Moodle App Integration:** Enabled `inApp="true"` in `templates/mobile_view.mustache` for seamless mobile app embedding.
- **Frontend Code Quality & Bundle:** Reduced ESLint complexity in `amd/src/viewer.js` (0 errors, 0 warnings) and rebuilt the Rollup-bundled `amd/build/viewer.min.js`.

## Verified

- Moodle Plugin CI matrix green across Moodle 4.5, 5.0, 5.1, 5.2, and 5.3 (PHP 8.2/8.3, MariaDB & PostgreSQL): PHP Lint, Moodle Code Checker, PHPDoc Checker, Mustache Lint, Grunt, and PHPUnit (26/26 tests, 916 assertions).
- Headless browser E2E verification and WSL CLI integration suites (`lifecycle`, `security`, `completion`, `report`, `mobile`, `ai`, `package2`).

Full list of changes: [CHANGELOG.md](../CHANGELOG.md).
