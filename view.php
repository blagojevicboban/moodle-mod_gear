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
 * View page for mod_gear.
 *
 * @package    mod_gear
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require_once(__DIR__ . '/../../config.php');
require_once(__DIR__ . '/lib.php');

$id = optional_param('id', 0, PARAM_INT); // Course module ID.
$g = optional_param('g', 0, PARAM_INT);   // GEAR instance ID.

if ($id) {
    $cm = get_coursemodule_from_id('gear', $id, 0, false, MUST_EXIST);
    $course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
    $gear = $DB->get_record('gear', ['id' => $cm->instance], '*', MUST_EXIST);
} else if ($g) {
    $gear = $DB->get_record('gear', ['id' => $g], '*', MUST_EXIST);
    $course = $DB->get_record('course', ['id' => $gear->course], '*', MUST_EXIST);
    $cm = get_coursemodule_from_instance('gear', $gear->id, $course->id, false, MUST_EXIST);
} else {
    throw new moodle_exception('invalidcoursemodule');
}

require_login($course, true, $cm);

$context = context_module::instance($cm->id);
require_capability('mod/gear:view', $context);

// Trigger view event.
$event = \mod_gear\event\course_module_viewed::create([
    'objectid' => $gear->id,
    'context' => $context,
]);
$event->add_record_snapshot('course', $course);
$event->add_record_snapshot('gear', $gear);
$event->trigger();

// Mark as viewed for completion.
$completion = new completion_info($course);
$completion->set_module_viewed($cm);

// Set up the page.
$PAGE->set_url('/mod/gear/view.php', ['id' => $cm->id]);
$PAGE->set_title(format_string($gear->name));
$PAGE->set_heading(format_string($course->fullname));
$PAGE->set_context($context);

// Load required CSS.
$PAGE->requires->css('/mod/gear/styles.css');

// Load Three.js BEFORE AMD to avoid RequireJS conflicts.
// Using r128 which supports global THREE.OrbitControls and THREE.GLTFLoader.
$PAGE->requires->js(new moodle_url('https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js'), true);
$PAGE->requires->js(new moodle_url('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js'), true);
$PAGE->requires->js(new moodle_url('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js'), true);

// Get models for this activity (with file URLs).
$models = gear_get_models($gear->id, $context->id);
$hotspots = $DB->get_records('gear_hotspots', ['gearid' => $gear->id], 'sortorder ASC');

// Prepare model data for JS (just URL and name).
$jsmodels = [];
foreach ($models as $model) {
    $jsmodels[] = [
        'url' => $model->url,
        'name' => $model->name,
        'format' => $model->format,
    ];
}

// Prepare JS configuration.
$jsconfig = [
    'cmid' => $cm->id,
    'gearid' => $gear->id,
    'config' => json_decode($gear->scene_config ?? '{}', true),
    'ar_enabled' => (bool) $gear->ar_enabled,
    'vr_enabled' => (bool) $gear->vr_enabled,
    'models' => $jsmodels,
];
$PAGE->requires->js_call_amd('mod_gear/viewer', 'init', [$jsconfig]);

// Prepare data for template.
$templatedata = [
    'name' => format_string($gear->name),
    'intro' => format_module_intro('gear', $gear, $cm->id),
    'has_models' => !empty($models),
    'ar_enabled' => (bool) $gear->ar_enabled,
    'vr_enabled' => (bool) $gear->vr_enabled,
    'models' => array_values($models),
    'hotspots' => array_values($hotspots),
    'cmid' => $cm->id,
    'sesskey' => sesskey(),
];

// Output.
echo $OUTPUT->header();
echo $OUTPUT->render_from_template('mod_gear/view', $templatedata);
echo $OUTPUT->footer();
