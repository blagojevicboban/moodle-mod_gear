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
 * Help and leaderboard modal helpers for mod_gear.
 *
 * @module     mod_gear/modals
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import Ajax from 'core/ajax';
import Notification from 'core/notification';
import Str from 'core/str';
import Templates from 'core/templates';
import {openDialog, closeDialog} from './dom';

/**
 * Render leaderboard table using Mustache.
 *
 * @param {HTMLElement} container
 * @param {Array} scores
 */
export const renderLeaderboardTable = (container, scores) => {
    const context = {
        has_scores: scores.length > 0, // eslint-disable-line camelcase
        scores: scores.map((entry, index) => {
            let badge = '';
            if (index === 0) {
                badge = '🥇';
            } else if (index === 1) {
                badge = '🥈';
            } else if (index === 2) {
                badge = '🥉';
            }
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
        return null;
    }).catch(Notification.exception);
};

/**
 * Fetch leaderboard data and render into modal.
 *
 * @param {Object} viewer GearViewer instance
 * @param {HTMLElement} modal
 */
export const fetchAndRenderLeaderboard = async(viewer, modal) => {
    openDialog(modal);
    const content = modal.querySelector('.gear-leaderboard-content');
    const loadingText = await Str.get_string('loading', 'mod_gear');
    content.innerHTML = '<div class="text-center"><i class="fa fa-spinner fa-spin"></i> ' + loadingText + '</div>';

    Ajax.call([{
        methodname: 'mod_gear_get_leaderboard',
        args: {
            gearid: viewer.gearid,
            limit: 10
        }
    }])[0].then((scores) => {
        renderLeaderboardTable(content, scores);
        return null;
    }).catch(Notification.exception);
};

/**
 * Show Help modal.
 *
 * @param {Object} viewer GearViewer instance
 */
export const showHelpModal = (viewer) => {
    let modal = document.getElementById('gear-help-modal-' + viewer.cmid);
    if (!modal) {
        Templates.render('mod_gear/help_modal', {
            cmid: viewer.cmid,
            canManage: viewer.canManage
        }).then((html, js) => {
            Templates.appendNodeContents(viewer.container, html, js);
            modal = document.getElementById('gear-help-modal-' + viewer.cmid);
            modal.querySelector('.close').addEventListener('click', () => closeDialog(modal));
            openDialog(modal);
            return null;
        }).catch(Notification.exception);
    } else {
        openDialog(modal);
    }
};

/**
 * Show Leaderboard modal.
 *
 * @param {Object} viewer GearViewer instance
 */
export const showLeaderboardModal = (viewer) => {
    let modal = document.getElementById('gear-leaderboard-modal-' + viewer.cmid);
    if (!modal) {
        Templates.render('mod_gear/leaderboard_modal', {
            cmid: viewer.cmid
        }).then((html, js) => {
            Templates.appendNodeContents(viewer.container, html, js);
            modal = document.getElementById('gear-leaderboard-modal-' + viewer.cmid);
            modal.querySelector('.close').addEventListener('click', () => closeDialog(modal));
            fetchAndRenderLeaderboard(viewer, modal);
            return null;
        }).catch(Notification.exception);
    } else {
        fetchAndRenderLeaderboard(viewer, modal);
    }
};
