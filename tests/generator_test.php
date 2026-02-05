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
 * GEAR generator tests.
 *
 * @package    mod_gear
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class generator_test extends advanced_testcase {

    /**
     * Test generator creation.
     */
    public function test_generator() {
        global $DB;

        $this->resetAfterTest();
        $this->setAdminUser();

        $course = $this->getDataGenerator()->create_course();
        $generator = $this->getDataGenerator()->get_plugin_generator('mod_gear');
        $gear = $generator->create_instance(['course' => $course->id, 'name' => 'Test GEAR']);

        $this->assertEquals('Test GEAR', $gear->name);
        $this->assertEquals($course->id, $gear->course);
        $this->assertNotEmpty($gear->scene_config);
        
        // Assert record exists in DB.
        $this->assertTrue($DB->record_exists('gear', ['id' => $gear->id]));
    }
}
