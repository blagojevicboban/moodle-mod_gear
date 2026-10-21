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
 * 3D tools for mod_gear: Snapshot export, clipping planes (cross-section) and 3D measurement.
 *
 * @module     mod_gear/tools
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import * as THREE from 'three';
import Notification from 'core/notification';
import Str from 'core/str';

const STRINGS = [
    'clipping_axis', 'clipping_enable', 'clipping_flip', 'clipping_offset', 'clipping_plane',
    'measure_clear', 'measure_distance', 'measure_hint', 'measure_tool',
    'snapshot', 'snapshot_saved',
];

/**
 * Interactive tools for a GEAR 3D scene.
 */
export default class SceneTools {
    /**
     * Constructor.
     *
     * @param {Object} viewer The GearViewer instance.
     */
    constructor(viewer) {
        this.viewer = viewer;
        this.strings = {};

        // Snapshot.
        this.snapshotBtn = null;

        // Cross-section / Clipping plane.
        this.clippingBtn = null;
        this.clippingPanel = null;
        this.clippingActive = false;
        this.clippingAxis = 'y';
        this.clippingOffset = 0;
        this.clippingInverted = false;
        this.clippingPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
        this.modelBounds = null;

        // Measurement tool.
        this.measureBtn = null;
        this.measuring = false;
        this.measurePoints = [];
        this.measureMarkers = [];
        this.measureLine = null;
        this.measureLabel = null;
        this.previewLine = null;

        this.onPointerDown = (e) => this.handlePointerDown(e);
        this.onPointerMove = (e) => this.handlePointerMove(e);
        this.onKeyDown = (e) => this.handleKeyDown(e);
    }

    /**
     * Load localized language strings and setup tool event listeners.
     *
     * @returns {Promise<void>}
     */
    async init() {
        const requests = STRINGS.map((key) => ({key, component: 'mod_gear'}));
        const values = await Str.get_strings(requests);
        STRINGS.forEach((key, index) => {
            this.strings[key] = values[index];
        });

        const cmid = this.viewer.cmid;
        this.snapshotBtn = document.getElementById('gear-snapshot-' + cmid);
        if (this.snapshotBtn) {
            this.snapshotBtn.addEventListener('click', () => this.takeSnapshot());
        }

        this.clippingBtn = document.getElementById('gear-clipping-' + cmid);
        if (this.clippingBtn) {
            this.clippingBtn.addEventListener('click', () => this.toggleClippingPanel());
        }

        this.measureBtn = document.getElementById('gear-measure-' + cmid);
        if (this.measureBtn) {
            this.measureBtn.addEventListener('click', () => this.toggleMeasureMode());
        }

        // Restore saved clipping settings from scene config if available.
        if (this.viewer.config && this.viewer.config.clipping) {
            const cfg = this.viewer.config.clipping;
            this.clippingActive = Boolean(cfg.enabled);
            this.clippingAxis = cfg.axis || 'y';
            this.clippingOffset = typeof cfg.offset === 'number' ? cfg.offset : 0;
            this.clippingInverted = Boolean(cfg.inverted);
        }

        document.addEventListener('keydown', this.onKeyDown);
    }

    /**
     * Called when 3D models have loaded in the scene.
     */
    onModelsLoaded() {
        this.calculateModelBounds();
        if (this.clippingActive) {
            this.updateClippingPlane();
        }
    }

    /**
     * Calculate bounding box and center of the model container.
     */
    calculateModelBounds() {
        if (!this.viewer.modelContainer) {
            return;
        }
        const box = new THREE.Box3().setFromObject(this.viewer.modelContainer);
        if (box.isEmpty()) {
            this.modelBounds = {
                min: {x: -1, y: -1, z: -1},
                max: {x: 1, y: 1, z: 1},
                size: {x: 2, y: 2, z: 2},
                center: {x: 0, y: 0, z: 0},
            };
        } else {
            const size = new THREE.Vector3();
            const center = new THREE.Vector3();
            box.getSize(size);
            box.getCenter(center);
            this.modelBounds = {
                min: {x: box.min.x, y: box.min.y, z: box.min.z},
                max: {x: box.max.x, y: box.max.y, z: box.max.z},
                size: {x: size.x, y: size.y, z: size.z},
                center: {x: center.x, y: center.y, z: center.z},
            };
        }
    }

    /**
     * 1. Snapshot export: render canvas and trigger high-res PNG download.
     */
    takeSnapshot() {
        const renderer = this.viewer.renderer;
        const scene = this.viewer.scene;
        const camera = this.viewer.camera;
        if (!renderer || !scene || !camera) {
            return;
        }

        // Ensure current state is fully drawn.
        renderer.render(scene, camera);

        try {
            const dataUrl = renderer.domElement.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = 'gear-' + this.viewer.cmid + '-' + Date.now() + '.png';
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            Notification.addNotification({
                message: this.strings.snapshot_saved || 'Snapshot saved',
                type: 'success',
            });
        } catch (e) {
            window.console.warn('GEAR: snapshot failed', e);
        }
    }

    /**
     * 2. Cross-section / Clipping plane: toggle the control panel.
     */
    toggleClippingPanel() {
        if (!this.clippingPanel) {
            this.createClippingPanel();
        }
        const isHidden = this.clippingPanel.classList.contains('d-none');
        if (isHidden) {
            this.clippingPanel.classList.remove('d-none');
            this.clippingBtn.classList.add('active');
            this.updateClippingPanelValues();
        } else {
            this.clippingPanel.classList.add('d-none');
            this.clippingBtn.classList.remove('active');
        }
    }

    /**
     * Build the floating clipping panel DOM element.
     */
    createClippingPanel() {
        const panel = document.createElement('div');
        panel.className = 'gear-tools-panel gear-clipping-panel d-none';
        panel.id = 'gear-clipping-panel-' + this.viewer.cmid;
        panel.setAttribute('role', 'region');
        panel.setAttribute('aria-label', this.strings.clipping_plane || 'Cross-section');

        panel.innerHTML = `
            <div class="gear-tools-panel-header d-flex justify-content-between align-items-center">
                <strong><i class="fa fa-cube mr-1" aria-hidden="true"></i> ${this.strings.clipping_plane}</strong>
                <button type="button" class="close text-white gear-tools-close" aria-label="Close">&times;</button>
            </div>
            <div class="gear-tools-panel-body">
                <div class="form-check mb-2">
                    <input class="form-check-input" type="checkbox" id="gear-clip-enable-${this.viewer.cmid}">
                    <label class="form-check-label text-white" for="gear-clip-enable-${this.viewer.cmid}">
                        ${this.strings.clipping_enable}
                    </label>
                </div>
                <div class="form-group mb-2">
                    <label class="text-white-50 small mb-1" for="gear-clip-axis-${this.viewer.cmid}">
                        ${this.strings.clipping_axis}
                    </label>
                    <select class="custom-select form-select form-select-sm" id="gear-clip-axis-${this.viewer.cmid}">
                        <option value="x">X (Sagittal / Left-Right)</option>
                        <option value="y" selected>Y (Axial / Up-Down)</option>
                        <option value="z">Z (Coronal / Front-Back)</option>
                    </select>
                </div>
                <div class="form-group mb-2">
                    <div class="d-flex justify-content-between text-white-50 small mb-1">
                        <label for="gear-clip-offset-${this.viewer.cmid}">${this.strings.clipping_offset}</label>
                        <span class="gear-clip-offset-val">0%</span>
                    </div>
                    <input type="range" class="form-range w-100" id="gear-clip-offset-${this.viewer.cmid}"
                           min="0" max="100" step="1" value="50">
                </div>
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="gear-clip-flip-${this.viewer.cmid}">
                    <label class="form-check-label text-white" for="gear-clip-flip-${this.viewer.cmid}">
                        ${this.strings.clipping_flip}
                    </label>
                </div>
            </div>
        `;

        this.viewer.container.appendChild(panel);
        this.clippingPanel = panel;

        // Wire event listeners.
        panel.querySelector('.gear-tools-close').addEventListener('click', () => {
            panel.classList.add('d-none');
            this.clippingBtn.classList.remove('active');
        });

        const enableCheck = panel.querySelector('#gear-clip-enable-' + this.viewer.cmid);
        enableCheck.addEventListener('change', (e) => {
            this.clippingActive = e.target.checked;
            this.updateClippingPlane();
        });

        const axisSelect = panel.querySelector('#gear-clip-axis-' + this.viewer.cmid);
        axisSelect.addEventListener('change', (e) => {
            this.clippingAxis = e.target.value;
            this.updateClippingPlane();
        });

        const offsetRange = panel.querySelector('#gear-clip-offset-' + this.viewer.cmid);
        offsetRange.addEventListener('input', (e) => {
            const pct = parseInt(e.target.value, 10);
            panel.querySelector('.gear-clip-offset-val').textContent = pct + '%';
            this.updateClippingOffsetFromPercent(pct);
        });

        const flipCheck = panel.querySelector('#gear-clip-flip-' + this.viewer.cmid);
        flipCheck.addEventListener('change', (e) => {
            this.clippingInverted = e.target.checked;
            this.updateClippingPlane();
        });
    }

    /**
     * Update panel controls to reflect current state.
     */
    updateClippingPanelValues() {
        if (!this.clippingPanel) {
            return;
        }
        const enableCheck = this.clippingPanel.querySelector('#gear-clip-enable-' + this.viewer.cmid);
        if (enableCheck) {
            enableCheck.checked = this.clippingActive;
        }
        const axisSelect = this.clippingPanel.querySelector('#gear-clip-axis-' + this.viewer.cmid);
        if (axisSelect) {
            axisSelect.value = this.clippingAxis;
        }
        const flipCheck = this.clippingPanel.querySelector('#gear-clip-flip-' + this.viewer.cmid);
        if (flipCheck) {
            flipCheck.checked = this.clippingInverted;
        }
    }

    /**
     * Calculate 3D coordinate from percentage slider.
     *
     * @param {number} pct Percentage 0 to 100
     */
    updateClippingOffsetFromPercent(pct) {
        if (!this.modelBounds) {
            this.calculateModelBounds();
        }
        const b = this.modelBounds;
        const axis = this.clippingAxis;
        const min = b ? b.min[axis] : -1;
        const max = b ? b.max[axis] : 1;
        this.clippingOffset = min + (max - min) * (pct / 100);
        this.updateClippingPlane();
    }

    /**
     * Update Three.js clipping plane in the renderer.
     */
    updateClippingPlane() {
        const renderer = this.viewer.renderer;
        if (!renderer) {
            return;
        }

        renderer.localClippingEnabled = true;

        if (!this.clippingActive) {
            renderer.clippingPlanes = [];
            return;
        }

        const normal = new THREE.Vector3();
        const sign = this.clippingInverted ? 1 : -1;

        if (this.clippingAxis === 'x') {
            normal.set(sign, 0, 0);
        } else if (this.clippingAxis === 'z') {
            normal.set(0, 0, sign);
        } else {
            normal.set(0, sign, 0);
        }

        const constant = this.clippingInverted ? -this.clippingOffset : this.clippingOffset;
        this.clippingPlane.set(normal, constant);
        renderer.clippingPlanes = [this.clippingPlane];
    }

    /**
     * 3. Measure tool: toggle measure mode.
     */
    toggleMeasureMode() {
        this.measuring = !this.measuring;
        if (this.measuring) {
            this.measureBtn.classList.add('active');
            this.viewer.canvas.style.cursor = 'crosshair';
            this.viewer.canvas.addEventListener('pointerdown', this.onPointerDown);
            this.viewer.canvas.addEventListener('pointermove', this.onPointerMove);
            this.showMeasureToast(this.strings.measure_hint);
        } else {
            this.measureBtn.classList.remove('active');
            this.viewer.canvas.style.cursor = 'default';
            this.viewer.canvas.removeEventListener('pointerdown', this.onPointerDown);
            this.viewer.canvas.removeEventListener('pointermove', this.onPointerMove);
            this.clearMeasurement();
        }
    }

    /**
     * Handle mouse click in measure mode.
     *
     * @param {PointerEvent} event
     */
    handlePointerDown(event) {
        if (!this.measuring || event.button !== 0) {
            return;
        }

        const hit = this.raycastModel(event);
        if (!hit) {
            return;
        }

        event.stopPropagation();

        if (this.measurePoints.length >= 2) {
            this.clearMeasurement();
        }

        this.measurePoints.push(hit.point.clone());
        this.createMarker(hit.point, this.measurePoints.length === 1 ? 0x10b981 : 0xef4444);

        if (this.measurePoints.length === 2) {
            this.finishMeasurement();
        }
    }

    /**
     * Handle pointer move for real-time measurement preview.
     *
     * @param {PointerEvent} event
     */
    handlePointerMove(event) {
        if (!this.measuring || this.measurePoints.length !== 1) {
            return;
        }

        const hit = this.raycastModel(event);
        if (!hit) {
            return;
        }

        const p1 = this.measurePoints[0];
        const p2 = hit.point;

        if (!this.previewLine) {
            const geom = new THREE.BufferGeometry().setFromPoints([p1, p2]);
            const mat = new THREE.LineDashedMaterial({
                color: 0xf59e0b,
                dashSize: 0.05,
                gapSize: 0.03,
            });
            this.previewLine = new THREE.Line(geom, mat);
            this.previewLine.computeLineDistances();
            this.viewer.scene.add(this.previewLine);
        } else {
            const positions = this.previewLine.geometry.attributes.position.array;
            positions[3] = p2.x;
            positions[4] = p2.y;
            positions[5] = p2.z;
            this.previewLine.geometry.attributes.position.needsUpdate = true;
            this.previewLine.computeLineDistances();
        }
    }

    /**
     * Connect the two measurement points with a line and display the distance label.
     */
    finishMeasurement() {
        if (this.previewLine) {
            this.viewer.scene.remove(this.previewLine);
            if (this.previewLine.geometry) {
                this.previewLine.geometry.dispose();
            }
            if (this.previewLine.material) {
                this.previewLine.material.dispose();
            }
            this.previewLine = null;
        }

        const p1 = this.measurePoints[0];
        const p2 = this.measurePoints[1];

        // Draw solid connecting line.
        const geom = new THREE.BufferGeometry().setFromPoints([p1, p2]);
        const mat = new THREE.LineBasicMaterial({color: 0x6366f1, linewidth: 2});
        this.measureLine = new THREE.Line(geom, mat);
        this.viewer.scene.add(this.measureLine);

        // Calculate formatted distance.
        const dist = p1.distanceTo(p2);
        let distStr = '';
        if (dist < 0.01) {
            distStr = (dist * 1000).toFixed(1) + ' mm';
        } else if (dist < 1.0) {
            distStr = (dist * 100).toFixed(1) + ' cm';
        } else {
            distStr = dist.toFixed(2) + ' m';
        }

        const labelText = (this.strings.measure_distance || 'Distance: {$a}').replace('{$a}', distStr);
        this.showMeasureResultBadge(labelText);
    }

    /**
     * Display a floating badge with the measurement result and clear action.
     *
     * @param {string} text Formatted distance text.
     */
    showMeasureResultBadge(text) {
        if (!this.measureLabel) {
            const badge = document.createElement('div');
            badge.className = 'gear-measure-badge';
            badge.setAttribute('role', 'status');
            this.viewer.container.appendChild(badge);
            this.measureLabel = badge;
        }

        this.measureLabel.innerHTML = `
            <span><i class="fa fa-ruler mr-1" aria-hidden="true"></i> ${text}</span>
            <button type="button" class="btn btn-sm btn-outline-light ml-2 gear-measure-clear-btn"
                    title="${this.strings.measure_clear}">
                &times;
            </button>
        `;

        this.measureLabel.querySelector('.gear-measure-clear-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.clearMeasurement();
        });
    }

    /**
     * Show toast instructions at the top of the viewer.
     *
     * @param {string} msg
     */
    showMeasureToast(msg) {
        let toast = this.viewer.container.querySelector('.gear-measure-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'gear-measure-toast alert alert-info py-1 px-3';
            this.viewer.container.appendChild(toast);
        }
        toast.textContent = msg;
        toast.style.display = 'block';
    }

    /**
     * Clear active measurement points, lines, and label.
     */
    clearMeasurement() {
        this.measurePoints = [];
        this.measureMarkers.forEach((marker) => {
            this.viewer.scene.remove(marker);
            if (marker.geometry) {
                marker.geometry.dispose();
            }
            if (marker.material) {
                marker.material.dispose();
            }
        });
        this.measureMarkers = [];

        if (this.measureLine) {
            this.viewer.scene.remove(this.measureLine);
            if (this.measureLine.geometry) {
                this.measureLine.geometry.dispose();
            }
            if (this.measureLine.material) {
                this.measureLine.material.dispose();
            }
            this.measureLine = null;
        }

        if (this.previewLine) {
            this.viewer.scene.remove(this.previewLine);
            if (this.previewLine.geometry) {
                this.previewLine.geometry.dispose();
            }
            if (this.previewLine.material) {
                this.previewLine.material.dispose();
            }
            this.previewLine = null;
        }

        if (this.measureLabel) {
            this.measureLabel.remove();
            this.measureLabel = null;
        }

        const toast = this.viewer.container.querySelector('.gear-measure-toast');
        if (toast) {
            toast.style.display = 'none';
        }
    }

    /**
     * Create a sphere marker at a 3D point.
     *
     * @param {THREE.Vector3} pos
     * @param {number} color Hex color
     */
    createMarker(pos, color) {
        const radius = (this.viewer.hotspotScale || 1.0) * 0.05;
        const geom = new THREE.SphereGeometry(radius, 16, 16);
        const mat = new THREE.MeshBasicMaterial({color, depthTest: false});
        const marker = new THREE.Mesh(geom, mat);
        marker.renderOrder = 999;
        marker.position.copy(pos);
        this.viewer.scene.add(marker);
        this.measureMarkers.push(marker);
    }

    /**
     * Raycast against models in the scene.
     *
     * @param {PointerEvent} event
     * @returns {Object|null}
     */
    raycastModel(event) {
        if (!this.viewer.camera || !this.viewer.modelContainer) {
            return null;
        }
        const rect = this.viewer.canvas.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.viewer.camera);
        const hits = raycaster.intersectObjects(this.viewer.modelContainer.children, true);
        return hits.length ? hits[0] : null;
    }

    /**
     * Handle Escape key to cancel tools.
     *
     * @param {KeyboardEvent} event
     */
    handleKeyDown(event) {
        if (event.key === 'Escape') {
            if (this.measuring) {
                this.toggleMeasureMode();
            }
            if (this.clippingPanel && !this.clippingPanel.classList.contains('d-none')) {
                this.toggleClippingPanel();
            }
        }
    }

    /**
     * Destroy resources and listeners.
     */
    destroy() {
        document.removeEventListener('keydown', this.onKeyDown);
        this.clearMeasurement();
        if (this.clippingPanel) {
            this.clippingPanel.remove();
            this.clippingPanel = null;
        }
        if (this.viewer.renderer) {
            this.viewer.renderer.clippingPlanes = [];
        }
    }
}

