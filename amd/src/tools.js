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
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import Notification from 'core/notification';
import Str from 'core/str';
import Templates from 'core/templates';

const STRINGS = [
    'autorotate',
    'clipping_axis', 'clipping_enable', 'clipping_flip', 'clipping_offset', 'clipping_plane',
    'env_darklab', 'env_lighting', 'env_none', 'env_studio', 'env_workshop',
    'explode_factor', 'explode_reset', 'explode_view',
    'measure_clear', 'measure_distance', 'measure_hint', 'measure_tool',
    'part_hide', 'part_isolate', 'part_none_selected', 'part_selected', 'part_unnamed', 'part_xray',
    'parts_inspector', 'parts_reset',
    'presentation_exit', 'presentation_mode',
    'snapshot', 'snapshot_saved',
    'xray_all',
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

        // Exploded view.
        this.explodeBtn = null;
        this.explodePanel = null;
        this.explodeFactor = 0; // 0..100
        this.explodeMeshes = [];

        // Part inspector & X-Ray.
        this.partsBtn = null;
        this.partsPanel = null;
        this.partsInspecting = false;
        this.globalXRay = false;
        this.selectedPart = null;
        this.isolatedPart = null;
        this.tempMaterials = new Set();

        // Studio environment (PMREM).
        this.envBtn = null;
        this.envPanel = null;
        this.envPreset = 'none';
        this.envRT = null;
        this.origBackground = undefined;
        this.origToneMappingExposure = null;

        // Presentation mode.
        this.presentBtn = null;
        this.presentationBar = null;
        this.presenting = false;

        // Time-Trial stopwatch.
        this.timeTrialBtn = null;
        this.timeTrialBadge = null;
        this.timeTrialTimer = null;
        this.timeTrialStart = 0;
        this.timeTrialRunning = false;

        this.onPointerDown = (e) => this.handlePointerDown(e);
        this.onPointerMove = (e) => this.handlePointerMove(e);
        this.onPartPointerDown = (e) => this.handlePartPointerDown(e);
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

        this.explodeBtn = document.getElementById('gear-explode-' + cmid);
        if (this.explodeBtn) {
            this.explodeBtn.addEventListener('click', () => this.toggleExplodePanel());
        }

        this.partsBtn = document.getElementById('gear-parts-' + cmid);
        if (this.partsBtn) {
            this.partsBtn.addEventListener('click', () => this.togglePartsPanel());
        }

        this.envBtn = document.getElementById('gear-env-' + cmid);
        if (this.envBtn) {
            this.envBtn.addEventListener('click', () => this.toggleEnvPanel());
        }

        this.presentBtn = document.getElementById('gear-present-' + cmid);
        if (this.presentBtn) {
            this.presentBtn.addEventListener('click', () => this.togglePresentationMode());
        }

        this.timeTrialBtn = document.getElementById('gear-timetrial-' + cmid);
        if (this.timeTrialBtn) {
            this.timeTrialBtn.addEventListener('click', () => this.toggleTimeTrial());
        }

        // Restore saved clipping, explode and environment settings from scene config if available.
        if (this.viewer.config) {
            if (this.viewer.config.clipping) {
                const cfg = this.viewer.config.clipping;
                this.clippingActive = Boolean(cfg.enabled);
                this.clippingAxis = cfg.axis || 'y';
                this.clippingOffset = typeof cfg.offset === 'number' ? cfg.offset : 0;
                this.clippingInverted = Boolean(cfg.inverted);
            }
            if (typeof this.viewer.config.explodeFactor === 'number') {
                this.explodeFactor = Math.max(0, Math.min(100, this.viewer.config.explodeFactor));
            }
            if (typeof this.viewer.config.envPreset === 'string') {
                this.envPreset = this.viewer.config.envPreset;
            }
        }

        document.addEventListener('keydown', this.onKeyDown);
    }

    /**
     * Called when 3D models have loaded in the scene.
     */
    onModelsLoaded() {
        this.calculateModelBounds();
        this.initExplodeData();
        if (this.explodeFactor > 0) {
            this.setExplodeFactor(this.explodeFactor);
        }
        if (this.envPreset && this.envPreset !== 'none') {
            this.setEnvPreset(this.envPreset);
        }
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
     * Ensure all floating tool panels from mod_gear/tools_panels are rendered once and wired.
     *
     * @returns {Promise<void>}
     */
    async ensurePanelsRendered() {
        if (this.panelsPromise) {
            return this.panelsPromise;
        }
        const cmid = this.viewer.cmid;
        this.panelsPromise = Templates.renderForPromise('mod_gear/tools_panels', {cmid}).then(({html, js}) => {
            Templates.appendNodeContents(this.viewer.container, html, js);

            this.clippingPanel = document.getElementById('gear-clipping-panel-' + cmid);
            this.explodePanel = document.getElementById('gear-explode-panel-' + cmid);
            this.partsPanel = document.getElementById('gear-parts-panel-' + cmid);
            this.envPanel = document.getElementById('gear-env-panel-' + cmid);
            this.presentationBar = document.getElementById('gear-presentation-bar-' + cmid);

            this.wireClippingPanel(cmid);
            this.wireExplodePanel(cmid);
            this.wirePartsPanel(cmid);
            this.wireEnvPanel(cmid);
            this.wirePresentationBar();
            return null;
        });
        return this.panelsPromise;
    }

    /**
     * 2. Cross-section / Clipping plane: toggle the control panel.
     */
    async toggleClippingPanel() {
        await this.ensurePanelsRendered();
        const isHidden = this.clippingPanel.classList.contains('d-none');
        this.closeFloatingPanels('clipping');
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
     * Wire events on the rendered clipping panel.
     *
     * @param {number} cmid
     */
    wireClippingPanel(cmid) {
        const panel = this.clippingPanel;
        if (!panel) {
            return;
        }
        panel.querySelector('.gear-panel-close').addEventListener('click', () => {
            panel.classList.add('d-none');
            this.clippingBtn.classList.remove('active');
        });

        const enableCheck = panel.querySelector('#gear-clip-enable-' + cmid);
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
        if (!this.measuring && this.partsInspecting) {
            this.setPartsPicking(false);
        }
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
     * 4. Exploded View: cache original mesh positions and radial separation vectors.
     */
    initExplodeData() {
        this.explodeMeshes = [];
        if (!this.viewer.modelContainer) {
            return;
        }
        this.viewer.modelContainer.updateMatrixWorld(true);
        const rootBox = new THREE.Box3().setFromObject(this.viewer.modelContainer);
        if (rootBox.isEmpty()) {
            return;
        }
        const rootCenter = new THREE.Vector3();
        const rootSize = new THREE.Vector3();
        rootBox.getCenter(rootCenter);
        rootBox.getSize(rootSize);
        const maxDist = Math.max(rootSize.length() * 0.45, 0.5);

        const meshBox = new THREE.Box3();
        const meshCenter = new THREE.Vector3();
        const worldDir = new THREE.Vector3();
        const parentQuat = new THREE.Quaternion();
        const parentScale = new THREE.Vector3();

        this.viewer.modelContainer.traverse((obj) => {
            if (!obj.isMesh) {
                return;
            }
            if (!obj.userData.origPosition) {
                obj.userData.origPosition = obj.position.clone();
            }
            meshBox.setFromObject(obj);
            meshBox.getCenter(meshCenter);
            worldDir.subVectors(meshCenter, rootCenter);
            if (worldDir.lengthSq() < 1e-6) {
                worldDir.set(0, 0, 0);
            } else {
                // Distance-weighted direction so outer parts separate slightly further than inner parts.
                const relDist = Math.min(worldDir.length() / Math.max(rootSize.length() * 0.5, 0.01), 1.5);
                worldDir.normalize().multiplyScalar(maxDist * (0.4 + 0.6 * relDist));
            }

            // Convert world offset vector into the mesh's parent local space.
            const localDir = worldDir.clone();
            if (obj.parent) {
                obj.parent.getWorldQuaternion(parentQuat);
                obj.parent.getWorldScale(parentScale);
                localDir.applyQuaternion(parentQuat.invert());
                localDir.set(
                    parentScale.x !== 0 ? localDir.x / parentScale.x : localDir.x,
                    parentScale.y !== 0 ? localDir.y / parentScale.y : localDir.y,
                    parentScale.z !== 0 ? localDir.z / parentScale.z : localDir.z
                );
            }
            obj.userData.explodeOffset = localDir;
            this.explodeMeshes.push(obj);
        });
    }

    /**
     * Apply exploded view factor (0..100).
     *
     * @param {number} pct Percentage 0..100
     */
    setExplodeFactor(pct) {
        this.explodeFactor = Math.max(0, Math.min(100, Number(pct) || 0));
        const t = this.explodeFactor / 100;
        this.explodeMeshes.forEach((mesh) => {
            if (!mesh.userData.origPosition || !mesh.userData.explodeOffset) {
                return;
            }
            mesh.position.copy(mesh.userData.origPosition).addScaledVector(mesh.userData.explodeOffset, t);
        });
        if (this.explodePanel) {
            const slider = this.explodePanel.querySelector('#gear-explode-slider-' + this.viewer.cmid);
            const valLabel = this.explodePanel.querySelector('#gear-explode-val-' + this.viewer.cmid);
            if (slider) {
                slider.value = String(this.explodeFactor);
            }
            if (valLabel) {
                valLabel.textContent = Math.round(this.explodeFactor) + '%';
            }
        }
    }

    /**
     * Toggle the Exploded View floating panel.
     */
    async toggleExplodePanel() {
        await this.ensurePanelsRendered();
        const isHidden = this.explodePanel.classList.contains('d-none');
        this.closeFloatingPanels('explode');
        if (isHidden) {
            this.explodePanel.classList.remove('d-none');
            this.explodeBtn.classList.add('active');
            this.setExplodeFactor(this.explodeFactor);
        } else {
            this.explodePanel.classList.add('d-none');
            this.explodeBtn.classList.remove('active');
        }
    }

    /**
     * Wire events on the rendered Exploded View panel.
     *
     * @param {number} cmid
     */
    wireExplodePanel(cmid) {
        const panel = this.explodePanel;
        if (!panel) {
            return;
        }
        panel.querySelector('.gear-panel-close').addEventListener('click', () => {
            panel.classList.add('d-none');
            this.explodeBtn.classList.remove('active');
        });
        panel.querySelector('#gear-explode-slider-' + cmid).addEventListener('input', (e) => {
            this.setExplodeFactor(parseFloat(e.target.value));
        });
        panel.querySelector('#gear-explode-reset-' + cmid).addEventListener('click', () => {
            this.setExplodeFactor(0);
        });
    }

    /**
     * 5. Part Inspector & X-Ray: toggle panel and part picking.
     */
    async togglePartsPanel() {
        await this.ensurePanelsRendered();
        const isHidden = this.partsPanel.classList.contains('d-none');
        this.closeFloatingPanels('parts');
        if (isHidden) {
            this.partsPanel.classList.remove('d-none');
            this.partsBtn.classList.add('active');
            this.setPartsPicking(true);
        } else {
            this.partsPanel.classList.add('d-none');
            this.partsBtn.classList.remove('active');
            this.setPartsPicking(false);
        }
    }

    /**
     * Enable or disable click-to-inspect on 3D model parts.
     *
     * @param {boolean} active
     */
    setPartsPicking(active) {
        if (active && this.measuring) {
            this.toggleMeasureMode();
        }
        this.partsInspecting = active;
        if (active) {
            this.viewer.canvas.style.cursor = 'pointer';
            this.viewer.canvas.addEventListener('pointerdown', this.onPartPointerDown);
        } else {
            this.viewer.canvas.style.cursor = 'default';
            this.viewer.canvas.removeEventListener('pointerdown', this.onPartPointerDown);
        }
    }

    /**
     * Wire events on the rendered Part Inspector & X-Ray panel.
     *
     * @param {number} cmid
     */
    wirePartsPanel(cmid) {
        const panel = this.partsPanel;
        if (!panel) {
            return;
        }
        panel.querySelector('.gear-panel-close').addEventListener('click', () => {
            panel.classList.add('d-none');
            this.partsBtn.classList.remove('active');
            this.setPartsPicking(false);
        });
        panel.querySelector('#gear-xray-all-' + cmid).addEventListener('change', (e) => {
            this.setGlobalXRay(e.target.checked);
        });
        panel.querySelector('#gear-part-isolate-' + cmid).addEventListener('click', () => this.isolateSelectedPart());
        panel.querySelector('#gear-part-hide-' + cmid).addEventListener('click', () => this.hideSelectedPart());
        panel.querySelector('#gear-part-xray-' + cmid).addEventListener('click', () => this.xraySelectedPart());
        panel.querySelector('#gear-parts-reset-' + cmid).addEventListener('click', () => this.resetAllParts());
    }

    /**
     * Handle pointer click to select a mesh part.
     *
     * @param {PointerEvent} event
     */
    handlePartPointerDown(event) {
        if (!this.partsInspecting || event.button !== 0 || event.shiftKey) {
            return;
        }
        const hit = this.raycastModel(event);
        if (!hit || !hit.object || !hit.object.isMesh) {
            return;
        }
        this.selectedPart = hit.object;
        const cmid = this.viewer.cmid;
        const nameEl = this.partsPanel.querySelector('#gear-part-name-' + cmid);
        const label = this.selectedPart.name || this.strings.part_unnamed || 'Unnamed part';
        if (nameEl) {
            nameEl.textContent = `${this.strings.part_selected}: ${label}`;
            nameEl.classList.add('has-selection');
        }
        ['#gear-part-isolate-', '#gear-part-hide-', '#gear-part-xray-'].forEach((sel) => {
            const btn = this.partsPanel.querySelector(sel + cmid);
            if (btn) {
                btn.disabled = false;
            }
        });
    }

    /**
     * Cache original material and visibility on a mesh before modifying it.
     *
     * @param {THREE.Mesh} mesh
     */
    cachePartState(mesh) {
        if (!mesh.userData.origMaterial) {
            mesh.userData.origMaterial = mesh.material;
            mesh.userData.origVisible = mesh.visible;
        }
    }

    /**
     * Create a translucent ghost/X-Ray material based on an original material.
     *
     * @param {THREE.Material|THREE.Material[]} origMat
     * @param {number} opacity
     * @param {boolean} wireframe
     * @returns {THREE.Material|THREE.Material[]}
     */
    makeGhostMaterial(origMat, opacity, wireframe) {
        const build = (m) => {
            const ghost = m.clone();
            ghost.transparent = true;
            ghost.opacity = opacity;
            ghost.depthWrite = false;
            ghost.wireframe = wireframe;
            this.tempMaterials.add(ghost);
            return ghost;
        };
        return Array.isArray(origMat) ? origMat.map(build) : build(origMat);
    }

    /**
     * Toggle global X-Ray mode across the entire model.
     *
     * @param {boolean} enabled
     */
    setGlobalXRay(enabled) {
        this.globalXRay = enabled;
        this.isolatedPart = null;
        if (!this.viewer.modelContainer) {
            return;
        }
        this.viewer.modelContainer.traverse((obj) => {
            if (!obj.isMesh) {
                return;
            }
            this.cachePartState(obj);
            if (enabled) {
                obj.visible = obj.userData.origVisible;
                obj.material = this.makeGhostMaterial(obj.userData.origMaterial, 0.22, true);
            } else {
                obj.material = obj.userData.origMaterial;
                obj.visible = obj.userData.origVisible;
            }
        });
    }

    /**
     * Isolate the currently selected part by ghosting all other meshes.
     */
    isolateSelectedPart() {
        if (!this.selectedPart || !this.viewer.modelContainer) {
            return;
        }
        const toggleOff = this.isolatedPart === this.selectedPart;
        this.isolatedPart = toggleOff ? null : this.selectedPart;
        this.viewer.modelContainer.traverse((obj) => {
            if (!obj.isMesh) {
                return;
            }
            this.cachePartState(obj);
            if (toggleOff) {
                obj.material = obj.userData.origMaterial;
                obj.visible = obj.userData.origVisible;
            } else if (obj === this.selectedPart) {
                obj.material = obj.userData.origMaterial;
                obj.visible = true;
            } else {
                obj.material = this.makeGhostMaterial(obj.userData.origMaterial, 0.1, false);
                obj.visible = true;
            }
        });
    }

    /**
     * Hide the currently selected part.
     */
    hideSelectedPart() {
        if (!this.selectedPart) {
            return;
        }
        this.cachePartState(this.selectedPart);
        this.selectedPart.visible = false;
    }

    /**
     * Toggle X-Ray ghosting on the currently selected part.
     */
    xraySelectedPart() {
        if (!this.selectedPart) {
            return;
        }
        this.cachePartState(this.selectedPart);
        if (this.selectedPart.userData.isPartXRay) {
            this.selectedPart.material = this.selectedPart.userData.origMaterial;
            this.selectedPart.userData.isPartXRay = false;
        } else {
            this.selectedPart.material = this.makeGhostMaterial(this.selectedPart.userData.origMaterial, 0.22, true);
            this.selectedPart.userData.isPartXRay = true;
        }
    }

    /**
     * Restore all mesh materials and visibility.
     */
    resetAllParts() {
        this.globalXRay = false;
        this.isolatedPart = null;
        if (this.viewer.modelContainer) {
            this.viewer.modelContainer.traverse((obj) => {
                if (!obj.isMesh || !obj.userData.origMaterial) {
                    return;
                }
                obj.material = obj.userData.origMaterial;
                obj.visible = obj.userData.origVisible;
                obj.userData.isPartXRay = false;
            });
        }
        this.tempMaterials.forEach((m) => m.dispose());
        this.tempMaterials.clear();
        if (this.partsPanel) {
            const cmid = this.viewer.cmid;
            const globalSwitch = this.partsPanel.querySelector('#gear-xray-all-' + cmid);
            if (globalSwitch) {
                globalSwitch.checked = false;
            }
        }
    }

    /**
     * 6. Studio Environment (PMREM): toggle panel.
     */
    async toggleEnvPanel() {
        await this.ensurePanelsRendered();
        const isHidden = this.envPanel.classList.contains('d-none');
        this.closeFloatingPanels('env');
        if (isHidden) {
            this.envPanel.classList.remove('d-none');
            this.envBtn.classList.add('active');
            this.setEnvPreset(this.envPreset);
        } else {
            this.envPanel.classList.add('d-none');
            this.envBtn.classList.remove('active');
        }
    }

    /**
     * Wire events on the rendered Studio Lighting panel.
     */
    wireEnvPanel() {
        const panel = this.envPanel;
        if (!panel) {
            return;
        }
        panel.querySelector('.gear-panel-close').addEventListener('click', () => {
            panel.classList.add('d-none');
            this.envBtn.classList.remove('active');
        });
        panel.querySelectorAll('.gear-env-preset-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                this.setEnvPreset(btn.dataset.preset);
            });
        });
    }

    /**
     * Apply a procedural PMREM lighting preset to the scene.
     *
     * @param {string} preset none | studio | workshop | darklab
     */
    setEnvPreset(preset) {
        const renderer = this.viewer.renderer;
        const scene = this.viewer.scene;
        if (!renderer || !scene) {
            return;
        }
        if (this.origBackground === undefined) {
            this.origBackground = scene.background ? scene.background.clone() : null;
        }
        if (this.origToneMappingExposure === null) {
            this.origToneMappingExposure = renderer.toneMappingExposure || 1.0;
        }

        if (this.envRT) {
            this.envRT.dispose();
            this.envRT = null;
        }

        this.envPreset = preset || 'none';

        if (this.envPreset === 'none') {
            scene.environment = null;
            scene.background = this.origBackground ? this.origBackground.clone() : null;
            renderer.toneMappingExposure = this.origToneMappingExposure;
        } else {
            const pmrem = new THREE.PMREMGenerator(renderer);
            const roomEnv = new RoomEnvironment();
            this.envRT = pmrem.fromScene(roomEnv, 0.04);
            roomEnv.dispose();
            pmrem.dispose();
            scene.environment = this.envRT.texture;

            if (this.envPreset === 'studio') {
                scene.background = this.origBackground ? this.origBackground.clone() : null;
                renderer.toneMappingExposure = 1.05;
            } else if (this.envPreset === 'workshop') {
                scene.background = new THREE.Color(0x2b2620);
                renderer.toneMappingExposure = 1.2;
            } else if (this.envPreset === 'darklab') {
                scene.background = new THREE.Color(0x0d1117);
                renderer.toneMappingExposure = 1.15;
            }
        }

        if (this.envPanel) {
            this.envPanel.querySelectorAll('.gear-env-preset-btn').forEach((btn) => {
                const isSelected = btn.dataset.preset === this.envPreset;
                btn.classList.toggle('active', isSelected);
                btn.classList.toggle('btn-primary', isSelected);
                btn.classList.toggle('btn-outline-light', !isSelected);
            });
        }
    }

    /**
     * 7. Presentation Mode: clean classroom/projector view with optional auto-turntable.
     */
    togglePresentationMode() {
        if (this.presenting) {
            this.exitPresentationMode();
        } else {
            this.enterPresentationMode();
        }
    }

    /**
     * Wire events on the rendered Presentation Mode bar.
     */
    wirePresentationBar() {
        const bar = this.presentationBar;
        if (!bar) {
            return;
        }
        bar.querySelector('.gear-present-turntable').addEventListener('click', () => {
            this.viewer.toggleAutoRotate();
        });
        bar.querySelector('.gear-present-exit').addEventListener('click', () => {
            this.exitPresentationMode();
        });
    }

    /**
     * Enter presentation mode.
     */
    async enterPresentationMode() {
        const activityEl = this.viewer.container.closest('.gear-activity');
        if (!activityEl) {
            return;
        }
        await this.ensurePanelsRendered();
        this.presenting = true;
        this.closeFloatingPanels();
        activityEl.classList.add('gear-presentation-mode');
        if (this.presentBtn) {
            this.presentBtn.classList.add('active');
        }
        if (this.presentationBar) {
            this.presentationBar.classList.remove('d-none');
        }
        window.dispatchEvent(new Event('resize'));
    }

    /**
     * Exit presentation mode.
     */
    exitPresentationMode() {
        if (!this.presenting) {
            return;
        }
        this.presenting = false;
        const activityEl = this.viewer.container.closest('.gear-activity');
        if (activityEl) {
            activityEl.classList.remove('gear-presentation-mode');
        }
        if (this.presentBtn) {
            this.presentBtn.classList.remove('active');
        }
        if (this.presentationBar) {
            this.presentationBar.classList.add('d-none');
        }
        window.dispatchEvent(new Event('resize'));
    }

    /**
     * 8. Time-Trial stopwatch: toggle live challenge timer.
     */
    toggleTimeTrial() {
        if (this.timeTrialRunning) {
            this.stopTimeTrial(true);
            return;
        }
        this.timeTrialRunning = true;
        this.timeTrialStart = Date.now();
        if (this.timeTrialBtn) {
            this.timeTrialBtn.classList.add('active');
        }
        if (!this.timeTrialBadge) {
            const badge = document.createElement('div');
            badge.className = 'gear-timetrial-badge';
            this.viewer.container.appendChild(badge);
            this.timeTrialBadge = badge;
        }
        this.timeTrialBadge.classList.remove('d-none', 'finished');
        const update = () => {
            const secs = Math.floor((Date.now() - this.timeTrialStart) / 1000);
            const mm = String(Math.floor(secs / 60)).padStart(2, '0');
            const ss = String(secs % 60).padStart(2, '0');
            if (this.timeTrialBadge) {
                this.timeTrialBadge.textContent = `⏱ ${mm}:${ss}`;
            }
        };
        update();
        this.timeTrialTimer = setInterval(update, 1000);
    }

    /**
     * Stop the Time-Trial stopwatch.
     *
     * @param {boolean} hideBadge
     */
    stopTimeTrial(hideBadge) {
        this.timeTrialRunning = false;
        if (this.timeTrialTimer) {
            clearInterval(this.timeTrialTimer);
            this.timeTrialTimer = null;
        }
        if (this.timeTrialBtn) {
            this.timeTrialBtn.classList.remove('active');
        }
        if (this.timeTrialBadge) {
            if (hideBadge) {
                this.timeTrialBadge.classList.add('d-none');
            } else {
                this.timeTrialBadge.classList.add('finished');
            }
        }
    }

    /**
     * Close all floating tool panels except an optional one.
     *
     * @param {string} [except] clipping | explode | parts | env
     */
    closeFloatingPanels(except) {
        const panels = [
            {key: 'clipping', panel: this.clippingPanel, btn: this.clippingBtn},
            {key: 'explode', panel: this.explodePanel, btn: this.explodeBtn},
            {key: 'parts', panel: this.partsPanel, btn: this.partsBtn},
            {key: 'env', panel: this.envPanel, btn: this.envBtn},
        ];
        panels.forEach(({key, panel, btn}) => {
            if (key === except) {
                return;
            }
            if (panel && !panel.classList.contains('d-none')) {
                panel.classList.add('d-none');
            }
            if (btn) {
                btn.classList.remove('active');
            }
            if (key === 'parts' && this.partsInspecting) {
                this.setPartsPicking(false);
            }
        });
    }

    /**
     * Handle Escape key to cancel tools.
     *
     * @param {KeyboardEvent} event
     */
    handleKeyDown(event) {
        if (event.key === 'Escape') {
            if (this.presenting) {
                this.exitPresentationMode();
            }
            if (this.measuring) {
                this.toggleMeasureMode();
            }
            if (this.partsInspecting) {
                this.setPartsPicking(false);
            }
            this.closeFloatingPanels();
        }
    }

    /**
     * Destroy resources and listeners.
     */
    destroy() {
        document.removeEventListener('keydown', this.onKeyDown);
        this.stopTimeTrial(true);
        if (this.timeTrialBadge) {
            this.timeTrialBadge.remove();
            this.timeTrialBadge = null;
        }
        this.exitPresentationMode();
        this.setPartsPicking(false);
        this.resetAllParts();
        this.clearMeasurement();
        [this.clippingPanel, this.explodePanel, this.partsPanel, this.envPanel, this.presentationBar].forEach((el) => {
            if (el) {
                el.remove();
            }
        });
        this.clippingPanel = null;
        this.explodePanel = null;
        this.partsPanel = null;
        this.envPanel = null;
        this.presentationBar = null;
        if (this.envRT) {
            this.envRT.dispose();
            this.envRT = null;
        }
        if (this.viewer.renderer) {
            this.viewer.renderer.clippingPlanes = [];
        }
    }
}

