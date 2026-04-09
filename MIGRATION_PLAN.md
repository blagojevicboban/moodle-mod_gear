# Three.js Migration Plan: r128 → r160+

## Executive Summary

This document outlines the migration strategy for upgrading Three.js from **r128.0** (June 2021) to **r160+** (2024-2025) in the GEAR Moodle module. The migration requires transitioning from legacy global scripts (`examples/js/`) to ES modules (`examples/jsm/`).

---

## Current State Analysis

### Version & Loading Strategy
- **Current Version:** Three.js `0.128.0` (r128)
- **Loading Method:** Global scripts via CDN in `view.php`
- **CDN URLs:**
  - `https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js`
  - `https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js`
  - `https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/TransformControls.js`
  - `https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js`

### Why r128?
The codebase explicitly uses r128 because it's the last version supporting the legacy `examples/js/` path with global `THREE` namespace. This path was **deprecated in r142** and **removed in r150** (early 2023).

---

## Breaking Changes

### 1. **`examples/js/` Folder Removed** ⚠️ CRITICAL
- **Status:** Removed in r150
- **Impact:** All addon imports will fail
- **Current Usage:**
  ```php
  // view.php lines 72-75
  $PAGE->requires->js(new moodle_url('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js'), true);
  $PAGE->requires->js(new moodle_url('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js'), true);
  ```

### 2. **ES Module System Required** ⚠️ CRITICAL
- **Old:** Global `THREE` object with addons attached
- **New:** Import statements for core and addons
- **Current Code:**
  ```javascript
  /* global THREE */
  define(['jquery', ...], function($, ...) {
      // Uses THREE.Scene, THREE.OrbitControls, etc.
  });
  ```

### 3. **Deprecated API: `sRGBEncoding`** ⚠️ MEDIUM
- **Location:** `viewer.js:188`
- **Old:** `this.renderer.outputEncoding = THREE.sRGBEncoding;`
- **New:** `this.renderer.outputColorSpace = THREE.SRGBColorSpace;`
- **Deprecated in:** r152

### 4. **PositionalAudio API Changes** ⚠️ LOW
- **Location:** `viewer.js:1960`
- **Status:** `setMediaStreamSource()` still works in r160, but verify compatibility

### 5. **Raycaster Origin Accessor** ⚠️ LOW
- **Location:** `viewer.js:952`
- **Old:** `this.raycaster.ray.origin.setFromMatrixPosition(...)`
- **New:** Still valid, but `ray.origin` is now accessed via `raycaster.ray.origin`

---

## Migration Strategy

### Phase 1: Preparation (Week 1)

#### 1.1 Self-Host Three.js Dependencies
**Rationale:** Remove CDN dependency, improve reliability and performance

**Action Items:**
1. Create `local_dependencies/` directory in plugin root
2. Download Three.js r160+ files:
   ```bash
   # Download from npm/unpkg
   npm install three@0.160.0
   ```

3. Copy required files:
   ```
   mod/gear/
   └── local_dependencies/
       ├── three.core.min.js          # Core Three.js
       ├── three.addons.min.js        # All addons combined (or separate files)
       ├── OrbitControls.js           # From examples/jsm/controls/
       ├── TransformControls.js       # From examples/jsm/controls/
       ├── GLTFLoader.js             # From examples/jsm/loaders/
       └── LICENSE                    # Three.js license
   ```

4. Update `view.php` to load local files:
   ```php
   // OLD (lines 72-76):
   $PAGE->requires->js(new moodle_url('https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js'), true);
   
   // NEW:
   $PAGE->requires->js(new moodle_url($CFG->wwwroot . '/mod/gear/local_dependencies/three.core.min.js'), true);
   ```

#### 1.2 Update Grunt Configuration
**File:** `Gruntfile.js`

Add ES module bundling step:
```javascript
// Add rollup or esbuild to bundle ES modules
grunt.loadNpmTasks('grunt-rollup');

grunt.initConfig({
    rollup: {
        options: {
            format: 'amd',
            plugins: [
                require('@rollup/plugin-node-resolve')({
                    browser: true,
                    preferBuiltins: false
                })
            ]
        },
        viewer: {
            files: {
                'amd/build/viewer.bundle.js': ['amd/src/viewer.js']
            }
        }
    },
    // ... existing config
});

grunt.registerTask('amd', ['rollup', 'uglify']);
```

**New Dependencies in `package.json`:**
```json
"devDependencies": {
  "three": "^0.160.0",
  "@rollup/plugin-node-resolve": "^15.2.0",
  "rollup": "^4.0.0",
  "grunt-rollup": "^12.0.0"
}
```

---

### Phase 2: Code Migration (Week 2-3)

#### 2.1 Update `view.php` - Remove CDN Script Loading

**File:** `view.php` (lines 69-76)

**CURRENT:**
```php
// Load Three.js BEFORE AMD to avoid RequireJS conflicts.
// Using r128 which supports global THREE.OrbitControls and THREE.GLTFLoader.
$PAGE->requires->js(new moodle_url('https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js'), true);
$PAGE->requires->js(new moodle_url('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js'), true);
$PAGE->requires->js(new moodle_url('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/TransformControls.js'), true);
$PAGE->requires->js(new moodle_url('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js'), true);
$PAGE->requires->js(new moodle_url('https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js'), true);
```

**NEW:**
```php
// Three.js is now bundled with the AMD module, no need to load separately.
// PeerJS still loaded via CDN (consider self-hosting in future).
$PAGE->requires->js(new moodle_url('https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js'), true);
```

#### 2.2 Update `amd/src/viewer.js` - ES Module Imports

**Key Changes:**

1. **Remove global THREE declaration:**
   ```javascript
   // OLD (line 24):
   /* global THREE */
   
   // NEW:
   // Remove this line - THREE will be imported
   ```

2. **Import Three.js modules:**
   ```javascript
   // OLD (line 26):
   define(['jquery', 'core/ajax', 'core/notification', 'core/str', 'core/templates'], function($, Ajax, Notification, Str, Templates) {
   
   // NEW:
   import * as THREE from 'three';
   import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
   import { TransformControls } from 'three/addons/controls/TransformControls.js';
   import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
   
   define(['jquery', 'core/ajax', 'core/notification', 'core/str', 'core/templates'], function($, Ajax, Notification, Str, Templates) {
   ```

   **⚠️ IMPORTANT:** Moodle's AMD system doesn't support ES6 `import` statements natively. We need a bundler (Rollup/esbuild) to convert imports to AMD format.

3. **Replace all `THREE.*` references:**
   All existing `THREE.*` calls remain unchanged since we're importing as `THREE` namespace:
   ```javascript
   new THREE.Scene()           // ✅ Still works
   new THREE.PerspectiveCamera() // ✅ Still works
   new THREE.WebGLRenderer()   // ✅ Still works
   ```

4. **Update addon instantiation:**
   ```javascript
   // OLD (line 266):
   this.controls = new THREE.OrbitControls(this.camera, this.canvas);
   
   // NEW:
   this.controls = new OrbitControls(this.camera, this.canvas);
   
   // OLD (line 275):
   this.transformControl = new THREE.TransformControls(this.camera, this.renderer.domElement);
   
   // NEW:
   this.transformControl = new TransformControls(this.camera, this.renderer.domElement);
   
   // OLD (line 649):
   loader = new THREE.GLTFLoader();
   
   // NEW:
   loader = new GLTFLoader();
   ```

5. **Update deprecated API:**
   ```javascript
   // OLD (line 188):
   this.renderer.outputEncoding = THREE.sRGBEncoding;
   
   // NEW:
   this.renderer.outputColorSpace = THREE.SRGBColorSpace;
   ```

#### 2.3 Update Build Process

**New `Gruntfile.js`:**
```javascript
module.exports = function (grunt) {
    var path = require('path');

    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-eslint');
    grunt.loadNpmTasks('grunt-stylelint');
    grunt.loadNpmTasks('grunt-rollup');

    grunt.initConfig({
        rollup: {
            options: {
                format: 'amd',
                amd: {
                    id: 'mod_gear/viewer'
                },
                plugins: [
                    require('@rollup/plugin-node-resolve')({
                        browser: true,
                        preferBuiltins: false
                    }),
                    require('@rollup/plugin-commonjs')()
                ],
                external: ['jquery', 'core/ajax', 'core/notification', 'core/str', 'core/templates'],
                globals: {
                    'jquery': '$',
                    'core/ajax': 'Ajax',
                    'core/notification': 'Notification',
                    'core/str': 'Str',
                    'core/templates': 'Templates'
                }
            },
            dist: {
                files: {
                    'amd/build/viewer.bundle.js': ['amd/src/viewer.js']
                }
            }
        },
        uglify: {
            dist: {
                files: {
                    'amd/build/viewer.min.js': ['amd/build/viewer.bundle.js']
                },
                options: {
                    sourceMap: true
                }
            }
        },
        eslint: {
            options: {
                quiet: !grunt.option('show-lint-warnings')
            },
            amd: {
                src: ['amd/src/**/*.js']
            }
        },
        watch: {
            js: {
                files: ['amd/src/*.js'],
                tasks: ['rollup', 'uglify']
            }
        }
    });

    grunt.registerTask('amd', ['rollup', 'uglify']);
    grunt.registerTask('default', ['amd']);
};
```

---

### Phase 3: Testing & Verification (Week 4)

#### 3.1 Functional Testing Checklist

| Feature | Test Case | Status |
|---------|-----------|--------|
| **3D Model Loading** | Upload and display GLB model | ☐ |
| **Orbit Controls** | Rotate, zoom, pan 3D scene | ☐ |
| **Hotspot Creation** | Shift+Click to add hotspot | ☐ |
| **Transform Controls** | Move hotspot with 3D gizmo | ☐ |
| **AR Mode** | Launch AR session (mobile) | ☐ |
| **VR Mode** | Launch VR session (headset) | ☐ |
| **Audio Hotspots** | Play positional audio | ☐ |
| **Video Hotspots** | Embed MP4/YouTube/Vimeo | ☐ |
| **Quiz System** | Answer questions, grading | ☐ |
| **Text-to-Speech** | Narrate hotspot content | ☐ |
| **WebRTC Voice** | Multi-user voice chat | ☐ |
| **Avatar Sync** | See other users in scene | ☐ |
| **Leaderboard** | Display top scores | ☐ |
| **AI Assist** | Generate quiz/content | ☐ |
| **Save/Restore** | Backup and restore activity | ☐ |

#### 3.2 Performance Testing

| Metric | r128 (Current) | r160+ (Target) | Tool |
|--------|----------------|----------------|------|
| Initial Load Time | ~2.5s | <2.0s | Lighthouse |
| FPS (Low-end Mobile) | 30fps | 45+fps | Chrome DevTools |
| Memory Usage | ~120MB | ~100MB | Chrome Task Manager |
| Bundle Size | ~650KB | ~580KB (tree-shaken) | Webpack Bundle Analyzer |

#### 3.3 Browser Compatibility Matrix

| Browser | Version | WebGL | WebXR | Notes |
|---------|---------|-------|-------|-------|
| Chrome | 120+ | ✅ | ✅ | Primary target |
| Firefox | 120+ | ✅ | ⚠️ Limited | WebXR experimental |
| Safari | 17+ | ✅ | ❌ | No WebXR support |
| Edge | 120+ | ✅ | ✅ | Chromium-based |
| Mobile Chrome | 120+ | ✅ | ✅ | AR tested |
| Mobile Safari | 17+ | ✅ | ❌ | iOS limitations |

---

### Phase 4: Deployment & Documentation (Week 5)

#### 4.1 Update Documentation

**Files to Update:**
1. `README.md` - Update requirements section
2. `CHANGELOG.md` - Add migration notes
3. `docs/MIGRATION.md` - Create migration guide for existing installations

#### 4.2 Backward Compatibility

**Deprecation Warnings:**
```javascript
// Add to viewer.js init() for transitional period
if (typeof THREE !== 'undefined') {
    console.warn('GEAR: Legacy Three.js global object detected. Please upgrade to ES module-based viewer.');
}
```

#### 4.3 Rollback Plan

If issues arise:
1. Revert `view.php` CDN URLs to r128
2. Restore previous `amd/build/viewer.min.js`
3. No database changes required (fully backward compatible)

---

## Detailed Code Changes

### File: `amd/src/viewer.js`

#### Line 24 - Remove Global Declaration
```diff
- /* global THREE */
```

#### Lines 26-27 - Add ES Module Imports
```diff
+ import * as THREE from 'three';
+ import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
+ import { TransformControls } from 'three/addons/controls/TransformControls.js';
+ import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
+
  define(['jquery', 'core/ajax', 'core/notification', 'core/str', 'core/templates'], function($, Ajax, Notification, Str, Templates) {
```

#### Line 188 - Update Deprecated API
```diff
- this.renderer.outputEncoding = THREE.sRGBEncoding;
+ this.renderer.outputColorSpace = THREE.SRGBColorSpace;
```

#### Line 266 - Update OrbitControls Instantiation
```diff
- this.controls = new THREE.OrbitControls(this.camera, this.canvas);
+ this.controls = new OrbitControls(this.camera, this.canvas);
```

#### Line 275 - Update TransformControls Instantiation
```diff
- this.transformControl = new THREE.TransformControls(this.camera, this.renderer.domElement);
+ this.transformControl = new TransformControls(this.camera, this.renderer.domElement);
```

#### Line 649 - Update GLTFLoader Instantiation
```diff
- loader = new THREE.GLTFLoader();
+ loader = new GLTFLoader();
```

### File: `view.php`

#### Lines 69-76 - Remove CDN Loading
```diff
- // Load Three.js BEFORE AMD to avoid RequireJS conflicts.
- // Using r128 which supports global THREE.OrbitControls and THREE.GLTFLoader.
- $PAGE->requires->js(new moodle_url('https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js'), true);
- $PAGE->requires->js(new moodle_url('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js'), true);
- $PAGE->requires->js(new moodle_url('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/TransformControls.js'), true);
- $PAGE->requires->js(new moodle_url('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js'), true);
+ // Three.js is now bundled with the AMD module via ES modules.
```

### File: `Gruntfile.js`

Add Rollup bundling (see Phase 2.3 above)

### File: `package.json`

```diff
  "devDependencies": {
    "grunt": "^1.6.1",
    "grunt-contrib-uglify": "^5.2.2",
    "grunt-contrib-watch": "^1.1.0",
    "grunt-eslint": "^24.3.0",
    "grunt-stylelint": "^0.20.1",
+   "three": "^0.160.0",
+   "@rollup/plugin-node-resolve": "^15.2.0",
+   "@rollup/plugin-commonjs": "^16.0.0",
+   "rollup": "^4.0.0",
+   "grunt-rollup": "^12.0.0"
  }
```

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Bundle size increase | Low | Medium | Use tree-shaking, only import needed addons |
| WebXR API changes | Low | High | Test AR/VR on multiple devices |
| Moodle AMD compatibility | Medium | High | Use Rollup to output AMD format |
| Performance regression | Low | High | Benchmark before/after |
| Breaking changes in r160 | Low | Medium | Review Three.js changelog r128→r160 |

---

## Benefits

✅ **Modern API Access:** WebXR improvements, better mobile performance  
✅ **Security:** 3+ years of security patches  
✅ **Performance:** WebGL2 optimizations, better memory management  
✅ **Maintainability:** Can update to future versions easily  
✅ **Tree-shaking:** Smaller bundle size (only used code included)  
✅ **Developer Experience:** Better IDE support, type safety  
✅ **Future-proof:** No more locked to obsolete version  

---

## Timeline Estimate

| Phase | Duration | Effort |
|-------|----------|--------|
| 1. Preparation | 1 week | 8 hours |
| 2. Code Migration | 2 weeks | 16 hours |
| 3. Testing | 1 week | 12 hours |
| 4. Deployment | 1 week | 4 hours |
| **Total** | **5 weeks** | **40 hours** |

---

## Alternative Approaches

### Option A: Incremental Upgrade (Recommended) ⭐
**Approach:** Migrate to r150 first (last version with some legacy support), then to r160+
- **Pros:** Smaller breaking changes per step
- **Cons:** Takes longer, two migration cycles

### Option B: Direct Jump to r160+
**Approach:** Skip intermediate versions, migrate directly
- **Pros:** Faster, one-time effort
- **Cons:** Higher risk, more breaking changes to handle
- **Recommended if:** Team has strong Three.js expertise

### Option C: Keep r128 + Self-Host
**Approach:** Don't upgrade, just self-host current version
- **Pros:** Minimal risk, quick win for reliability
- **Cons:** Still stuck on obsolete version, missing improvements

---

## Next Steps

1. ✅ Review and approve this migration plan
2. ☐ Set up development branch: `feature/threejs-upgrade-r160`
3. ☐ Install Three.js r160 via npm
4. ☐ Configure Rollup bundler
5. ☐ Update `viewer.js` imports
6. ☐ Remove CDN loading from `view.php`
7. ☐ Test all features locally
8. ☐ Run cross-browser testing
9. ☐ Update documentation
10. ☐ Create pull request with migration notes

---

## References

- [Three.js Migration Guide](https://threejs.org/docs/index.html#manual/en/introduction/How-to-update-to-0.160.0)
- [Three.js Changelog](https://github.com/mrdoob/three.js/releases)
- [Moodle AMD Modules](https://docs.moodle.org/dev/Javascript_Modules)
- [Rollup Plugin Node Resolve](https://github.com/rollup/plugins/tree/master/packages/node-resolve)

---

**Last Updated:** April 9, 2026  
**Author:** AI Code Analysis  
**Status:** Draft - Pending Review
