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
            this.audioListener = null;

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
            
            // Leaderboard button (injected dynamically).
            this.setupLeaderboardButton();
        }

        /**
         * Setup Leaderboard button and modal.
         */
        setupLeaderboardButton() {
            var btn = document.createElement('button');
            btn.className = 'btn btn-secondary gear-control-btn gear-leaderboard-btn';
            btn.title = 'Leaderboard';
            btn.innerHTML = '<i class="fa fa-trophy"></i>';
            btn.style.position = 'absolute';
            btn.style.top = '10px';
            btn.style.right = '60px'; // Next to fullscreen button usually
            btn.style.zIndex = '1000';
            
            btn.addEventListener('click', () => this.showLeaderboard());
            
            // Append to container.
            this.container.appendChild(btn);
        }

        /**
         * Show Leaderboard modal.
         */
        showLeaderboard() {
            var modal = document.getElementById('gear-leaderboard-modal-' + this.cmid);
            if (!modal) {
                modal = this.createLeaderboardModal();
            }
            
            // Show modal with loading state.
             modal.classList.add('active');
             var content = modal.querySelector('.gear-leaderboard-content');
             content.innerHTML = '<div class="text-center"><i class="fa fa-spinner fa-spin"></i> Loading...</div>';
             
             // Fetch data.
             Ajax.call([{
                methodname: 'mod_gear_get_leaderboard',
                args: {
                    gearid: this.gearid,
                    limit: 10
                }
            }])[0].then((scores) => {
                this.renderLeaderboard(content, scores);
            }).catch(Notification.exception);
        }

        /**
         * Create Leaderboard modal element.
         */
        createLeaderboardModal() {
            var modal = document.createElement('div');
            modal.id = 'gear-leaderboard-modal-' + this.cmid;
            modal.className = 'gear-modal';
            // Simple overlay styles (can be moved to CSS).
            modal.style.position = 'absolute';
            modal.style.top = '0';
            modal.style.left = '0';
            modal.style.width = '100%';
            modal.style.height = '100%';
            modal.style.background = 'rgba(0,0,0,0.8)';
            modal.style.display = 'none';
            modal.style.zIndex = '2000';
            modal.style.justifyContent = 'center';
            modal.style.alignItems = 'center';
            
            modal.innerHTML = `
                <div class="gear-modal-dialog" style="background:white; padding:20px; border-radius:8px; max-width:500px; width:90%; position:relative;">
                    <button class="close" style="position:absolute; top:10px; right:10px;">&times;</button>
                    <h3><i class="fa fa-trophy text-warning"></i> Leaderboard</h3>
                    <div class="gear-leaderboard-content"></div>
                </div>
            `;
            
            // Close logic.
            modal.querySelector('.close').addEventListener('click', () => {
                modal.classList.remove('active');
                modal.style.display = 'none';
            });
            
            // Override display when active.
            var style = document.createElement('style');
            style.textContent = `#gear-leaderboard-modal-${this.cmid}.active { display: flex !important; }`;
            document.head.appendChild(style);
            
            this.container.appendChild(modal);
            return modal;
        }

        /**
         * Render leaderboard table.
         * @param {HTMLElement} container 
         * @param {Array} scores 
         */
        renderLeaderboard(container, scores) {
            if (scores.length === 0) {
                container.innerHTML = '<p class="text-muted text-center">No scores yet. Be the first!</p>';
                return;
            }
            
            var html = '<table class="table table-striped">';
            html += '<thead><tr><th>#</th><th>User</th><th>Score</th></tr></thead>';
            html += '<tbody>';
            
            scores.forEach((entry, index) => {
                var badge = '';
                if (index === 0) badge = '🥇';
                else if (index === 1) badge = '🥈';
                else if (index === 2) badge = '🥉';
                
                html += `<tr>
                    <td>${index + 1} ${badge}</td>
                    <td>${entry.fullname}</td>
                    <td><strong>${entry.score}</strong></td>
                </tr>`;
            });
            html += '</tbody></table>';
            
            container.innerHTML = html;
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

            if (hotspot.type === 'quiz') {
                this.renderQuizInPopup(popup, hotspot);
            } else if (hotspot.type === 'audio' && hotspot.sound) {
                // Add play/pause controls.
                var audioControls = document.createElement('div');
                audioControls.className = 'gear-audio-controls mt-2';
                var btnText = hotspot.sound.isPlaying ? 'Pause Audio' : 'Play Audio';
                var btnIcon = hotspot.sound.isPlaying ? 'fa-pause' : 'fa-play';
                
                audioControls.innerHTML = `
                    <button class="btn btn-sm btn-info gear-audio-toggle">
                        <i class="fa ${btnIcon}"></i> ${btnText}
                    </button>
                    <div class="small text-muted mt-1"><i class="fa fa-volume-up"></i> Spatial Audio</div>
                `;
                
                var toggleBtn = audioControls.querySelector('.gear-audio-toggle');
                toggleBtn.addEventListener('click', () => {
                   if (hotspot.sound.isPlaying) {
                       hotspot.sound.pause();
                       toggleBtn.innerHTML = '<i class="fa fa-play"></i> Play Audio';
                   } else {
                       hotspot.sound.play();
                       toggleBtn.innerHTML = '<i class="fa fa-pause"></i> Pause Audio';
                   }
                });
                
                content.appendChild(audioControls);
            }

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
                    '<label for="gear-hotspot-input-type-' + this.cmid + '">Type</label>' +
                    '<div class="d-flex">' +
                    '<select id="gear-hotspot-input-type-' + this.cmid + '" class="form-control mr-2">' +
                    '<option value="info">Info</option>' +
                    '<option value="quiz">Quiz</option>' +
                    '<option value="audio">Audio</option>' +
                    '</select>' +
                    '<button type="button" class="btn btn-info gear-ai-btn" title="AI Assist">✨ AI Assist</button>' +
                    '</div>' +
                    '</div>' +
                    '<div id="gear-hotspot-quiz-fields-' + this.cmid + '" style="display:none;">' +
                    '<div class="gear-form-group">' +
                    '<label for="gear-hotspot-input-options-' + this.cmid + '">Options (comma separated)</label>' +
                    '<input type="text" id="gear-hotspot-input-options-' + this.cmid +
                    '" class="form-control" placeholder="Option A, Option B, Option C">' +
                    '</div>' +
                    '<div class="gear-form-group">' +
                    '<label for="gear-hotspot-input-correct-' + this.cmid + '">Correct Answer (Index 0-N)</label>' +
                    '<input type="number" id="gear-hotspot-input-correct-' + this.cmid +
                    '" class="form-control" value="0" min="0">' +
                    '</div>' +
                    '<div class="gear-form-group">' +
                    '<label for="gear-hotspot-input-points-' + this.cmid + '">Points</label>' +
                    '<input type="number" id="gear-hotspot-input-points-' + this.cmid +
                    '" class="form-control" value="10" min="1">' +
                    '</div>' +
                    '</div>' +
                    '<div id="gear-hotspot-audio-fields-' + this.cmid + '" style="display:none;">' +
                    '<div class="gear-form-group">' +
                    '<label for="gear-hotspot-input-audiourl-' + this.cmid + '">Audio URL (MP3/WAV)</label>' +
                    '<input type="text" id="gear-hotspot-input-audiourl-' + this.cmid +
                    '" class="form-control" placeholder="https://example.com/audio.mp3">' +
                    '</div>' +
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

                // Type change handler.
                var typeSelect = form.querySelector('#gear-hotspot-input-type-' + this.cmid);
                var quizFields = form.querySelector('#gear-hotspot-quiz-fields-' + this.cmid);
                var audioFields = form.querySelector('#gear-hotspot-audio-fields-' + this.cmid);
                typeSelect.addEventListener('change', () => {
                    quizFields.style.display = (typeSelect.value === 'quiz') ? 'block' : 'none';
                    audioFields.style.display = (typeSelect.value === 'audio') ? 'block' : 'none';
                });

                // AI Assist button.
                var aiBtn = form.querySelector('.gear-ai-btn');
                aiBtn.addEventListener('click', () => {
                    var type = typeSelect.value;
                    var prompt = window.prompt("What should this hotspot be about?", "");
                    if (prompt) {
                        aiBtn.disabled = true;
                        aiBtn.textContent = 'Generating...';
                        this.generateContent(prompt, type).then((data) => {
                            aiBtn.disabled = false;
                            aiBtn.textContent = '✨ AI Assist';
                            
                            if (type === 'quiz') {
                                try {
                                    var json = JSON.parse(data);
                                    form.querySelector('#gear-hotspot-input-title-' + this.cmid).value = json.question || '';
                                    form.querySelector('#gear-hotspot-input-options-' + this.cmid).value = json.options ? json.options.join(', ') : '';
                                    form.querySelector('#gear-hotspot-input-correct-' + this.cmid).value = json.correct || 0;
                                } catch (e) {
                                    Notification.alert('Error', 'Failed to parse AI response');
                                }
                            } else if (type === 'info') {
                                form.querySelector('#gear-hotspot-input-title-' + this.cmid).value = prompt; // Use prompt as title
                                form.querySelector('#gear-hotspot-input-content-' + this.cmid).value = data;
                            }
                        }).catch((err) => {
                            aiBtn.disabled = false;
                            aiBtn.textContent = '✨ AI Assist';
                            Notification.alert('AI Error', err.message || 'Generation failed');
                        });
                    }
                });

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
                
                var typeSelect = form.querySelector('#gear-hotspot-input-type-' + this.cmid);
                typeSelect.value = hotspotToEdit.type || 'info';
                typeSelect.dispatchEvent(new Event('change'));

                if (hotspotToEdit.type === 'quiz' && hotspotToEdit.config) {
                    var config = (typeof hotspotToEdit.config === 'string') ? JSON.parse(hotspotToEdit.config) : hotspotToEdit.config;
                    form.querySelector('#gear-hotspot-input-options-' + this.cmid).value = config.options ? config.options.join(', ') : '';
                    form.querySelector('#gear-hotspot-input-correct-' + this.cmid).value = config.correctAnswer || 0;
                    form.querySelector('#gear-hotspot-input-points-' + this.cmid).value = config.points || 10;
                } else if (hotspotToEdit.type === 'audio' && hotspotToEdit.config) {
                    var config = (typeof hotspotToEdit.config === 'string') ? JSON.parse(hotspotToEdit.config) : hotspotToEdit.config;
                    form.querySelector('#gear-hotspot-input-audiourl-' + this.cmid).value = config.audioUrl || '';
                }
                
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
            
            var typeInput = form.querySelector('#gear-hotspot-input-type-' + this.cmid);
            var type = typeInput.value;
            var config = {};
            
            if (type === 'quiz') {
                var optionsStr = form.querySelector('#gear-hotspot-input-options-' + this.cmid).value;
                var correct = form.querySelector('#gear-hotspot-input-correct-' + this.cmid).value;
                var points = form.querySelector('#gear-hotspot-input-points-' + this.cmid).value;
                
                config.options = optionsStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
                config.correctAnswer = parseInt(correct, 10);
                config.points = parseInt(points, 10);
                
                if (config.options.length < 2) {
                     Notification.alert('Error', 'Please provide at least 2 options');
                     return;
                }
            }

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
                    type: type,
                    title: title,
                    content: content,
                    position: JSON.stringify(position),
                    icon: (type === 'quiz') ? 'question' : 'info',
                    config: JSON.stringify(config)
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
                            hm.userData.type = type;
                            hm.userData.icon = (type === 'quiz') ? 'question' : 'info';
                            hm.userData.config = JSON.stringify(config);
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
                                type: type,
                                icon: (type === 'quiz') ? 'question' : 'info',
                                config: JSON.stringify(config)
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
                            type: type,
                            icon: (type === 'quiz') ? 'question' : 'info',
                            config: JSON.stringify(config)
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


        /**
         * Render quiz interface in popup.
         * 
         * @param {HTMLElement} popup
         * @param {Object} hotspot
         */
        renderQuizInPopup(popup, hotspot) {
            var contentDiv = popup.querySelector('.gear-hotspot-content');
            var config = (typeof hotspot.config === 'string') ? JSON.parse(hotspot.config) : hotspot.config;
            
            if (!config || !config.options) {
                contentDiv.innerHTML += '<p class="text-danger">Invalid quiz configuration</p>';
                return;
            }

            var html = '<div class="gear-quiz-container">';
            html += '<form id="gear-quiz-form-' + hotspot.id + '">';
            
            config.options.forEach((opt, index) => {
                html += '<div class="form-check">';
                html += '<input class="form-check-input" type="radio" name="gear-quiz-option" id="q-opt-' + hotspot.id + '-' + index + '" value="' + index + '">';
                html += '<label class="form-check-label" for="q-opt-' + hotspot.id + '-' + index + '">' + opt + '</label>';
                html += '</div>';
            });
            
            html += '<button type="button" class="btn btn-primary btn-sm mt-2 gear-quiz-submit">Submit</button>';
            html += '<div class="gear-quiz-feedback mt-2"></div>';
            html += '</form></div>';
            
            contentDiv.innerHTML += html;
            
            var submitBtn = popup.querySelector('.gear-quiz-submit');
            submitBtn.addEventListener('click', () => {
                var selected = popup.querySelector('input[name="gear-quiz-option"]:checked');
                if (!selected) {
                    Notification.alert('Warning', 'Please select an answer');
                    return;
                }
                this.submitQuizAnswer(hotspot, selected.value, popup);
            });
        }

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
            }])[0].then((response) => {
                var feedbackDiv = popup.querySelector('.gear-quiz-feedback');
                var submitBtn = popup.querySelector('.gear-quiz-submit');
                
                if (response.correct) {
                    feedbackDiv.innerHTML = '<span class="badge badge-success">Correct!</span> +' + response.score + ' pts';
                } else {
                    feedbackDiv.innerHTML = '<span class="badge badge-danger">Incorrect</span>';
                }
                
                submitBtn.disabled = true;
                // update tracking/grades UI if necessary
            }).catch(Notification.exception);
        }
        /**
         * Generate content using AI.
         *
         * @param {string} prompt The user prompt.
         * @param {string} type Content type (info/quiz).
         * @return {Promise}
         */
        generateContent(prompt, type) {
            return Ajax.call([{
                methodname: 'mod_gear_generate_content',
                args: {
                    gearid: this.gearid,
                    prompt: prompt,
                    type: type
                }
            }])[0].then((response) => {
                if (response.success) {
                    return response.content;
                } else {
                    return Promise.reject('Generation failed');
                }
            });
        }
    }



    /**
     * SyncManager class for collaborative mode.
     */
    class SyncManager {
        constructor(viewer) {
            this.viewer = viewer;
            this.interval = null;
            this.avatars = {}; // Map of userid -> { mesh }
            this.lastPosition = null;
            this.lastRotation = null;
        }

        start() {
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
        }
        

    }

    return {
        /**
         * Initialize the GEAR viewer.
         *
         * @param {Object} options Configuration options
         */
        init: function(options) {
            var viewer = new GearViewer(options);
            
            // Start sync if enabled.
            var sync = new SyncManager(viewer);
            document.addEventListener('gear:scene:loaded', (e) => {
                if (e.detail.cmid == options.cmid) {
                    sync.start();
                }
            });
        }
    };
});
