// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * GEAR Viewer - Main JavaScript module for 3D/AR/VR viewing.
 *
 * @module     mod_gear/viewer
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Three.js ES module imports (bundled via Rollup for Moodle AMD compatibility).
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {TransformControls} from 'three/examples/jsm/controls/TransformControls.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/examples/jsm/loaders/DRACOLoader.js';
import {KTX2Loader} from 'three/examples/jsm/loaders/KTX2Loader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';

// Moodle AMD dependencies (external - loaded via RequireJS at runtime).
import Ajax from 'core/ajax';
import Notification from 'core/notification';
import Str from 'core/str';
import Templates from 'core/templates';
import Policy from 'core_ai/policy';
import PolicyModal from 'core_ai/policymodal';
import CustomEvents from 'core/custom_interaction_events';
import ModalSaveCancel from 'core/modal_save_cancel';
import ModalEvents from 'core/modal_events';
import SyncManager from './sync';
import SceneExtras from './extras';
import SceneTools from './tools';
import {pickQuestion} from './bank';
import {escapeHtml, htmlToText, prefersReducedMotion, openDialog, closeDialog} from './dom';

// Above this many triangles the scene is rendered at pixel ratio 1; above the second limit the teacher is warned.
const HEAVY_TRIANGLES = 500000;
const WARN_TRIANGLES = 1000000;

    /**
     * GEAR Viewer class.
     */
    class GearViewer {
        /**
         * Constructor.
         *
         * @param {Object} options Configuration options
         */
        constructor(options) {
            this.cmid = options.cmid;
            this.gearid = options.gearid;
            this.config = options.config || {};
            // Hotspot feature flags from scene config.
            if (this.config.hotspots && typeof this.config.hotspots.enabled !== 'undefined') {
                this.hotspotsEnabled = !!this.config.hotspots.enabled;
            } else {
                this.hotspotsEnabled = true;
            }
            this.hotspotsEditable = (this.config.hotspots && !!this.config.hotspots.edit) || false;
            this.hotspotScale = (this.config.camera && this.config.camera.hotspotScale) || 1.5;
            this.hotspotColor = (this.config.camera && this.config.camera.hotspotColor) || '#6366f1';
            this.arEnabled = options.ar_enabled || false;
            this.vrEnabled = options.vr_enabled || false;
            this.modelsData = [];
            this.hotspotsData = [];
            this.hotspotsData = [];
            this.canManage = options.canmanage || false;
            this.userid = options.userid || 0; // The current user ID for WebRTC
            this.peerjsUrl = options.peerjsurl || '';
            this.peerServer = options.peerserver || null;
            this.aiAvailable = !!options.aiavailable;
            this.dracoPath = options.dracopath || '';
            this.basisPath = options.basispath || '';
            this.usdzUrl = options.usdzurl || '';
            this.sceneName = options.name || '';

            this.container = document.getElementById('gear-viewer-' + this.cmid);
            this.canvas = document.getElementById('gear-canvas-' + this.cmid);

            this.isFullscreen = false;
            this.isAutoRotating = false;
            this.scene = null;
            this.camera = null;
            this.renderer = null;
            this.controls = null;
            this.model = null;
            this.models = []; // All loaded model objects (the first one is this.model).
            this.hotspotMeshes = [];
            this.raycaster = null;
            this.mouse = new THREE.Vector2();
            this.audioListener = null;
            this.modelContainer = new THREE.Group();
            this.extras = new SceneExtras(this);
            this.tools = new SceneTools(this);
            this.clock = new THREE.Clock();
            this.movingHotspotId = null; // Track hotspot being moved.
            this.tooltipElement = null; // Tooltip element for hover display.
            this.activeTooltipHotspot = null; // Track which hotspot tooltip is showing.

            this.init();
        }

        /**
         * Initialize the viewer.
         */
        async init() {
            try {
                this.pointLabel = await Str.get_string('point', 'mod_gear');
                await this.loadThreeJS();
                this.setupScene();
                this.setupControls();
                this.setupRaycaster();

                // Find out what WebXR can do before the AR and VR buttons are wired up.
                await this.checkWebXRSupport();
                this.setupEventListeners();
                await this.tools.init();

                // Wait for overlay UI to be added to DOM before proceeding
                await this.setupOverlay();

                // Fetch data from server to avoid large arguments in js_call_amd.
                await this.fetchSceneData();

                this.loadModels();
                if (this.hotspotsEnabled) {
                    this.loadHotspots();
                }
                this.animate();

                // Dispatch loaded event.
                var eventDetail = {cmid: this.cmid, gearid: this.gearid};
                document.dispatchEvent(new CustomEvent('gear:scene:loaded', {detail: eventDetail}));
            } catch (error) {
                Notification.exception(error);
            }
        }

        /**
         * Setup fallback UI for devices without WebXR support.
         */
        async setupFallbackUI() {
            const fallbackMessage = await Str.get_string('webxrnotsupported', 'mod_gear');
            const fallbackStyle = 'position: absolute; top: 10px; left: 10px; right: 10px; z-index: 1000; ' +
                'background: rgba(255, 243, 205, 0.15); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); ' +
                'border: 1px solid rgba(255, 193, 7, 0.3); border-radius: 8px; ' +
                'color: rgba(255, 255, 255, 0.9); text-shadow: 0 1px 2px rgba(0,0,0,0.3);';
            const fallbackHtml = `
                <div class="alert alert-warning gear-fallback-notice" style="${fallbackStyle}">
                    <i class="fa fa-info-circle" aria-hidden="true"></i>
                    ${fallbackMessage}
                    <br><small>${await Str.get_string('fallbackmessage', 'mod_gear')}</small>
                </div>
            `;

            // Insert the fallback notice into the viewer container
            const viewerContainer = document.getElementById('gear-viewer-' + this.cmid);
            if (viewerContainer) {
                viewerContainer.insertAdjacentHTML('afterbegin', fallbackHtml);
            }

            // Hide AR/VR buttons if they exist
            const arBtn = document.getElementById('gear-ar-' + this.cmid);
            const vrBtn = document.getElementById('gear-vr-' + this.cmid);
            if (arBtn) {
                arBtn.style.display = 'none';
            }
            if (vrBtn) {
                vrBtn.style.display = 'none';
            }
        }

        /**
         * Check WebXR support and setup fallback if needed.
         * Only disables AR/VR buttons silently - doesn't block normal 3D viewing.
         */
        async checkWebXRSupport() {
            // Check if AR/VR buttons should be hidden
            var arBtn = document.getElementById('gear-ar-' + this.cmid);
            var vrBtn = document.getElementById('gear-vr-' + this.cmid);

            if ('xr' in navigator) {
                try {
                    // Check if any XR session types are supported
                    var arSupported = false;
                    var vrSupported = false;

                    try {
                        arSupported = await navigator.xr.isSessionSupported('immersive-ar');
                    } catch (e) {
                        // AR not supported - ignore
                    }

                    try {
                        vrSupported = await navigator.xr.isSessionSupported('immersive-vr');
                    } catch (e) {
                        // VR not supported - ignore
                    }

                    this.arSupported = arSupported;
                    this.vrSupported = vrSupported;

                    // Hide buttons if not supported (no warning needed for desktop browsers)
                    if (!arSupported && arBtn) {
                        arBtn.style.display = 'none';
                        arBtn.disabled = true;
                    }

                    if (!vrSupported && vrBtn) {
                        vrBtn.style.display = 'none';
                        vrBtn.disabled = true;
                    }
                } catch (error) {
                    // WebXR API error - just hide buttons silently
                    window.console.warn('GEAR: WebXR check failed:', error);
                    if (arBtn) {
                        arBtn.style.display = 'none';
                    }
                    if (vrBtn) {
                        vrBtn.style.display = 'none';
                    }
                }
            } else {
                // WebXR not available at all (expected on most desktop browsers)
                // Just hide AR/VR buttons - no warning needed
                if (arBtn) {
                    arBtn.style.display = 'none';
                }
                if (vrBtn) {
                    vrBtn.style.display = 'none';
                }
            }
        }

        /**
         * Fetch models and hotspots from the server.
         */
        async fetchSceneData() {
            try {
                const response = await Ajax.call([{
                    methodname: 'mod_gear_get_scene_data',
                    args: {gearid: this.gearid}
                }])[0];

                this.modelsData = response.models || [];
                this.hotspotsData = response.hotspots || [];

                // Parse position and config for hotspots.
                this.hotspotsData.forEach(h => {
                    if (typeof h.position === 'string') {
                        try {
 h.position = JSON.parse(h.position);
} catch (e) {
 h.position = {x: 0, y: 0, z: 0};
}
                    }
                    if (typeof h.config === 'string') {
                        try {
 h.config = JSON.parse(h.config);
} catch (e) {
 h.config = {};
}
                    }
                });
            } catch (error) {
                window.console.error('GEAR: Failed to fetch scene data', error);
                throw error;
            }
        }

        /**
         * Load Three.js library.
         * Three.js is loaded by PHP before AMD, so just verify it exists.
         */
        async loadThreeJS() {
            // Three.js is loaded via PHP $PAGE->requires->js() before this module.
            // Just wait for it to be available.
            if (typeof THREE === 'undefined') {
                // Wait a bit for scripts to load.
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            if (typeof THREE === 'undefined') {
                throw new Error(await Str.get_string('loading', 'mod_gear') + ': Three.js not loaded. Please check view.php.');
            }
        }

        /**
         * Setup the Three.js scene.
         */
        setupScene() {
            var bgColor;
            var aspect;
            var camPos;

            // Create scene.
            this.scene = new THREE.Scene();

            // Set background color.
            bgColor = this.config.background || '#1a1a2e';
            this.scene.background = new THREE.Color(bgColor);

            // Create camera.
            aspect = this.container.clientWidth / this.container.clientHeight;
            this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
            camPos = this.config.camera?.position || [0, 1.6, 3];
            this.camera.position.set(camPos[0], camPos[1], camPos[2]);

            // Create renderer optimized for performance.
            // Disable antialiasing on high-DPI screens since it is unnecessary and costly.
            var isLowDPI = (window.devicePixelRatio < 2);
            this.renderer = new THREE.WebGLRenderer({
                canvas: this.canvas,
                antialias: isLowDPI,
                alpha: true,
                powerPreference: 'high-performance'
            });
            this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
            // Cap the pixel ratio to 2 to prevent extreme performance hits on 3x-4x mobile screens.
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            this.renderer.outputColorSpace = THREE.SRGBColorSpace;
            this.renderer.xr.enabled = true;

            // Framebuffer scaling in WebXR to maintain high FPS in VR/AR.
            if (this.renderer.xr.setFramebufferScaleFactor) {
                this.renderer.xr.setFramebufferScaleFactor(0.8);
            }

            // Create model container and add to scene.
            this.scene.add(this.modelContainer);

            // Audio Listener.
            this.audioListener = new THREE.AudioListener();
            this.camera.add(this.audioListener);

            // Add lighting.
            this.setupLighting();

            // Add resize handler (kept so that destroy() can remove it).
            this.resizeHandler = () => this.onResize();
            window.addEventListener('resize', this.resizeHandler);

            // Do not render while the tab is hidden or the canvas is scrolled out of view.
            this.pageVisible = !document.hidden;
            this.inViewport = true;
            this.visibilityHandler = () => {
                this.pageVisible = !document.hidden;
            };
            document.addEventListener('visibilitychange', this.visibilityHandler);
            if (window.IntersectionObserver) {
                this.viewObserver = new IntersectionObserver((entries) => {
                    this.inViewport = entries.some((entry) => entry.isIntersecting);
                });
                this.viewObserver.observe(this.container);
            }
            window.addEventListener('pagehide', () => this.destroy(), {once: true});
        }

        /**
         * Setup scene lighting.
         */
        setupLighting() {
            var preset = this.config.lighting || 'studio';
            var ambient;
            var keyLight;
            var fillLight;
            var rimLight;
            var sunLight;
            var skyLight;
            var spotLight;

            // Ambient light.
            ambient = new THREE.AmbientLight(0xffffff, 0.5);
            this.scene.add(ambient);

            switch (preset) {
                case 'studio':
                    // Key light.
                    keyLight = new THREE.DirectionalLight(0xffffff, 1);
                    keyLight.position.set(5, 5, 5);
                    this.scene.add(keyLight);

                    // Fill light.
                    fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
                    fillLight.position.set(-5, 0, 5);
                    this.scene.add(fillLight);

                    // Rim light.
                    rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
                    rimLight.position.set(0, 5, -5);
                    this.scene.add(rimLight);
                    break;

                case 'outdoor':
                    sunLight = new THREE.DirectionalLight(0xffffcc, 1.2);
                    sunLight.position.set(10, 10, 5);
                    this.scene.add(sunLight);

                    skyLight = new THREE.HemisphereLight(0x87ceeb, 0x3d5c5c, 0.6);
                    this.scene.add(skyLight);
                    break;

                case 'dark':
                    spotLight = new THREE.SpotLight(0xffffff, 0.8);
                    spotLight.position.set(0, 5, 0);
                    this.scene.add(spotLight);
                    break;
            }
        }

        /**
         * Setup orbit controls.
         */
        setupControls() {
            this.controls = new OrbitControls(this.camera, this.canvas);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.screenSpacePanning = false;
            this.controls.minDistance = 0.5;
            this.controls.maxDistance = 50;
            this.controls.maxPolarAngle = Math.PI;

            if (this.canManage && typeof TransformControls !== 'undefined') {
                this.transformControl = new TransformControls(this.camera, this.renderer.domElement);
                this.transformControl.setMode('translate');
                this.transformControl.addEventListener('dragging-changed', (event) => {
                    this.controls.enabled = !event.value;
                    if (!event.value && this.movingHotspotId) {
                        if (this.transformControl.object) {
                            var pos = this.transformControl.object.position;
                            this.updateHotspotPosition(this.movingHotspotId, pos);
                        }
                    }
                });
                this.scene.add(this.transformControl);
            }
        }

        /**
         * Setup UI event listeners.
         */
        setupEventListeners() {
            var fullscreenBtn;
            var autorotateBtn;
            var arBtn;
            var vrBtn;

            // Fullscreen button.
            fullscreenBtn = document.getElementById('gear-fullscreen-' + this.cmid);
            if (fullscreenBtn) {
                fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
            }

            // Auto-rotate button.
            autorotateBtn = document.getElementById('gear-autorotate-' + this.cmid);
            if (autorotateBtn) {
                autorotateBtn.addEventListener('click', () => this.toggleAutoRotate());
            }

            // AR button.
            arBtn = document.getElementById('gear-ar-' + this.cmid);
            if (arBtn && this.arEnabled) {
                this.setupARButton(arBtn);
            }

            // VR button.
            vrBtn = document.getElementById('gear-vr-' + this.cmid);
            if (vrBtn && this.vrEnabled) {
                this.setupVRButton(vrBtn);
            }

            // Leaderboard button.
            var leaderBtn = document.getElementById('gear-leaderboard-' + this.cmid);
            if (leaderBtn) {
                leaderBtn.addEventListener('click', () => this.showLeaderboard());
            }

            // Save view button (from template).
            var saveBtn = document.getElementById('gear-saveview-' + this.cmid);
            if (saveBtn) {
                saveBtn.addEventListener('click', () => this.saveCurrentView());
            }

            // Export scene button.
            var exportBtn = document.getElementById('gear-export-scene-' + this.cmid);
            if (exportBtn) {
                exportBtn.addEventListener('click', () => {
                    window.location.href = M.cfg.wwwroot + '/mod/gear/export_scene.php?cmid=' + this.cmid;
                });
            }

            // Import scene button.
            var importBtn = document.getElementById('gear-import-scene-' + this.cmid);
            var importInput = document.getElementById('gear-import-file-' + this.cmid);
            if (importBtn && importInput) {
                importBtn.addEventListener('click', () => importInput.click());
                importInput.addEventListener('change', async() => {
                    if (!importInput.files || !importInput.files[0]) {
                        return;
                    }
                    const file = importInput.files[0];
                    try {
                        await Notification.saveCancelPromise(
                            await Str.get_string('confirm', 'core'),
                            await Str.get_string('import_scene_confirm', 'mod_gear'),
                            await Str.get_string('import_scene', 'mod_gear')
                        );
                    } catch {
                        importInput.value = '';
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = async(ev) => {
                        const jsonStr = ev.target.result;
                        try {
                            JSON.parse(jsonStr);
                        } catch {
                            Notification.alert(
                                await Str.get_string('error', 'core'),
                                await Str.get_string('import_scene_invalid', 'mod_gear')
                            );
                            importInput.value = '';
                            return;
                        }
                        Ajax.call([{
                            methodname: 'mod_gear_import_scene',
                            args: {
                                gearid: this.gearid,
                                scenedata: jsonStr,
                                mode: 'replace'
                            }
                        }])[0].then(async(res) => {
                            importInput.value = '';
                            if (res.success) {
                                Notification.addNotification({
                                    message: await Str.get_string('import_scene_success', 'mod_gear', res.count),
                                    type: 'success'
                                });
                                await this.reloadAllHotspots();
                            }
                            return null;
                        }).catch(Notification.exception);
                    };
                    reader.readAsText(file);
                });
            }

            // Hotspot scale slider.
            var scaleSlider = document.getElementById('gear-hotspot-scale-' + this.cmid);
            if (scaleSlider) {
                scaleSlider.value = this.hotspotScale;
                scaleSlider.addEventListener('input', (e) => {
                    this.hotspotScale = parseFloat(e.target.value);
                    this.updateHotspotsScale();
                });
            }

            // Hotspot color picker.
            var colorPicker = document.getElementById('gear-hotspot-color-' + this.cmid);
            if (colorPicker) {
                colorPicker.value = this.hotspotColor;
                colorPicker.addEventListener('input', (e) => {
                    this.hotspotColor = e.target.value;
                    this.updateHotspotsColor();
                });
            }

            // (Overlay controls are now awaited in init)

            // Initialize tooltips for control hints using native Bootstrap API.
            // We avoid jQuery's .tooltip() plugin as it may not be available in Moodle 4.x AMD context.
            try {
                document.querySelectorAll('.gear-help-hint, .gear-control-btn').forEach(function(el) {
                    if (window.bootstrap && window.bootstrap.Tooltip) {
                        new window.bootstrap.Tooltip(el, {trigger: 'click hover focus'});
                    }
                });
            } catch (e) {
                // Tooltip initialisation is non-critical; silently ignore failures.
                window.console.warn('GEAR: tooltip init failed', e);
            }
        }

        /**
         * Setup overlay controls (Hotspots & Leaderboard floating on scene).
         */
        async setupOverlay() {
            return Templates.render('mod_gear/overlay_controls', {
                cmid: this.cmid,
                canManage: this.canManage
            }).then((html, js) => {
                Templates.appendNodeContents(this.container, html, js);
                this.setupOverlayEventListeners();
                return null;
            }).catch(Notification.exception);
        }

        /**
         * Setup event listeners for the overlay controls.
         */
        setupOverlayEventListeners() {
            var overlay = document.getElementById('gear-scene-overlay-' + this.cmid);
            if (!overlay) {
 return;
}

            // Help button.
            var helpBtn = document.getElementById('gear-help-btn-' + this.cmid);
            if (helpBtn) {
                helpBtn.addEventListener('click', () => this.showHelp());
            }

            // Leaderboard button.
            var leaderBtn = document.getElementById('gear-leaderboard-btn-' + this.cmid);
            if (leaderBtn) {
                leaderBtn.addEventListener('click', () => this.showLeaderboard());
            }

            // Hotspots dropdown toggle.
            var hotspotsNav = document.getElementById('gear-hotspots-nav-' + this.cmid);
            if (hotspotsNav) {
                var toggle = hotspotsNav.querySelector('.dropdown-toggle');
                toggle.addEventListener('click', (e) => {
                    e.preventDefault();
                    hotspotsNav.classList.toggle('show');
                    hotspotsNav.querySelector('.dropdown-menu').classList.toggle('show');
                });

                // Close when clicking outside.
                document.addEventListener('click', (e) => {
                    if (!hotspotsNav.contains(e.target)) {
                        hotspotsNav.classList.remove('show');
                        hotspotsNav.querySelector('.dropdown-menu').classList.remove('show');
                    }
                });
            }
        }


        /**
         * Update all existing hotspots with current scale.
         */
        updateHotspotsScale() {
            if (!this.hotspotMeshes) {
 return;
}
            this.hotspotMeshes.forEach(mesh => {
                mesh.scale.set(this.hotspotScale, this.hotspotScale, this.hotspotScale);
            });
        }

        /**
         * Update all existing hotspots with current color.
         */
        updateHotspotsColor() {
            if (!this.hotspotMeshes) {
 return;
}
            const color = new THREE.Color(this.hotspotColor);
            this.hotspotMeshes.forEach(mesh => {
                // Audio hotspots have their own color logic but we can apply the general one
                // unless it is specifically overridden.
                mesh.material.color.copy(color);
            });
        }

        /**
         * Save current camera and model state.
         */
        async saveCurrentView() {
            const camPos = this.camera.position;
            const targetPos = this.controls.target;

            // 1. Save Camera Config (Scene level).
            const scenePromise = Ajax.call([{
                methodname: 'mod_gear_save_scene_config',
                args: {
                    gearid: this.gearid,
                    camera: JSON.stringify({
                        position: [camPos.x, camPos.y, camPos.z],
                        target: [targetPos.x, targetPos.y, targetPos.z],
                        hotspotScale: this.hotspotScale,
                        hotspotColor: this.hotspotColor,
                        clipping: {
                            enabled: this.tools.clippingActive,
                            axis: this.tools.clippingAxis,
                            offset: this.tools.clippingOffset,
                            inverted: this.tools.clippingInverted
                        }
                    })
                }
            }])[0];

            // 2. Save the transform of every model.
            const modelPromises = this.models.filter((object) => object.userData.modelId).map((object) => Ajax.call([{
                methodname: 'mod_gear_save_model_transform',
                args: {
                    id: object.userData.modelId,
                    position: JSON.stringify({x: object.position.x, y: object.position.y, z: object.position.z}),
                    rotation: JSON.stringify({x: object.rotation.x, y: object.rotation.y, z: object.rotation.z}),
                    scale: object.scale.x
                }
            }])[0]);

            Promise.all([scenePromise, ...modelPromises]).then(async() => {
                Notification.addNotification({
                    message: await Str.get_string('saveviewsuccess', 'mod_gear'),
                    type: 'success'
                });
                return null;
            }).catch(Notification.exception);
        }


        /**
         * Show Help modal.
         */
        showHelp() {
            var modal = document.getElementById('gear-help-modal-' + this.cmid);
            if (!modal) {
                Templates.render('mod_gear/help_modal', {
                    cmid: this.cmid,
                    canManage: this.canManage
                }).then((html, js) => {
                    Templates.appendNodeContents(this.container, html, js);
                    modal = document.getElementById('gear-help-modal-' + this.cmid);

                    // Close logic.
                    modal.querySelector('.close').addEventListener('click', () => closeDialog(modal));

                    openDialog(modal);
                    return null;
                }).catch(Notification.exception);
            } else {
                openDialog(modal);
            }
        }


        /**
         * Show Leaderboard modal.
         */
        showLeaderboard() {
            var modal = document.getElementById('gear-leaderboard-modal-' + this.cmid);
            if (!modal) {
                Templates.render('mod_gear/leaderboard_modal', {
                    cmid: this.cmid
                }).then((html, js) => {
                    Templates.appendNodeContents(this.container, html, js);
                    modal = document.getElementById('gear-leaderboard-modal-' + this.cmid);

                    // Close logic.
                    modal.querySelector('.close').addEventListener('click', () => closeDialog(modal));

                    this.fetchAndRenderLeaderboard(modal);
                    return null;
                }).catch(Notification.exception);
            } else {
                this.fetchAndRenderLeaderboard(modal);
            }
        }

        /**
         * Fetch data and render leaderboard content.
         *
         * @param {HTMLElement} modal
         */
        async fetchAndRenderLeaderboard(modal) {
            openDialog(modal);
            var content = modal.querySelector('.gear-leaderboard-content');
            var loadingText = await Str.get_string('loading', 'mod_gear');
            content.innerHTML = '<div class="text-center"><i class="fa fa-spinner fa-spin"></i> ' + loadingText + '</div>';

            // Fetch data.
            Ajax.call([{
                methodname: 'mod_gear_get_leaderboard',
                args: {
                    gearid: this.gearid,
                    limit: 10
                }
            }])[0].then((scores) => {
                this.renderLeaderboardTable(content, scores);
                return null;
            }).catch(Notification.exception);
        }


        /**
         * Render leaderboard table using mustache.
         *
         * @param {HTMLElement} container
         * @param {Array} scores
         */
        renderLeaderboardTable(container, scores) {
            var context = {
                has_scores: scores.length > 0, // eslint-disable-line camelcase
                scores: scores.map((entry, index) => {
                    var badge = '';
                    if (index === 0) {
                        badge = '🥇';
                    } else if (index === 1) {
                        badge = '🥈';
                    } else if (index === 2) {
                        badge = '🥉';
                    }

                    return {
                        rank: index + 1,
                        badge: badge,
                        fullname: entry.fullname,
                        score: entry.score
                    };
                })
            };

            Templates.render('mod_gear/leaderboard_table', context).then((html, js) => {
                Templates.replaceNodeContents(container, html, js);
                return null;
            }).catch(Notification.exception);
        }

        /**
         * Setup AR button with WebXR check.
         *
         * @param {HTMLElement} button AR button element
         */
        async setupARButton(button) {
            if (!this.arSupported && this.canOpenQuickLook()) {
                // IPhone and iPad: no WebXR AR, but Safari opens a USDZ file in AR Quick Look.
                button.style.display = '';
                button.disabled = false;
                button.addEventListener('click', () => this.openQuickLook());
            } else if (!this.arSupported) {
                button.disabled = true;
                button.title = await Str.get_string('arnotsupported', 'mod_gear');
            } else {
                button.addEventListener('click', () => this.startARSession());
            }
        }

        /**
         * Whether AR Quick Look (Apple's AR viewer for USDZ files) can be used for this activity.
         *
         * @returns {boolean}
         */
        canOpenQuickLook() {
            return !!this.usdzUrl && document.createElement('a').relList.supports('ar');
        }

        /**
         * Open the USDZ version of the model in AR Quick Look.
         */
        openQuickLook() {
            const anchor = document.createElement('a');
            anchor.rel = 'ar';
            anchor.href = this.usdzUrl;
            anchor.appendChild(document.createElement('img'));
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            this.trackEvent('ar_start');
        }

        /**
         * Setup VR button with WebXR check.
         *
         * @param {HTMLElement} button VR button element
         */
        async setupVRButton(button) {
            if (!this.vrSupported) {
                button.disabled = true;
                button.title = await Str.get_string('webxrnotsupported', 'mod_gear');
            } else {
                button.addEventListener('click', () => this.startVRSession());
            }
        }

        /**
         * Load 3D models from config data.
         */
        async loadModels() {
            try {
                if (this.modelsData && this.modelsData.length > 0) {
                    const loader = this.createGltfLoader();
                    const total = this.modelsData.length;

                    for (let index = 0; index < total; index++) {
                        const modelData = this.modelsData[index];
                        const gltf = await new Promise((resolve, reject) => {
                            loader.load(modelData.url, resolve, (event) => this.showLoadProgress(index, total, event), reject);
                        });
                        const object = this.prepareModel(gltf.scene, modelData);
                        this.modelContainer.add(object);
                        this.extras.addModel(gltf, object);
                        this.models.push(object);
                        if (!this.model) {
                            this.model = object;
                        }
                    }

                    // If scene config has saved camera, use it, otherwise center on everything that was loaded.
                    if (this.config.camera && this.config.camera.position) {
                        const cp = this.config.camera.position;
                        const ct = this.config.camera.target || [0, 0, 0];
                        this.camera.position.set(cp[0], cp[1], cp[2]);
                        this.controls.target.set(ct[0], ct[1], ct[2]);
                        this.controls.update();
                    } else {
                        this.centerCameraOnModel(this.modelContainer);
                    }

                    // Animations, material variants and the guided tour.
                    await this.extras.ready();
                    this.tools.onModelsLoaded();
                    await this.adaptToModelSize();

                    // Mark as loaded.
                    this.container.classList.add('loaded');
                } else {
                    // No models uploaded yet - show placeholder.
                    this.addPlaceholderModel();
                    this.container.classList.add('loaded');
                }
            } catch (error) {
                // Error loading model - say so instead of silently showing a placeholder.
                window.console.error('GEAR: Error loading model:', error);
                this.addPlaceholderModel();
                this.container.classList.add('loaded');
                this.announce(await Str.get_string('modelloaderror', 'mod_gear'));
                Notification.addNotification({
                    message: await Str.get_string('modelloaderror', 'mod_gear'),
                    type: 'error'
                });
            }
        }

        /**
         * A glTF loader that also reads Draco and Meshopt compressed models (decoders are self-hosted).
         *
         * @returns {GLTFLoader}
         */
        createGltfLoader() {
            const loader = new GLTFLoader();
            if (this.dracoPath) {
                const draco = new DRACOLoader();
                draco.setDecoderPath(this.dracoPath);
                loader.setDRACOLoader(draco);
            }
            if (this.basisPath) {
                // KTX2 (Basis Universal) textures: the transcoder picks the format that this GPU supports.
                this.ktx2Loader = new KTX2Loader();
                this.ktx2Loader.setTranscoderPath(this.basisPath);
                this.ktx2Loader.detectSupport(this.renderer);
                loader.setKTX2Loader(this.ktx2Loader);
            }
            loader.setMeshoptDecoder(MeshoptDecoder);
            return loader;
        }

        /**
         * Lower the render resolution for heavy models and phones, and tell the teacher when a model is too heavy.
         */
        async adaptToModelSize() {
            let triangles = 0;
            this.modelContainer.traverse((object) => {
                if (object.isMesh && object.geometry) {
                    const geometry = object.geometry;
                    triangles += (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
                }
            });
            this.triangleCount = Math.round(triangles);
            const touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
            let ratio = Math.min(window.devicePixelRatio, touch ? 1.5 : 2);
            if (triangles > HEAVY_TRIANGLES) {
                ratio = Math.min(ratio, 1);
            }
            this.renderer.setPixelRatio(ratio);
            if (this.canManage && triangles > WARN_TRIANGLES) {
                Notification.addNotification({
                    message: await Str.get_string('modeltoolarge', 'mod_gear', this.triangleCount.toLocaleString()),
                    type: 'warning'
                });
            }
        }

        /**
         * Show the loading progress in the loading overlay.
         *
         * @param {number} index Index of the model that is loading
         * @param {number} total Number of models
         * @param {ProgressEvent} event Progress event
         */
        showLoadProgress(index, total, event) {
            const label = this.container.querySelector('.gear-loading p');
            if (!label || !event.lengthComputable) {
                return;
            }
            const done = (index + event.loaded / event.total) / total;
            label.textContent = Math.round(done * 100) + '%';
        }

        /**
         * Apply the saved orientation, position, rotation and scale of a model.
         *
         * @param {THREE.Object3D} object The loaded scene
         * @param {Object} modelData Model record
         * @returns {THREE.Object3D}
         */
        prepareModel(object, modelData) {
            // Fix model orientation - rotate 180 degrees on X axis to make the model upright (glTF coordinate system).
            object.rotation.x = Math.PI;
            object.userData.modelId = modelData.id;

            const parse = (value) => {
                try {
                    return typeof value === 'string' ? JSON.parse(value) : value;
                } catch (e) {
                    window.console.warn('GEAR: Failed to parse model transform', e);
                    return null;
                }
            };
            const p = modelData.position ? parse(modelData.position) : null;
            if (p) {
                object.position.set(p.x, p.y, p.z);
            }
            const r = modelData.rotation ? parse(modelData.rotation) : null;
            if (r) {
                object.rotation.set(r.x, r.y, r.z);
            }
            object.scale.setScalar(modelData.scale ? parseFloat(modelData.scale) : 1);
            return object;
        }

        /**
         * Add a placeholder model for testing.
         */
        addPlaceholderModel() {
            var geometry = new THREE.BoxGeometry(1, 1, 1);
            var material = new THREE.MeshStandardMaterial({
                color: 0x4a90d9,
                metalness: 0.3,
                roughness: 0.4
            });
            this.model = new THREE.Mesh(geometry, material);
            this.models = [this.model];
            this.modelContainer.add(this.model);
        }

        /**
         * Center camera on loaded model.
         *
         * @param {Object} model The model to center on
         */
        centerCameraOnModel(model) {
            var box = new THREE.Box3().setFromObject(model);
            var center = box.getCenter(new THREE.Vector3());
            var size = box.getSize(new THREE.Vector3());

            var maxDim = Math.max(size.x, size.y, size.z);
            var fov = this.camera.fov * (Math.PI / 180);
            var cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
            cameraZ *= 1.5; // Add some padding.

            this.camera.position.set(center.x, center.y, center.z + cameraZ);
            this.controls.target.copy(center);
            this.controls.update();
        }

        /**
         * Animation loop.
         */
        animate() {
            this.renderer.setAnimationLoop(() => {
                const delta = this.clock.getDelta();
                if (!this.renderer.xr.isPresenting && (!this.pageVisible || !this.inViewport)) {
                    return;
                }
                if (this.isAutoRotating) {
                    this.modelContainer.rotation.y += 0.005;
                }

                this.extras.update(delta);
                this.controls.update();
                this.renderer.render(this.scene, this.camera);
            });
        }

        /**
         * Stop rendering and release listeners and GPU resources (called when the page is left).
         */
        destroy() {
            if (!this.renderer) {
                return;
            }
            this.renderer.setAnimationLoop(null);
            this.extras.destroy();
            this.tools.destroy();
            window.removeEventListener('resize', this.resizeHandler);
            document.removeEventListener('visibilitychange', this.visibilityHandler);
            if (this.viewObserver) {
                this.viewObserver.disconnect();
            }
            this.scene.traverse((obj) => {
                if (obj.geometry) {
                    obj.geometry.dispose();
                }
                if (obj.material) {
                    (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach((m) => m.dispose());
                }
            });
            if (this.ktx2Loader) {
                this.ktx2Loader.dispose();
            }
            this.renderer.dispose();
            if (this.tooltipElement) {
                this.tooltipElement.remove();
                this.tooltipElement = null;
            }
        }

        /**
         * Announce a message to screen readers (polite live region, only used for keyboard navigation).
         *
         * @param {string} text Text to announce
         */
        announce(text) {
            if (!this.statusRegion) {
                this.statusRegion = document.createElement('div');
                this.statusRegion.className = 'visually-hidden';
                this.statusRegion.setAttribute('role', 'status');
                this.statusRegion.setAttribute('aria-live', 'polite');
                this.container.appendChild(this.statusRegion);
            }
            this.statusRegion.textContent = text;
        }

        /**
         * Handle window resize.
         */
        onResize() {
            var width = this.container.clientWidth;
            var height = this.container.clientHeight;

            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
        }

        /**
         * Toggle fullscreen mode.
         */
        toggleFullscreen() {
            var container = this.container.closest('.gear-viewer-container');
            var btn;
            var icon;

            container.classList.toggle('fullscreen');
            this.isFullscreen = !this.isFullscreen;

            btn = document.getElementById('gear-fullscreen-' + this.cmid);
            icon = btn.querySelector('i');
            icon.classList.toggle('fa-expand', !this.isFullscreen);
            icon.classList.toggle('fa-compress', this.isFullscreen);

            setTimeout(() => this.onResize(), 100);
        }

        /**
         * Toggle auto-rotation.
         */
        toggleAutoRotate() {
            var btn;

            this.isAutoRotating = !this.isAutoRotating;

            btn = document.getElementById('gear-autorotate-' + this.cmid);
            btn.classList.toggle('active', this.isAutoRotating);
        }

        /**
         * Start AR session.
         */
        async startARSession() {
            var session;
            var eventDetail;

            try {
                session = await navigator.xr.requestSession('immersive-ar', {
                    requiredFeatures: ['hit-test', 'local-floor']
                });

                this.renderer.xr.setSession(session);

                eventDetail = {cmid: this.cmid};
                document.dispatchEvent(new CustomEvent('gear:ar:started', {detail: eventDetail}));

                this.trackEvent('ar_start');
            } catch (error) {
                Notification.exception(error);
            }
        }

        /**
         * Start VR session.
         */
        async startVRSession() {
            var session;
            var eventDetail;

            try {
                session = await navigator.xr.requestSession('immersive-vr', {
                    optionalFeatures: ['local-floor', 'bounded-floor']
                });

                this.renderer.xr.setSession(session);

                eventDetail = {cmid: this.cmid};
                document.dispatchEvent(new CustomEvent('gear:vr:started', {detail: eventDetail}));

                this.trackEvent('vr_start');
            } catch (error) {
                Notification.exception(error);
            }
        }

        /**
         * Track user events.
         *
         * @param {string} action Action name
         * @param {Object} data Additional data
         */
        trackEvent(action, data = {}) {
            Ajax.call([{
                methodname: 'mod_gear_track_event',
                args: {
                    gearid: this.gearid,
                    action: action,
                    data: JSON.stringify(data)
                }
            }]);
        }

        /**
         * Setup raycaster for click detection.
         */
        setupRaycaster() {
            this.raycaster = new THREE.Raycaster();

            // Click handler for hotspots.
            this.canvas.addEventListener('click', (event) => {
                var rect = this.canvas.getBoundingClientRect();
                this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
                this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

                this.raycaster.setFromCamera(this.mouse, this.camera);

                // Check if we are moving a hotspot (Managers only).
                if (this.movingHotspotId !== null && this.canManage) {
                    if (this.transformControl && this.transformControl.object) {
                        this.transformControl.detach();
                        this.movingHotspotId = null;
                        this.controls.enabled = true;
                        return;
                    }

                    var moveIntersects = this.raycaster.intersectObjects(this.models, true);
                    if (moveIntersects.length > 0) {
                        var moveWorld = moveIntersects[0].point;
                        var moveLocal = this.modelContainer.worldToLocal(moveWorld.clone());
                        this.updateHotspotPosition(this.movingHotspotId, moveLocal);
                        return;
                    }
                }

                // Shift+Click to add new hotspot (managers only).
                if (event.shiftKey && this.canManage && this.model && this.hotspotsEnabled) {
                    var modelIntersects = this.raycaster.intersectObjects(this.models, true);
                    if (modelIntersects.length > 0) {
                        var addWorld = modelIntersects[0].point;
                        var addLocal = this.modelContainer.worldToLocal(addWorld.clone());
                        this.showAddHotspotForm(addLocal);
                        return;
                    }
                }

                // Normal click - check hotspots.
                var intersects = this.raycaster.intersectObjects(this.hotspotMeshes);

                if (intersects.length > 0) {
                    var hotspotMesh = intersects[0].object;
                    if (hotspotMesh.visible) {
                        if (hotspotMesh.userData.type === 'teleport') {
                            this.focusHotspot(hotspotMesh.userData.id);
                        } else {
                            this.showHotspotPopup(hotspotMesh.userData);
                        }
                    }
                }
            });

            // Hover handler for tooltips.
            this.canvas.addEventListener('mousemove', (event) => {
                var rect = this.canvas.getBoundingClientRect();
                this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
                this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

                this.raycaster.setFromCamera(this.mouse, this.camera);
                var intersects = this.raycaster.intersectObjects(this.hotspotMeshes);

                if (intersects.length > 0) {
                    var hotspotMesh = intersects[0].object;
                    if (hotspotMesh.visible && hotspotMesh.userData.type !== 'teleport') {
                        this.showTooltip(hotspotMesh.userData, event);
                    } else {
                        this.hideTooltip();
                    }
                } else {
                    this.hideTooltip();
                }
            });

            // Keyboard navigation for accessibility.
            this.canvas.setAttribute('tabindex', '0');
            this.canvas.setAttribute('role', 'application');

            this.canvas.addEventListener('focus', () => {
                this.canvas.style.outline = '2px solid #6366f1';
                this.canvas.style.outlineOffset = '2px';
            });

            this.canvas.addEventListener('blur', () => {
                this.canvas.style.outline = '';
                this.canvas.style.outlineOffset = '';
                this.hideTooltip();
            });

            this.canvas.addEventListener('keydown', (event) => {
                var focusedHotspotIndex = this.focusedHotspotIndex || 0;
                var visibleHotspots = this.hotspotMeshes.filter(function(mesh) {
                    return mesh.visible && mesh.userData.type !== 'teleport';
                });

                switch (event.key) {
                    case 'Tab':
                        // Allow default tab behavior but track focus.
                        break;

                    case 'ArrowRight':
                    case 'ArrowDown':
                        event.preventDefault();
                        focusedHotspotIndex = (focusedHotspotIndex + 1) % visibleHotspots.length;
                        this.focusedHotspotIndex = focusedHotspotIndex;
                        this.highlightFocusedHotspot(visibleHotspots[focusedHotspotIndex]);
                        break;

                    case 'ArrowLeft':
                    case 'ArrowUp':
                        event.preventDefault();
                        focusedHotspotIndex = (focusedHotspotIndex - 1 + visibleHotspots.length) % visibleHotspots.length;
                        this.focusedHotspotIndex = focusedHotspotIndex;
                        this.highlightFocusedHotspot(visibleHotspots[focusedHotspotIndex]);
                        break;

                    case 'Enter':
                    case ' ':
                        event.preventDefault();
                        if (visibleHotspots[focusedHotspotIndex]) {
                            var hotspot = visibleHotspots[focusedHotspotIndex];
                            if (hotspot.userData.type === 'teleport') {
                                this.focusHotspot(hotspot.userData.id);
                            } else {
                                this.showHotspotPopup(hotspot.userData);
                            }
                        }
                        break;

                    case 'Escape':
                        this.hideTooltip();
                        break;
                }
            });

            // Touch support for mobile (long-press to show tooltip).
            this.longPressTimer = null;
            this.touchStartPos = {x: 0, y: 0};

            this.canvas.addEventListener('touchstart', (event) => {
                if (event.touches.length === 1) {
                    var touch = event.touches[0];
                    this.touchStartPos = {x: touch.clientX, y: touch.clientY};

                    // Start long-press timer (500ms).
                    this.longPressTimer = setTimeout(() => {
                        var rect = this.canvas.getBoundingClientRect();
                        this.mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
                        this.mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;

                        this.raycaster.setFromCamera(this.mouse, this.camera);
                        var intersects = this.raycaster.intersectObjects(this.hotspotMeshes);

                        if (intersects.length > 0) {
                            var hotspotMesh = intersects[0].object;
                            if (hotspotMesh.visible && hotspotMesh.userData.type !== 'teleport') {
                                // Create synthetic event for positioning.
                                var syntheticEvent = {
                                    clientX: touch.clientX,
                                    clientY: touch.clientY
                                };
                                this.showTooltip(hotspotMesh.userData, syntheticEvent);

                                // Provide haptic feedback if available.
                                if (navigator.vibrate) {
                                    navigator.vibrate(50);
                                }
                            }
                        }
                    }, 500);
                }
            }, {passive: true});

            this.canvas.addEventListener('touchmove', (event) => {
                // Cancel long-press if user is scrolling/pinching.
                if (this.longPressTimer) {
                    var touch = event.touches[0];
                    var deltaX = Math.abs(touch.clientX - this.touchStartPos.x);
                    var deltaY = Math.abs(touch.clientY - this.touchStartPos.y);

                    // If moved more than 10px, cancel long-press.
                    if (deltaX > 10 || deltaY > 10) {
                        clearTimeout(this.longPressTimer);
                        this.longPressTimer = null;
                    }
                }
            }, {passive: true});

            this.canvas.addEventListener('touchend', () => {
                if (this.longPressTimer) {
                    clearTimeout(this.longPressTimer);
                    this.longPressTimer = null;
                }
            });

            this.setupVRControllers();
        }

        /**
         * Show tooltip for hotspot.
         *
         * @param {Object} hotspot Hotspot data
         * @param {MouseEvent} event Mouse event for positioning
         */
        showTooltip(hotspot, event) {
            // Don't show tooltip if already showing for this hotspot.
            if (this.activeTooltipHotspot && this.activeTooltipHotspot.id === hotspot.id) {
                this.updateTooltipPosition(event);
                return;
            }

            this.activeTooltipHotspot = hotspot;

            // Create tooltip element if it doesn't exist.
            if (!this.tooltipElement) {
                this.tooltipElement = document.createElement('div');
                this.tooltipElement.className = 'gear-hotspot-tooltip';
                this.tooltipElement.setAttribute('role', 'tooltip');
                this.tooltipElement.style.cssText = 'position:fixed;padding:12px;background:rgba(0,0,0,0.9);color:#fff;' +
                    'border-radius:8px;pointer-events:none;z-index:10000;max-width:250px;font-size:14px;' +
                    'box-shadow:0 4px 12px rgba(0,0,0,0.3);opacity:0;transform:scale(0.95);' +
                    (prefersReducedMotion() ? '' : 'transition:opacity 0.2s ease-in-out, transform 0.2s ease-in-out;');
                document.body.appendChild(this.tooltipElement);
            }

            // Get icon based on type.
            var iconMap = {
                'info': 'fa-info-circle',
                'quiz': 'fa-question-circle',
                'audio': 'fa-volume-up',
                'video': 'fa-video',
                'teleport': 'fa-street-view'
            };
            var icon = iconMap[hotspot.type] || 'fa-info-circle';

            // Build tooltip content with accessible labels.
            var content = '<div style="display:flex;align-items:center;margin-bottom:6px;">';
            content += '<i class="fa ' + icon + '" style="margin-right:8px;font-size:16px;color:#6366f1;" aria-hidden="true"></i>';
            content += '<strong>' + escapeHtml(hotspot.title || this.pointLabel) + '</strong>';
            content += '</div>';

            if (hotspot.content) {
                // Strip HTML tags for tooltip description.
                var plainText = htmlToText(hotspot.content);
                // Truncate if too long.
                if (plainText.length > 100) {
                    plainText = plainText.substring(0, 100) + '...';
                }
                content += '<div style="opacity:0.8;font-size:12px;line-height:1.4;">' + escapeHtml(plainText) + '</div>';
            }

            // Set accessible text for screen readers.
            this.tooltipElement.setAttribute('aria-label', (hotspot.title || this.pointLabel) + ': ' + htmlToText(hotspot.content));
            this.tooltipElement.innerHTML = content;

            // Show tooltip with animation.
            this.tooltipElement.style.display = 'block';

            // Trigger fade-in animation using requestAnimationFrame for smooth transition.
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    this.tooltipElement.style.opacity = '1';
                    this.tooltipElement.style.transform = 'scale(1)';
                });
            });

            this.updateTooltipPosition(event);
        }

        /**
         * Update tooltip position to follow mouse.
         *
         * @param {MouseEvent} event Mouse event
         */
        updateTooltipPosition(event) {
            if (!this.tooltipElement) {
                return;
            }

            var offsetX = 15;
            var offsetY = 15;
            var x = event.clientX + offsetX;
            var y = event.clientY + offsetY;

            // Prevent tooltip from going off-screen.
            var tooltipRect = this.tooltipElement.getBoundingClientRect();
            if (x + tooltipRect.width > window.innerWidth) {
                x = event.clientX - tooltipRect.width - offsetX;
            }
            if (y + tooltipRect.height > window.innerHeight) {
                y = event.clientY - tooltipRect.height - offsetY;
            }

            this.tooltipElement.style.left = x + 'px';
            this.tooltipElement.style.top = y + 'px';
        }

        /**
         * Hide tooltip.
         */
        hideTooltip() {
            if (this.tooltipElement) {
                // Trigger fade-out animation.
                this.tooltipElement.style.opacity = '0';
                this.tooltipElement.style.transform = 'scale(0.95)';

                // Hide after animation completes.
                setTimeout(() => {
                    if (this.tooltipElement) {
                        this.tooltipElement.style.display = 'none';
                    }
                }, 200);
            }
            this.activeTooltipHotspot = null;
        }

        /**
         * Highlight the focused hotspot for keyboard navigation.
         *
         * @param {THREE.Mesh} mesh The hotspot mesh to highlight
         */
        highlightFocusedHotspot(mesh) {
            if (!mesh) {
                return;
            }

            // Reset previous highlight.
            this.hotspotMeshes.forEach(function(m) {
                if (m.userData._focused) {
                    m.userData._focused = false;
                    // Restore original emissive intensity.
                    if (m.userData._originalEmissive !== undefined) {
                        m.material.emissiveIntensity = m.userData._originalEmissive;
                    }
                }
            });

            // Highlight current focused hotspot.
            mesh.userData._focused = true;
            if (mesh.userData._originalEmissive === undefined) {
                mesh.userData._originalEmissive = mesh.material.emissiveIntensity || 0;
            }
            mesh.material.emissiveIntensity = 0.5;

            // Show tooltip at center of screen for keyboard users.
            var syntheticEvent = {
                clientX: window.innerWidth / 2,
                clientY: window.innerHeight / 2
            };
            this.showTooltip(mesh.userData, syntheticEvent);
            this.announce((mesh.userData.title || this.pointLabel) +
                (mesh.userData.content ? ': ' + htmlToText(mesh.userData.content).substring(0, 200) : ''));
        }

        /**
         * Setup WebXR Controllers for VR hand interactions.
         */
        setupVRControllers() {
            var geometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, 0, -5)
            ]);
            var lineMaterial = new THREE.LineBasicMaterial({color: 0xffffff, transparent: true, opacity: 0.5});

            var addController = (index) => {
                var controller = this.renderer.xr.getController(index);
                controller.addEventListener('select', (evt) => this.onVRSelect(evt));

                var line = new THREE.Line(geometry, lineMaterial);
                line.name = 'line';
                line.scale.z = 5;
                controller.add(line);

                this.scene.add(controller);
                return controller;
            };

            this.vrControllers = [addController(0), addController(1)];
        }

        /**
         * Handle VR Controller Select event (Trigger button).
         * @param {Event} event
         */
        onVRSelect(event) {
            var controller = event.target;
            var tempMatrix = new THREE.Matrix4();
            tempMatrix.identity().extractRotation(controller.matrixWorld);
            this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
            this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

            var intersects = this.raycaster.intersectObjects(this.hotspotMeshes, false);
            if (intersects.length > 0) {
                var hotspotMesh = intersects[0].object;
                if (hotspotMesh.visible) {
                    if (hotspotMesh.userData.type === 'teleport') {
                        this.focusHotspot(hotspotMesh.userData.id);
                    } else {
                        this.showHotspotPopup(hotspotMesh.userData);

                        this.toggleVrAudio(hotspotMesh);
                    }
                }
            }
        }

        /**
         * Toggle the audio of an audio hotspot directly, because DOM popups are hard to click inside a headset.
         *
         * @param {THREE.Mesh} hotspotMesh The hotspot mesh
         */
        toggleVrAudio(hotspotMesh) {
            if (hotspotMesh.userData.type !== 'audio' || hotspotMesh.children.length === 0) {
                return;
            }
            const audio = hotspotMesh.children[0];
            if (audio.isPlaying) {
                audio.pause();
            } else {
                audio.play();
            }
        }

        /**
         * Update hotspot position in DB and scene.
         *
         * @param {number} id
         * @param {THREE.Vector3} newPoint
         */
        updateHotspotPosition(id, newPoint) {
            var hotspot = this.hotspotsData.find(h => h.id == id);
            if (!hotspot) {
                return;
            }

            var position = {x: newPoint.x, y: newPoint.y, z: newPoint.z};

            Ajax.call([{
                methodname: 'mod_gear_save_hotspot',
                args: {
                    id: id,
                    gearid: this.gearid,
                    modelid: 0,
                    type: hotspot.type,
                    title: hotspot.title,
                    content: hotspot.content,
                    position: JSON.stringify(position), // DB expects string
                    icon: hotspot.icon || '',
                    config: (typeof hotspot.config === 'object') ? JSON.stringify(hotspot.config) : (hotspot.config || '')
                }
            }])[0].then(async() => {
                // Update mesh.
                var mesh = this.hotspotMeshes.find(m => m.userData.id == id);
                if (mesh) {
                    mesh.position.copy(newPoint);
                }
                // Update data.
                hotspot.position = position;

                this.movingHotspotId = null;
                this.canvas.style.cursor = 'auto';

                Notification.addNotification({
                    message: await Str.get_string('hotspotmoved', 'mod_gear'),
                    type: 'success'
                });
                return null;
            }).catch(Notification.exception);
        }

        /**
         * Load hotspots from data.
         */
        loadHotspots() {
            var geometry;
            var material;
            var pos;

            if (!this.hotspotsData || this.hotspotsData.length === 0) {
                this.renderHotspotsNav();
                return;
            }

            // Hotspot sphere geometry (increased size for better visibility).
            geometry = new THREE.SphereGeometry(0.12, 24, 24);
            material = new THREE.MeshBasicMaterial({
                color: new THREE.Color(this.hotspotColor),
                transparent: true,
                opacity: 0.9
            });

            for (const hotspot of this.hotspotsData) {
                const sphere = new THREE.Mesh(geometry, material.clone());
                sphere.scale.set(this.hotspotScale, this.hotspotScale, this.hotspotScale);
                pos = hotspot.position || {x: 0, y: 0, z: 0};
                sphere.position.set(pos.x, pos.y, pos.z);
                sphere.userData = hotspot;

                // Audio Support.
                if (hotspot.type === 'audio' && hotspot.config) {
                    const config = (typeof hotspot.config === 'string') ? JSON.parse(hotspot.config) : hotspot.config;
                    if (config.audioUrl) {
                        try {
                            const sound = new THREE.PositionalAudio(this.audioListener);
                            const audioLoader = new THREE.AudioLoader();
                            audioLoader.load(config.audioUrl, (buffer) => {
                                sound.setBuffer(buffer);
                                sound.setRefDistance(1);
                                sound.setRolloffFactor(1); // Default rolloff
                                sound.setLoop(true); // Default loop or config
                                sphere.add(sound);
                                sphere.userData.sound = sound;
                            });
                            // Differentiate audio hotspots visually.
                            sphere.material.color.setHex(0x10b981); // Green for audio
                        } catch (e) {
                            window.console.warn('GEAR: Failed to load audio', e);
                        }
                    }
                }

                this.modelContainer.add(sphere);
                this.hotspotMeshes.push(sphere);
            }

            this.renderHotspotsNav();
        }

        /**
         * Delete a hotspot.
         *
         * @param {number} id
         */
        deleteHotspot(id) {
            Ajax.call([{
                methodname: 'mod_gear_delete_hotspot',
                args: {id: id}
            }])[0].then(async() => {
                // Remove from data array.
                this.hotspotsData = this.hotspotsData.filter(h => h.id != id);

                // Remove from scene.
                var meshIdx = this.hotspotMeshes.findIndex(m => m.userData.id == id);
                if (meshIdx !== -1) {
                    var mesh = this.hotspotMeshes[meshIdx];
                    this.modelContainer.remove(mesh);
                    if (mesh.geometry) {
                        mesh.geometry.dispose();
                    }
                    if (mesh.material) {
                        mesh.material.dispose();
                    }
                    this.hotspotMeshes.splice(meshIdx, 1);
                }

                // Refresh Nav.
                this.renderHotspotsNav();

                Notification.addNotification({
                    message: await Str.get_string('hotspotdeleted', 'mod_gear'),
                    type: 'success'
                });
                return null;
            }).catch(Notification.exception);
        }

        /**
         * Render hotspot list in the floating dropdown.
         */
        /**
         * Close the hotspot dropdown that contains the given element.
         *
         * @param {HTMLElement} element An element inside the dropdown
         */
        closeNavDropdown(element) {
            const dropdown = element.closest('.dropdown');
            if (dropdown) {
                dropdown.classList.remove('show');
                dropdown.querySelector('.dropdown-menu').classList.remove('show');
            }
        }

        /**
         * Connect the buttons of one entry of the hotspot list (open, and for managers edit and delete).
         *
         * @param {Object} hotspot Hotspot data
         */
        wireHotspotNavItem(hotspot) {
            const item = document.getElementById('gear-hotspot-nav-item-' + hotspot.id);
            if (!item) {
                return;
            }
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.focusHotspot(hotspot.id);
                this.closeNavDropdown(item);
            });
            if (!this.canManage) {
                return;
            }

            const editBtn = document.getElementById('gear-hotspot-nav-edit-' + hotspot.id);
            if (editBtn) {
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const pos = hotspot.position || {x: 0, y: 0, z: 0};
                    this.showAddHotspotForm({x: pos.x, y: pos.y, z: pos.z}, hotspot);
                    this.closeNavDropdown(item);
                });
            }

            const deleteBtn = document.getElementById('gear-hotspot-nav-delete-' + hotspot.id);
            if (deleteBtn) {
                deleteBtn.addEventListener('click', async(e) => {
                    e.stopPropagation();
                    if (await this.confirmDeleteHotspot()) {
                        this.deleteHotspot(hotspot.id);
                    }
                });
            }
        }

        async renderHotspotsNav() {
            var menu = this.container.querySelector('.gear-hotspots-menu');
            if (!menu) {
                return;
            }

            await this.describeScene();

            menu.innerHTML = '';

            if (this.hotspotsData.length === 0) {
                const noHotspotsStr = await Str.get_string('nohotspots', 'mod_gear');
                menu.innerHTML = '<span class="dropdown-item-text text-muted">' + noHotspotsStr + '</span>';
                return;
            }

            for (const hotspot of this.hotspotsData) {
                var icon = 'fa-dot-circle';
                if (hotspot.type === 'quiz') {
                    icon = 'fa-question-circle';
                }
                if (hotspot.type === 'audio') {
                    icon = 'fa-volume-up';
                }
                if (hotspot.type === 'video') {
                    icon = 'fa-video';
                }
                if (hotspot.type === 'teleport') {
                    icon = 'fa-street-view';
                }

                try {
                    const html = await Templates.render('mod_gear/hotspot_nav_item', {
                        id: hotspot.id,
                        icon: icon,
                        title: hotspot.title || await Str.get_string('point', 'mod_gear'),
                        canManage: this.canManage
                    });

                    Templates.appendNodeContents(menu, html, "");
                    this.wireHotspotNavItem(hotspot);
                } catch (e) {
                    Notification.exception(e);
                }
            }
        }

        /**
         * Focus camera on a specific hotspot.
         *
         * @param {number} hotspotId
         */
        focusHotspot(hotspotId) {
            var hotspotData = this.hotspotsData.find(h => h.id == hotspotId);
            var mesh = this.hotspotMeshes.find(m => m.userData.id == hotspotId);

            if (!hotspotData || !mesh) {
 return;
}

            // Highlight in Nav.
            document.querySelectorAll('.gear-hotspot-nav-item').forEach(el => el.classList.remove('active'));
            var navItem = document.getElementById('gear-hotspot-nav-item-' + hotspotId);
            if (navItem) {
                navItem.classList.add('active');
                navItem.scrollIntoView({behavior: 'smooth', inline: 'center'});
            }

            // Move Camera.
            var targetPos = new THREE.Vector3();
            mesh.getWorldPosition(targetPos);

            // Calculate a nice camera position relative to hotspot.
            // We want to look AT the hotspot from a short distance.
            var offset = new THREE.Vector3(0, 0.5, 1);
            var newCamPos = targetPos.clone().add(offset);

            // Simple transition (could use TWEEN if available, but OrbitControls target update is enough).
            this.controls.target.copy(targetPos);
            this.camera.position.copy(newCamPos);
            this.controls.update();

            // Blink effect on mesh.
            this.stopBlinking();
            this.activeBlinkMesh = mesh;
            if (!prefersReducedMotion()) {
                this.blinkInterval = setInterval(() => {
                    mesh.visible = !mesh.visible;
                }, 300);
            }

            // Stop blinking after 3 seconds.
            setTimeout(() => this.stopBlinking(), 3000);

            if (hotspotData.type !== 'teleport') {
                this.showHotspotPopup(hotspotData);
            }
        }

        /**
         * Stop any active blinking.
         */
        stopBlinking() {
            if (this.blinkInterval) {
                clearInterval(this.blinkInterval);
                this.blinkInterval = null;
            }
            if (this.activeBlinkMesh) {
                this.activeBlinkMesh.visible = true;
                this.activeBlinkMesh = null;
            }
        }

        /**
         * Show hotspot popup using mustache.
         *
         * @param {Object} hotspot Hotspot data
         */
        async showHotspotPopup(hotspot) {
            var audioContext = {};
            if (hotspot.type === 'audio' && hotspot.sound) {
                audioContext = {
                    isAudio: true,
                    audioIcon: hotspot.sound.isPlaying ? 'fa-pause' : 'fa-play',
                    audioText: hotspot.sound.isPlaying
                        ? Str.get_string('audio_pause', 'mod_gear')
                        : Str.get_string('audio_play', 'mod_gear')
                };
            }

            var videoContext = {};
            if (hotspot.type === 'video' && hotspot.config) {
                var config = (typeof hotspot.config === 'string') ? JSON.parse(hotspot.config) : hotspot.config;
                if (config.videoUrl) {
                    var finalUrl = config.videoUrl;
                    var isIframe = false;

                    if (finalUrl.indexOf('youtube.com') !== -1 || finalUrl.indexOf('youtu.be') !== -1) {
                        isIframe = true;
                        var videoId = '';
                        if (finalUrl.indexOf('youtube.com/watch') !== -1) {
                            var urlObj = new URL(finalUrl);
                            var params = new URLSearchParams(urlObj.search);
                            videoId = params.get('v');
                        } else if (finalUrl.indexOf('youtu.be/') !== -1) {
                            videoId = finalUrl.split('youtu.be/')[1].split('?')[0];
                        } else if (finalUrl.indexOf('youtube.com/embed/') !== -1) {
                            videoId = finalUrl.split('youtube.com/embed/')[1].split('?')[0];
                        }
                        if (videoId) {
                            finalUrl = 'https://www.youtube.com/embed/' + videoId;
                        }
                    } else if (finalUrl.indexOf('vimeo.com') !== -1) {
                        isIframe = true;
                        if (finalUrl.indexOf('player.vimeo.com') === -1) {
                            var vimeoId = finalUrl.split('vimeo.com/')[1].split('/')[0].split('?')[0];
                            if (vimeoId) {
                                finalUrl = 'https://player.vimeo.com/video/' + vimeoId;
                            }
                        }
                    }

                    videoContext.isVideo = true;
                    videoContext.videoUrl = finalUrl;
                    videoContext.isIframe = isIframe;
                }
            }

            var context = {
                cmid: this.cmid,
                canManage: this.canManage,
                title: hotspot.title || await Str.get_string('hotspottype_info', 'mod_gear'),
                content: hotspot.content || '',
                isInfo: hotspot.type === 'info',
                isAudio: hotspot.type === 'audio',
                ...audioContext,
                ...videoContext
            };

            Templates.render('mod_gear/hotspot_popup', context).then((html, js) => {
                var existing = document.getElementById('gear-hotspot-popup-' + this.cmid);
                if (existing) {
                    Templates.replaceNode(existing, html, js);
                } else {
                    Templates.appendNodeContents(this.container, html, js);
                }

                var popup = document.getElementById('gear-hotspot-popup-' + this.cmid);
                popup.classList.add('active');

                const closePopup = () => {
                    popup.classList.remove('active');
                    popup.querySelectorAll('iframe').forEach(f => {
                        var src = f.src;
                        f.src = '';
                        f.src = src;
                    });
                    popup.querySelectorAll('video, audio').forEach(m => m.pause());
                    if ('speechSynthesis' in window) {
                        window.speechSynthesis.cancel();
                    }
                };

                // Event Listeners.
                popup.querySelector('.gear-hotspot-close').addEventListener('click', () => {
                    closePopup();
                });

                if (this.canManage) {
                    popup.querySelector('.gear-edit-hotspot')?.addEventListener('click', () => {
                        var pos = hotspot.position || {x: 0, y: 0, z: 0};
                        this.showAddHotspotForm({x: pos.x, y: pos.y, z: pos.z}, hotspot);
                        closePopup();
                    });

                    popup.querySelector('.gear-move-hotspot')?.addEventListener('click', async(e) => {
                        e.stopPropagation();
                        this.movingHotspotId = hotspot.id;
                        this.canvas.style.cursor = 'move';
                        closePopup();

                        if (this.transformControl) {
                            var meshToMove = this.hotspotMeshes.find(m => m.userData.id == hotspot.id);
                            if (meshToMove) {
                                this.transformControl.attach(meshToMove);
                            }
                        }
                        Notification.addNotification({
                            message: await Str.get_string('clicktoplace', 'mod_gear'),
                            type: 'info'
                        });
                    });

                    popup.querySelector('.gear-delete-hotspot')?.addEventListener('click', async() => {
                        if (await this.confirmDeleteHotspot()) {
                            this.deleteHotspot(hotspot.id);
                            closePopup();
                        }
                    });
                }

                if (hotspot.type === 'quiz') {
                    this.renderQuizInPopup(popup, hotspot);
                } else if (hotspot.type === 'audio' && hotspot.sound) {
                    var toggleBtn = popup.querySelector('.gear-audio-toggle');
                    toggleBtn.addEventListener('click', async() => {
                        if (hotspot.sound.isPlaying) {
                            hotspot.sound.pause();
                            toggleBtn.innerHTML = '<i class="fa fa-play"></i> ' + await Str.get_string('audio_play', 'mod_gear');
                        } else {
                            hotspot.sound.play();
                            toggleBtn.innerHTML = '<i class="fa fa-pause"></i> ' + await Str.get_string('audio_pause', 'mod_gear');
                        }
                    });
                }

                // Text to Speech
                var ttsBtn = popup.querySelector('.gear-tts-btn');
                if (ttsBtn && 'speechSynthesis' in window) {
                    ttsBtn.addEventListener('click', () => {
                        var isPlaying = ttsBtn.classList.contains('playing');
                        if (isPlaying) {
                            window.speechSynthesis.cancel();
                            ttsBtn.classList.remove('playing');
                            ttsBtn.innerHTML = '<i class="fa fa-volume-up text-secondary"></i>';
                        } else {
                            var plainText = (hotspot.title || '') + ". " + htmlToText(hotspot.content);
                            var utterance = new SpeechSynthesisUtterance(plainText);
                            utterance.lang = document.documentElement.lang || 'en-US';

                            utterance.onend = function() {
                                ttsBtn.classList.remove('playing');
                                ttsBtn.innerHTML = '<i class="fa fa-volume-up text-secondary"></i>';
                            };

                            window.speechSynthesis.cancel();
                            window.speechSynthesis.speak(utterance);

                            ttsBtn.classList.add('playing');
                            ttsBtn.innerHTML = '<i class="fa fa-stop-circle text-danger"></i>';
                        }
                    });
                }

                // Highlight in Nav.
                document.querySelectorAll('.gear-hotspot-nav-item').forEach(el => el.classList.remove('active'));
                var navItem = document.getElementById('gear-hotspot-nav-item-' + hotspot.id);
                if (navItem) {
                    navItem.classList.add('active');
                    navItem.scrollIntoView({behavior: 'smooth', inline: 'center'});
                }

                // Track interaction.
                this.trackEvent('hotspot_click', {hotspotId: hotspot.id, title: hotspot.title});

                return null;
            }).catch(Notification.exception);
        }

        /**
         * Show form to add/edit a hotspot using mustache.
         *
         * @param {Object} point THREE.Vector3 position
         * @param {Object} [hotspotToEdit] Optional hotspot object when editing
         */
        showAddHotspotForm(point, hotspotToEdit) {
            var context = {
                cmid: this.cmid,
                aiAvailable: this.aiAvailable,
                posX: point.x.toFixed(3),
                posY: point.y.toFixed(3),
                posZ: point.z.toFixed(3),
                isInfo: true
            };

            let editCfg = null;
            if (hotspotToEdit && hotspotToEdit.config) {
                editCfg = typeof hotspotToEdit.config === 'string' ? JSON.parse(hotspotToEdit.config) : hotspotToEdit.config;
            }
            var quizOptions = this.hotspotsData
                .filter(h => h.type === 'quiz' && (!hotspotToEdit || h.id != hotspotToEdit.id))
                .map(h => ({
                    id: h.id,
                    title: h.title,
                    selected: Boolean(editCfg && editCfg.requires_id == h.id)
                }));
            context.quizOptions = quizOptions;

            if (hotspotToEdit) {
                var pos = hotspotToEdit.position || point;
                context.hotspotId = hotspotToEdit.id;
                context.title = hotspotToEdit.title || '';
                context.content = hotspotToEdit.content || '';
                context.posX = pos.x.toFixed(3);
                context.posY = pos.y.toFixed(3);
                context.posZ = pos.z.toFixed(3);
                context.isInfo = hotspotToEdit.type === 'info';
                context.isQuiz = hotspotToEdit.type === 'quiz';
                context.isAudio = hotspotToEdit.type === 'audio';
                context.isVideo = hotspotToEdit.type === 'video';
                context.isTeleport = hotspotToEdit.type === 'teleport';

                if (hotspotToEdit.type === 'quiz' && editCfg) {
                    Object.assign(context, this.quizFormContext(editCfg));
                } else if (hotspotToEdit.type === 'audio' && editCfg) {
                    context.audioUrl = editCfg.audioUrl || '';
                } else if (hotspotToEdit.type === 'video' && editCfg) {
                    context.videoUrl = editCfg.videoUrl || '';
                }
            }

            Templates.render('mod_gear/hotspot_form', context).then((html, js) => {
                var existing = document.getElementById('gear-hotspot-form-' + this.cmid);
                if (existing) {
                    Templates.replaceNode(existing, html, js);
                } else {
                    Templates.appendNodeContents(this.container, html, js);
                }

                var form = document.getElementById('gear-hotspot-form-' + this.cmid);
                form.classList.add('active');

                this.setupHotspotFormEventListeners(form);

                return null;
            }).catch(Notification.exception);
        }

        /**
         * Template values of the quiz fields of the hotspot form for an existing quiz hotspot.
         *
         * @param {Object} config Hotspot config
         * @returns {Object} Template context values
         */
        quizFormContext(config) {
            const quizType = config.quizType || 'single';
            return {
                isSingle: quizType === 'single',
                isMulti: quizType === 'multi',
                isText: quizType === 'text',
                options: config.options ? config.options.join(', ') : '',
                correctAnswer: quizType === 'multi' ? (config.correctAnswers || []).join(', ') : (config.correctAnswer || 0),
                accepted: (config.acceptedAnswers || []).join('\n'),
                caseSensitive: !!config.caseSensitive,
                points: config.points || 10,
            };
        }

        /**
         * Show the fields that belong to the chosen quiz type (options for choices, accepted answers for a typed answer).
         *
         * @param {HTMLElement} form The hotspot form
         */
        showQuizTypeFields(form) {
            const text = form.querySelector('#gear-hotspot-input-quiztype-' + this.cmid).value === 'text';
            form.querySelectorAll('.gear-quiz-choice-fields').forEach((el) => {
                el.hidden = text;
            });
            form.querySelectorAll('.gear-quiz-text-fields').forEach((el) => {
                el.hidden = !text;
            });
        }

        /**
         * Copy a question of the course question banks into the quiz fields of the hotspot form.
         *
         * @param {HTMLElement} form The hotspot form
         */
        async importBankQuestion(form) {
            let question;
            try {
                question = await pickQuestion(this.gearid, this.cmid);
            } catch (e) {
                Notification.exception(e);
                return;
            }
            if (!question) {
                return;
            }
            const field = (name) => form.querySelector('#gear-hotspot-input-' + name + '-' + this.cmid);
            const joined = question.options.join(', ');
            form.dataset.importedOptions = JSON.stringify(question.options);
            form.dataset.importedJoined = joined;
            field('options').value = joined;
            field('quiztype').value = question.quiztype;
            field('correct').value = question.quiztype === 'multi' ? question.corrects.join(', ') : question.correct;
            field('accepted').value = question.accepted.join('\n');
            field('casesensitive').checked = question.casesensitive;
            this.showQuizTypeFields(form);
            if (!field('title').value.trim()) {
                field('title').value = question.name;
            }
            field('content').value = '<p>' + escapeHtml(question.text) + '</p>';
            Notification.addNotification({message: await Str.get_string('importquestionimported', 'mod_gear'), type: 'info'});
        }

        /**
         * Setup event listeners for the hotspot form.
         *
         * @param {HTMLElement} form
         */
        setupHotspotFormEventListeners(form) {
            var typeSelect = form.querySelector('#gear-hotspot-input-type-' + this.cmid);
            var quizFields = form.querySelector('#gear-hotspot-quiz-fields-' + this.cmid);
            var audioFields = form.querySelector('#gear-hotspot-audio-fields-' + this.cmid);
            var videoFields = form.querySelector('#gear-hotspot-video-fields-' + this.cmid);

            const quizType = form.querySelector('#gear-hotspot-input-quiztype-' + this.cmid);
            if (quizType) {
                quizType.addEventListener('change', () => this.showQuizTypeFields(form));
            }
            const importButton = form.querySelector('.gear-import-question');
            if (importButton) {
                importButton.addEventListener('click', () => this.importBankQuestion(form));
            }

            typeSelect.addEventListener('change', () => {
                quizFields.style.display = (typeSelect.value === 'quiz') ? 'block' : 'none';
                audioFields.style.display = (typeSelect.value === 'audio') ? 'block' : 'none';
                videoFields.style.display = (typeSelect.value === 'video') ? 'block' : 'none';
                return null;
            });

            // AI Assist button.
            var aiBtn = form.querySelector('.gear-ai-btn');
            aiBtn.addEventListener('click', async() => {
                // The AI usage policy of Moodle has to be accepted once per user.
                if (!await Policy.getPolicyStatus(this.userid)) {
                    const policyModal = await PolicyModal.create();
                    policyModal.getModal().on(CustomEvents.events.activate, policyModal.getActionSelector('save'), () => {
                        aiBtn.click();
                    });
                    return;
                }
                var type = typeSelect.value;
                var prompt = await this.askAiTopic();
                if (prompt) {
                    aiBtn.disabled = true;
                    aiBtn.textContent = await Str.get_string('generating', 'mod_gear');
                    this.generateContent(prompt, type).then(async(data) => {
                        aiBtn.disabled = false;
                        aiBtn.textContent = await Str.get_string('aiassist', 'mod_gear');

                        if (type === 'quiz') {
                            try {
                                var json = JSON.parse(data);
                                form.querySelector('#gear-hotspot-input-title-' + this.cmid).value = json.question || '';
                                const optStr = json.options ? json.options.join(', ') : '';
                                form.querySelector('#gear-hotspot-input-options-' + this.cmid).value = optStr;
                                form.querySelector('#gear-hotspot-input-correct-' + this.cmid).value = json.correct || 0;
                            } catch (e) {
                                Notification.alert(
                                    await Str.get_string('error', 'core'),
                                    await Str.get_string('aifail', 'mod_gear')
                                );
                            }
                        } else if (type === 'info') {
                            form.querySelector('#gear-hotspot-input-title-' + this.cmid).value = prompt;
                            form.querySelector('#gear-hotspot-input-content-' + this.cmid).value = data;
                        }
                        return null;
                    }).catch(async(err) => {
                        aiBtn.disabled = false;
                        aiBtn.textContent = await Str.get_string('aiassist', 'mod_gear');
                        Notification.alert(
                            await Str.get_string('error', 'core'),
                            err.message || await Str.get_string('generationfailed', 'mod_gear')
                        );
                        return null;
                    });
                }
            });

            // Media upload triggers and file inputs.
            form.querySelectorAll('.gear-upload-trigger-btn').forEach((triggerBtn) => {
                triggerBtn.addEventListener('click', () => {
                    const targetId = triggerBtn.dataset.target;
                    const input = form.querySelector('#' + targetId);
                    if (input) {
                        input.click();
                    }
                });
            });

            form.querySelectorAll('input[type="file"]').forEach((fileInput) => {
                fileInput.addEventListener('change', async() => {
                    if (!fileInput.files || !fileInput.files[0]) {
                        return;
                    }
                    const file = fileInput.files[0];
                    const isAudio = fileInput.id.indexOf('audio') !== -1;
                    const statusEl = form.querySelector(isAudio
                        ? '#gear-hotspot-audio-status-' + this.cmid
                        : '#gear-hotspot-video-status-' + this.cmid);
                    const urlInput = form.querySelector(isAudio
                        ? '#gear-hotspot-input-audiourl-' + this.cmid
                        : '#gear-hotspot-input-videourl-' + this.cmid);

                    statusEl.className = 'form-text text-muted gear-upload-status';
                    statusEl.textContent = await Str.get_string('media_uploading', 'mod_gear');

                    const formData = new FormData();
                    formData.append('cmid', this.cmid);
                    formData.append('sesskey', M.cfg.sesskey);
                    formData.append('file', file);
                    if (form.dataset.draftitemid) {
                        formData.append('draftitemid', form.dataset.draftitemid);
                    }

                    try {
                        const resp = await fetch(M.cfg.wwwroot + '/mod/gear/upload_media.php', {
                            method: 'POST',
                            body: formData
                        });
                        const data = await resp.json();
                        if (data.success) {
                            form.dataset.draftitemid = data.draftitemid;
                            urlInput.value = data.url;
                            statusEl.className = 'form-text text-success gear-upload-status';
                            statusEl.textContent = await Str.get_string('media_upload_success', 'mod_gear') +
                                ' (' + data.filename + ')';
                        } else {
                            statusEl.className = 'form-text text-danger gear-upload-status';
                            statusEl.textContent = data.message || 'Upload failed';
                        }
                    } catch (err) {
                        statusEl.className = 'form-text text-danger gear-upload-status';
                        statusEl.textContent = err.message || 'Upload failed';
                    }
                });
            });

            // Cancel button.
            form.querySelector('.gear-cancel-btn').addEventListener('click', () => {
                form.classList.remove('active');
            });

            // Save button.
            form.querySelector('.gear-save-btn').addEventListener('click', () => {
                this.saveNewHotspot(form);
            });
        }

        /**
         * Save a new hotspot via AJAX.
         *
         * @param {HTMLElement} form The form element
         */
        async saveNewHotspot(form) {
            var titleInput = form.querySelector('#gear-hotspot-input-title-' + this.cmid);
            var contentInput = form.querySelector('#gear-hotspot-input-content-' + this.cmid);
            var title = titleInput.value.trim();
            var content = contentInput.value.trim();
            var position = {
                x: parseFloat(form.dataset.posX),
                y: parseFloat(form.dataset.posY),
                z: parseFloat(form.dataset.posZ)
            };

            var typeInput = form.querySelector('#gear-hotspot-input-type-' + this.cmid);
            var type = typeInput.value;
            var config = {};

            var requiresInput = form.querySelector('#gear-hotspot-input-requires-' + this.cmid);
            if (requiresInput && requiresInput.value) {
                config.requires_id = requiresInput.value; // eslint-disable-line camelcase
            }

            if (type === 'quiz') {
                var optionsStr = form.querySelector('#gear-hotspot-input-options-' + this.cmid).value;
                var correct = form.querySelector('#gear-hotspot-input-correct-' + this.cmid).value;
                var points = form.querySelector('#gear-hotspot-input-points-' + this.cmid).value;
                const quizType = form.querySelector('#gear-hotspot-input-quiztype-' + this.cmid).value;

                // Options copied from the question bank may contain commas, so they are kept as a list.
                config.options = form.dataset.importedJoined === optionsStr && form.dataset.importedOptions
                    ? JSON.parse(form.dataset.importedOptions)
                    : optionsStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
                config.correctAnswer = parseInt(correct, 10);
                config.points = parseInt(points, 10);
                config.quizType = quizType;

                if (quizType === 'text') {
                    // Typed answer: no options, a list of accepted answers instead.
                    delete config.options;
                    delete config.correctAnswer;
                    config.acceptedAnswers = form.querySelector('#gear-hotspot-input-accepted-' + this.cmid).value
                        .split('\n').map(s => s.trim()).filter(s => s.length > 0);
                    config.caseSensitive = form.querySelector('#gear-hotspot-input-casesensitive-' + this.cmid).checked;
                    if (!config.acceptedAnswers.length) {
                        Notification.alert(
                            await Str.get_string('error', 'core'),
                            await Str.get_string('quiz_noaccepted', 'mod_gear')
                        );
                        return;
                    }
                } else if (quizType === 'multi') {
                    delete config.correctAnswer;
                    config.correctAnswers = correct.split(',').map(s => parseInt(s.trim(), 10))
                        .filter(n => !isNaN(n) && n >= 0 && n < config.options.length);
                    if (!config.correctAnswers.length) {
                        Notification.alert(
                            await Str.get_string('error', 'core'),
                            await Str.get_string('quiz_nocorrect', 'mod_gear')
                        );
                        return;
                    }
                }

                if (quizType !== 'text' && config.options.length < 2) {
                    Notification.alert(
                        await Str.get_string('error', 'core'),
                        await Str.get_string('quiz_minoptions', 'mod_gear')
                    );
                    return;
                }
            } else if (type === 'audio') {
                var audioUrl = form.querySelector('#gear-hotspot-input-audiourl-' + this.cmid).value.trim();
                config.audioUrl = audioUrl;
            } else if (type === 'video') {
                var videoUrl = form.querySelector('#gear-hotspot-input-videourl-' + this.cmid).value.trim();
                config.videoUrl = videoUrl;
            }

            if (!title) {
                Notification.alert(
                    await Str.get_string('error', 'core'),
                    await Str.get_string('entertitle_error', 'mod_gear')
                );
                return;
            }

            // Determine whether creating new or editing existing hotspot.
            var hotspotId = form.dataset.hotspotId ? parseInt(form.dataset.hotspotId, 10) : 0;
            var draftitemId = form.dataset.draftitemid ? parseInt(form.dataset.draftitemid, 10) : 0;

            // Save via AJAX.
            Ajax.call([{
                methodname: 'mod_gear_save_hotspot',
                args: {
                    id: hotspotId,
                    gearid: this.gearid,
                    modelid: 0,
                    type: type,
                    title: title,
                    content: content,
                    position: JSON.stringify(position),
                    icon: (type === 'quiz') ? 'question' : 'info',
                    config: JSON.stringify(config),
                    draftitemid: draftitemId
                }
            }])[0].then(async(response) => {
                // Add hotspot mesh.
                var geometry = new THREE.SphereGeometry(0.08, 16, 16);
                var material = new THREE.MeshBasicMaterial({
                    color: 0x6366f1,
                    transparent: true,
                    opacity: 0.9
                });
                if (hotspotId && hotspotId > 0) {
                    // Update existing mesh data.
                    var updated = false;
                    for (var i = 0; i < this.hotspotMeshes.length; i++) {
                        var hm = this.hotspotMeshes[i];
                        if (hm.userData && hm.userData.id == hotspotId) {
                            hm.userData.title = title;
                            hm.userData.content = content;
                            hm.userData.type = type;
                            hm.userData.icon = (type === 'quiz') ? 'question' : 'info';
                            hm.userData.config = JSON.stringify(config);
                            // Update position if changed.
                            hm.position.set(position.x, position.y, position.z);
                            updated = true;
                            break;
                        }
                    }

                    // Update data array.
                    var dataIdx = this.hotspotsData.findIndex(h => h.id == hotspotId);
                    if (dataIdx !== -1) {
                        this.hotspotsData[dataIdx] = Object.assign(this.hotspotsData[dataIdx], {
                            title: title,
                            content: content,
                            type: type,
                            position: position,
                            config: JSON.stringify(config)
                        });
                    }

                    if (!updated) {
                        let sphere = new THREE.Mesh(geometry, material);
                        sphere.position.set(position.x, position.y, position.z);
                        sphere.userData = {
                            id: response.id,
                            title: title,
                            content: content,
                            type: type,
                            icon: (type === 'quiz') ? 'question' : 'info',
                            config: JSON.stringify(config)
                        };
                        this.modelContainer.add(sphere);
                        this.hotspotMeshes.push(sphere);
                    }
                } else {
                    let sphereData = {
                        id: response.id,
                        title: title,
                        content: content,
                        type: type,
                        position: position,
                        icon: (type === 'quiz') ? 'question' : 'info',
                        config: JSON.stringify(config)
                    };
                    this.hotspotsData.push(sphereData);

                    let sphere = new THREE.Mesh(geometry, material);
                    sphere.position.set(position.x, position.y, position.z);
                    sphere.userData = sphereData;
                    this.modelContainer.add(sphere);
                    this.hotspotMeshes.push(sphere);
                }

                this.renderHotspotsNav();

                // Close form.
                form.classList.remove('active');
                Notification.addNotification({
                    message: await Str.get_string('hotspotsaved', 'mod_gear'),
                    type: 'success'
                });

                return response;
            }).catch(Notification.exception);
        }


        /**
         * Render quiz content using mustache.
         *
         * @param {HTMLElement} popup
         * @param {Object} hotspot
         */
        renderQuizInPopup(popup, hotspot) {
            var contentDiv = popup.querySelector('.gear-hotspot-content');
            var config = (typeof hotspot.config === 'string') ? JSON.parse(hotspot.config) : hotspot.config;

            const quizType = (config && config.quizType) || 'single';
            if (!config || (quizType !== 'text' && !config.options)) {
                Str.get_string('quiz_invalid', 'mod_gear').then((msg) => {
                    const note = Object.assign(document.createElement('p'), {className: 'text-danger', textContent: msg});
                    contentDiv.appendChild(note);
                    return null;
                }).catch(Notification.exception);
                return;
            }

            var context = {
                id: hotspot.id,
                multi: quizType === 'multi',
                text: quizType === 'text',
                options: (config.options || []).map((opt, index) => ({
                    index: index,
                    text: opt
                }))
            };

            Templates.render('mod_gear/quiz', context).then((html, js) => {
                Templates.appendNodeContents(contentDiv, html, js);

                var submitBtn = popup.querySelector('.gear-quiz-submit');
                submitBtn.addEventListener('click', async() => {
                    let answer;
                    if (quizType === 'text') {
                        answer = popup.querySelector('.gear-quiz-text').value.trim();
                    } else {
                        const selected = popup.querySelectorAll('input[name="gear-quiz-option"]:checked');
                        answer = Array.from(selected).map((input) => input.value).join(',');
                    }
                    if (!answer) {
                        Notification.alert(
                            await Str.get_string('warning', 'core'),
                            await Str.get_string(quizType === 'text' ? 'quiz_typeanswer' : 'quiz_selectanswer', 'mod_gear')
                        );
                        return;
                    }
                    this.submitQuizAnswer(hotspot, answer, popup);
                });
                return null;
            }).catch(Notification.exception);
        }

        /**
         * Submit quiz answer.
         *
         * @param {Object} hotspot
         * @param {string} answer
         * @param {HTMLElement} popup
         */
        submitQuizAnswer(hotspot, answer, popup) {
            Ajax.call([{
                methodname: 'mod_gear_submit_quiz',
                args: {
                    gearid: this.gearid,
                    hotspotid: hotspot.id,
                    answer: answer
                }
            }])[0].then(async(response) => {
                var feedbackDiv = popup.querySelector('.gear-quiz-feedback');
                var submitBtn = popup.querySelector('.gear-quiz-submit');

                if (response.correct) {
                    const msg = await Str.get_string('quiz_correct', 'mod_gear');
                    feedbackDiv.textContent = '';
                    var okBadge = document.createElement('span');
                    okBadge.className = 'badge badge-success bg-success';
                    okBadge.textContent = msg;
                    feedbackDiv.append(okBadge, ' ' + await Str.get_string('quizpointsawarded', 'mod_gear', response.score));
                    await this.refreshHotspots();
                } else {
                    const msg = await Str.get_string('quiz_incorrect', 'mod_gear');
                    feedbackDiv.textContent = '';
                    var badBadge = document.createElement('span');
                    badBadge.className = 'badge badge-danger bg-danger';
                    badBadge.textContent = msg;
                    feedbackDiv.append(badBadge);
                }

                submitBtn.disabled = true;
                return null;
            }).catch(Notification.exception);
        }

        /**
         * Ask the server for hotspots that have just been unlocked (by solving a quiz) and add them to the scene.
         * The server never sends locked hotspots to students, so unlocking survives a page reload.
         */
        async refreshHotspots() {
            var known = new Set(this.hotspotMeshes.map(m => m.userData.id));

            await this.fetchSceneData();
            var all = this.hotspotsData;
            var added = all.filter(h => !known.has(h.id));
            if (added.length === 0) {
                return;
            }

            this.hotspotsData = added;
            this.loadHotspots();
            this.hotspotsData = all;
            this.renderHotspotsNav();

            // Pop animation for the new hotspots.
            this.hotspotMeshes.filter(m => !known.has(m.userData.id)).forEach(mesh => {
                var target = this.hotspotScale;
                mesh.scale.set(0.01, 0.01, 0.01);
                var growth = setInterval(() => {
                    var curr = mesh.scale.x;
                    if (curr >= target) {
                        clearInterval(growth);
                    } else {
                        mesh.scale.set(curr + 0.1, curr + 0.1, curr + 0.1);
                    }
                }, 30);
            });
        }

        /**
         * Fully clear and reload all hotspots in the scene and navigation menu.
         */
        async reloadAllHotspots() {
            for (var i = 0; i < this.hotspotMeshes.length; i++) {
                var mesh = this.hotspotMeshes[i];
                this.scene.remove(mesh);
                if (mesh.geometry) {
                    mesh.geometry.dispose();
                }
                if (mesh.material) {
                    mesh.material.dispose();
                }
            }
            this.hotspotMeshes = [];
            await this.fetchSceneData();
            if (this.hotspotsEnabled) {
                this.loadHotspots();
                this.renderHotspotsNav();
                this.updateA11yHotspots();
            }
        }

        /**
         * Text alternative of the 3D scene: the label of the canvas and a visually hidden list of hotspots
         * that screen reader users can move through and open.
         */
        async describeScene() {
            const alt = ((this.config && this.config.alt) || '').trim() || await Str.get_string('scenedefaultalt', 'mod_gear', {
                name: this.sceneName,
                count: this.hotspotsData.length,
            });
            this.canvas.setAttribute('aria-label', alt + ' ' + await Str.get_string('canvaslabel', 'mod_gear'));

            let region = this.container.querySelector('.gear-sr-scene');
            if (!region) {
                region = document.createElement('div');
                region.className = 'gear-sr-scene visually-hidden';
                region.setAttribute('role', 'region');
                this.container.appendChild(region);
            }
            region.setAttribute('aria-label', await Str.get_string('scenedescription', 'mod_gear'));
            region.textContent = '';
            const intro = document.createElement('p');
            intro.textContent = alt;
            region.appendChild(intro);

            const list = document.createElement('ul');
            const fallback = await Str.get_string('point', 'mod_gear');
            this.hotspotsData.forEach((hotspot) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.textContent = hotspot.title || fallback;
                button.addEventListener('click', () => this.focusHotspot(hotspot.id));
                const item = document.createElement('li');
                item.appendChild(button);
                list.appendChild(item);
            });
            region.appendChild(list);
        }

        /**
         * Ask the teacher to confirm that a hotspot is deleted.
         *
         * @returns {Promise<boolean>} True when the deletion was confirmed
         */
        async confirmDeleteHotspot() {
            try {
                await Notification.deleteCancelPromise(
                    await Str.get_string('confirm', 'core'),
                    await Str.get_string('deletehotspotconfirm', 'mod_gear'),
                    await Str.get_string('delete', 'core')
                );
                return true;
            } catch (e) {
                return false;
            }
        }

        /**
         * Ask the teacher for the topic the AI assistant should write about.
         *
         * @returns {Promise<string>} The topic, or an empty string when the dialog was cancelled
         */
        async askAiTopic() {
            const inputId = 'gear-ai-topic-' + this.cmid;
            const label = escapeHtml(await Str.get_string('ai_prompt', 'mod_gear'));
            const modal = await ModalSaveCancel.create({
                title: await Str.get_string('aiassist', 'mod_gear'),
                body: '<div class="mb-3"><label for="' + inputId + '" class="form-label">' + label + '</label>' +
                    '<input type="text" class="form-control" id="' + inputId + '" maxlength="200"></div>',
                removeOnClose: true,
            });
            const root = modal.getRoot()[0];
            const input = root.querySelector('#' + inputId);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    root.querySelector('[data-action="save"]').click();
                }
            });
            return new Promise((resolve) => {
                let topic = '';
                modal.getRoot().on(ModalEvents.save, () => {
                    topic = input.value.trim();
                });
                modal.getRoot().on(ModalEvents.hidden, () => resolve(topic));
                modal.getRoot().on(ModalEvents.shown, () => input.focus());
                modal.show();
            });
        }

        /**
         * Generate content using AI.
         *
         * @param {string} prompt The user prompt.
         * @param {string} type Content type (info/quiz).
         * @return {Promise}
         */
        async generateContent(prompt, type) {
            return Ajax.call([{
                methodname: 'mod_gear_generate_content',
                args: {
                    gearid: this.gearid,
                    prompt: prompt,
                    type: type
                }
            }])[0].then(async(response) => {
                if (!response.success) {
                    throw new Error(await Str.get_string('generationfailed', 'mod_gear'));
                }
                return response.content;
            });
        }
    }


/**
 * Initialize the GEAR viewer.
 *
 * @param {Object} options Configuration options
 */
function init(options) {
    var viewerInstance = new GearViewer(options);

    // Start sync if enabled.
    var sync = new SyncManager(viewerInstance);

    // UI listeners for collaboration (Voice & Chat).
    document.addEventListener('gear:scene:loaded', (e) => {
        if (e.detail.cmid == options.cmid) {
            if (!options.collab) {
                // Collaborative mode is off: no shared session, no WebRTC, no chat; hide its controls.
                ['gear-voice-btn-', 'gear-chat-toggle-btn-', 'gear-chat-panel-'].forEach((prefix) => {
                    var el = document.getElementById(prefix + options.cmid);
                    if (el) {
                        el.style.display = 'none';
                    }
                });
                return;
            }
            sync.start();

            // Voice chat button listener.
            var voiceBtn = document.getElementById('gear-voice-btn-' + options.cmid);
            if (voiceBtn) {
                voiceBtn.addEventListener('click', () => {
                    sync.joinVoiceChat();
                });
            }

            // Chat UI listeners.
            var chatToggleBtn = document.getElementById('gear-chat-toggle-btn-' + options.cmid);
            var chatPanel = document.getElementById('gear-chat-panel-' + options.cmid);
            var chatCloseBtn = document.getElementById('gear-chat-close-' + options.cmid);
            var chatInput = document.getElementById('gear-chat-input-' + options.cmid);
            var chatSend = document.getElementById('gear-chat-send-' + options.cmid);

            if (chatToggleBtn && chatPanel) {
                chatToggleBtn.addEventListener('click', () => {
                    chatPanel.classList.toggle('d-none');
                    if (!chatPanel.classList.contains('d-none')) {
                        chatInput.focus();
                    }
                });
                chatCloseBtn.addEventListener('click', () => {
                    chatPanel.classList.add('d-none');
                });

                chatSend.addEventListener('click', () => {
                    if (chatInput.value.trim() !== '') {
                        sync.sendChatMessage(chatInput.value.trim());
                        chatInput.value = '';
                    }
                });
                chatInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter' && chatInput.value.trim() !== '') {
                        sync.sendChatMessage(chatInput.value.trim());
                        chatInput.value = '';
                    }
                });
            }
        }
    });
}

// Export module for Moodle AMD (Rollup will convert to AMD format).
export default {
    init: init
};
