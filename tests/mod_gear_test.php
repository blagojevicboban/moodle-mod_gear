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

use advanced_testcase;

/**
 * GEAR module core tests.
 *
 * @package    mod_gear
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 * @coversDefaultClass \mod_gear
 */
final class mod_gear_test extends advanced_testcase {
    /**
     * Test adding a gear instance.
     * @covers ::gear_add_instance
     */
    public function test_gear_add_instance(): void {
        global $DB;
        $this->resetAfterTest();
        $this->setAdminUser();

        $course = $this->getDataGenerator()->create_course();
        $record = new \stdClass();
        $record->course = $course->id;
        $record->name = 'Test GEAR Activity';
        $record->intro = 'Introduction';
        $record->introformat = FORMAT_HTML;
        $record->background_color = '#ffffff';
        $record->lighting = 'studio';

        // Call the function directly (as simulated in mod_form submission).
        $gearid = gear_add_instance($record, null);

        $this->assertIsInt($gearid);
        $this->assertGreaterThan(0, $gearid);

        $gear = $DB->get_record('gear', ['id' => $gearid]);
        $this->assertEquals('Test GEAR Activity', $gear->name);
        $this->assertEquals($course->id, $gear->course);
    }

    /**
     * Test updating a gear instance.
     * @covers ::gear_update_instance
     */
    public function test_gear_update_instance(): void {
        global $DB;
        $this->resetAfterTest();
        $this->setAdminUser();

        $course = $this->getDataGenerator()->create_course();
        $gear = $this->getDataGenerator()->create_module('gear', ['course' => $course->id, 'name' => 'Old Name']);

        $record = new \stdClass();
        $record->id = $gear->id;
        // Standard moodle form data for update has: id (cmid), instance (record id), course (course id).
        // Let's assume gear_update_instance expects the data object.

        $record->instance = $gear->id;
        $record->course = $course->id;
        $record->name = 'New Name';
        $record->intro = 'New Intro';
        $record->introformat = FORMAT_HTML;
        $record->timemodified = time();

        $result = gear_update_instance($record, null);

        $this->assertTrue($result);

        $updatedgear = $DB->get_record('gear', ['id' => $gear->id]);
        $this->assertEquals('New Name', $updatedgear->name);
    }

    /**
     * Test deleting a gear instance.
     * @covers ::gear_delete_instance
     */
    public function test_gear_delete_instance(): void {
        global $DB;
        $this->resetAfterTest();
        $this->setAdminUser();

        $course = $this->getDataGenerator()->create_course();
        $gear = $this->getDataGenerator()->create_module('gear', ['course' => $course->id]);

        // Add some related data to verify cascade delete.
        $DB->insert_record('gear_models', [
            'gearid' => $gear->id,
            'name' => 'Test Model',
            'filepath' => 'test.glb',
            'timecreated' => time(),
        ]);
        $DB->insert_record('gear_hotspots', [
            'gearid' => $gear->id,
            'modelid' => 0,
            'title' => 'Test Hotspot',
            'content' => 'content',
            'position' => '0 0 0',
            'type' => 'info',
        ]);

        $this->assertTrue($DB->record_exists('gear', ['id' => $gear->id]));
        $this->assertTrue($DB->record_exists('gear_models', ['gearid' => $gear->id]));
        $this->assertTrue($DB->record_exists('gear_hotspots', ['gearid' => $gear->id]));

        $result = gear_delete_instance($gear->id);

        $this->assertTrue($result);
        $this->assertFalse($DB->record_exists('gear', ['id' => $gear->id]));
        $this->assertFalse($DB->record_exists('gear_models', ['gearid' => $gear->id]));
        $this->assertFalse($DB->record_exists('gear_hotspots', ['gearid' => $gear->id]));
    }
}
