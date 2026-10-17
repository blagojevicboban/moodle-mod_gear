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

namespace mod_gear;

use mod_gear\external\delete_hotspot;
use mod_gear\external\get_hotspots;
use mod_gear\external\get_leaderboard;
use mod_gear\external\get_scene_data;
use mod_gear\external\save_hotspot;
use mod_gear\external\save_model_transform;
use mod_gear\external\save_scene_config;
use mod_gear\external\submit_quiz;
use mod_gear\external\sync_session;
use mod_gear\external\track_event;

/**
 * Unit tests for mod_gear external web services.
 *
 * @package    mod_gear
 * @category   test
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 * @covers     \mod_gear\external\save_hotspot
 * @covers     \mod_gear\external\delete_hotspot
 * @covers     \mod_gear\external\get_hotspots
 * @covers     \mod_gear\external\get_scene_data
 * @covers     \mod_gear\external\track_event
 * @covers     \mod_gear\external\submit_quiz
 * @covers     \mod_gear\external\get_leaderboard
 * @covers     \mod_gear\external\sync_session
 */
final class external_test extends \advanced_testcase {
    /**
     * Test hotspot CRUD, XSS sanitization, answer filtering, and IDOR protection.
     */
    public function test_hotspot_crud_and_idor(): void {
        global $DB;
        $this->resetAfterTest();

        $c1 = $this->getDataGenerator()->create_course();
        $c2 = $this->getDataGenerator()->create_course();
        $teacher1 = $this->getDataGenerator()->create_and_enrol($c1, 'editingteacher');
        $teacher2 = $this->getDataGenerator()->create_and_enrol($c2, 'editingteacher');
        $student = $this->getDataGenerator()->create_and_enrol($c1, 'student');

        /** @var \mod_gear_generator $generator */
        $generator = $this->getDataGenerator()->get_plugin_generator('mod_gear');
        $g1 = $generator->create_instance(['course' => $c1->id]);
        $g2 = $generator->create_instance(['course' => $c2->id]);

        // Teacher 1 creates a quiz hotspot with script/onerror payload.
        $this->setUser($teacher1);
        $res = save_hotspot::execute(
            0,
            $g1->id,
            0,
            'quiz',
            'Quiz 1',
            '<p>ok</p><img src=x onerror=alert(1)><script>alert(2)</script>',
            '{"x":0,"y":0,"z":0}',
            'info',
            '{"options":["a","b"],"correctAnswer":1,"points":10}'
        );
        $hid = $res['id'];
        $stored = $DB->get_field('gear_hotspots', 'content', ['id' => $hid]);
        $this->assertStringNotContainsStringIgnoringCase('script', $stored);
        $this->assertStringNotContainsStringIgnoringCase('onerror', $stored);

        // Teacher sees correctAnswer.
        $teacherspots = get_hotspots::execute($g1->id)['hotspots'];
        $this->assertStringContainsString('correctAnswer', $teacherspots[0]['config']);

        // Student does not receive correctAnswer in get_hotspots or get_scene_data.
        $this->setUser($student);
        $studentspots = get_hotspots::execute($g1->id)['hotspots'];
        $this->assertStringNotContainsString('correctAnswer', $studentspots[0]['config']);
        $scenedata = get_scene_data::execute($g1->id);
        $this->assertStringNotContainsString('correctAnswer', $scenedata['hotspots'][0]['config']);

        // Student cannot save or delete hotspots.
        try {
            save_hotspot::execute(0, $g1->id, 0, 'info', 'x', '', '{"x":0,"y":0,"z":0}', 'info');
            $this->fail('Expected capability exception for student');
        } catch (\required_capability_exception $e) {
            $this->assertNotEmpty($e->getMessage());
        }

        // Teacher 2 creates a hotspot in course 2, then Teacher 1 tries IDOR update via course 1 gearid.
        $this->setUser($teacher2);
        $res2 = save_hotspot::execute(0, $g2->id, 0, 'info', 'Foreign', '', '{"x":0,"y":0,"z":0}', 'info');

        $this->setUser($teacher1);
        try {
            save_hotspot::execute($res2['id'], $g1->id, 0, 'info', 'Hacked', '', '{"x":0,"y":0,"z":0}', 'info');
            $this->fail('Expected dml_missing_record_exception for cross-activity hotspot IDOR');
        } catch (\dml_missing_record_exception $e) {
            $this->assertNotEmpty($e->getMessage());
        }

        // Invalid type and invalid JSON are rejected.
        try {
            save_hotspot::execute(0, $g1->id, 0, 'invalid_type', 'x', '', '{"x":0,"y":0,"z":0}', 'info');
            $this->fail('Expected invalid_parameter_exception for invalid type');
        } catch (\invalid_parameter_exception $e) {
            $this->assertNotEmpty($e->getMessage());
        }

        // Delete hotspot works for owner teacher.
        $del = delete_hotspot::execute($hid);
        $this->assertTrue($del['success']);
        $this->assertFalse($DB->record_exists('gear_hotspots', ['id' => $hid]));
    }

    /**
     * Test track_event action whitelist, submit_quiz scoring, leaderboard, and session sync.
     */
    public function test_tracking_quiz_leaderboard_and_sync(): void {
        $this->resetAfterTest();

        $course = $this->getDataGenerator()->create_course();
        $teacher = $this->getDataGenerator()->create_and_enrol($course, 'editingteacher');
        $student1 = $this->getDataGenerator()->create_and_enrol($course, 'student');
        $student2 = $this->getDataGenerator()->create_and_enrol($course, 'student');

        /** @var \mod_gear_generator $generator */
        $generator = $this->getDataGenerator()->get_plugin_generator('mod_gear');
        $gear = $generator->create_instance(['course' => $course->id, 'grade' => 100]);
        $model = $generator->create_model(['gearid' => $gear->id]);
        $quiz = $generator->create_hotspot([
            'gearid' => $gear->id,
            'type' => 'quiz',
            'config' => json_encode(['options' => ['wrong', 'right'], 'correctAnswer' => 1, 'points' => 20]),
        ]);

        // Teacher updates scene config and model transform.
        $this->setUser($teacher);
        $this->assertTrue(save_scene_config::execute($gear->id, '{"position":[1,2,3]}')['success']);
        $this->assertTrue(save_model_transform::execute($model->id, '{"x":1,"y":2,"z":3}', null, 2.0)['success']);

        // Student 1 cannot forge quiz_submit via track_event.
        $this->setUser($student1);
        try {
            track_event::execute($gear->id, 'quiz_submit', '{"score":9999,"hotspotid":' . $quiz->id . '}');
            $this->fail('Expected invalid_parameter_exception for forged quiz_submit');
        } catch (\invalid_parameter_exception $e) {
            $this->assertNotEmpty($e->getMessage());
        }

        // Allowed tracking action succeeds.
        $this->assertTrue(track_event::execute($gear->id, 'hotspot_click', '{"hotspotId":' . $quiz->id . '}')['success']);

        // Submit wrong then right quiz answer.
        $wrong = submit_quiz::execute($gear->id, $quiz->id, '0');
        $this->assertFalse($wrong['correct']);
        $this->assertSame(0, $wrong['score']);

        $right = submit_quiz::execute($gear->id, $quiz->id, '1');
        $this->assertTrue($right['correct']);
        $this->assertSame(20, $right['score']);

        // Leaderboard returns student 1 with 20 points.
        $board = get_leaderboard::execute($gear->id, 10);
        $this->assertCount(1, $board);
        $this->assertSame((int) $student1->id, $board[0]['userid']);
        $this->assertSame(20, $board[0]['score']);

        // Collaborative mode is off by default.
        try {
            sync_session::execute($gear->id, '{"x":1,"y":0,"z":0}', '{"x":0,"y":0,"z":0}', 'peera');
            $this->fail('sync_session must be refused while collaborative mode is disabled');
        } catch (\moodle_exception $e) {
            $this->assertSame('collabdisabled', $e->errorcode);
        }

        // Collaborative sync between student 1 and student 2.
        set_config('collab_enabled', 1, 'mod_gear');
        sync_session::execute($gear->id, '{"x":1,"y":0,"z":0}', '{"x":0,"y":0,"z":0}', 'peera');
        $this->setUser($student2);
        $others = sync_session::execute($gear->id, '{"x":2,"y":0,"z":0}', '{"x":0,"y":0,"z":0}', 'peerb');
        $this->assertCount(1, $others);
        $this->assertSame((int) $student1->id, $others[0]['userid']);
        $this->assertSame('peera', $others[0]['peerid']);
    }

    /**
     * A hotspot that requires a quiz is not sent to students (and cannot be answered) until the quiz has been solved.
     */
    public function test_locked_hotspot_is_hidden_until_quiz_is_solved(): void {
        $this->resetAfterTest();

        $course = $this->getDataGenerator()->create_course();
        $teacher = $this->getDataGenerator()->create_and_enrol($course, 'editingteacher');
        $student = $this->getDataGenerator()->create_and_enrol($course, 'student');
        $gear = $this->getDataGenerator()->create_module('gear', ['course' => $course->id]);

        $this->setUser($teacher);
        $origin = '{"x":0,"y":0,"z":0}';
        $quizconfig = '{"options":["a","b"],"correctAnswer":1,"points":10}';
        $quiz = save_hotspot::execute(0, $gear->id, 0, 'quiz', 'Quiz', '', $origin, 'info', $quizconfig);
        $lockedconfig = '{"requires_id":"' . $quiz['id'] . '"}';
        save_hotspot::execute(0, $gear->id, 0, 'info', 'Secret', '<p>secret</p>', $origin, 'info', $lockedconfig);
        $this->assertCount(2, get_hotspots::execute($gear->id)['hotspots']);

        $this->setUser($student);
        $titles = array_column(get_hotspots::execute($gear->id)['hotspots'], 'title');
        $this->assertSame(['Quiz'], $titles);
        $this->assertCount(1, get_scene_data::execute($gear->id)['hotspots']);

        submit_quiz::execute($gear->id, $quiz['id'], '0');
        $this->assertCount(1, get_hotspots::execute($gear->id)['hotspots']);

        submit_quiz::execute($gear->id, $quiz['id'], '1');
        $this->assertSame(['Quiz', 'Secret'], array_column(get_hotspots::execute($gear->id)['hotspots'], 'title'));
        $this->assertCount(2, get_scene_data::execute($gear->id)['hotspots']);
    }
}
