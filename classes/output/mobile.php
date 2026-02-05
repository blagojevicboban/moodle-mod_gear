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

defined('MOODLE_INTERNAL') || die();

use context_module;

/**
 * Mobile output class for mod_gear.
 *
 * @package    mod_gear
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class mobile {

    /**
     * Returns the mobile view data.
     *
     * @param array $args
     * @return array
     */
    public static function mobile_course_view($args) {
        global $DB, $CFG;

        $args = (object) $args;
        $cm = get_coursemodule_from_id('gear', $args->cmid);
        $gear = $DB->get_record('gear', ['id' => $cm->instance]);
        $context = context_module::instance($cm->id);

        $data = [
            'gear' => $gear,
            'cmid' => $cm->id,
            'courseid' => $cm->course,
            'name' => $gear->name,
            'intro' => format_text($gear->intro, $gear->introformat, ['context' => $context]),
            'warning' => get_string('mobile_warning', 'mod_gear'),
        ];

        return [
            'templates' => [
                [
                    'id' => 'main',
                    'html' => file_get_contents($CFG->dirroot . '/mod/gear/templates/mobile_view.mustache'),
                ],
            ],
            'javascript' => '', // Add mobile-specific JS here if needed.
            'otherdata' => $data,
        ];
    }
}
