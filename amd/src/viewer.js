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
            // Hotspot feature flags from scene config.
            if (this.config.hotspots && typeof this.config.hotspots.enabled !== 'undefined') {
                this.hotspotsEnabled = !!this.config.hotspots.enabled;
            } else {
                this.hotspotsEnabled = true;
            }
            this.hotspotsEditable = (this.config.hotspots && !!this.config.hotspots.edit) || false;
            this.arEnabled = options.ar_enabled || false;
            this.vrEnabled = options.vr_enabled || false;
            this.modelsData = options.models || [];
            this.hotspotsData = options.hotspots || [];
            this.canManage = options.canmanage || false;

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
                throw new Error('Three.js not loaded. Please check view.php.');
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

                // Shift+Click to add new hotspot (managers only).
                if (event.shiftKey && this.canManage && this.model && this.hotspotsEnabled) {
                    var modelIntersects = this.raycaster.intersectObject(this.model, true);
                    if (modelIntersects.length > 0) {
                        var point = modelIntersects[0].point;
                        this.showAddHotspotForm(point);
                        return;
                    }
                }

                // Normal click - check hotspots.
                var intersects = this.raycaster.intersectObjects(this.hotspotMeshes);

                if (intersects.length > 0) {
                    var hotspotMesh = intersects[0].object;
                    this.showHotspotPopup(hotspotMesh.userData);
                }
            });
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
                return;
            }

            // Hotspot sphere geometry.
            geometry = new THREE.SphereGeometry(0.08, 16, 16);
            material = new THREE.MeshBasicMaterial({
                color: 0x6366f1,
                transparent: true,
                opacity: 0.9
            });

            for (const hotspot of this.hotspotsData) {
                sphere = new THREE.Mesh(geometry, material.clone());
                pos = hotspot.position || {x: 0, y: 0, z: 0};
                sphere.position.set(pos.x, pos.y, pos.z);
                sphere.userData = hotspot;
                this.scene.add(sphere);
                this.hotspotMeshes.push(sphere);
            }
        }

        /**
         * Show hotspot popup.
         *
         * @param {Object} hotspot Hotspot data
         */
        showHotspotPopup(hotspot) {
            var popup = document.getElementById('gear-hotspot-popup-' + this.cmid);
            var title;
            var content;
            var closeBtn;

            if (!popup) {
                // Create popup if it doesn't exist.
                popup = document.createElement('div');
                popup.id = 'gear-hotspot-popup-' + this.cmid;
                popup.className = 'gear-hotspot-popup';
                popup.innerHTML = '<div class="gear-hotspot-popup-inner">' +
                    '<button class="gear-hotspot-close" aria-label="Close">&times;</button>' +
                    '<h4 class="gear-hotspot-title"></h4>' +
                    '<div class="gear-hotspot-content"></div>' +
                    '</div>';
                this.container.appendChild(popup);

                // Close button handler.
                closeBtn = popup.querySelector('.gear-hotspot-close');
                closeBtn.addEventListener('click', () => {
                    popup.classList.remove('active');
                });
            }

            // Update content.
            title = popup.querySelector('.gear-hotspot-title');
            content = popup.querySelector('.gear-hotspot-content');
            title.textContent = hotspot.title || 'Info';
            content.innerHTML = hotspot.content || '';

            // If editing is allowed for managers, add an Edit button.
            if (this.canManage && this.hotspotsEditable) {
                var editBtn = document.createElement('button');
                editBtn.className = 'btn btn-secondary gear-edit-hotspot';
                editBtn.textContent = 'Edit';
                editBtn.style.marginLeft = '0.5rem';
                // When clicked, open the form populated with hotspot data.
                editBtn.addEventListener('click', () => {
                    // Use the hotspot position to open the form in edit mode.
                    var pos = hotspot.position || {x: 0, y: 0, z: 0};
                    this.showAddHotspotForm({x: pos.x, y: pos.y, z: pos.z}, hotspot);
                    popup.classList.remove('active');
                });

                // Append edit button next to title if possible.
                var titleEl = popup.querySelector('.gear-hotspot-title');
                if (titleEl) {
                    titleEl.appendChild(editBtn);
                } else {
                    popup.querySelector('.gear-hotspot-popup-inner').appendChild(editBtn);
                }
            }

            // Show popup.
            popup.classList.add('active');

            // Track interaction.
            if (typeof this.trackInteraction === 'function') {
                this.trackInteraction('hotspot_click', {hotspotId: hotspot.id, title: hotspot.title});
            }
        }

        /**
         * Show form to add a new hotspot.
         *
         * @param {Object} point THREE.Vector3 position
         * @param {Object} [hotspotToEdit] Optional hotspot object when editing
         */
        showAddHotspotForm(point, hotspotToEdit) {
            var form = document.getElementById('gear-hotspot-form-' + this.cmid);
            var saveBtn;
            var cancelBtn;

            if (!form) {
                // Create form.
                form = document.createElement('div');
                form.id = 'gear-hotspot-form-' + this.cmid;
                form.className = 'gear-hotspot-popup active';
                form.innerHTML = '<div class="gear-hotspot-popup-inner gear-hotspot-form-inner">' +
                    '<h4 class="gear-hotspot-title">Add Hotspot</h4>' +
                    '<div class="gear-form-group">' +
                    '<label for="gear-hotspot-input-title-' + this.cmid + '">Title</label>' +
                    '<input type="text" id="gear-hotspot-input-title-' + this.cmid +
                    '" class="form-control" placeholder="Enter title">' +
                    '</div>' +
                    '<div class="gear-form-group">' +
                    '<label for="gear-hotspot-input-content-' + this.cmid + '">Content</label>' +
                    '<textarea id="gear-hotspot-input-content-' + this.cmid +
                    '" class="form-control" rows="3" placeholder="Enter content"></textarea>' +
                    '</div>' +
                    '<div class="gear-form-actions">' +
                    '<button type="button" class="btn btn-secondary gear-cancel-btn">Cancel</button>' +
                    '<button type="button" class="btn btn-primary gear-save-btn">Save</button>' +
                    '</div>' +
                    '</div>';
                this.container.appendChild(form);

                // Cancel button.
                cancelBtn = form.querySelector('.gear-cancel-btn');
                cancelBtn.addEventListener('click', () => {
                    form.classList.remove('active');
                });
            } else {
                // Reset form or populate for edit.
                form.querySelector('#gear-hotspot-input-title-' + this.cmid).value = '';
                form.querySelector('#gear-hotspot-input-content-' + this.cmid).value = '';
                form.removeAttribute('data-hotspot-id');
                form.classList.add('active');
            }

            // If editing an existing hotspot, populate fields and set id.
            if (hotspotToEdit) {
                form.querySelector('#gear-hotspot-input-title-' + this.cmid).value = hotspotToEdit.title || '';
                form.querySelector('#gear-hotspot-input-content-' + this.cmid).value = hotspotToEdit.content || '';
                form.dataset.hotspotId = hotspotToEdit.id;
                // Use hotspot position if present, otherwise provided point.
                var usedPos = hotspotToEdit.position || point;
                form.dataset.posX = usedPos.x.toFixed(3);
                form.dataset.posY = usedPos.y.toFixed(3);
                form.dataset.posZ = usedPos.z.toFixed(3);
            } else {
                // Store position for new hotspot.
                form.dataset.posX = point.x.toFixed(3);
                form.dataset.posY = point.y.toFixed(3);
                form.dataset.posZ = point.z.toFixed(3);
            }

            // Save button (re-bind to use current position).
            saveBtn = form.querySelector('.gear-save-btn');
            saveBtn.onclick = () => this.saveNewHotspot(form);
        }

        /**
         * Save a new hotspot via AJAX.
         *
         * @param {HTMLElement} form The form element
         */
        saveNewHotspot(form) {
            var titleInput = form.querySelector('#gear-hotspot-input-title-' + this.cmid);
            var contentInput = form.querySelector('#gear-hotspot-input-content-' + this.cmid);
            var title = titleInput.value.trim();
            var content = contentInput.value.trim();
            var position = {
                x: parseFloat(form.dataset.posX),
                y: parseFloat(form.dataset.posY),
                z: parseFloat(form.dataset.posZ)
            };

            if (!title) {
                Notification.alert('Error', 'Please enter a title');
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
                    type: 'info',
                    title: title,
                    content: content,
                    position: JSON.stringify(position),
                    icon: 'info'
                }
            }])[0].then((response) => {
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
                            // Update position if changed.
                            hm.position.set(position.x, position.y, position.z);
                            updated = true;
                            break;
                        }
                    }
                        if (!updated) {
                            let sphere = new THREE.Mesh(geometry, material);
                            sphere.position.set(position.x, position.y, position.z);
                            sphere.userData = {
                                id: response.id,
                                title: title,
                                content: content,
                                type: 'info'
                            };
                            this.scene.add(sphere);
                            this.hotspotMeshes.push(sphere);
                        }
                } else {
                        let sphere = new THREE.Mesh(geometry, material);
                        sphere.position.set(position.x, position.y, position.z);
                        sphere.userData = {
                            id: response.id,
                            title: title,
                            content: content,
                            type: 'info'
                        };
                        this.scene.add(sphere);
                        this.hotspotMeshes.push(sphere);
                }

                // Close form.
                form.classList.remove('active');
                Notification.addNotification({
                    message: 'Hotspot saved successfully',
                    type: 'success'
                });

                return response;
            }).catch(Notification.exception);
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
