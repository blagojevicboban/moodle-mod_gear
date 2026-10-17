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
 * Animations, material variants and the guided tour of a GEAR scene.
 *
 * @module     mod_gear/extras
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import * as THREE from 'three';
import Ajax from 'core/ajax';
import Notification from 'core/notification';
import Str from 'core/str';
import ModalSaveCancel from 'core/modal_save_cancel';
import ModalEvents from 'core/modal_events';
import {escapeHtml, prefersReducedMotion} from './dom';

const STRINGS = [
    'animation', 'animationspeed', 'defaultssaved', 'materialvariant', 'pauseanimation', 'playanimation', 'savedefaults',
    'tour', 'touradd', 'tourclose', 'tourdelete', 'tourdeleteconfirm', 'touredit', 'tourempty', 'tournext', 'tourprevious',
    'tourmovedown', 'tourmoveup', 'tourstep', 'tourtext', 'tourtitle', 'variantdefault',
];
const SPEEDS = [0.25, 0.5, 1, 1.5, 2];
const TOUR_MS = 900;

/**
 * Plays the animations of the loaded models, switches material variants and runs the guided tour.
 */
export default class SceneExtras {
    /**
     * Constructor.
     *
     * @param {Object} viewer The GearViewer that owns the scene (camera, controls, container, config, gearid, canManage)
     */
    constructor(viewer) {
        this.viewer = viewer;
        this.mixers = [];
        this.actions = new Map(); // Clip name -> actions (one per model that has the clip).
        this.variantNames = [];
        this.variantMeshes = []; // Entries {mesh, base, mappings, parser}.
        this.materialCache = new Map();
        this.playing = false;
        this.speed = 1;
        this.tour = Array.isArray(viewer.config.tour) ? viewer.config.tour.slice() : [];
        this.tourIndex = -1;
        this.flight = null;
        this.strings = {};
        this.panel = null;
    }

    /**
     * Register a loaded glTF: collect its animation clips and material variants.
     *
     * @param {Object} gltf Result of GLTFLoader
     * @param {THREE.Object3D} object The scene that was added to the viewer
     */
    addModel(gltf, object) {
        if (gltf.animations && gltf.animations.length) {
            const mixer = new THREE.AnimationMixer(object);
            this.mixers.push(mixer);
            gltf.animations.forEach((clip) => {
                const list = this.actions.get(clip.name) || [];
                list.push(mixer.clipAction(clip));
                this.actions.set(clip.name, list);
            });
        }
        this.collectVariants(gltf, object);
    }

    /**
     * Read the KHR_materials_variants extension of a glTF file.
     *
     * @param {Object} gltf Result of GLTFLoader
     * @param {THREE.Object3D} object The loaded scene
     */
    collectVariants(gltf, object) {
        const json = gltf.parser && gltf.parser.json;
        const names = json && json.extensions && json.extensions.KHR_materials_variants
            ? json.extensions.KHR_materials_variants.variants : null;
        if (!names || !names.length) {
            return;
        }
        const offset = this.variantNames.length;
        names.forEach((variant) => this.variantNames.push(variant.name));
        object.traverse((mesh) => {
            const association = mesh.isMesh ? gltf.parser.associations.get(mesh) : null;
            if (!association || association.meshes === undefined) {
                return;
            }
            const primitive = json.meshes[association.meshes].primitives[association.primitives || 0];
            const extension = primitive && primitive.extensions ? primitive.extensions.KHR_materials_variants : null;
            if (extension && extension.mappings) {
                this.variantMeshes.push({
                    mesh,
                    base: mesh.material,
                    offset,
                    mappings: extension.mappings,
                    parser: gltf.parser,
                });
            }
        });
    }

    /**
     * Build the controls once all models are loaded and apply the saved defaults.
     */
    async ready() {
        const keys = await Str.get_strings(STRINGS.map((key) => ({key, component: 'mod_gear'})));
        STRINGS.forEach((key, i) => {
            this.strings[key] = keys[i];
        });
        const hasTour = this.tour.length > 0 || this.viewer.canManage;
        if (!this.actions.size && !this.variantNames.length && !hasTour) {
            return;
        }
        this.buildPanel(hasTour);

        const saved = this.viewer.config.animation || {};
        if (this.actions.size) {
            this.speed = SPEEDS.includes(Number(saved.speed)) ? Number(saved.speed) : 1;
            this.speedSelect.value = String(this.speed);
            if (saved.clip && this.actions.has(saved.clip)) {
                this.clipSelect.value = saved.clip;
            }
            this.selectClip(this.clipSelect.value);
            if (saved.autoplay && !prefersReducedMotion()) {
                this.setPlaying(true);
            }
        }
        const variant = this.variantNames.indexOf(this.viewer.config.variant);
        if (variant >= 0) {
            this.variantSelect.value = String(variant);
            await this.selectVariant(variant);
        }
    }

    /**
     * Create the animation, variant and tour controls inside the viewer.
     *
     * @param {boolean} hasTour Whether the tour button is shown
     */
    buildPanel(hasTour) {
        const s = this.strings;
        const panel = this.el('div', 'gear-extras');
        this.panel = panel;

        if (this.actions.size) {
            const row = this.el('div', 'gear-extras-row');
            const clips = Array.from(this.actions.keys()).map((name, i) => [name, name || '#' + (i + 1)]);
            this.clipSelect = this.select(row, s.animation, clips);
            this.playButton = this.el('button', 'btn btn-sm btn-light', '<i class="fa fa-play" aria-hidden="true"></i>');
            this.playButton.type = 'button';
            this.playButton.setAttribute('aria-pressed', 'false');
            this.playButton.title = s.playanimation;
            this.playButton.setAttribute('aria-label', s.playanimation);
            this.playButton.addEventListener('click', () => this.setPlaying(!this.playing));
            row.appendChild(this.playButton);
            this.speedSelect = this.select(row, s.animationspeed, SPEEDS.map((v) => [String(v), v + 'Ã—']));
            this.speedSelect.value = '1';
            this.clipSelect.addEventListener('change', () => this.selectClip(this.clipSelect.value));
            this.speedSelect.addEventListener('change', () => {
                this.speed = Number(this.speedSelect.value);
                this.mixers.forEach((mixer) => {
                    mixer.timeScale = this.speed;
                });
            });
            panel.appendChild(row);
        }
        if (this.variantNames.length) {
            const row = this.el('div', 'gear-extras-row');
            this.variantSelect = this.select(row, s.materialvariant,
                [['-1', s.variantdefault]].concat(this.variantNames.map((name, i) => [String(i), name])));
            this.variantSelect.addEventListener('change', () => this.selectVariant(Number(this.variantSelect.value)));
            panel.appendChild(row);
        }
        const row = this.el('div', 'gear-extras-row');
        if (hasTour) {
            const button = this.el('button', 'btn btn-sm btn-light', '<i class="fa fa-route" aria-hidden="true"></i> ' +
                escapeHtml(s.tour));
            button.type = 'button';
            button.addEventListener('click', () => this.openTour());
            row.appendChild(button);
        }
        if (this.viewer.canManage && (this.actions.size || this.variantNames.length)) {
            const save = this.el('button', 'btn btn-sm btn-outline-light', escapeHtml(s.savedefaults));
            save.type = 'button';
            save.addEventListener('click', () => this.saveDefaults());
            row.appendChild(save);
        }
        if (row.childNodes.length) {
            panel.appendChild(row);
        }
        this.viewer.container.appendChild(panel);
    }

    /**
     * Create an element.
     *
     * @param {string} tag Tag name
     * @param {string} className Classes
     * @param {string} [html] Inner HTML (trusted or escaped by the caller)
     * @returns {HTMLElement}
     */
    el(tag, className, html) {
        const node = document.createElement(tag);
        node.className = className;
        if (html) {
            node.innerHTML = html;
        }
        return node;
    }

    /**
     * Add a labelled select to a row.
     *
     * @param {HTMLElement} row Parent row
     * @param {string} label Accessible label
     * @param {Array} options List of [value, text]
     * @returns {HTMLSelectElement}
     */
    select(row, label, options) {
        const select = this.el('select', 'custom-select form-select form-select-sm gear-extras-select');
        select.setAttribute('aria-label', label);
        select.title = label;
        options.forEach(([value, text]) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = text;
            select.appendChild(option);
        });
        row.appendChild(select);
        return select;
    }

    /**
     * Make a clip the current one (stops the previous clip).
     *
     * @param {string} name Clip name
     */
    selectClip(name) {
        const wasPlaying = this.playing;
        this.actions.forEach((list) => list.forEach((action) => action.stop()));
        this.currentClip = name;
        (this.actions.get(name) || []).forEach((action) => {
            action.reset();
            action.play();
            action.paused = !wasPlaying;
        });
        this.mixers.forEach((mixer) => {
            mixer.timeScale = this.speed;
        });
        if (!wasPlaying) {
            this.mixers.forEach((mixer) => mixer.update(0));
        }
    }

    /**
     * Play or pause the current clip.
     *
     * @param {boolean} play True to play
     */
    setPlaying(play) {
        this.playing = play;
        (this.actions.get(this.currentClip) || []).forEach((action) => {
            action.paused = !play;
        });
        if (this.playButton) {
            const label = play ? this.strings.pauseanimation : this.strings.playanimation;
            this.playButton.innerHTML = '<i class="fa fa-' + (play ? 'pause' : 'play') + '" aria-hidden="true"></i>';
            this.playButton.title = label;
            this.playButton.setAttribute('aria-label', label);
            this.playButton.setAttribute('aria-pressed', play ? 'true' : 'false');
        }
    }

    /**
     * Show a material variant.
     *
     * @param {number} index Variant index, -1 for the materials of the model itself
     */
    async selectVariant(index) {
        for (const entry of this.variantMeshes) {
            const local = index - entry.offset;
            const mapping = index < 0 ? null : entry.mappings.find((m) => m.variants.includes(local));
            if (!mapping) {
                entry.mesh.material = entry.base;
                continue;
            }
            if (!this.materialCache.has(entry.parser)) {
                this.materialCache.set(entry.parser, new Map());
            }
            const cache = this.materialCache.get(entry.parser);
            if (!cache.has(mapping.material)) {
                cache.set(mapping.material, await entry.parser.getDependency('material', mapping.material));
            }
            entry.mesh.material = cache.get(mapping.material) || entry.base;
        }
    }

    /**
     * Advance the animations and the camera flight (called from the render loop).
     *
     * @param {number} delta Seconds since the last frame
     */
    update(delta) {
        if (this.playing) {
            this.mixers.forEach((mixer) => mixer.update(delta));
        }
        if (this.flight) {
            const f = this.flight;
            f.elapsed += delta * 1000;
            const t = Math.min(1, f.elapsed / TOUR_MS);
            const e = t * t * (3 - 2 * t);
            this.viewer.camera.position.lerpVectors(f.fromPosition, f.toPosition, e);
            this.viewer.controls.target.lerpVectors(f.fromTarget, f.toTarget, e);
            this.viewer.controls.update();
            if (t >= 1) {
                this.flight = null;
            }
        }
    }

    /**
     * Save the clip, speed, autoplay and variant as the defaults of the activity.
     */
    saveDefaults() {
        Ajax.call([{
            methodname: 'mod_gear_save_scene_config',
            args: {
                gearid: this.viewer.gearid,
                animation: JSON.stringify({clip: this.currentClip || '', autoplay: this.playing, speed: this.speed}),
                variant: this.variantSelect && this.variantSelect.value !== '-1'
                    ? this.variantNames[Number(this.variantSelect.value)] : '',
            },
        }])[0].then(() => {
            this.viewer.config.animation = {clip: this.currentClip || '', autoplay: this.playing, speed: this.speed};
            Notification.addNotification({message: this.strings.defaultssaved, type: 'success'});
            return null;
        }).catch(Notification.exception);
    }

    /**
     * Open the guided tour panel at the first step.
     */
    openTour() {
        if (!this.tourPanel) {
            this.buildTourPanel();
        }
        this.tourPanel.hidden = false;
        this.tourIndex = this.tour.length ? 0 : -1;
        this.showStep(false);
        this.tourPanel.querySelector('.gear-tour-next').focus();
    }

    /**
     * Close the tour panel.
     */
    closeTour() {
        this.tourPanel.hidden = true;
        this.flight = null;
        this.panel.querySelector('button').focus();
    }

    /**
     * Create the panel with the step text and the navigation buttons.
     */
    buildTourPanel() {
        const s = this.strings;
        const panel = this.el('div', 'gear-tour');
        panel.setAttribute('role', 'region');
        panel.setAttribute('aria-label', s.tour);
        panel.hidden = true;
        panel.innerHTML = '<div class="gear-tour-head"><strong class="gear-tour-title"></strong>' +
            '<button type="button" class="gear-tour-close close" aria-label="' + escapeHtml(s.tourclose) +
            '">&times;</button></div>' +
            '<div class="gear-tour-body" aria-live="polite"></div>' +
            '<div class="gear-tour-nav"><button type="button" class="btn btn-sm btn-light gear-tour-prev">' +
            escapeHtml(s.tourprevious) + '</button><span class="gear-tour-count"></span>' +
            '<button type="button" class="btn btn-sm btn-primary gear-tour-next">' + escapeHtml(s.tournext) + '</button></div>';
        if (this.viewer.canManage) {
            const edit = this.el('div', 'gear-tour-edit');
            [
                ['add', s.touradd, 'plus'], ['edit', s.touredit, 'pen'], ['delete', s.tourdelete, 'trash'],
                ['up', s.tourmoveup, 'arrow-up'], ['down', s.tourmovedown, 'arrow-down'],
            ].forEach(([action, label, icon]) => {
                const button = this.el('button', 'btn btn-sm btn-outline-light',
                    '<i class="fa fa-' + icon + '" aria-hidden="true"></i>');
                button.type = 'button';
                button.dataset.action = action;
                button.title = label;
                button.setAttribute('aria-label', label);
                edit.appendChild(button);
            });
            panel.appendChild(edit);
            edit.addEventListener('click', (e) => {
                const button = e.target.closest('button');
                if (button) {
                    this.editAction(button.dataset.action);
                }
            });
        }
        panel.querySelector('.gear-tour-close').addEventListener('click', () => this.closeTour());
        panel.querySelector('.gear-tour-prev').addEventListener('click', () => this.go(-1));
        panel.querySelector('.gear-tour-next').addEventListener('click', () => this.go(1));
        panel.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                this.closeTour();
            }
        });
        this.viewer.controls.addEventListener('start', () => {
            this.flight = null;
        });
        this.viewer.container.appendChild(panel);
        this.tourPanel = panel;
    }

    /**
     * Move to the previous or next step.
     *
     * @param {number} direction -1 or 1
     */
    go(direction) {
        const next = this.tourIndex + direction;
        if (next >= 0 && next < this.tour.length) {
            this.tourIndex = next;
            this.showStep(true);
        }
    }

    /**
     * Show the current step and fly the camera to its view.
     *
     * @param {boolean} fly Whether to move the camera
     */
    async showStep(fly) {
        const panel = this.tourPanel;
        const step = this.tour[this.tourIndex];
        const total = this.tour.length;
        panel.querySelector('.gear-tour-title').textContent = step ? step.title : '';
        panel.querySelector('.gear-tour-body').textContent = step ? step.text : this.strings.tourempty;
        panel.querySelector('.gear-tour-count').textContent = step
            ? await Str.get_string('tourstep', 'mod_gear', {current: this.tourIndex + 1, total}) : '';
        panel.querySelector('.gear-tour-prev').disabled = !step || this.tourIndex === 0;
        panel.querySelector('.gear-tour-next').disabled = !step || this.tourIndex >= total - 1;
        panel.querySelectorAll('.gear-tour-edit [data-action]').forEach((button) => {
            const a = button.dataset.action;
            button.disabled = !step && a !== 'add' ? true
                : (a === 'up' && this.tourIndex === 0) || (a === 'down' && this.tourIndex >= total - 1);
        });
        if (step && (fly || this.tourIndex === 0)) {
            this.flyTo(step);
        }
    }

    /**
     * Move the camera to the view of a step.
     *
     * @param {Object} step Tour step
     */
    flyTo(step) {
        const camera = this.viewer.camera;
        const controls = this.viewer.controls;
        const toPosition = new THREE.Vector3(...step.position);
        const toTarget = new THREE.Vector3(...step.target);
        if (prefersReducedMotion()) {
            camera.position.copy(toPosition);
            controls.target.copy(toTarget);
            controls.update();
            return;
        }
        this.flight = {
            elapsed: 0,
            fromPosition: camera.position.clone(),
            toPosition,
            fromTarget: controls.target.clone(),
            toTarget,
        };
    }

    /**
     * Handle one of the teacher's edit buttons.
     *
     * @param {string} action add, edit, delete, up or down
     */
    async editAction(action) {
        const i = this.tourIndex;
        if (action === 'add' || action === 'edit') {
            const existing = action === 'edit' ? this.tour[i] : null;
            const values = await this.askStep(existing);
            if (!values) {
                return;
            }
            if (existing) {
                Object.assign(existing, values);
            } else {
                // A new step remembers the current camera view.
                const camera = this.viewer.camera;
                const target = this.viewer.controls.target;
                const view = {
                    position: [camera.position.x, camera.position.y, camera.position.z].map((n) => Math.round(n * 1e4) / 1e4),
                    target: [target.x, target.y, target.z].map((n) => Math.round(n * 1e4) / 1e4),
                };
                this.tour.splice(i + 1, 0, {...values, ...view});
                this.tourIndex = i + 1;
            }
        } else if (action === 'delete') {
            try {
                await Notification.deleteCancelPromise(
                    this.strings.tourdelete, this.strings.tourdeleteconfirm, await Str.get_string('delete', 'core'));
            } catch (e) {
                return;
            }
            this.tour.splice(i, 1);
            this.tourIndex = Math.min(i, this.tour.length - 1);
        } else {
            const j = action === 'up' ? i - 1 : i + 1;
            [this.tour[i], this.tour[j]] = [this.tour[j], this.tour[i]];
            this.tourIndex = j;
        }
        await this.saveTour();
        this.showStep(false);
    }

    /**
     * Ask for the title and text of a step.
     *
     * @param {Object|null} step Existing step to edit
     * @returns {Promise<Object|null>} {title, text} or null when cancelled
     */
    async askStep(step) {
        const id = 'gear-tour-' + this.viewer.cmid;
        const s = this.strings;
        const modal = await ModalSaveCancel.create({
            title: step ? s.touredit : s.touradd,
            body: '<div class="mb-3"><label class="form-label" for="' + id + '-title">' + escapeHtml(s.tourtitle) + '</label>' +
                '<input type="text" class="form-control" maxlength="120" id="' + id + '-title" value="' +
                escapeHtml(step ? step.title : '') + '"></div>' +
                '<div class="mb-3"><label class="form-label" for="' + id + '-text">' + escapeHtml(s.tourtext) + '</label>' +
                '<textarea class="form-control" rows="4" maxlength="1000" id="' + id + '-text">' +
                escapeHtml(step ? step.text : '') + '</textarea></div>',
            removeOnClose: true,
        });
        const root = modal.getRoot()[0];
        return new Promise((resolve) => {
            let values = null;
            modal.getRoot().on(ModalEvents.save, () => {
                values = {
                    title: root.querySelector('#' + id + '-title').value.trim(),
                    text: root.querySelector('#' + id + '-text').value.trim(),
                };
            });
            modal.getRoot().on(ModalEvents.hidden, () => resolve(values));
            modal.getRoot().on(ModalEvents.shown, () => root.querySelector('#' + id + '-title').focus());
            modal.show();
        });
    }

    /**
     * Save the tour steps.
     *
     * @returns {Promise}
     */
    saveTour() {
        return Ajax.call([{
            methodname: 'mod_gear_save_scene_config',
            args: {gearid: this.viewer.gearid, tour: JSON.stringify(this.tour)},
        }])[0].catch(Notification.exception);
    }

    /**
     * Release the mixers and panels.
     */
    destroy() {
        this.mixers.forEach((mixer) => mixer.stopAllAction());
        this.flight = null;
    }
}
