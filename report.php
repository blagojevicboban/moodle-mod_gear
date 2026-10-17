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
 * Analytics report page for mod_gear.
 *
 * @package    mod_gear
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require_once(__DIR__ . '/../../config.php');
require_once(__DIR__ . '/lib.php');

$id = required_param('id', PARAM_INT); // Course module ID.
$userid = optional_param('userid', 0, PARAM_INT); // Show the details of one student.
$download = optional_param('download', '', PARAM_ALPHA); // Download the student progress (data format).

$cm = get_coursemodule_from_id('gear', $id, 0, false, MUST_EXIST);
$course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
$gear = $DB->get_record('gear', ['id' => $cm->instance], '*', MUST_EXIST);

require_login($course, true, $cm);

$context = context_module::instance($cm->id);
require_capability('mod/gear:manage', $context);

$url = new moodle_url('/mod/gear/report.php', ['id' => $cm->id]);
$PAGE->set_url($url);
$PAGE->set_title(format_string($gear->name) . ': ' . get_string('reports', 'mod_gear'));
$PAGE->set_heading(format_string($course->fullname));
$PAGE->set_context($context);

// Students of the selected group (people who can manage the activity are left out).
$groupid = groups_get_activity_group($cm, true);
$students = get_enrolled_users($context, 'mod/gear:view', (int) $groupid, 'u.*', 'u.lastname, u.firstname', 0, 0, true);
$managers = get_enrolled_users($context, 'mod/gear:manage', 0, 'u.id');
$students = array_diff_key($students, $managers);
$studentreport = new \mod_gear\local\student_report($gear);
$progress = $studentreport->rows($students);

$formatgrade = function (?float $grade) use ($gear): string {
    return $grade === null ? '-' : format_float($grade, 2) . ' / ' . format_float((float) $gear->grade, 2);
};

if ($download !== '') {
    $columns = [
        'fullname' => get_string('fullnameuser'),
        'viewed' => get_string('hotspotsviewed', 'mod_gear'),
        'solved' => get_string('quizzessolved', 'mod_gear'),
        'points' => get_string('points', 'mod_gear'),
        'grade' => get_string('grade', 'core_grades'),
        'lastactivity' => get_string('lastactivity', 'mod_gear'),
    ];
    $rows = array_map(fn($row) => [
        'fullname' => $row['fullname'],
        'viewed' => $row['viewed'] . ' / ' . $row['viewable'],
        'solved' => $row['solved'] . ' / ' . $row['quizzes'],
        'points' => $row['points'] . ' / ' . $row['maxpoints'],
        'grade' => $formatgrade($row['grade']),
        'lastactivity' => $row['lastactivity'] ? userdate($row['lastactivity']) : '',
    ], $progress);
    \core\dataformat::download_data(clean_filename(format_string($gear->name) . ' progress'), $download, $columns, $rows);
    die();
}

$event = \mod_gear\event\report_viewed::create([
    'objectid' => $gear->id,
    'context' => $context,
]);
$event->add_record_snapshot('gear', $gear);
$event->trigger();

echo $OUTPUT->header();

if ($userid && isset($students[$userid])) {
    // Details of one student: every hotspot with views, quiz attempts and the best score.
    echo $OUTPUT->heading(get_string('studentdetails', 'mod_gear', fullname($students[$userid])));
    echo html_writer::link($url, get_string('backtoreport', 'mod_gear'), ['class' => 'd-inline-block mb-3']);
    $table = new html_table();
    $table->head = [
        get_string('hotspot', 'mod_gear'),
        get_string('type', 'mod_gear'),
        get_string('viewed', 'mod_gear'),
        get_string('attempts', 'mod_gear'),
        get_string('points', 'mod_gear'),
    ];
    $table->data = [];
    foreach ($studentreport->details($userid) as $row) {
        $viewed = $row['views'] ? get_string('yes') . ' (' . $row['views'] . ')' : get_string('no');
        if ($row['locked']) {
            $viewed = get_string('locked', 'mod_gear');
        }
        $points = '-';
        if ($row['type'] === 'quiz') {
            $points = $row['best'] . ' / ' . $row['points'];
            if ($row['correct']) {
                $points .= ' ' . $OUTPUT->pix_icon('i/valid', get_string('correct', 'question'));
            }
        }
        $table->data[] = [
            s($row['title']),
            get_string('hotspottype_' . $row['type'], 'mod_gear'),
            $viewed,
            $row['type'] === 'quiz' ? $row['attempts'] : '-',
            $points,
        ];
    }
    echo html_writer::table($table);
    echo $OUTPUT->footer();
    die();
}

echo $OUTPUT->heading(get_string('analyticsfor', 'mod_gear', format_string($gear->name)));

// Fetch summary data from gear_tracking.
$sql = "SELECT action, COUNT(id) as count
          FROM {gear_tracking}
         WHERE gearid = :gearid
      GROUP BY action
      ORDER BY count DESC";

$summary = $DB->get_records_sql($sql, ['gearid' => $gear->id]);

if (empty($summary)) {
    echo $OUTPUT->notification(get_string('nodata', 'mod_gear'), 'info');
} else {
    // General Actions Table.
    $table = new html_table();
    $table->head = [get_string('action', 'mod_gear'), get_string('count', 'mod_gear')];
    $table->data = [];
    foreach ($summary as $record) {
        $table->data[] = [s($record->action), $record->count];
    }
    echo html_writer::tag('h3', get_string('generaltracking', 'mod_gear'));
    echo html_writer::table($table);

    // Fetch Hotspot metrics.
    $sqlhotspots = "SELECT t.id, t.userid, t.data, t.timecreated, u.firstname, u.lastname
                       FROM {gear_tracking} t
                       JOIN {user} u ON u.id = t.userid
                      WHERE t.gearid = :gearid AND t.action = 'hotspot_click'
                   ORDER BY t.timecreated DESC";
    $hotspotclicks = $DB->get_records_sql($sqlhotspots, ['gearid' => $gear->id]);

    if (!empty($hotspotclicks)) {
        // Aggregate by hotspot id; titles come from the hotspot table, never from client supplied tracking data.
        $hotspottitles = $DB->get_records_menu('gear_hotspots', ['gearid' => $gear->id], '', 'id, title');
        $hotspotcounts = [];
        foreach ($hotspotclicks as $hc) {
            $data = json_decode($hc->data);
            $hid = isset($data->hotspotId) ? (int) $data->hotspotId : 0;
            if (!isset($hotspottitles[$hid])) {
                continue;
            }
            $title = format_string($hotspottitles[$hid]);
            if (!isset($hotspotcounts[$title])) {
                $hotspotcounts[$title] = 0;
            }
            $hotspotcounts[$title]++;
        }

        arsort($hotspotcounts);

        $htable = new html_table();
        $htable->head = [get_string('hotspot', 'mod_gear'), get_string('clicks', 'mod_gear')];
        $htable->data = [];

        foreach ($hotspotcounts as $title => $count) {
            $htable->data[] = [s($title), $count];
        }

        echo html_writer::tag('h3', get_string('hotspotanalytics', 'mod_gear'));
        echo html_writer::table($htable);

        // Render simple Bar chart.
        $chart = new \core\chart_bar();
        $series = new \core\chart_series(get_string('clicks', 'mod_gear'), array_values($hotspotcounts));
        $chart->add_series($series);
        $chart->set_labels(array_keys($hotspotcounts));
        echo $OUTPUT->render($chart);
    }
}

// Progress of every student.
echo html_writer::tag('h3', get_string('studentprogress', 'mod_gear'));
groups_print_activity_menu($cm, $url);
if (!$progress) {
    echo $OUTPUT->notification(get_string('nostudents', 'mod_gear'), 'info');
} else {
    $table = new html_table();
    $table->head = [
        get_string('fullnameuser'),
        get_string('hotspotsviewed', 'mod_gear'),
        get_string('quizzessolved', 'mod_gear'),
        get_string('points', 'mod_gear'),
        get_string('grade', 'core_grades'),
        get_string('lastactivity', 'mod_gear'),
    ];
    $table->data = [];
    foreach ($progress as $row) {
        $table->data[] = [
            html_writer::link(new moodle_url($url, ['userid' => $row['userid']]), s($row['fullname'])),
            $row['viewed'] . ' / ' . $row['viewable'],
            $row['solved'] . ' / ' . $row['quizzes'],
            $row['points'] . ' / ' . $row['maxpoints'],
            $formatgrade($row['grade']),
            $row['lastactivity'] ? userdate($row['lastactivity'], get_string('strftimedatetimeshort', 'langconfig')) : '-',
        ];
    }
    echo html_writer::table($table);
    echo $OUTPUT->download_dataformat_selector(
        get_string('downloadas', 'table'),
        $url->out_omit_querystring(),
        'download',
        ['id' => $cm->id, 'group' => (int) $groupid]
    );
}

echo $OUTPUT->footer();
