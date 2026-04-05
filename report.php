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

echo $OUTPUT->header();

echo $OUTPUT->heading(get_string('analyticsfor', 'mod_gear', format_string($gear->name)));

// Fetch summary data from gear_tracking
$sql = "SELECT action, COUNT(id) as count 
          FROM {gear_tracking} 
         WHERE gearid = :gearid 
      GROUP BY action 
      ORDER BY count DESC";

$summary = $DB->get_records_sql($sql, ['gearid' => $gear->id]);

if (empty($summary)) {
    echo $OUTPUT->notification(get_string('nodata', 'mod_gear'), 'info');
} else {
    // General Actions Table
    $table = new html_table();
    $table->head = [get_string('action', 'mod_gear'), get_string('count', 'mod_gear')];
    $table->data = [];
    
    foreach ($summary as $record) {
        $table->data[] = [$record->action, $record->count];
    }
    
    echo html_writer::tag('h3', get_string('generaltracking', 'mod_gear'));
    echo html_writer::table($table);

    // Fetch Hotspot metrics
    $sql_hotspots = "SELECT t.id, t.userid, t.data, t.timecreated, u.firstname, u.lastname 
                       FROM {gear_tracking} t
                       JOIN {user} u ON u.id = t.userid
                      WHERE t.gearid = :gearid AND t.action = 'hotspot_click'
                   ORDER BY t.timecreated DESC";
    $hotspot_clicks = $DB->get_records_sql($sql_hotspots, ['gearid' => $gear->id]);
    
    if (!empty($hotspot_clicks)) {
        // Aggregate by hotspot title
        $hotspot_counts = [];
        foreach ($hotspot_clicks as $hc) {
            $data = json_decode($hc->data);
            $title = isset($data->title) ? $data->title : 'Unknown Hotspot';
            if (!isset($hotspot_counts[$title])) {
                $hotspot_counts[$title] = 0;
            }
            $hotspot_counts[$title]++;
        }
        
        arsort($hotspot_counts);
        
        $htable = new html_table();
        $htable->head = [get_string('hotspot', 'mod_gear'), get_string('clicks', 'mod_gear')];
        $htable->data = [];
        
        foreach ($hotspot_counts as $title => $count) {
            $htable->data[] = [$title, $count];
        }

        echo html_writer::tag('h3', get_string('hotspotanalytics', 'mod_gear'));
        echo html_writer::table($htable);
        
        // Render simple Bar chart
        $chart = new \core\chart_bar();
        $series = new \core\chart_series(get_string('clicks', 'mod_gear'), array_values($hotspot_counts));
        $chart->add_series($series);
        $chart->set_labels(array_keys($hotspot_counts));
        echo $OUTPUT->render($chart);
    }
}

echo $OUTPUT->footer();
