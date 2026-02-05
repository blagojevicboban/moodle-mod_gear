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

/**
 * Restore task for mod_gear.
 *
 * @package    mod_gear
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

require_once($CFG->dirroot . '/mod/gear/backup/moodle2/restore_gear_stepslib.php');

/**
 * Restore task for mod_gear.
 */
class restore_gear_activity_task extends restore_activity_task {

    /**
     * Define (or validate) the restore steps.
     */
    protected function define_my_settings() {
        // No special settings for this activity.
    }

    /**
     * Define the restore steps.
     */
    protected function define_my_steps() {
        $this->add_step(new restore_gear_activity_structure_step('gear_structure', 'gear.xml'));
    }

    /**
     * Define the contents for decoding.
     *
     * @return array
     */
    static public function define_decode_contents() {
        $contents = array();
        $contents[] = new restore_decode_content('gear', array('intro'), 'gear');
        return $contents;
    }

    /**
     * Define the decoding rules.
     *
     * @return array
     */
    static public function define_decode_rules() {
        $rules = array();

        $rules[] = new restore_decode_rule('GEARVIEWBYID', '/mod/gear/view.php?id=$1', 'course_module');
        $rules[] = new restore_decode_rule('GEARINDEX', '/mod/gear/index.php?id=$1', 'course');

        return $rules;
    }

    /**
     * Define the restore log rules.
     *
     * @return array
     */
    static public function define_restore_log_rules() {
        $rules = array();

        $rules[] = new restore_log_rule('gear', 'add', 'view.php?id={course_module}', '{name}');
        $rules[] = new restore_log_rule('gear', 'update', 'view.php?id={course_module}', '{name}');
        $rules[] = new restore_log_rule('gear', 'view', 'view.php?id={course_module}', '{name}');

        return $rules;
    }

    /**
     * Define the restore log rules for the course.
     *
     * @return array
     */
    static public function define_restore_log_rules_for_course() {
        $rules = array();

        $rules[] = new restore_log_rule('gear', 'view all', 'index.php?id={course}', 'gear');

        return $rules;
    }
}
