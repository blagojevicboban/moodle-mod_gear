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
 * Backup steps library for mod_gear.
 *
 * @package    mod_gear
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

/**
 * Backup step for mod_gear.
 */
class backup_gear_activity_structure_step extends backup_activity_structure_step {

    /**
     * Define the structure of the plugin.
     *
     * @return backup_nested_element
     */
    protected function define_structure() {
        // Define the structure of the plugin tables.
        $gear = new backup_nested_element('gear', array('id'), array(
            'course', 'name', 'intro', 'introformat', 'scene_config',
            'ar_enabled', 'vr_enabled', 'completion_type', 'timecreated', 'timemodified'
        ));

        $models = new backup_nested_element('gear_models');
        $model = new backup_nested_element('gear_model', array('id'), array(
            'name', 'filepath', 'filesize', 'format', 'metadata',
            'position', 'rotation', 'scale', 'timecreated'
        ));

        $hotspots = new backup_nested_element('gear_hotspots');
        $hotspot = new backup_nested_element('gear_hotspot', array('id'), array(
            'modelid', 'type', 'title', 'content', 'position',
            'icon', 'config', 'sortorder'
        ));

        $trackings = new backup_nested_element('gear_trackings');
        $tracking = new backup_nested_element('gear_tracking', array('id'), array(
            'userid', 'action', 'data', 'duration', 'timecreated'
        ));

        // Build the tree.
        $gear->add_child($models);
        $models->add_child($model);

        $gear->add_child($hotspots);
        $hotspots->add_child($hotspot);

        $gear->add_child($trackings);
        $trackings->add_child($tracking);

        // Sources.
        $gear->set_source_table('gear', array('id' => backup::VAR_ACTIVITYID));

        $model->set_source_table('gear_models', array('gearid' => backup::VAR_PARENTID));
        $hotspot->set_source_table('gear_hotspots', array('gearid' => backup::VAR_PARENTID));

        // Tracking data is user data, so only include if users are included in backup.
        if ($this->get_setting_value('userinfo')) {
            $tracking->set_source_table('gear_tracking', array('gearid' => backup::VAR_PARENTID));
        }

        // Annotations.
        // Identify file areas.
        $gear->annotate_files('mod_gear', 'intro', null); // Intro files.
        $gear->annotate_files('mod_gear', 'model', null); // Model files (attached to module context, itemid 0).

        return $this->prepare_activity_structure($gear);
    }
}
