<?php
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

namespace mod_gear\output;

use context_module;
use moodle_url;

/**
 * Mobile output class for mod_gear.
 *
 * The Moodle app cannot run the WebGL/WebXR viewer, so the app shows the description, the student's progress and a
 * button that opens the activity in the browser (with automatic login).
 *
 * @package    mod_gear
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class mobile {
    /**
     * Returns the mobile view of the activity.
     *
     * @param array $args Arguments from the app (cmid, courseid, userid)
     * @return array
     */
    public static function mobile_course_view($args) {
        global $DB, $OUTPUT, $USER;

        $args = (object) $args;
        $cm = get_coursemodule_from_id('gear', $args->cmid, 0, false, MUST_EXIST);
        $gear = $DB->get_record('gear', ['id' => $cm->instance], '*', MUST_EXIST);
        $context = context_module::instance($cm->id);
        require_login($cm->course, false, $cm, true, true);
        require_capability('mod/gear:view', $context);

        $data = [
            'cmid' => $cm->id,
            'name' => format_string($gear->name, true, ['context' => $context]),
            'intro' => format_module_intro('gear', $gear, $cm->id),
            'viewurl' => (new moodle_url('/mod/gear/view.php', ['id' => $cm->id]))->out(false),
        ];

        // Progress of the current user (not for teachers, who see the report in the browser).
        if (!has_capability('mod/gear:manage', $context)) {
            $rows = (new \mod_gear\local\student_report($gear))->rows([$USER]);
            $row = reset($rows);
            $data['progress'] = [
                'viewed' => $row['viewed'] . ' / ' . $row['viewable'],
                'solved' => $row['solved'] . ' / ' . $row['quizzes'],
                'points' => $row['points'] . ' / ' . $row['maxpoints'],
                'hasquizzes' => $row['quizzes'] > 0,
            ];
        }

        return [
            'templates' => [
                [
                    'id' => 'main',
                    'html' => $OUTPUT->render_from_template('mod_gear/mobile_view', $data),
                ],
            ],
            'javascript' => '',
            'otherdata' => '',
        ];
    }
}
