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

// Moodle AMD dependencies (external - loaded via RequireJS at runtime).
import $ from 'jquery';
import Ajax from 'core/ajax';
import Notification from 'core/notification';
import Str from 'core/str';
import Templates from 'core/templates';

/* global Peer */

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
            this.hotspotScale = (this.config.camera && this.config.camera.hotspotScale) || 1.0;
            this.hotspotColor = (this.config.camera && this.config.camera.hotspotColor) || '#6366f1';
            this.arEnabled = options.ar_enabled || false;
            this.vrEnabled = options.vr_enabled || false;
            this.modelsData = [];
            this.hotspotsData = [];
            this.hotspotsData = [];
            this.completedQuizzes = []; // Track gamification progress
            this.canManage = options.canmanage || false;
            this.userid = options.userid || 0; // The current user ID for WebRTC

            this.container = document.getElementById('gear-viewer-' + this.cmid);
            this.canvas = document.getElementById('gear-canvas-' + this.cmid);

            this.isFullscreen = false;
            this.isAutoRotating = false;
            this.scene = null;
            this.camera = null;
            this.renderer = null;
            this.controls = null;
            this.model = null;
            this.hotspotMeshes = [];
            this.raycaster = null;
            this.mouse = new THREE.Vector2();
            this.audioListener = null;
            this.modelContainer = new THREE.Group();
            this.movingHotspotId = null; // Track hotspot being moved.

            this.init();
        }

        /**
         * Initialize the viewer.
         */
        async init() {
            try {
                await this.loadThreeJS();
                this.setupScene();
                this.setupControls();
                this.setupRaycaster();
                this.setupEventListeners();
                
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
         * Fetch models and hotspots from the server.
         */
        async fetchSceneData() {
            try {
                const response = await Ajax.call([{
                    methodname: 'mod_gear_get_scene_data',
                    args: { gearid: this.gearid }
                }])[0];

                this.modelsData = response.models || [];
                this.hotspotsData = response.hotspots || [];

                // Parse position and config for hotspots.
                this.hotspotsData.forEach(h => {
                    if (typeof h.position === 'string') {
                        try { h.position = JSON.parse(h.position); } catch (e) { h.position = {x: 0, y: 0, z: 0}; }
                    }
                    if (typeof h.config === 'string') {
                        try { h.config = JSON.parse(h.config); } catch (e) { h.config = {}; }
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

            // Add resize handler.
            window.addEventListener('resize', () => this.onResize());
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
            }).catch(Notification.exception);
        }

        /**
         * Setup event listeners for the overlay controls.
         */
        setupOverlayEventListeners() {
            var overlay = document.getElementById('gear-scene-overlay-' + this.cmid);
            if (!overlay) return;

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
            if (!this.hotspotMeshes) return;
            this.hotspotMeshes.forEach(mesh => {
                mesh.scale.set(this.hotspotScale, this.hotspotScale, this.hotspotScale);
            });
        }

        /**
         * Update all existing hotspots with current color.
         */
        updateHotspotsColor() {
            if (!this.hotspotMeshes) return;
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
                        hotspotColor: this.hotspotColor
                    })
                }
            }])[0];

            // 2. Save Model Transform (Main model).
            let modelPromise = Promise.resolve();
            if (this.model && this.modelsData.length > 0) {
                modelPromise = Ajax.call([{
                    methodname: 'mod_gear_save_model_transform',
                    args: {
                        id: this.modelsData[0].id,
                        position: JSON.stringify({x: this.model.position.x, y: this.model.position.y, z: this.model.position.z}),
                        rotation: JSON.stringify({x: this.model.rotation.x, y: this.model.rotation.y, z: this.model.rotation.z}),
                        scale: this.model.scale.x
                    }
                }])[0];
            }

            Promise.all([scenePromise, modelPromise]).then(async () => {
                Notification.addNotification({
                    message: await Str.get_string('saveviewsuccess', 'mod_gear'),
                    type: 'success'
                });
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
                    modal.querySelector('.close').addEventListener('click', () => {
                        modal.classList.remove('active');
                        modal.style.display = 'none';
                    });

                    modal.classList.add('active');
                    modal.style.display = 'flex';
                }).catch(Notification.exception);
            } else {
                modal.classList.add('active');
                modal.style.display = 'flex';
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
                    modal.querySelector('.close').addEventListener('click', () => {
                        modal.classList.remove('active');
                        modal.style.display = 'none';
                    });

                    this.fetchAndRenderLeaderboard(modal);
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
             modal.classList.add('active');
             modal.style.display = 'flex';
             var content = modal.querySelector('.gear-leaderboard-content');
             content.innerHTML = '<div class="text-center"><i class="fa fa-spinner fa-spin"></i> ' + await Str.get_string('loading', 'mod_gear') + '</div>';
             
             // Fetch data.
             Ajax.call([{
                methodname: 'mod_gear_get_leaderboard',
                args: {
                    gearid: this.gearid,
                    limit: 10
                }
            }])[0].then((scores) => {
                this.renderLeaderboardTable(content, scores);
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
                has_scores: scores.length > 0,
                scores: scores.map((entry, index) => {
                    var badge = '';
                    if (index === 0) badge = '🥇';
                    else if (index === 1) badge = '🥈';
                    else if (index === 2) badge = '🥉';
                    
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
            }).catch(Notification.exception);
        }

        /**
         * Setup AR button with WebXR check.
         *
         * @param {HTMLElement} button AR button element
         */
        async setupARButton(button) {
            var supported;
            if ('xr' in navigator) {
                supported = await navigator.xr.isSessionSupported('immersive-ar');
                if (!supported) {
                    button.disabled = true;
                    button.title = await Str.get_string('arnotsupported', 'mod_gear');
                } else {
                    button.addEventListener('click', () => this.startARSession());
                }
            } else {
                button.disabled = true;
            }
        }

        /**
         * Setup VR button with WebXR check.
         *
         * @param {HTMLElement} button VR button element
         */
        async setupVRButton(button) {
            var supported;
            if ('xr' in navigator) {
                supported = await navigator.xr.isSessionSupported('immersive-vr');
                if (!supported) {
                    button.disabled = true;
                    button.title = await Str.get_string('webxrnotsupported', 'mod_gear');
                } else {
                    button.addEventListener('click', () => this.startVRSession());
                }
            } else {
                button.disabled = true;
            }
        }

        /**
         * Load 3D models from config data.
         */
        async loadModels() {
            var loader;
            var gltf;

            try {
                if (this.modelsData && this.modelsData.length > 0) {
                    loader = new GLTFLoader();

                    for (const modelData of this.modelsData) {
                        gltf = await new Promise((resolve, reject) => {
                            loader.load(modelData.url, resolve, undefined, reject);
                        });

                        this.model = gltf.scene;

                        // Apply saved transform if available.
                        if (modelData.position) {
                            try {
                                const p = (typeof modelData.position === 'string') ? JSON.parse(modelData.position) : modelData.position;
                                this.model.position.set(p.x, p.y, p.z);
                            } catch (e) { window.console.warn('GEAR: Failed to parse model position', e); }
                        }
                        if (modelData.rotation) {
                            try {
                                const r = (typeof modelData.rotation === 'string') ? JSON.parse(modelData.rotation) : modelData.rotation;
                                this.model.rotation.set(r.x, r.y, r.z);
                            } catch (e) { window.console.warn('GEAR: Failed to parse model rotation', e); }
                        }
                        if (modelData.scale) {
                            this.model.scale.setScalar(parseFloat(modelData.scale));
                        } else {
                            this.model.scale.setScalar(1);
                        }

                        this.modelContainer.add(this.model);

                        // If scene config has saved camera, use it, otherwise center.
                        if (this.config.camera && this.config.camera.position) {
                            const cp = this.config.camera.position;
                            const ct = this.config.camera.target || [0, 0, 0];
                            this.camera.position.set(cp[0], cp[1], cp[2]);
                            this.controls.target.set(ct[0], ct[1], ct[2]);
                            this.controls.update();
                        } else {
                            this.centerCameraOnModel(this.model);
                        }
                    }

                    // Mark as loaded.
                    this.container.classList.add('loaded');
                } else {
                    // No models uploaded yet - show placeholder.
                    this.addPlaceholderModel();
                    this.container.classList.add('loaded');
                }
            } catch (error) {
                // Error loading model - show placeholder.
                window.console.error('GEAR: Error loading model:', error);
                this.addPlaceholderModel();
                this.container.classList.add('loaded');
            }
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
                if (this.isAutoRotating) {
                    this.modelContainer.rotation.y += 0.005;
                }

                this.controls.update();
                this.renderer.render(this.scene, this.camera);
            });
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

                    var moveIntersects = this.raycaster.intersectObject(this.model, true);
                    if (moveIntersects.length > 0) {
                        var worldPoint = moveIntersects[0].point;
                        var localPoint = this.modelContainer.worldToLocal(worldPoint.clone());
                        this.updateHotspotPosition(this.movingHotspotId, localPoint);
                        return;
                    }
                }

                // Shift+Click to add new hotspot (managers only).
                if (event.shiftKey && this.canManage && this.model && this.hotspotsEnabled) {
                    var modelIntersects = this.raycaster.intersectObject(this.model, true);
                    if (modelIntersects.length > 0) {
                        var worldPoint = modelIntersects[0].point;
                        var localPoint = this.modelContainer.worldToLocal(worldPoint.clone());
                        this.showAddHotspotForm(localPoint);
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

            this.setupVRControllers();
        }

        /**
         * Setup WebXR Controllers for VR hand interactions.
         */
        setupVRControllers() {
            var geometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, 0, -5)
            ]);
            var lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
            
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
                        
                        // Toggle audio in VR directly since standard DOM popups are hard to click inside headset.
                        if (hotspotMesh.userData.type === 'audio' && hotspotMesh.children.length > 0) {
                             var audio = hotspotMesh.children[0];
                             if (audio.isPlaying) {
                                 audio.pause();
                             } else {
                                 audio.play();
                             }
                        }
                    }
                }
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
            if (!hotspot) return;

            var position = { x: newPoint.x, y: newPoint.y, z: newPoint.z };

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
            }])[0].then(async () => {
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
            }).catch(Notification.exception);
        }

        /**
         * Load hotspots from data.
         */
        loadHotspots() {
            var geometry;
            var material;
            var sphere;
            var pos;

            if (!this.hotspotsData || this.hotspotsData.length === 0) {
                this.renderHotspotsNav();
                return;
            }

            // Hotspot sphere geometry.
            geometry = new THREE.SphereGeometry(0.08, 16, 16);
            material = new THREE.MeshBasicMaterial({
                color: new THREE.Color(this.hotspotColor),
                transparent: true,
                opacity: 0.9
            });

            for (const hotspot of this.hotspotsData) {
                sphere = new THREE.Mesh(geometry, material.clone());
                sphere.scale.set(this.hotspotScale, this.hotspotScale, this.hotspotScale);
                pos = hotspot.position || {x: 0, y: 0, z: 0};
                sphere.position.set(pos.x, pos.y, pos.z);
                sphere.userData = hotspot;

                // Branching logic
                if (hotspot.config) {
                    var hConfig = (typeof hotspot.config === 'string') ? JSON.parse(hotspot.config) : hotspot.config;
                    if (hConfig.requires_id && !this.completedQuizzes.includes(parseInt(hConfig.requires_id, 10)) && !this.canManage) {
                        sphere.visible = false;
                        sphere.userData.requires_id = parseInt(hConfig.requires_id, 10);
                    }
                }
                
                // Audio Support.
                if (hotspot.type === 'audio' && hotspot.config) {
                    var config = (typeof hotspot.config === 'string') ? JSON.parse(hotspot.config) : hotspot.config;
                    if (config.audioUrl) {
                        try {
                            var sound = new THREE.PositionalAudio(this.audioListener);
                            var audioLoader = new THREE.AudioLoader();
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
                args: { id: id }
            }])[0].then(async () => {
                // Remove from data array.
                this.hotspotsData = this.hotspotsData.filter(h => h.id != id);
                
                // Remove from scene.
                var meshIdx = this.hotspotMeshes.findIndex(m => m.userData.id == id);
                if (meshIdx !== -1) {
                    var mesh = this.hotspotMeshes[meshIdx];
                    this.modelContainer.remove(mesh);
                    if (mesh.geometry) mesh.geometry.dispose();
                    if (mesh.material) mesh.material.dispose();
                    this.hotspotMeshes.splice(meshIdx, 1);
                }

                // Refresh Nav.
                this.renderHotspotsNav();

                Notification.addNotification({
                    message: await Str.get_string('hotspotdeleted', 'mod_gear'),
                    type: 'success'
                });
            }).catch(Notification.exception);
        }

        /**
         * Render hotspot list in the floating dropdown.
         */
        async renderHotspotsNav() {
            var menu = this.container.querySelector('.gear-hotspots-menu');
            if (!menu) return;

            menu.innerHTML = '';
            
            if (this.hotspotsData.length === 0) {
                menu.innerHTML = '<span class="dropdown-item-text text-muted">' + await Str.get_string('nohotspots', 'mod_gear') + '</span>';
                return;
            }

            for (const hotspot of this.hotspotsData) {
                // Check branching
                if (hotspot.config) {
                     var config = (typeof hotspot.config === 'string') ? JSON.parse(hotspot.config) : hotspot.config;
                     if (config.requires_id && !this.completedQuizzes.includes(parseInt(config.requires_id, 10)) && !this.canManage) {
                         continue; // Hide from students if locked
                     }
                }

                var icon = 'fa-dot-circle';
                if (hotspot.type === 'quiz') icon = 'fa-question-circle';
                if (hotspot.type === 'audio') icon = 'fa-volume-up';
                if (hotspot.type === 'video') icon = 'fa-video';
                if (hotspot.type === 'teleport') icon = 'fa-street-view';

                try {
                    const html = await Templates.render('mod_gear/hotspot_nav_item', {
                        id: hotspot.id,
                        icon: icon,
                        title: hotspot.title || await Str.get_string('point', 'mod_gear'),
                        canManage: this.canManage
                    });
                    
                    Templates.appendNodeContents(menu, html, "");
                    var item = document.getElementById('gear-hotspot-nav-item-' + hotspot.id);
                    if (item) {
                        item.addEventListener('click', (e) => {
                            e.stopPropagation();
                            this.focusHotspot(hotspot.id);
                            // Close dropdown after selection.
                            var dropdown = item.closest('.dropdown');
                            if (dropdown) {
                                dropdown.classList.remove('show');
                                dropdown.querySelector('.dropdown-menu').classList.remove('show');
                            }
                        });

                        if (this.canManage) {
                            var editBtn = document.getElementById('gear-hotspot-nav-edit-' + hotspot.id);
                            if (editBtn) {
                                editBtn.addEventListener('click', (e) => {
                                    e.stopPropagation();
                                    var pos = hotspot.position || {x: 0, y: 0, z: 0};
                                    this.showAddHotspotForm({x: pos.x, y: pos.y, z: pos.z}, hotspot);
                                    // Close dropdown
                                    var dropdown = item.closest('.dropdown');
                                    if (dropdown) {
                                        dropdown.classList.remove('show');
                                        dropdown.querySelector('.dropdown-menu').classList.remove('show');
                                    }
                                });
                            }

                            var deleteBtn = document.getElementById('gear-hotspot-nav-delete-' + hotspot.id);
                            if (deleteBtn) {
                                deleteBtn.addEventListener('click', async (e) => {
                                    e.stopPropagation();
                                    if (window.confirm(await Str.get_string('deletehotspotconfirm', 'mod_gear'))) {
                                        this.deleteHotspot(hotspot.id);
                                    }
                                });
                            }
                        }
                    }
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
            
            if (!hotspotData || !mesh) return;

            // Highlight in Nav.
            document.querySelectorAll('.gear-hotspot-nav-item').forEach(el => el.classList.remove('active'));
            var navItem = document.getElementById('gear-hotspot-nav-item-' + hotspotId);
            if (navItem) {
                navItem.classList.add('active');
                navItem.scrollIntoView({ behavior: 'smooth', inline: 'center' });
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
            this.blinkInterval = setInterval(() => {
                mesh.visible = !mesh.visible;
            }, 300);
            
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
                    audioText: hotspot.sound.isPlaying ? Str.get_string('audio_pause', 'mod_gear') : Str.get_string('audio_play', 'mod_gear')
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

                    popup.querySelector('.gear-move-hotspot')?.addEventListener('click', async (e) => {
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

                    popup.querySelector('.gear-delete-hotspot')?.addEventListener('click', async () => {
                        if (window.confirm(await Str.get_string('deletehotspotconfirm', 'mod_gear'))) {
                            this.deleteHotspot(hotspot.id);
                            closePopup();
                        }
                    });
                }

                if (hotspot.type === 'quiz') {
                    this.renderQuizInPopup(popup, hotspot);
                } else if (hotspot.type === 'audio' && hotspot.sound) {
                    var toggleBtn = popup.querySelector('.gear-audio-toggle');
                    toggleBtn.addEventListener('click', async () => {
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
                            var div = document.createElement('div');
                            div.innerHTML = hotspot.content;
                            var plainText = (hotspot.title || '') + ". " + (div.textContent || div.innerText || '');
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
                    navItem.scrollIntoView({ behavior: 'smooth', inline: 'center' });
                }

                // Track interaction.
                this.trackEvent('hotspot_click', {hotspotId: hotspot.id, title: hotspot.title});

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
                posX: point.x.toFixed(3),
                posY: point.y.toFixed(3),
                posZ: point.z.toFixed(3),
                isInfo: true
            };

            var quizOptions = this.hotspotsData
                .filter(h => h.type === 'quiz' && (!hotspotToEdit || h.id != hotspotToEdit.id))
                .map(h => ({
                    id: h.id,
                    title: h.title,
                    selected: hotspotToEdit && hotspotToEdit.config && (typeof hotspotToEdit.config === 'string' ? JSON.parse(hotspotToEdit.config) : hotspotToEdit.config).requires_id == h.id
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

                if (hotspotToEdit.type === 'quiz' && hotspotToEdit.config) {
                    var config = (typeof hotspotToEdit.config === 'string') ? JSON.parse(hotspotToEdit.config) : hotspotToEdit.config;
                    context.options = config.options ? config.options.join(', ') : '';
                    context.correctAnswer = config.correctAnswer || 0;
                    context.points = config.points || 10;
                } else if (hotspotToEdit.type === 'audio' && hotspotToEdit.config) {
                    var config = (typeof hotspotToEdit.config === 'string') ? JSON.parse(hotspotToEdit.config) : hotspotToEdit.config;
                    context.audioUrl = config.audioUrl || '';
                } else if (hotspotToEdit.type === 'video' && hotspotToEdit.config) {
                    var config = (typeof hotspotToEdit.config === 'string') ? JSON.parse(hotspotToEdit.config) : hotspotToEdit.config;
                    context.videoUrl = config.videoUrl || '';
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

            }).catch(Notification.exception);
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
            
            typeSelect.addEventListener('change', () => {
                quizFields.style.display = (typeSelect.value === 'quiz') ? 'block' : 'none';
                audioFields.style.display = (typeSelect.value === 'audio') ? 'block' : 'none';
                videoFields.style.display = (typeSelect.value === 'video') ? 'block' : 'none';
            });

            // AI Assist button.
            var aiBtn = form.querySelector('.gear-ai-btn');
            aiBtn.addEventListener('click', async () => {
                var type = typeSelect.value;
                var prompt = window.prompt(await Str.get_string('ai_prompt', 'mod_gear'), "");
                if (prompt) {
                    aiBtn.disabled = true;
                    aiBtn.textContent = await Str.get_string('generating', 'mod_gear');
                    this.generateContent(prompt, type).then(async (data) => {
                        aiBtn.disabled = false;
                        aiBtn.textContent = await Str.get_string('aiassist', 'mod_gear');
                        
                        if (type === 'quiz') {
                            try {
                                var json = JSON.parse(data);
                                form.querySelector('#gear-hotspot-input-title-' + this.cmid).value = json.question || '';
                                form.querySelector('#gear-hotspot-input-options-' + this.cmid).value = json.options ? json.options.join(', ') : '';
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
                    }).catch(async (err) => {
                        aiBtn.disabled = false;
                        aiBtn.textContent = await Str.get_string('aiassist', 'mod_gear');
                        Notification.alert(
                            await Str.get_string('error', 'core'),
                            err.message || await Str.get_string('generationfailed', 'mod_gear')
                        );
                    });
                }
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
                config.requires_id = requiresInput.value;
            }
            
            if (type === 'quiz') {
                var optionsStr = form.querySelector('#gear-hotspot-input-options-' + this.cmid).value;
                var correct = form.querySelector('#gear-hotspot-input-correct-' + this.cmid).value;
                var points = form.querySelector('#gear-hotspot-input-points-' + this.cmid).value;
                
                config.options = optionsStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
                config.correctAnswer = parseInt(correct, 10);
                config.points = parseInt(points, 10);
                
                if (config.options.length < 2) {
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
                    config: JSON.stringify(config)
                }
            }])[0].then(async (response) => {
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
         * Render quiz interface in popup.
         * 
         * @param {HTMLElement} popup
         * @param {Object} hotspot
         */
        /**
         * Render quiz content using mustache.
         * 
         * @param {HTMLElement} popup
         * @param {Object} hotspot
         */
        renderQuizInPopup(popup, hotspot) {
            var contentDiv = popup.querySelector('.gear-hotspot-content');
            var config = (typeof hotspot.config === 'string') ? JSON.parse(hotspot.config) : hotspot.config;
            
            if (!config || !config.options) {
                Str.get_string('quiz_invalid', 'mod_gear').then((msg) => {
                    contentDiv.innerHTML += '<p class="text-danger">' + msg + '</p>';
                });
                return;
            }

            var context = {
                id: hotspot.id,
                options: config.options.map((opt, index) => ({
                    index: index,
                    text: opt
                }))
            };

            Templates.render('mod_gear/quiz', context).then((html, js) => {
                Templates.appendNodeContents(contentDiv, html, js);
                
                var submitBtn = popup.querySelector('.gear-quiz-submit');
                submitBtn.addEventListener('click', async () => {
                    var selected = popup.querySelector('input[name="gear-quiz-option"]:checked');
                    if (!selected) {
                        Notification.alert(
                            await Str.get_string('warning', 'core'),
                            await Str.get_string('quiz_selectanswer', 'mod_gear')
                        );
                        return;
                    }
                    this.submitQuizAnswer(hotspot, selected.value, popup);
                });
            }).catch(Notification.exception);
        }

        /**
         * Submit quiz answer.
         */
        /**
         * Submit quiz answer.
         */
        submitQuizAnswer(hotspot, answer, popup) {
             Ajax.call([{
                methodname: 'mod_gear_submit_quiz',
                args: {
                    gearid: this.gearid,
                    hotspotid: hotspot.id,
                    answer: answer
                }
            }])[0].then(async (response) => {
                var feedbackDiv = popup.querySelector('.gear-quiz-feedback');
                var submitBtn = popup.querySelector('.gear-quiz-submit');
                
                if (response.correct) {
                    var msg = await Str.get_string('quiz_correct', 'mod_gear');
                    feedbackDiv.innerHTML = '<span class="badge badge-success">' + msg + '</span> +' + response.score + ' pts';
                    this.completedQuizzes.push(hotspot.id);
                    this.checkHotspotUnlocks();
                } else {
                    var msg = await Str.get_string('quiz_incorrect', 'mod_gear');
                    feedbackDiv.innerHTML = '<span class="badge badge-danger">' + msg + '</span>';
                }
                
                submitBtn.disabled = true;
            }).catch(Notification.exception);
        }

        /**
         * Check if gamification condition unlocks any hotspots
         */
        checkHotspotUnlocks() {
            let unlocked = false;
            if (this.hotspotMeshes) {
                this.hotspotMeshes.forEach(mesh => {
                    if (!mesh.visible && mesh.userData && mesh.userData.requires_id) {
                        if (this.completedQuizzes.includes(parseInt(mesh.userData.requires_id, 10))) {
                            mesh.visible = true;
                            unlocked = true;
                            // Add pop animation
                            mesh.scale.set(0.01, 0.01, 0.01);
                            let scaleTarget = this.hotspotScale;
                            let growth = setInterval(() => {
                                let curr = mesh.scale.x;
                                if (curr >= scaleTarget) {
                                    clearInterval(growth);
                                } else {
                                    mesh.scale.set(curr + 0.1, curr + 0.1, curr + 0.1);
                                }
                            }, 30);
                        }
                    }
                });
            }
            if (unlocked) {
                this.renderHotspotsNav();
            }
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
            }])[0].then(async (response) => {
                if (response.success) {
                    return response.content;
                } else {
                    return Promise.reject(await Str.get_string('generationfailed', 'mod_gear'));
                }
            });
        }
    }



    /**
     * SyncManager class for collaborative mode & WebRTC.
     */
    class SyncManager {
        constructor(viewer) {
            this.viewer = viewer;
            this.interval = null;
            this.avatars = {}; // Map of userid -> { mesh }
            this.lastPosition = null;
            this.lastRotation = null;
            
            // WebRTC
            this.peer = null;
            this.localStream = null;
            this.calls = {}; // peerId -> call
            this.dataConns = {}; // peerId -> dataConn
            this.voiceEnabled = false;
        }

        async initPeer() {
            if (this.peer) return;
            var myPeerId = 'mod_gear_' + this.viewer.gearid + '_' + this.viewer.userid;
            this.peer = new Peer(myPeerId);
            
            this.peer.on('call', (call) => {
                if (this.localStream) {
                    call.answer(this.localStream);
                } else {
                    call.answer(); // empty stream
                }
                this.handleCall(call);
            });

            this.peer.on('connection', (conn) => {
                this.handleDataConnection(conn);
            });
        }

        async joinVoiceChat() {
            if (this.voiceEnabled) return;
            try {
                this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                this.voiceEnabled = true;
                
                if (!this.peer) {
                    await this.initPeer();
                }
                
                var btn = document.getElementById('gear-voice-btn-' + this.viewer.cmid);
                if (btn) {
                    btn.querySelector('i').className = 'fa fa-microphone text-success';
                }
                
                Str.get_string('voicejoined', 'mod_gear').then(msg => {
                    Notification.addNotification({ message: msg, type: 'success' });
                });
            } catch (e) {
                Str.get_string('voicenotsupported', 'mod_gear').then(msg => {
                    Notification.alert('Error', msg);
                });
            }
        }

        handleCall(call) {
            call.on('stream', (remoteStream) => {
                var parts = call.peer.split('_');
                var peerUserId = parseInt(parts[parts.length - 1], 10);
                
                var avatar = this.avatars[peerUserId];
                // Only attach if avatar exists and doesn't already have audio
                if (avatar && !avatar.hasAudio) {
                    var sound = new THREE.PositionalAudio(this.viewer.audioListener);
                    // r128 PositionalAudio supports setMediaStreamSource
                    if (typeof sound.setMediaStreamSource === 'function') {
                        sound.setMediaStreamSource(remoteStream);
                    } else {
                        // Fallback
                        sound.setNodeSource(sound.context.createMediaStreamSource(remoteStream));
                    }
                    sound.setRefDistance(2);
                    avatar.mesh.add(sound);
                    avatar.hasAudio = true;
                }
            });
            this.calls[call.peer] = call;
        }

        handleDataConnection(conn) {
            conn.on('open', () => {
                this.dataConns[conn.peer] = conn;
            });
            conn.on('data', (data) => {
                this.displayChatMessage(data.sender, data.text, 'other');
            });
            conn.on('close', () => {
                delete this.dataConns[conn.peer];
            });
        }

        connectData(peerId) {
            if (this.dataConns[peerId]) return;
            var conn = this.peer.connect(peerId);
            this.handleDataConnection(conn);
        }

        sendChatMessage(text) {
            var msg = { sender: 'User ' + this.viewer.userid, text: text };
            Object.values(this.dataConns).forEach(conn => {
                if (conn.open) {
                    conn.send(msg);
                }
            });
            this.displayChatMessage('Me', text, 'self');
        }

        displayChatMessage(sender, text, type) {
            var messagesDiv = document.getElementById('gear-chat-messages-' + this.viewer.cmid);
            if (!messagesDiv) return;
            var msgDiv = document.createElement('div');
            msgDiv.className = 'gear-chat-msg ' + type;
            msgDiv.innerHTML = '<span class="gear-chat-sender">' + sender + '</span>' + text;
            messagesDiv.appendChild(msgDiv);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }

        start() {
            this.initPeer();
            this.interval = setInterval(() => this.sync(), 2000);
            this.sync(); // Initial call
        }

        stop() {
            if (this.interval) {
                clearInterval(this.interval);
                this.interval = null;
            }
        }

        sync() {
            if (!this.viewer.camera) return;

            // Use Three.js properties.
            var pos = this.viewer.camera.position;
            var rot = this.viewer.camera.rotation;

            // Only update if changed significantly? 
            // For now, send anyway to keep session alive (heartbeat).
            
            var posObj = { x: pos.x, y: pos.y, z: pos.z };
            var rotObj = { x: rot.x, y: rot.y, z: rot.z }; // Euler

            Ajax.call([{
                methodname: 'mod_gear_sync_session',
                args: {
                    gearid: this.viewer.gearid,
                    position: JSON.stringify(posObj),
                    rotation: JSON.stringify(rotObj)
                }
            }])[0].then((users) => {
                this.updateAvatars(users);
            }).catch((e) => {
                window.console.warn('Sync error', e); 
            });
        }

        updateAvatars(users) {
            var activeIds = new Set();
            
            users.forEach((user) => {
                activeIds.add(user.userid);
                
                if (!this.avatars[user.userid]) {
                    this.createAvatar(user);
                }
                
                this.updateAvatarState(user);
            });
            
            // Remove disconnected users.
            Object.keys(this.avatars).forEach((id) => {
                if (!activeIds.has(parseInt(id))) {
                    this.removeAvatar(id);
                }
            });

            // Connect uncalled voice peers
            if (this.peer) {
                users.forEach((user) => {
                    if (user.userid != this.viewer.userid) {
                        var pId = 'mod_gear_' + this.viewer.gearid + '_' + user.userid;
                        if (this.voiceEnabled && !this.calls[pId]) {
                            var call = this.peer.call(pId, this.localStream);
                            if (call) {
                                this.handleCall(call);
                            } else {
                                this.calls[pId] = null;
                            }
                        }
                        // Connect text chat
                        if (!this.dataConns[pId]) {
                            this.connectData(pId);
                        }
                    }
                });
            }
        }

        createAvatar(user) {
            // Create a group for the avatar.
            var group = new THREE.Group();
            
            // Simple avatar: Sphere representing head.
            var geometry = new THREE.SphereGeometry(0.3, 16, 16);
            var color = '#' + Math.floor(Math.random()*16777215).toString(16);
            var material = new THREE.MeshBasicMaterial({ color: color });
            var sphere = new THREE.Mesh(geometry, material);
            group.add(sphere);
            
            // Add to scene.
            this.viewer.scene.add(group);
            
            this.avatars[user.userid] = {
                mesh: group
            };
        }

        updateAvatarState(user) {
            var avatar = this.avatars[user.userid];
            if (!avatar) return;
            
            if (user.position) {
                try {
                    var pos = (typeof user.position === 'string') ? JSON.parse(user.position) : user.position;
                    avatar.mesh.position.set(pos.x, pos.y, pos.z);
                } catch(e) {
                    // Ignore parse error
                }
            }
            
            if (user.rotation) {
                 try {
                    var rot = (typeof user.rotation === 'string') ? JSON.parse(user.rotation) : user.rotation;
                    avatar.mesh.rotation.set(rot.x, rot.y, rot.z);
                } catch(e) {
                    // Ignore parse error
                }
            }
        }

        removeAvatar(userid) {
            var avatar = this.avatars[userid];
            if (avatar && avatar.mesh) {
                this.viewer.scene.remove(avatar.mesh);
                // Optional: dispose geometry/material.
            }
            delete this.avatars[userid];
            
            // Clean up WebRTC calls if disconnected
            var peerId = 'mod_gear_' + this.viewer.gearid + '_' + userid;
            if (this.calls[peerId]) {
                if (this.calls[peerId].close) this.calls[peerId].close();
                delete this.calls[peerId];
            }
            if (this.dataConns[peerId]) {
                if (this.dataConns[peerId].close) this.dataConns[peerId].close();
                delete this.dataConns[peerId];
            }
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
