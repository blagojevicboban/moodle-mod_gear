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
 * Restore steps library for mod_gear.
 *
 * @package    mod_gear
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

/**
 * Restore step for mod_gear.
 */
class restore_gear_activity_structure_step extends restore_activity_structure_step {

    /**
     * Define the structure of the restore step.
     *
     * @return restore_path_element[]
     */
    protected function define_structure() {
        $paths = array();

        $paths[] = new restore_path_element('gear', '/activity/gear');
        $paths[] = new restore_path_element('gear_model', '/activity/gear/gear_models/gear_model');
        $paths[] = new restore_path_element('gear_hotspot', '/activity/gear/gear_hotspots/gear_hotspot');
        if ($this->get_setting_value('userinfo')) {
            $paths[] = new restore_path_element('gear_tracking', '/activity/gear/gear_trackings/gear_tracking');
        }

        return $this->prepare_activity_structure($paths);
    }

    /**
     * Process the restoration of the gear main record.
     *
     * @param array $data The data from the XML
     */
    protected function process_gear($data) {
        global $DB;

        $data = (object)$data;
        $oldid = $data->id;
        $data->course = $this->get_courseid();
        $data->timemodified = $this->apply_date_offset($data->timemodified);
        $data->timecreated = $this->apply_date_offset($data->timecreated);

        // Insert the gear record.
        $newitemid = $DB->insert_record('gear', $data);
        $this->apply_activity_instance($newitemid);
    }

    /**
     * Process the restoration of gear models.
     *
     * @param array $data The data from the XML
     */
    protected function process_gear_model($data) {
        global $DB;

        $data = (object)$data;
        $oldid = $data->id;
        $data->gearid = $this->get_new_parentid('gear');
        $data->timecreated = $this->apply_date_offset($data->timecreated);

        $newitemid = $DB->insert_record('gear_models', $data);
        $this->set_mapping('gear_model', $oldid, $newitemid);
    }

    /**
     * Process the restoration of gear hotspots.
     *
     * @param array $data The data from the XML
     */
    protected function process_gear_hotspot($data) {
        global $DB;

        $data = (object)$data;
        $oldid = $data->id;
        $data->gearid = $this->get_new_parentid('gear');

        // Map modelid if it exists.
        if (!empty($data->modelid)) {
             $data->modelid = $this->get_mappingid('gear_model', $data->modelid);
        }

        $newitemid = $DB->insert_record('gear_hotspots', $data);
        $this->set_mapping('gear_hotspot', $oldid, $newitemid);
    }

    /**
     * Process the restoration of gear tracking data.
     *
     * @param array $data The data from the XML
     */
    protected function process_gear_tracking($data) {
        global $DB;

        $data = (object)$data;
        $data->gearid = $this->get_new_parentid('gear');
        $data->userid = $this->get_mappingid('user', $data->userid);
        $data->timecreated = $this->apply_date_offset($data->timecreated);

        $DB->insert_record('gear_tracking', $data);
    }

    /**
     * After execution actions.
     */
    protected function after_execute() {
        // Add related files.
        $this->add_related_files('mod_gear', 'intro', null);
        $this->add_related_files('mod_gear', 'model', null);
    }
}
