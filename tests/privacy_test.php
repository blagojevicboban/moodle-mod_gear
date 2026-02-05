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

namespace mod_gear\privacy;

use core_privacy\local\metadata\collection;
use core_privacy\tests\provider_testcase;

/**
 * Privacy provider tests class for mod_gear.
 *
 * @package    mod_gear
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class privacy_test extends provider_testcase {

    /**
     * Test for provider::get_metadata().
     */
    public function test_get_metadata() {
        $collection = new collection('mod_gear');
        $newcollection = provider::get_metadata($collection);
        $itemcollection = $newcollection->get_collection();
        $this->assertCount(1, $itemcollection);

        $metadata = reset($itemcollection);
        $this->assertEquals('gear_tracking', $metadata->get_name());
        $this->assertEquals('privacy:metadata:gear_tracking', $metadata->get_summary());
        $this->assertEquals('privacy:metadata:gear_tracking:userid', $metadata->get_privacy_fields()['userid']);
    }

    /**
     * Test for provider::get_contexts_for_userid().
     */
    public function test_get_contexts_for_userid() {
        $this->resetAfterTest();

        $course = $this->getDataGenerator()->create_course();
        $user = $this->getDataGenerator()->create_user();
        $gear = $this->getDataGenerator()->create_module('gear', ['course' => $course->id]);
        $context = \context_module::instance($gear->cmid);

        // Add some tracking data.
        $tracking = (object) [
            'gearid' => $gear->id,
            'userid' => $user->id,
            'action' => 'view',
            'timecreated' => time(),
        ];
        global $DB;
        $DB->insert_record('gear_tracking', $tracking);

        $contextlist = provider::get_contexts_for_userid($user->id);
        $this->assertCount(1, $contextlist);
        $this->assertEquals($context->id, $contextlist->get_contextids()[0]);
    }

    /**
     * Test for provider::export_user_data().
     */
    public function test_export_user_data() {
        $this->resetAfterTest();

        $course = $this->getDataGenerator()->create_course();
        $user = $this->getDataGenerator()->create_user();
        $gear = $this->getDataGenerator()->create_module('gear', ['course' => $course->id]);
        $context = \context_module::instance($gear->cmid);

        $tracking = (object) [
            'gearid' => $gear->id,
            'userid' => $user->id,
            'action' => 'view',
            'data' => '{"foo":"bar"}',
            'duration' => 10,
            'timecreated' => time(),
        ];
        global $DB;
        $DB->insert_record('gear_tracking', $tracking);

        $writer = \core_privacy\local\request\writer::with_context($context);
        $this->assertFalse($writer->has_any_data());

        $approvedlist = new \core_privacy\local\request\approved_contextlist($user, 'mod_gear', [$context->id]);
        provider::export_user_data($approvedlist);

        $this->assertTrue($writer->has_any_data());
        $data = $writer->get_data([get_string('pluginname', 'mod_gear')]);
        $this->assertCount(1, $data->tracking);
        $this->assertEquals('view', $data->tracking[0]->action);
    }

    /**
     * Test for provider::delete_data_for_all_users_in_context().
     */
    public function test_delete_data_for_all_users_in_context() {
        $this->resetAfterTest();

        $course = $this->getDataGenerator()->create_course();
        $user = $this->getDataGenerator()->create_user();
        $gear = $this->getDataGenerator()->create_module('gear', ['course' => $course->id]);
        $context = \context_module::instance($gear->cmid);

        global $DB;
        $DB->insert_record('gear_tracking', (object) ['gearid' => $gear->id, 'userid' => $user->id, 'action' => 'a']);
        $this->assertEquals(1, $DB->count_records('gear_tracking'));

        provider::delete_data_for_all_users_in_context($context);
        $this->assertEquals(0, $DB->count_records('gear_tracking'));
    }

    /**
     * Test for provider::delete_data_for_user().
     */
    public function test_delete_data_for_user() {
        $this->resetAfterTest();

        $course = $this->getDataGenerator()->create_course();
        $user1 = $this->getDataGenerator()->create_user();
        $user2 = $this->getDataGenerator()->create_user();
        $gear = $this->getDataGenerator()->create_module('gear', ['course' => $course->id]);
        $context = \context_module::instance($gear->cmid);

        global $DB;
        $DB->insert_record('gear_tracking', (object) ['gearid' => $gear->id, 'userid' => $user1->id, 'action' => 'a']);
        $DB->insert_record('gear_tracking', (object) ['gearid' => $gear->id, 'userid' => $user2->id, 'action' => 'b']);
        $this->assertEquals(2, $DB->count_records('gear_tracking'));

        $approvedlist = new \core_privacy\local\request\approved_contextlist($user1, 'mod_gear', [$context->id]);
        provider::delete_data_for_user($approvedlist);

        $this->assertEquals(1, $DB->count_records('gear_tracking'));
        $this->assertTrue($DB->record_exists('gear_tracking', ['userid' => $user2->id]));
    }
}
