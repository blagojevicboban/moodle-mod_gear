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
 * Index page listing all GEAR instances in a course.
 *
 * @package    mod_gear
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require_once(__DIR__ . '/../../config.php');
require_once(__DIR__ . '/lib.php');

$id = required_param('id', PARAM_INT); // Course ID.

$course = $DB->get_record('course', ['id' => $id], '*', MUST_EXIST);

require_login($course);

$context = context_course::instance($course->id);

// Trigger course module list viewed event.
$event = \core\event\course_module_instance_list_viewed::create([
    'context' => $context,
]);
$event->add_record_snapshot('course', $course);
$event->trigger();

$PAGE->set_url('/mod/gear/index.php', ['id' => $id]);
$PAGE->set_title(format_string($course->fullname));
$PAGE->set_heading(format_string($course->fullname));
$PAGE->set_context($context);

echo $OUTPUT->header();
echo $OUTPUT->heading(get_string('modulenameplural', 'gear'), 2);

// Get all GEAR instances in this course.
if (!$gears = get_all_instances_in_course('gear', $course)) {
    notice(get_string('nomodels', 'gear'), new moodle_url('/course/view.php', ['id' => $course->id]));
}

// Build table.
$usesections = course_format_uses_sections($course->format);

$table = new html_table();
$table->attributes['class'] = 'generaltable mod_index';

if ($usesections) {
    $table->head = [
        get_string('sectionname', 'format_' . $course->format),
        get_string('name'),
        get_string('description'),
    ];
    $table->align = ['center', 'left', 'left'];
} else {
    $table->head = [
        get_string('name'),
        get_string('description'),
    ];
    $table->align = ['left', 'left'];
}

foreach ($gears as $gear) {
    $link = html_writer::link(
        new moodle_url('/mod/gear/view.php', ['id' => $gear->coursemodule]),
        format_string($gear->name),
        ['class' => $gear->visible ? '' : 'dimmed']
    );

    $description = format_module_intro('gear', $gear, $gear->coursemodule);

    if ($usesections) {
        $table->data[] = [
            get_section_name($course, $gear->section),
            $link,
            $description,
        ];
    } else {
        $table->data[] = [$link, $description];
    }
}

echo html_writer::table($table);
echo $OUTPUT->footer();
