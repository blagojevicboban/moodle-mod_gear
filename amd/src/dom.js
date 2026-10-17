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
 * DOM helpers of the GEAR viewer: safe text handling, modal dialogs and the reduced motion preference.
 *
 * @module     mod_gear/dom
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

/**
 * Escape text for safe insertion into HTML.
 *
 * @param {*} value Any value
 * @returns {string} Escaped string
 */
export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

/**
 * Whether the user asked the system for reduced motion.
 *
 * @returns {boolean} True when animations should be avoided
 */
export const prefersReducedMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

/**
 * Open a modal dialog: focus the first control, trap Tab, close with Escape and give focus back to the opener.
 *
 * @param {HTMLElement} modal Modal element (role=dialog)
 */
export const openDialog = (modal) => {
    modal.classList.add('active');
    modal.style.display = 'flex';
    modal.gearOpener = document.activeElement;
    const selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusable = () => Array.from(modal.querySelectorAll(selector)).filter((el) => !el.disabled && el.offsetParent !== null);
    if (!modal.gearKeyHandler) {
        modal.gearKeyHandler = (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                closeDialog(modal);
            } else if (e.key === 'Tab') {
                const items = focusable();
                if (!items.length) {
                    return;
                }
                const first = items[0];
                const last = items[items.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };
        modal.addEventListener('keydown', modal.gearKeyHandler);
    }
    const items = focusable();
    if (items.length) {
        items[0].focus();
    }
};

/**
 * Close a modal opened with openDialog and return focus to the element that opened it.
 *
 * @param {HTMLElement} modal Modal element
 */
export const closeDialog = (modal) => {
    modal.classList.remove('active');
    modal.style.display = 'none';
    if (modal.gearOpener && modal.gearOpener.focus) {
        modal.gearOpener.focus();
    }
};

/**
 * Convert an HTML fragment to plain text without executing anything (inert document).
 *
 * @param {string} html HTML fragment
 * @returns {string} Plain text
 */
export const htmlToText = (html) => new DOMParser().parseFromString(String(html ?? ''), 'text/html').body.textContent || '';
