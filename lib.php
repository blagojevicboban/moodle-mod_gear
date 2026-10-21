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
        case FEATURE_GROUPS:
            return true;
        case FEATURE_GROUPINGS:
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

    $gear->scene_config = gear_build_scene_config($gear, null);

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
            ['subdirs' => 1, 'maxfiles' => 20]
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

    // Keep what the viewer saved in the scene config (camera position/target, hotspot colour).
    $oldconfig = $DB->get_field('gear', 'scene_config', ['id' => $gear->id]);

    $gear->scene_config = gear_build_scene_config($gear, $oldconfig ?: null);

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
            ['subdirs' => 1, 'maxfiles' => 20]
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
    $mainformats = ['glb', 'gltf', 'obj', 'fbx'];

    foreach ($files as $file) {
        if ($file->is_directory()) {
            continue;
        }

        $filename = $file->get_filename();
        $filepath = $file->get_filepath();
        $fullpath = ltrim($filepath . $filename, '/');
        $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));

        // Skip non-model entry points (textures, .bin files, etc.) from being independent models.
        if (!in_array($ext, $mainformats)) {
            continue;
        }

        $processed[$fullpath] = true;

        if (!isset($existing[$fullpath])) {
            // Add new model record.
            $record = new stdClass();
            $record->gearid = $gearid;
            $record->name = $filename;
            $record->filepath = $fullpath;
            $record->filesize = $file->get_filesize();
            $record->format = $ext;
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
 * @param stdClass $gear The gear instance
 * @param int $userid optional user id, 0 means all users
 * @return array array of grades, false if none
 */
function gear_get_user_grades($gear, $userid = 0) {
    global $DB;

    $params = ['gearid' => $gear->id];
    $sql = "SELECT t.id, u.id AS userid, t.data
              FROM {user} u
              JOIN {gear_tracking} t ON t.userid = u.id
             WHERE t.gearid = :gearid AND t.action = 'quiz_submit'";

    if ($userid) {
        $params['userid'] = $userid;
        $sql .= " AND u.id = :userid";
    }

    $tracking = $DB->get_records_sql($sql, $params);
    $grades = [];

    foreach ($tracking as $track) {
        $data = json_decode($track->data, true);
        if (isset($data['score'])) {
            if (!isset($grades[$track->userid])) {
                $grades[$track->userid] = [
                    'id' => $track->userid,
                    'userid' => $track->userid,
                    'rawgrade' => 0,
                    'hotspots' => [],
                ];
            }

            // Logic: take max score per hotspot.
            $hotspotid = isset($data['hotspotid']) ? $data['hotspotid'] : 0;
            $currenthotspotscore = isset($grades[$track->userid]['hotspots'][$hotspotid]) ?
                $grades[$track->userid]['hotspots'][$hotspotid] : 0;

            if ($data['score'] > $currenthotspotscore) {
                // Update total.
                $grades[$track->userid]['rawgrade'] += ($data['score'] - $currenthotspotscore);
                $grades[$track->userid]['hotspots'][$hotspotid] = $data['score'];
            }
        }
    }

    // Scale the collected points to the grade of the activity (points of all quiz hotspots = full grade).
    $maxpoints = 0;
    foreach ($DB->get_records('gear_hotspots', ['gearid' => $gear->id, 'type' => 'quiz'], '', 'id, config') as $hs) {
        $cfg = json_decode($hs->config ?? '', true);
        $maxpoints += isset($cfg['points']) ? (int) $cfg['points'] : 10;
    }
    foreach ($grades as $uid => $grade) {
        unset($grades[$uid]['hotspots']);
        if ($gear->grade > 0 && $maxpoints > 0) {
            $grades[$uid]['rawgrade'] = min((float) $gear->grade, $grade['rawgrade'] / $maxpoints * $gear->grade);
        }
    }

    return $grades;
}

/**
 * Build the scene config JSON from form data, keeping viewer-saved values of an existing config.
 *
 * @param stdClass $gear Form data
 * @param string|null $existing Existing scene_config JSON (update) or null (create)
 * @return string JSON
 */
function gear_build_scene_config(stdClass $gear, ?string $existing): string {
    $config = $existing ? (json_decode($existing, true) ?: []) : [];
    $config['background'] = $gear->background_color ?? $config['background'] ?? '#1a1a2e';
    $config['lighting'] = $gear->lighting ?? $config['lighting'] ?? 'studio';
    $config['camera']['position'] = $config['camera']['position'] ?? [0, 1.6, 3];
    $config['camera']['hotspotScale'] = isset($gear->hotspot_scale)
        ? (float) $gear->hotspot_scale : ($config['camera']['hotspotScale'] ?? 1.5);
    $config['hotspots']['enabled'] = isset($gear->enablehotspots)
        ? (bool) $gear->enablehotspots : ($config['hotspots']['enabled'] ?? true);
    $config['alt'] = isset($gear->scene_alt) ? trim((string) $gear->scene_alt) : ($config['alt'] ?? '');
    $config['hotspots']['edit'] = isset($gear->edithotspots)
        ? (bool) $gear->edithotspots : ($config['hotspots']['edit'] ?? false);
    return json_encode($config);
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
    require_once($CFG->libdir . '/gradelib.php');

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
    global $CFG, $DB;
    require_once($CFG->libdir . '/gradelib.php');

    $params = ['itemname' => $gear->name];

    // Get idnumber. Priority: $gear object (form data) > direct DB lookup.
    if (isset($gear->idnumber)) {
        $params['idnumber'] = $gear->idnumber;
    } else {
        $idnumber = '';
        if (!empty($gear->coursemodule)) {
            // Creating new instance: fetch directly from course_modules by ID.
            $idnumber = $DB->get_field('course_modules', 'idnumber', ['id' => $gear->coursemodule]);
        } else {
            // Existing instance: fetch using instance ID.
            $modid = $DB->get_field('modules', 'id', ['name' => 'gear']);
            if ($modid) {
                $idnumber = $DB->get_field('course_modules', 'idnumber', ['module' => $modid, 'instance' => $gear->id]);
            }
        }
        $params['idnumber'] = (string)$idnumber;
    }

    if (isset($gear->grade)) {
        if ($gear->grade > 0) {
            $params['gradetype'] = GRADE_TYPE_VALUE;
            $params['grademax']  = $gear->grade;
            $params['grademin']  = 0;
        } else if ($gear->grade < 0) {
            $params['gradetype'] = GRADE_TYPE_SCALE;
            $params['scaleid']   = -$gear->grade;
        } else {
            $params['gradetype'] = GRADE_TYPE_NONE;
        }
    }

    if (isset($gear->gradepass)) {
        $params['gradepass'] = $gear->gradepass;
    }

    if ($grades === 'reset') {
        $params['reset'] = true;
        $grades = null;
    }

    return grade_update('mod/gear', $gear->course, 'mod', 'gear', $gear->id, 0, $grades, $params);
}

/**
 * Delete the grade item of a GEAR instance.
 *
 * @param stdClass $gear The module instance
 * @return int GRADE_UPDATE_OK or an error code
 */
function gear_grade_item_delete($gear) {
    global $CFG;
    require_once($CFG->libdir . '/gradelib.php');

    return grade_update('mod/gear', $gear->course, 'mod', 'gear', $gear->id, 0, null, ['deleted' => 1]);
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

    // Remove the grade item, then the related records and files.
    gear_grade_item_delete($gear);
    $cm = get_coursemodule_from_instance('gear', $id);
    if ($cm) {
        $context = context_module::instance($cm->id);
        $fs = get_file_storage();
        $fs->delete_area_files($context->id, 'mod_gear', 'model');
        $fs->delete_area_files($context->id, 'mod_gear', 'hotspot_media');
    }
    $DB->delete_records('gear_sessions', ['gearid' => $id]);
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
    require_capability('mod/gear:view', $context);

    if ($filearea !== 'model' && $filearea !== 'hotspot_media') {
        return false;
    }

    $itemid = (int) array_shift($args);
    $filename = array_pop($args);
    $filepath = $args ? '/' . implode('/', $args) . '/' : '/';

    $fs = get_file_storage();
    $file = $fs->get_file($context->id, 'mod_gear', $filearea, $itemid, $filepath, $filename);

    if (!$file) {
        return false;
    }

    if ($filearea === 'hotspot_media') {
        // Media files (audio, video) must be streamable and played inline in browser.
        send_stored_file($file, 86400, 0, false, $options);
        return true;
    }

    // Models are loaded by the same-origin viewer, no CORS header is needed. Never render uploads inline.
    // USDZ files must open inline in AR Quick Look; everything else is always a download.
    $inline = strtolower(pathinfo($filename, PATHINFO_EXTENSION)) === 'usdz';
    send_stored_file($file, 86400, 0, !$inline, $options);
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
        // Explode path to handle subdirs in make_pluginfile_url.
        $parts = explode('/', $model->filepath);
        $filename = array_pop($parts);
        $filepath = '/' . implode('/', $parts);
        if (strlen($filepath) > 1) {
            $filepath .= '/';
        }

        $url = moodle_url::make_pluginfile_url(
            $contextid,
            'mod_gear',
            'model',
            0,
            $filepath,
            $filename
        );
        $model->url = $url->out();
        // An optional USDZ version of the model (same name) opens in AR Quick Look on iPhone and iPad.
        $usdzname = pathinfo($filename, PATHINFO_FILENAME) . '.usdz';
        $model->usdzurl = '';
        if (get_file_storage()->file_exists($contextid, 'mod_gear', 'model', 0, $filepath, $usdzname)) {
            $model->usdzurl = moodle_url::make_pluginfile_url($contextid, 'mod_gear', 'model', 0, $filepath, $usdzname)->out();
        }
        $result[] = $model;
    }

    return $result;
}

/**
 * Remove data that must not reach students (quiz answers) from a hotspot config JSON string.
 *
 * @param string|null $config JSON config of a hotspot
 * @param bool $canmanage Whether the viewer may manage the activity
 * @return string Config JSON, without the correct answer for non-managers
 */
function gear_filter_hotspot_config(?string $config, bool $canmanage): string {
    if ($config === null || $config === '' || $canmanage) {
        return $config ?? '';
    }
    $decoded = json_decode($config, true);
    if (!is_array($decoded)) {
        return '';
    }
    unset($decoded['correctAnswer'], $decoded['correctAnswers'], $decoded['acceptedAnswers'], $decoded['caseSensitive']);
    return json_encode($decoded);
}

/**
 * Check the answer to a quiz hotspot.
 *
 * Quiz types (config quizType): "single" (default, correctAnswer is the index of the right option), "multi" (correctAnswers
 * lists the indexes of all right options, the answer must select exactly those) and "text" (acceptedAnswers lists the accepted
 * texts, "*" matches any characters, caseSensitive decides whether letter case matters).
 *
 * @param array $config Decoded hotspot config
 * @param string $answer The submitted answer: an index, a comma separated list of indexes or a text
 * @return bool True when the answer is correct
 */
function gear_quiz_answer_is_correct(array $config, string $answer): bool {
    $type = $config['quizType'] ?? 'single';
    if ($type === 'multi') {
        $expected = array_map('intval', (array) ($config['correctAnswers'] ?? []));
        $given = array_map('intval', array_filter(array_map('trim', explode(',', $answer)), 'is_numeric'));
        sort($expected);
        $given = array_values(array_unique($given));
        sort($given);
        return $expected !== [] && $expected === $given;
    }
    if ($type === 'text') {
        $normalise = fn(string $text): string => trim(preg_replace('/\s+/u', ' ', $text));
        $given = $normalise($answer);
        if ($given === '') {
            return false;
        }
        $flags = empty($config['caseSensitive']) ? 'iu' : 'u';
        foreach ((array) ($config['acceptedAnswers'] ?? []) as $accepted) {
            $accepted = $normalise((string) $accepted);
            if ($accepted === '') {
                continue;
            }
            $pattern = '/^' . str_replace('\*', '.*', preg_quote($accepted, '/')) . '$/' . $flags;
            if (preg_match($pattern, $given)) {
                return true;
            }
        }
        return false;
    }
    return isset($config['correctAnswer']) && (string) $config['correctAnswer'] === trim($answer);
}

/**
 * Return a list of page types.
 *
 * @param string $pagetype Current page type
 * @param stdClass|null $parentcontext Block's parent context
 * @param stdClass|null $currentcontext Current context of block
 * @return array Array of page types
 */
function gear_page_type_list($pagetype, $parentcontext, $currentcontext): array {
    return ['mod-gear-*' => get_string('page-mod-gear-x', 'mod_gear')];
}

/**
 * Return a small object with summary information about what a user has done in a GEAR instance.
 *
 * @param stdClass $course The course record
 * @param stdClass $user The user record
 * @param cm_info|stdClass $mod The course module info
 * @param stdClass $gear The gear instance
 * @return stdClass|null Summary with info and time
 */
function gear_user_outline($course, $user, $mod, $gear): ?stdClass {
    global $DB;

    $grades = gear_get_user_grades($gear, $user->id);
    $lasttime = $DB->get_field_sql(
        'SELECT MAX(timecreated) FROM {gear_tracking} WHERE gearid = :gearid AND userid = :userid',
        ['gearid' => $gear->id, 'userid' => $user->id]
    );

    if (empty($grades[$user->id]) && empty($lasttime)) {
        return null;
    }

    $result = new stdClass();
    if (!empty($grades[$user->id])) {
        $result->info = get_string('score', 'mod_gear') . ': ' . round((float) $grades[$user->id]['rawgrade'], 2);
    } else {
        $count = $DB->count_records('gear_tracking', ['gearid' => $gear->id, 'userid' => $user->id]);
        $result->info = get_string('clicks', 'mod_gear') . ': ' . $count;
    }
    $result->time = (int) $lasttime;
    return $result;
}

/**
 * Print a detailed representation of what a user has done in a GEAR instance.
 *
 * @param stdClass $course The course record
 * @param stdClass $user The user record
 * @param cm_info|stdClass $mod The course module info
 * @param stdClass $gear The gear instance
 * @return void
 */
function gear_user_complete($course, $user, $mod, $gear): void {
    $outline = gear_user_outline($course, $user, $mod, $gear);
    if ($outline) {
        echo html_writer::div(s($outline->info));
    } else {
        echo html_writer::div(get_string('nodata', 'mod_gear'));
    }
}

/**
 * Add elements to the course reset form.
 *
 * @param MoodleQuickForm $mform The reset course form
 * @return void
 */
function gear_reset_course_form_definition(&$mform): void {
    $mform->addElement('header', 'gearheader', get_string('modulenameplural', 'mod_gear'));
    $mform->addElement('advcheckbox', 'reset_gear_tracking', get_string('resettracking', 'mod_gear'));
}

/**
 * Course reset form defaults.
 *
 * @param stdClass $course The course record
 * @return array Default values
 */
function gear_reset_course_form_defaults($course): array {
    return ['reset_gear_tracking' => 1];
}

/**
 * Removes all user tracking, sessions, and grades when a course is reset.
 *
 * @param stdClass $data The data submitted from the reset course form
 * @return array Status array
 */
function gear_reset_userdata($data): array {
    global $DB;

    $status = [];
    if (!empty($data->reset_gear_tracking)) {
        $gearsql = 'SELECT g.id FROM {gear} g WHERE g.course = :courseid';
        $params = ['courseid' => $data->courseid];

        $DB->delete_records_select('gear_tracking', "gearid IN ($gearsql)", $params);
        $DB->delete_records_select('gear_sessions', "gearid IN ($gearsql)", $params);

        foreach ($DB->get_records('gear', ['course' => $data->courseid]) as $gear) {
            gear_grade_item_update($gear, 'reset');
        }

        $status[] = [
            'component' => get_string('modulenameplural', 'mod_gear'),
            'item' => get_string('resettracking', 'mod_gear'),
            'error' => false,
        ];
    }

    return $status;
}

/**
 * Ids of the quiz hotspots a user has answered correctly.
 *
 * @param int $gearid The GEAR instance id
 * @param int $userid The user id
 * @return int[] Hotspot ids
 */
function gear_get_solved_quiz_ids(int $gearid, int $userid): array {
    global $DB;

    $solved = [];
    $conditions = ['gearid' => $gearid, 'userid' => $userid, 'action' => 'quiz_submit'];
    $records = $DB->get_records('gear_tracking', $conditions, '', 'id, data');
    foreach ($records as $record) {
        $data = json_decode($record->data, true);
        if (!empty($data['correct']) && !empty($data['hotspotid'])) {
            $solved[(int) $data['hotspotid']] = (int) $data['hotspotid'];
        }
    }
    return array_values($solved);
}

/**
 * Whether a hotspot is available to a user: hotspots that require another quiz stay hidden until it has been solved.
 *
 * @param stdClass $hotspot Hotspot record (needs the config JSON)
 * @param int[] $solved Quiz hotspot ids the user has solved
 * @param bool $canmanage Whether the user may manage the activity (managers always see everything)
 * @return bool True when the hotspot may be shown
 */
function gear_hotspot_is_unlocked(stdClass $hotspot, array $solved, bool $canmanage): bool {
    if ($canmanage) {
        return true;
    }
    $config = json_decode($hotspot->config ?? '', true);
    $required = is_array($config) && !empty($config['requires_id']) ? (int) $config['requires_id'] : 0;
    return !$required || in_array($required, $solved, true);
}

/**
 * Whether collaborative mode (shared sessions, WebRTC voice and chat) is enabled by the administrator.
 *
 * @return bool
 */
function gear_collaboration_enabled(): bool {
    return (bool) get_config('mod_gear', 'collab_enabled');
}

/**
 * Connection options of the configured PeerJS server, or null to use the public PeerJS cloud.
 *
 * @return array|null Options (host, port, path, secure) for the Peer constructor
 */
function gear_get_peer_server(): ?array {
    $url = trim((string) get_config('mod_gear', 'peerjs_server'));
    $parts = $url === '' ? false : parse_url($url);
    if (!$parts || empty($parts['host'])) {
        return null;
    }
    $secure = ($parts['scheme'] ?? 'https') === 'https';
    return [
        'host' => $parts['host'],
        'port' => (int) ($parts['port'] ?? ($secure ? 443 : 80)),
        'path' => $parts['path'] ?? '/',
        'secure' => $secure,
    ];
}

/**
 * Whether the AI assistant can be used: it is switched on in the plugin settings and the site has an enabled
 * core AI provider that supports text generation.
 *
 * @return bool
 */
function gear_ai_available(): bool {
    if (!get_config('mod_gear', 'ai_enabled') || !class_exists('\core_ai\manager')) {
        return false;
    }
    try {
        return \core\di::get(\core_ai\manager::class)->is_action_available(\core_ai\aiactions\generate_text::class);
    } catch (\Throwable $e) {
        return false;
    }
}

/**
 * Completion rules of a GEAR activity for the course page (Moodle reads them from the cm_info custom data).
 *
 * @param stdClass $coursemodule Course module record
 * @return cached_cm_info|false
 */
function gear_get_coursemodule_info($coursemodule) {
    global $DB;

    $gear = $DB->get_record('gear', ['id' => $coursemodule->instance], 'id, name, completionhotspots, completionpoints');
    if (!$gear) {
        return false;
    }
    $info = new cached_cm_info();
    $info->name = $gear->name;
    if ($coursemodule->completion == COMPLETION_TRACKING_AUTOMATIC) {
        $info->customdata['customcompletionrules']['completionhotspots'] = $gear->completionhotspots;
        $info->customdata['customcompletionrules']['completionpoints'] = $gear->completionpoints;
    }
    return $info;
}

/**
 * Best quiz points of a user: the highest score per quiz hotspot, summed.
 *
 * @param int $gearid The GEAR instance id
 * @param int $userid The user id
 * @return int Points
 */
function gear_get_user_points(int $gearid, int $userid): int {
    global $DB;

    $best = [];
    $conditions = ['gearid' => $gearid, 'userid' => $userid, 'action' => 'quiz_submit'];
    foreach ($DB->get_records('gear_tracking', $conditions, '', 'id, data') as $record) {
        $data = json_decode($record->data, true);
        if (isset($data['score'], $data['hotspotid'])) {
            $best[$data['hotspotid']] = max($best[$data['hotspotid']] ?? 0, (int) $data['score']);
        }
    }
    return array_sum($best);
}

/**
 * Whether a user has opened every hotspot that is visible to them (teleport points only move the camera).
 *
 * @param int $gearid The GEAR instance id
 * @param int $userid The user id
 * @return bool
 */
function gear_user_opened_all_hotspots(int $gearid, int $userid): bool {
    global $DB;

    $solved = gear_get_solved_quiz_ids($gearid, $userid);
    $needed = [];
    foreach ($DB->get_records('gear_hotspots', ['gearid' => $gearid], '', 'id, type, config') as $hotspot) {
        if ($hotspot->type !== 'teleport' && gear_hotspot_is_unlocked($hotspot, $solved, false)) {
            $needed[(int) $hotspot->id] = true;
        }
    }
    if (!$needed) {
        return false;
    }
    $conditions = ['gearid' => $gearid, 'userid' => $userid, 'action' => 'hotspot_click'];
    foreach ($DB->get_records('gear_tracking', $conditions, '', 'id, data') as $click) {
        $data = json_decode($click->data, true);
        unset($needed[(int) ($data['hotspotId'] ?? 0)]);
    }
    return !$needed;
}

/**
 * Re-evaluate the automatic completion of a GEAR activity for a user (after a hotspot was opened or a quiz answered).
 *
 * @param stdClass $cm Course module record
 * @param int $userid The user id
 */
function gear_update_completion(stdClass $cm, int $userid): void {
    global $DB;

    if ($cm->completion != COMPLETION_TRACKING_AUTOMATIC) {
        return;
    }
    $course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
    $completion = new completion_info($course);
    if ($completion->is_enabled($cm)) {
        $completion->update_state($cm, COMPLETION_UNKNOWN, $userid);
    }
}

/**
 * Users whose avatars, chat and scores the current user may see, or null for everybody (no group restriction).
 *
 * @param stdClass $cm Course module record
 * @param context_module $context Activity context
 * @return int[]|null User ids (always contains the current user) or null
 */
function gear_get_visible_userids(stdClass $cm, context_module $context): ?array {
    global $DB, $USER;

    if (groups_get_activity_groupmode($cm) != SEPARATEGROUPS || has_capability('moodle/site:accessallgroups', $context)) {
        return null;
    }
    $groups = groups_get_activity_allowed_groups($cm, $USER->id);
    $userids = [(int) $USER->id];
    if ($groups) {
        [$insql, $params] = $DB->get_in_or_equal(array_keys($groups));
        $userids = array_merge($userids, $DB->get_fieldset_select('groups_members', 'DISTINCT userid', "groupid $insql", $params));
    }
    return array_values(array_unique(array_map('intval', $userids)));
}
