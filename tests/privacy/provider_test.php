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
use core_privacy\local\request\approved_contextlist;
use core_privacy\local\request\approved_userlist;
use core_privacy\local\request\userlist;
use core_privacy\local\request\writer;

/**
 * Privacy provider tests for mod_gear.
 *
 * @package    mod_gear
 * @category   test
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 * @covers     \mod_gear\privacy\provider
 */
final class provider_test extends \core_privacy\tests\provider_testcase {
    /**
     * Test that get_metadata declares tables and external services.
     */
    public function test_get_metadata(): void {
        $collection = new collection('mod_gear');
        $newcollection = provider::get_metadata($collection);
        $itemcollection = $newcollection->get_collection();
        $this->assertCount(4, $itemcollection);
    }

    /**
     * Test context discovery, export, and deletion of user data.
     */
    public function test_export_and_delete_user_data(): void {
        global $DB;
        $this->resetAfterTest();

        $course = $this->getDataGenerator()->create_course();
        $u1 = $this->getDataGenerator()->create_and_enrol($course, 'student');
        $u2 = $this->getDataGenerator()->create_and_enrol($course, 'student');

        /** @var \mod_gear_generator $generator */
        $generator = $this->getDataGenerator()->get_plugin_generator('mod_gear');
        $gear = $generator->create_instance(['course' => $course->id]);
        $context = \context_module::instance($gear->cmid);

        $DB->insert_record('gear_tracking', (object) [
            'gearid' => $gear->id,
            'userid' => $u1->id,
            'action' => 'ar_start',
            'data' => '{}',
            'duration' => 15,
            'timecreated' => time(),
        ]);
        $DB->insert_record('gear_sessions', (object) [
            'gearid' => $gear->id,
            'userid' => $u1->id,
            'position' => '{"x":0,"y":1,"z":2}',
            'rotation' => '{"x":0,"y":0,"z":0}',
            'timemodified' => time(),
        ]);
        $DB->insert_record('gear_tracking', (object) [
            'gearid' => $gear->id,
            'userid' => $u2->id,
            'action' => 'vr_start',
            'data' => '{}',
            'duration' => 20,
            'timecreated' => time(),
        ]);

        // Contexts for user 1.
        $contextlist = provider::get_contexts_for_userid($u1->id);
        $this->assertCount(1, $contextlist);
        $this->assertEquals($context->id, $contextlist->current()->id);

        // Users in context.
        $userlist = new userlist($context, 'mod_gear');
        provider::get_users_in_context($userlist);
        $this->assertEqualsCanonicalizing([$u1->id, $u2->id], $userlist->get_userids());

        // Export data for user 1.
        $approved = new approved_contextlist($u1, 'mod_gear', [$context->id]);
        provider::export_user_data($approved);
        $subcontext = [get_string('pluginname', 'mod_gear')];
        $exported = writer::with_context($context)->get_data($subcontext);
        $this->assertNotEmpty($exported->tracking);
        $sessions = writer::with_context($context)->get_related_data($subcontext, 'sessions');
        $this->assertNotEmpty($sessions->sessions);

        // Delete data for user 1 only.
        provider::delete_data_for_user($approved);
        $this->assertFalse($DB->record_exists('gear_tracking', ['gearid' => $gear->id, 'userid' => $u1->id]));
        $this->assertFalse($DB->record_exists('gear_sessions', ['gearid' => $gear->id, 'userid' => $u1->id]));
        $this->assertTrue($DB->record_exists('gear_tracking', ['gearid' => $gear->id, 'userid' => $u2->id]));

        // Delete data for remaining users via approved_userlist.
        $approvedusers = new approved_userlist($context, 'mod_gear', [$u2->id]);
        provider::delete_data_for_users($approvedusers);
        $this->assertFalse($DB->record_exists('gear_tracking', ['gearid' => $gear->id]));
    }
}
