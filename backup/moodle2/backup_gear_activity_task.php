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
 * Backup task for mod_gear.
 *
 * @package    mod_gear
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

require_once($CFG->dirroot . '/mod/gear/backup/moodle2/backup_gear_stepslib.php');

/**
 * Backup task for mod_gear.
 */
class backup_gear_activity_task extends backup_activity_task {

    /**
     * Define the settings for this activity.
     */
    protected function define_my_settings() {
        // No special settings for this activity.
    }

    /**
     * Define the steps for this activity.
     */
    protected function define_my_steps() {
        $this->add_step(new backup_gear_activity_structure_step('gear_structure', 'gear.xml'));
    }

    /**
     * Encode content links.
     *
     * @param string $content The content to encode
     * @return string The encoded content
     */
    static public function encode_content_links($content) {
        global $CFG;

        $base = preg_quote($CFG->wwwroot, "/");

        // Link to the list of instances.
        $search = "/(" . $base . "\/mod\/gear\/index.php\?id\=)([0-9]+)/";
        $content = preg_replace($search, '$@GEARINDEX*$2@$', $content);

        // Link to the view.
        $search = "/(" . $base . "\/mod\/gear\/view.php\?id\=)([0-9]+)/";
        $content = preg_replace($search, '$@GEARVIEWBYID*$2@$', $content);

        return $content;
    }
}
