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

/**
 * Unit tests for mod_gear lib.php callbacks and scheduled tasks.
 *
 * @package    mod_gear
 * @category   test
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 * @covers     ::gear_add_instance
 * @covers     ::gear_update_instance
 * @covers     ::gear_delete_instance
 * @covers     ::gear_get_user_grades
 * @covers     ::gear_reset_userdata
 */
final class lib_test extends \advanced_testcase {
    /**
     * Test creating, updating (preserving camera/flags), and deleting a GEAR instance.
     */
    public function test_create_update_delete_instance(): void {
        global $DB;
        $this->resetAfterTest();
        $this->setAdminUser();

        $course = $this->getDataGenerator()->create_course();
        /** @var \mod_gear_generator $generator */
        $generator = $this->getDataGenerator()->get_plugin_generator('mod_gear');

        $gear = $generator->create_instance([
            'course' => $course->id,
            'name' => 'Test GEAR',
            'grade' => 50,
            'background_color' => '#112233',
            'lighting' => 'dark',
            'hotspot_scale' => 2.0,
            'enablehotspots' => 1,
            'edithotspots' => 0,
        ]);

        // Simulate the viewer saving camera position and target into scene_config.
        $cfg = json_decode($DB->get_field('gear', 'scene_config', ['id' => $gear->id]), true);
        $cfg['camera']['position'] = [5, 6, 7];
        $cfg['camera']['target'] = [1, 1, 1];
        $DB->set_field('gear', 'scene_config', json_encode($cfg), ['id' => $gear->id]);

        // Updating form settings should keep the viewer-saved camera position/target.
        $upd = $DB->get_record('gear', ['id' => $gear->id]);
        $upd->instance = $gear->id;
        $upd->coursemodule = $gear->cmid;
        $upd->background_color = '#445566';
        gear_update_instance($upd);

        $newcfg = json_decode($DB->get_field('gear', 'scene_config', ['id' => $gear->id]), true);
        $this->assertEquals([5, 6, 7], $newcfg['camera']['position']);
        $this->assertEquals([1, 1, 1], $newcfg['camera']['target']);
        $this->assertSame('#445566', $newcfg['background']);
        $this->assertFalse($newcfg['hotspots']['edit']);

        // Add related records and verify deletion cleans up everything including the grade item.
        $student = $this->getDataGenerator()->create_user();
        $generator->create_hotspot(['gearid' => $gear->id]);
        $generator->create_model(['gearid' => $gear->id]);
        $DB->insert_record('gear_sessions', (object) [
            'userid' => $student->id,
            'gearid' => $gear->id,
            'timemodified' => time(),
        ]);

        $this->assertNotEmpty(\grade_item::fetch([
            'itemtype' => 'mod',
            'itemmodule' => 'gear',
            'iteminstance' => $gear->id,
            'courseid' => $course->id,
        ]));

        $this->assertTrue(gear_delete_instance($gear->id));
        $this->assertFalse(\grade_item::fetch([
            'itemtype' => 'mod',
            'itemmodule' => 'gear',
            'iteminstance' => $gear->id,
            'courseid' => $course->id,
        ]));
        $this->assertFalse($DB->record_exists('gear', ['id' => $gear->id]));
        $this->assertFalse($DB->record_exists('gear_hotspots', ['gearid' => $gear->id]));
        $this->assertFalse($DB->record_exists('gear_models', ['gearid' => $gear->id]));
        $this->assertFalse($DB->record_exists('gear_sessions', ['gearid' => $gear->id]));
    }

    /**
     * Test grade scaling across multiple quiz hotspots and course reset.
     */
    public function test_grade_scaling_and_reset(): void {
        global $DB;
        $this->resetAfterTest();

        $course = $this->getDataGenerator()->create_course();
        $student = $this->getDataGenerator()->create_and_enrol($course, 'student');
        /** @var \mod_gear_generator $generator */
        $generator = $this->getDataGenerator()->get_plugin_generator('mod_gear');

        $gear = $generator->create_instance([
            'course' => $course->id,
            'grade' => 50,
        ]);

        $q1 = $generator->create_hotspot([
            'gearid' => $gear->id,
            'type' => 'quiz',
            'config' => json_encode(['options' => ['a', 'b'], 'correctAnswer' => 0, 'points' => 10]),
        ]);
        $generator->create_hotspot([
            'gearid' => $gear->id,
            'type' => 'quiz',
            'config' => json_encode(['options' => ['a', 'b'], 'correctAnswer' => 1, 'points' => 30]),
        ]);

        // Student answers the first quiz (10 out of 40 total points -> 12.5 out of 50 max grade).
        $DB->insert_record('gear_tracking', (object) [
            'gearid' => $gear->id,
            'userid' => $student->id,
            'action' => 'quiz_submit',
            'data' => json_encode(['hotspotid' => $q1->id, 'score' => 10, 'correct' => true]),
            'timecreated' => time(),
        ]);

        $grades = gear_get_user_grades($gear, $student->id);
        $this->assertEqualsWithDelta(12.5, $grades[$student->id]['rawgrade'], 0.001);

        $outline = gear_user_outline($course, $student, null, $gear);
        $this->assertNotNull($outline);
        $this->assertStringContainsString('12.5', $outline->info);

        // Test scheduled cleanup task removes expired sessions only.
        $DB->insert_record('gear_sessions', (object) [
            'userid' => $student->id,
            'gearid' => $gear->id,
            'timemodified' => time() - (2 * HOURSECS),
        ]);
        $task = new \mod_gear\task\cleanup_sessions();
        $task->execute();
        $this->assertFalse($DB->record_exists('gear_sessions', ['gearid' => $gear->id]));

        // Test course reset clears tracking data.
        $resetdata = (object) [
            'courseid' => $course->id,
            'reset_gear_tracking' => 1,
        ];
        $status = gear_reset_userdata($resetdata);
        $this->assertNotEmpty($status);
        $this->assertFalse($DB->record_exists('gear_tracking', ['gearid' => $gear->id]));
    }
}

