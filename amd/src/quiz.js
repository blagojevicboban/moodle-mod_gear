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
 * Quiz hotspot form helpers, popup rendering, and answer submission for mod_gear.
 *
 * @module     mod_gear/quiz
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import Ajax from 'core/ajax';
import Notification from 'core/notification';
import Str from 'core/str';
import Templates from 'core/templates';

/**
 * Build template context for the quiz fields in the hotspot form.
 *
 * @param {Object} config Decoded hotspot config
 * @returns {Object}
 */
export const quizFormContext = (config) => {
    const quizType = config.quizType || 'single';
    const bankCategoryId = parseInt(config.bankCategoryId || 0, 10) || 0;
    return {
        bankCategoryId,
        isCategoryQuiz: bankCategoryId > 0,
        isSingle: quizType === 'single',
        isMulti: quizType === 'multi',
        isText: quizType === 'text',
        options: config.options ? config.options.join(', ') : '',
        correctAnswer: quizType === 'multi' ? (config.correctAnswers || []).join(', ') : (config.correctAnswer || 0),
        accepted: (config.acceptedAnswers || []).join('\n'),
        caseSensitive: !!config.caseSensitive,
        points: config.points || 10,
    };
};

/**
 * Toggle visibility of choice vs text quiz fields in the hotspot form.
 *
 * @param {HTMLElement} form The hotspot form
 * @param {number} cmid Course module ID
 */
export const showQuizTypeFields = (form, cmid) => {
    const text = form.querySelector('#gear-hotspot-input-quiztype-' + cmid).value === 'text';
    form.querySelectorAll('.gear-quiz-choice-fields').forEach((el) => {
        el.hidden = text;
    });
    form.querySelectorAll('.gear-quiz-text-fields').forEach((el) => {
        el.hidden = !text;
    });
};

/**
 * Submit a quiz answer to the server and update popup feedback.
 *
 * @param {Object} viewer GearViewer instance
 * @param {Object} hotspot Hotspot data
 * @param {string} answer Submitted answer
 * @param {HTMLElement} popup Hotspot popup element
 */
export const submitQuizAnswer = (viewer, hotspot, answer, popup) => {
    Ajax.call([{
        methodname: 'mod_gear_submit_quiz',
        args: {
            gearid: viewer.gearid,
            hotspotid: hotspot.id,
            answer: answer
        }
    }])[0].then(async(response) => {
        const feedbackDiv = popup.querySelector('.gear-quiz-feedback');
        const submitBtn = popup.querySelector('.gear-quiz-submit');

        if (response.correct) {
            const msg = await Str.get_string('quiz_correct', 'mod_gear');
            feedbackDiv.textContent = '';
            const okBadge = document.createElement('span');
            okBadge.className = 'badge badge-success bg-success';
            okBadge.textContent = msg;
            feedbackDiv.append(okBadge, ' ' + await Str.get_string('quizpointsawarded', 'mod_gear', response.score));
            await viewer.refreshHotspots();
        } else {
            const msg = await Str.get_string('quiz_incorrect', 'mod_gear');
            feedbackDiv.textContent = '';
            const badBadge = document.createElement('span');
            badBadge.className = 'badge badge-danger bg-danger';
            badBadge.textContent = msg;
            feedbackDiv.append(badBadge);
        }

        submitBtn.disabled = true;
        return null;
    }).catch(Notification.exception);
};

/**
 * Render quiz UI inside a hotspot popup.
 *
 * @param {Object} viewer GearViewer instance
 * @param {HTMLElement} popup Hotspot popup element
 * @param {Object} hotspot Hotspot data
 */
export const renderQuizInPopup = (viewer, popup, hotspot) => {
    const contentDiv = popup.querySelector('.gear-hotspot-content');
    const config = (typeof hotspot.config === 'string') ? JSON.parse(hotspot.config) : hotspot.config;

    const quizType = (config && config.quizType) || 'single';
    if (config && config.bankCategoryId > 0 && !config.options && quizType !== 'text') {
        Str.get_string('quizbankcategory_preview', 'mod_gear').then((msg) => {
            const note = Object.assign(document.createElement('p'), {className: 'text-info', textContent: msg});
            contentDiv.appendChild(note);
            return null;
        }).catch(Notification.exception);
        return;
    }
    if (!config || (quizType !== 'text' && !config.options)) {
        Str.get_string('quiz_invalid', 'mod_gear').then((msg) => {
            const note = Object.assign(document.createElement('p'), {className: 'text-danger', textContent: msg});
            contentDiv.appendChild(note);
            return null;
        }).catch(Notification.exception);
        return;
    }

    const context = {
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

        const submitBtn = popup.querySelector('.gear-quiz-submit');
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
            submitQuizAnswer(viewer, hotspot, answer, popup);
        });
        return null;
    }).catch(Notification.exception);
};
