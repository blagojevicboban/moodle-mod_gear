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
            return true;
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

    // Build scene config from form fields.
    $gear->scene_config = json_encode([
        'background' => $gear->background_color ?? '#1a1a2e',
        'lighting' => $gear->lighting ?? 'studio',
        'camera' => ['position' => [0, 1.6, 3]],
        'hotspots' => [
            'enabled' => isset($gear->enablehotspots) ? (bool)$gear->enablehotspots : true,
            'edit' => isset($gear->edithotspots) ? (bool)$gear->edithotspots : false,
        ],
    ]);

    $gear->id = $DB->insert_record('gear', $gear);

    // Save uploaded model files.
    $cmid = $gear->coursemodule;
    $context = context_module::instance($cmid);
    if (!empty($gear->modelfiles)) {
        file_save_draft_area_files(
            $gear->modelfiles,
            $context->id,
            'mod_gear',
            'model',
            0,
            ['subdirs' => 0, 'maxfiles' => 10]
        );

        // Create gear_models records for each uploaded file.
        gear_sync_model_records($gear->id, $context->id);
    }

    gear_grade_item_update($gear);
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

    // Build scene config from form fields.
    $gear->scene_config = json_encode([
        'background' => $gear->background_color ?? '#1a1a2e',
        'lighting' => $gear->lighting ?? 'studio',
        'camera' => ['position' => [0, 1.6, 3]],
        'hotspots' => [
            'enabled' => isset($gear->enablehotspots) ? (bool)$gear->enablehotspots : true,
            'edit' => isset($gear->edithotspots) ? (bool)$gear->edithotspots : false,
        ],
    ]);

    $result = $DB->update_record('gear', $gear);

    // Save uploaded model files.
    $cmid = $gear->coursemodule;
    $context = context_module::instance($cmid);
    if (isset($gear->modelfiles)) {
        file_save_draft_area_files(
            $gear->modelfiles,
            $context->id,
            'mod_gear',
            'model',
            0,
            ['subdirs' => 0, 'maxfiles' => 10]
        );

        // Sync gear_models records.
        gear_sync_model_records($gear->id, $context->id);
    }

    gear_grade_item_update($gear);
    return $result;
}

/**
 * Sync gear_models table with uploaded files.
 *
 * @param int $gearid The GEAR instance ID
 * @param int $contextid The context ID
 * @return void
 */
function gear_sync_model_records(int $gearid, int $contextid): void {
    global $DB;

    $fs = get_file_storage();
    $files = $fs->get_area_files($contextid, 'mod_gear', 'model', 0, 'filename', false);

    // Get existing model records.
    $existing = $DB->get_records('gear_models', ['gearid' => $gearid], '', 'filepath, id');

    $processed = [];
    foreach ($files as $file) {
        $filepath = $file->get_filename();
        $processed[$filepath] = true;

        if (!isset($existing[$filepath])) {
            // Add new model record.
            $record = new stdClass();
            $record->gearid = $gearid;
            $record->name = pathinfo($filepath, PATHINFO_FILENAME);
            $record->filepath = $filepath;
            $record->filesize = $file->get_filesize();
            $record->format = pathinfo($filepath, PATHINFO_EXTENSION);
            $record->scale = 1.0;
            $record->timecreated = time();
            $DB->insert_record('gear_models', $record);
        }
    }

    // Remove records for deleted files.
    foreach ($existing as $filepath => $record) {
        if (!isset($processed[$filepath])) {
            $DB->delete_records('gear_models', ['id' => $record->id]);
        }
    }
}

/**
 * Return grade for given user or all users.
 *
 * @param int $gearid id of gear
 * @param int $userid optional user id, 0 means all users
 * @return array array of grades, false if none
 */
function gear_get_user_grades($gear, $userid = 0) {
    global $DB;

    $params = array('gearid' => $gear->id);
    $sql = "SELECT u.id as userid, t.data
              FROM {user} u
              JOIN {gear_tracking} t ON t.userid = u.id
             WHERE t.gearid = :gearid AND t.action = 'quiz_submit'";

    if ($userid) {
        $params['userid'] = $userid;
        $sql .= " AND u.id = :userid";
    }

    $tracking = $DB->get_records_sql($sql, $params);
    $grades = array();

    foreach ($tracking as $track) {
        $data = json_decode($track->data, true);
        if (isset($data['score'])) {
            if (!isset($grades[$track->userid])) {
                $grades[$track->userid] = array(
                    'id' => $track->userid,
                    'userid' => $track->userid,
                    'rawgrade' => 0,
                    'hotspots' => []
                );
            }
            
            // Logic: take max score per hotspot.
            $hotspotid = isset($data['hotspotid']) ? $data['hotspotid'] : 0;
            $current_hotspot_score = isset($grades[$track->userid]['hotspots'][$hotspotid]) ? $grades[$track->userid]['hotspots'][$hotspotid] : 0;
            
            if ($data['score'] > $current_hotspot_score) {
                // Update total.
                $grades[$track->userid]['rawgrade'] += ($data['score'] - $current_hotspot_score);
                $grades[$track->userid]['hotspots'][$hotspotid] = $data['score'];
            }
        }
    }

    return $grades;
}

/**
 * Update grades in the gradebook.
 *
 * @param stdClass $gear The module instance
 * @param int $userid Specific user only, 0 means all
 * @param bool $nullifnone If true and the user has no grade then a null value is sent to the gradebook
 */
function gear_update_grades($gear, $userid = 0, $nullifnone = true) {
    global $CFG;
    require_once($CFG->libdir.'/gradelib.php');

    if ($gear->grade == 0) {
        gear_grade_item_update($gear);
    } else if ($grades = gear_get_user_grades($gear, $userid)) {
        gear_grade_item_update($gear, $grades);
    } else if ($userid && $nullifnone) {
        $grade = new stdClass();
        $grade->userid = $userid;
        $grade->rawgrade = null;
        gear_grade_item_update($gear, $grade);
    } else {
        gear_grade_item_update($gear);
    }
}

/**
 * Create/update grade item for given gear.
 *
 * @param stdClass $gear The module instance
 * @param mixed $grades Optional array/object of grade(s); 'reset' means reset grades in gradebook
 * @return int 0 if ok, error code otherwise
 */
function gear_grade_item_update($gear, $grades = null) {
    global $CFG;
    require_once($CFG->libdir.'/gradelib.php');

    $params = array('itemname' => $gear->name, 'idnumber' => $gear->cmidnumber);

    if ($gear->grade > 0) {
        $params['gradetype'] = GRADE_TYPE_VALUE;
        $params['grademax'] = $gear->grade;
        $params['grademin'] = 0;
    } else {
        $params['gradetype'] = GRADE_TYPE_NONE;
    }

    if ($grades === 'reset') {
        $params['reset'] = true;
        $grades = null;
    }

    return grade_update('mod/gear', $gear->course, 'mod', 'gear', $gear->id, 0, $grades, $params);
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

    // Set CORS headers for 3D model files.
    $mimetype = $file->get_mimetype();
    if (strpos($mimetype, 'model') !== false || in_array(pathinfo($filename, PATHINFO_EXTENSION), ['gltf', 'glb'])) {
        header('Access-Control-Allow-Origin: *');
    }

    send_stored_file($file, 86400, 0, $forcedownload, $options);
    return true;
}

/**
 * Get all models for a GEAR instance.
 *
 * @param int $gearid The GEAR instance ID
 * @param int $contextid The context ID for generating URLs
 * @return array Array of model objects with URLs
 */
function gear_get_models(int $gearid, int $contextid): array {
    global $DB;

    $models = $DB->get_records('gear_models', ['gearid' => $gearid]);
    $result = [];

    foreach ($models as $model) {
        $url = moodle_url::make_pluginfile_url(
            $contextid,
            'mod_gear',
            'model',
            0,
            '/',
            $model->filepath
        );
        $model->url = $url->out();
        $result[] = $model;
    }

    return $result;
}
