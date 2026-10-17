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
 * Pick a question from the course question banks to fill the quiz fields of a hotspot.
 *
 * @module     mod_gear/bank
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import Ajax from 'core/ajax';
import Notification from 'core/notification';
import Str from 'core/str';
import ModalSaveCancel from 'core/modal_save_cancel';
import ModalEvents from 'core/modal_events';
import {escapeHtml} from './dom';

/**
 * Let the teacher choose a question of the course question banks.
 *
 * @param {number} gearid GEAR activity ID
 * @param {number} cmid Course module ID (used for element ids)
 * @returns {Promise<Object|null>} The chosen question {name, text, options, correct} or null
 */
export const pickQuestion = async(gearid, cmid) => {
    const [questions, title, label, help, none] = await Promise.all([
        Ajax.call([{methodname: 'mod_gear_get_bank_questions', args: {gearid}}])[0],
        Str.get_string('importquestion', 'mod_gear'),
        Str.get_string('importquestionchoose', 'mod_gear'),
        Str.get_string('importquestionhelp', 'mod_gear'),
        Str.get_string('importquestionnone', 'mod_gear'),
    ]);
    if (!questions.length) {
        Notification.alert(title, none);
        return null;
    }
    const id = 'gear-bank-' + cmid;
    const rows = questions.map((q, i) => '<option value="' + i + '">' + escapeHtml(q.name) + '</option>').join('');
    const modal = await ModalSaveCancel.create({
        title,
        body: '<p class="text-muted">' + escapeHtml(help) + '</p><div class="mb-3"><label class="form-label" for="' + id + '">' +
            escapeHtml(label) + '</label><select class="form-control custom-select" id="' + id + '">' + rows + '</select></div>' +
            '<div class="small" id="' + id + '-preview" aria-live="polite"></div>',
        removeOnClose: true,
    });
    const root = modal.getRoot()[0];
    const select = root.querySelector('#' + id);
    const preview = root.querySelector('#' + id + '-preview');
    const showPreview = () => {
        const q = questions[Number(select.value)];
        preview.textContent = '';
        const text = document.createElement('p');
        text.textContent = q.text;
        // Choices with the correct ones in bold, or the accepted answers of a short answer question.
        const list = document.createElement(q.quiztype === 'text' ? 'ul' : 'ol');
        (q.quiztype === 'text' ? q.accepted : q.options).forEach((option, i) => {
            const item = document.createElement('li');
            item.textContent = option;
            if (q.quiztype === 'text' || q.corrects.includes(i)) {
                item.classList.add('font-weight-bold', 'fw-bold');
            }
            list.appendChild(item);
        });
        preview.append(text, list);
    };
    select.addEventListener('change', showPreview);
    showPreview();
    return new Promise((resolve) => {
        let chosen = null;
        modal.getRoot().on(ModalEvents.save, () => {
            chosen = questions[Number(select.value)];
        });
        modal.getRoot().on(ModalEvents.hidden, () => resolve(chosen));
        modal.getRoot().on(ModalEvents.shown, () => select.focus());
        modal.show();
    });
};
