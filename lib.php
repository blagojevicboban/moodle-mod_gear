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
 * @see plugin_supports()
 * @param string $feature FEATURE_xx constant for requested feature
 * @return bool|string|null True if supported, null if unknown, otherwise the value
 */
function gear_supports(string $feature): bool|string|null {
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
 * Given an object containing all the necessary data,
 * (defined by the form in mod_form.php) this function
 * will create a new instance and return the id number
 * of the new instance.
 *
 * @param stdClass $gear An object from the form in mod_form.php
 * @param mod_gear_mod_form|null $mform The form instance
 * @return int The id of the newly inserted gear record
 */
function gear_add_instance(stdClass $gear, ?mod_gear_mod_form $mform = null): int {
    global $DB;

    $gear->timecreated = time();
    $gear->timemodified = time();

    // Process scene config if needed.
    if (empty($gear->scene_config)) {
        $gear->scene_config = json_encode([
            'background' => '#1a1a2e',
            'lighting' => 'studio',
            'camera' => ['position' => [0, 1.6, 3]],
        ]);
    }

    $gear->id = $DB->insert_record('gear', $gear);

    return $gear->id;
}

/**
 * Updates an existing GEAR instance.
 *
 * Given an object containing all the necessary data,
 * (defined by the form in mod_form.php) this function
 * will update an existing instance with new data.
 *
 * @param stdClass $gear An object from the form in mod_form.php
 * @param mod_gear_mod_form|null $mform The form instance
 * @return bool True on success, false on failure
 */
function gear_update_instance(stdClass $gear, ?mod_gear_mod_form $mform = null): bool {
    global $DB;

    $gear->timemodified = time();
    $gear->id = $gear->instance;

    return $DB->update_record('gear', $gear);
}

/**
 * Deletes a GEAR instance.
 *
 * @param int $id Id of the module instance
 * @return bool True on success, false on failure
 */
function gear_delete_instance(int $id): bool {
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
 * @param stdClass $course The course object
 * @param stdClass $cm The course module object
 * @param context_module $context The context
 * @param string $filearea The name of the file area
 * @param array $args Extra arguments (itemid, path)
 * @param bool $forcedownload Whether or not force download
 * @param array $options Additional options affecting the file serving
 * @return bool False if the file not found, just send the file otherwise
 */
function gear_pluginfile(
    stdClass $course,
    stdClass $cm,
    context_module $context,
    string $filearea,
    array $args,
    bool $forcedownload,
    array $options = []
): bool {
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
    return true;
}
