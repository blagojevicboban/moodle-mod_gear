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

/* global THREE */

define(['jquery', 'core/ajax', 'core/notification', 'core/str'], function($, Ajax, Notification, Str) {
    'use strict';

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
            this.arEnabled = options.ar_enabled || false;
            this.vrEnabled = options.vr_enabled || false;
            this.modelsData = options.models || [];

            this.container = document.getElementById('gear-viewer-' + this.cmid);
            this.canvas = document.getElementById('gear-canvas-' + this.cmid);

            this.isFullscreen = false;
            this.isAutoRotating = false;
            this.scene = null;
            this.camera = null;
            this.renderer = null;
            this.controls = null;
            this.model = null;

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
                this.setupEventListeners();
                this.loadModels();
                this.animate();

                // Dispatch loaded event.
                var eventDetail = {cmid: this.cmid, gearid: this.gearid};
                document.dispatchEvent(new CustomEvent('gear:scene:loaded', {detail: eventDetail}));
            } catch (error) {
                Notification.exception(error);
            }
        }

        /**
         * Load Three.js library dynamically.
         */
        async loadThreeJS() {
            // Three.js should be loaded via lib folder or CDN.
            if (typeof THREE === 'undefined') {
                // Temporarily disable AMD to prevent Three.js conflict with RequireJS.
                var originalDefine = window.define;
                window.define = undefined;

                try {
                    // Load from CDN as fallback.
                    await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.150.0/build/three.min.js');
                    await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.150.0/examples/js/controls/OrbitControls.js');
                    await this.loadScript('https://cdn.jsdelivr.net/npm/three@0.150.0/examples/js/loaders/GLTFLoader.js');
                } finally {
                    // Restore AMD.
                    window.define = originalDefine;
                }
            }
        }

        /**
         * Load a script dynamically.
         *
         * @param {string} src Script URL
         * @returns {Promise} Promise that resolves when script is loaded
         */
        loadScript(src) {
            return new Promise((resolve, reject) => {
                var script = document.createElement('script');
                script.src = src;
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
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

            // Create renderer.
            this.renderer = new THREE.WebGLRenderer({
                canvas: this.canvas,
                antialias: true,
                alpha: true
            });
            this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
            this.renderer.setPixelRatio(window.devicePixelRatio);
            this.renderer.outputEncoding = THREE.sRGBEncoding;
            this.renderer.xr.enabled = true;

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
            this.controls = new THREE.OrbitControls(this.camera, this.canvas);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.screenSpacePanning = false;
            this.controls.minDistance = 0.5;
            this.controls.maxDistance = 50;
            this.controls.maxPolarAngle = Math.PI;
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
                    loader = new THREE.GLTFLoader();

                    for (const modelData of this.modelsData) {
                        gltf = await new Promise((resolve, reject) => {
                            loader.load(modelData.url, resolve, undefined, reject);
                        });

                        this.model = gltf.scene;

                        // Apply default scale.
                        this.model.scale.setScalar(1);

                        this.scene.add(this.model);

                        // Center camera on model.
                        this.centerCameraOnModel(this.model);
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
            this.scene.add(this.model);
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
                if (this.isAutoRotating && this.model) {
                    this.model.rotation.y += 0.005;
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
    }

    return {
        /**
         * Initialize the GEAR viewer.
         *
         * @param {Object} options Configuration options
         */
        init: function(options) {
            new GearViewer(options);
        }
    };
});
