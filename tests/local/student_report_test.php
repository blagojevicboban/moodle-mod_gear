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

namespace mod_gear\local;

/**
 * Tests for the student progress report.
 *
 * @package    mod_gear
 * @category   test
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 * @covers     \mod_gear\local\student_report
 */
final class student_report_test extends \advanced_testcase {
    /**
     * Views, solved quizzes, points, grade and locked hotspots are counted per student.
     */
    public function test_rows_and_details(): void {
        global $DB;
        $this->resetAfterTest();

        $course = $this->getDataGenerator()->create_course();
        $student = $this->getDataGenerator()->create_and_enrol($course, 'student');
        $other = $this->getDataGenerator()->create_and_enrol($course, 'student');
        /** @var \mod_gear_generator $generator */
        $generator = $this->getDataGenerator()->get_plugin_generator('mod_gear');
        $gear = $generator->create_instance(['course' => $course->id, 'grade' => 100]);
        $info = $generator->create_hotspot(['gearid' => $gear->id, 'type' => 'info', 'title' => 'Info']);
        $quiz = $generator->create_hotspot(['gearid' => $gear->id, 'type' => 'quiz', 'title' => 'Quiz',
            'config' => json_encode(['options' => ['a', 'b'], 'correctAnswer' => 1, 'points' => 20])]);
        $locked = $generator->create_hotspot(['gearid' => $gear->id, 'type' => 'info', 'title' => 'Secret',
            'config' => json_encode(['requires_id' => $quiz->id])]);
        $generator->create_hotspot(['gearid' => $gear->id, 'type' => 'teleport', 'title' => 'Waypoint']);

        $track = function (int $userid, string $action, array $data, int $time) use ($DB, $gear): void {
            $DB->insert_record('gear_tracking', (object) ['gearid' => $gear->id, 'userid' => $userid, 'action' => $action,
                'data' => json_encode($data), 'timecreated' => $time]);
        };
        $track($student->id, 'hotspot_click', ['hotspotId' => $info->id], 100);
        $track($student->id, 'hotspot_click', ['hotspotId' => $info->id], 110);
        $track($student->id, 'quiz_submit', ['hotspotid' => $quiz->id, 'correct' => false, 'score' => 0], 120);
        $track($student->id, 'quiz_submit', ['hotspotid' => $quiz->id, 'correct' => true, 'score' => 20], 130);

        $report = new student_report($DB->get_record('gear', ['id' => $gear->id]));
        $rows = $report->rows([$student, $other]);
        $this->assertCount(2, $rows);

        // The student opened one of three hotspots (the locked one became available after the quiz); teleports do not count.
        $this->assertSame(1, $rows[0]['viewed']);
        $this->assertSame(3, $rows[0]['viewable']);
        $this->assertSame([1, 1, 20, 20], [$rows[0]['solved'], $rows[0]['quizzes'], $rows[0]['points'], $rows[0]['maxpoints']]);
        $this->assertEqualsWithDelta(100.0, $rows[0]['grade'], 0.001);
        $this->assertSame(130, $rows[0]['lastactivity']);

        // The other student has done nothing, so the locked hotspot is not counted.
        $this->assertSame([0, 2, 0, 0], [$rows[1]['viewed'], $rows[1]['viewable'], $rows[1]['solved'], $rows[1]['lastactivity']]);
        $this->assertEqualsWithDelta(0.0, $rows[1]['grade'], 0.001);

        $details = array_column($report->details((int) $student->id), null, 'id');
        $this->assertCount(3, $details);
        $this->assertSame(2, $details[$info->id]['views']);
        $this->assertSame(2, $details[$quiz->id]['attempts']);
        $this->assertTrue($details[$quiz->id]['correct']);
        $this->assertFalse($details[$locked->id]['locked']);
        $this->assertTrue(array_column($report->details((int) $other->id), null, 'id')[$locked->id]['locked']);
    }
}
