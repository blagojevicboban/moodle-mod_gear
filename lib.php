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
 * Library of functions for mod_gear.
 *
 * @package    mod_gear
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

/**
 * Returns the information if the module supports a feature.
 *
 * @param string $feature FEATURE_xx constant for requested feature
 * @return mixed true if supported, null if unknown
 */
function gear_supports($feature) {
    switch ($feature) {
        case FEATURE_MOD_INTRO:
            return true;
        case FEATURE_SHOW_DESCRIPTION:
            return true;
        case FEATURE_BACKUP_MOODLE2:
            return true;
        case FEATURE_COMPLETION_TRACKS_VIEWS:
            return true;
        case FEATURE_COMPLETION_HAS_RULES:
            return true;
        case FEATURE_GRADE_HAS_GRADE:
            return false;
        case FEATURE_GRADE_OUTCOMES:
            return false;
        case FEATURE_MOD_PURPOSE:
            return MOD_PURPOSE_CONTENT;
        default:
            return null;
    }
}

/**
 * Adds a new GEAR instance.
 *
 * @param stdClass $gear The data from the form
 * @param mod_gear_mod_form $mform The form
 * @return int The id of the newly inserted gear record
 */
function gear_add_instance($gear, $mform = null) {
    global $DB;

    $gear->timecreated = time();
    $gear->timemodified = time();

    // Process scene config if needed.
    if (empty($gear->scene_config)) {
        $gear->scene_config = json_encode([
            'background' => '#1a1a2e',
            'lighting' => 'studio',
            'camera' => ['position' => [0, 1.6, 3]]
        ]);
    }

    $gear->id = $DB->insert_record('gear', $gear);

    return $gear->id;
}

/**
 * Updates an existing GEAR instance.
 *
 * @param stdClass $gear The data from the form
 * @param mod_gear_mod_form $mform The form
 * @return bool Success/Failure
 */
function gear_update_instance($gear, $mform = null) {
    global $DB;

    $gear->timemodified = time();
    $gear->id = $gear->instance;

    return $DB->update_record('gear', $gear);
}

/**
 * Deletes a GEAR instance.
 *
 * @param int $id Id of the module instance
 * @return bool Success/Failure
 */
function gear_delete_instance($id) {
    global $DB;

    if (!$gear = $DB->get_record('gear', ['id' => $id])) {
        return false;
    }

    // Delete related records.
    $DB->delete_records('gear_models', ['gearid' => $id]);
    $DB->delete_records('gear_hotspots', ['gearid' => $id]);
    $DB->delete_records('gear_tracking', ['gearid' => $id]);

    // Delete the main record.
    $DB->delete_records('gear', ['id' => $id]);

    return true;
}

/**
 * Serves the files from the gear file areas.
 *
 * @param stdClass $course the course object
 * @param stdClass $cm the course module object
 * @param stdClass $context the context
 * @param string $filearea the name of the file area
 * @param array $args extra arguments (itemid, path)
 * @param bool $forcedownload whether or not force download
 * @param array $options additional options affecting the file serving
 * @return bool false if the file not found, just send the file otherwise
 */
function gear_pluginfile($course, $cm, $context, $filearea, $args, $forcedownload, array $options = []) {
    if ($context->contextlevel != CONTEXT_MODULE) {
        return false;
    }

    require_login($course, true, $cm);

    if ($filearea !== 'model' && $filearea !== 'content') {
        return false;
    }

    $itemid = array_shift($args);
    $filename = array_pop($args);
    $filepath = $args ? '/' . implode('/', $args) . '/' : '/';

    $fs = get_file_storage();
    $file = $fs->get_file($context->id, 'mod_gear', $filearea, $itemid, $filepath, $filename);

    if (!$file) {
        return false;
    }

    send_stored_file($file, 86400, 0, $forcedownload, $options);
}
