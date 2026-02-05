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
use core_privacy\local\request\contextlist;
use core_privacy\local\request\approved_contextlist;
use core_privacy\local\request\transform;
use core_privacy\local\request\writer;

/**
 * Privacy provider for mod_gear.
 *
 * @package    mod_gear
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class provider implements
        \core_privacy\local\metadata\provider,
        \core_privacy\local\request\plugin\provider {

    /**
     * Returns meta data about this system.
     *
     * @param   collection $collection The initialised collection to add items to.
     * @return  collection     A listing of user data stored through this system.
     */
    public static function get_metadata(collection $collection): collection {
        $collection->add_database_table('gear_tracking', [
            'userid' => 'privacy:metadata:gear_tracking:userid',
            'action' => 'privacy:metadata:gear_tracking:action',
            'data' => 'privacy:metadata:gear_tracking:data',
            'duration' => 'privacy:metadata:gear_tracking:duration',
            'timecreated' => 'privacy:metadata:gear_tracking:timecreated',
        ], 'privacy:metadata:gear_tracking');

        return $collection;
    }

    /**
     * Get the list of contexts where a user has stored data.
     *
     * @param   int $userid The user to search.
     * @return  contextlist   The list of contexts used in this plugin.
     */
    public static function get_contexts_for_userid(int $userid): contextlist {
        $contextlist = new contextlist();
        $contextlist->add_from_sql(
            "SELECT c.id
               FROM {context} c
               JOIN {course_modules} cm ON cm.id = c.instanceid AND c.contextlevel = :contextlevel
               JOIN {modules} m ON m.id = cm.module AND m.name = :modname
               JOIN {gear} g ON g.id = cm.instance
               JOIN {gear_tracking} gt ON gt.gearid = g.id
              WHERE gt.userid = :userid",
            [
                'contextlevel' => CONTEXT_MODULE,
                'modname' => 'gear',
                'userid' => $userid,
            ]
        );

        return $contextlist;
    }

    /**
     * Export all user data for the specified user, in the specified contexts.
     *
     * @param   approved_contextlist $contextlist The approved contexts to export information for.
     */
    public static function export_user_data(approved_contextlist $contextlist) {
        global $DB;

        if (empty($contextlist->count())) {
            return;
        }

        $user = $contextlist->get_user();

        foreach ($contextlist->get_contexts() as $context) {
            if ($context->contextlevel != CONTEXT_MODULE) {
                continue;
            }

            // Get the gear instance.
            $cm = get_coursemodule_from_id('gear', $context->instanceid);
            if (!$cm) {
                continue;
            }

            // Export tracking data.
            $trackings = $DB->get_records('gear_tracking', ['gearid' => $cm->instance, 'userid' => $user->id]);
            $data = [];
            foreach ($trackings as $tracking) {
                $data[] = (object) [
                    'action' => $tracking->action,
                    'data' => $tracking->data,
                    'duration' => transform::duration($tracking->duration),
                    'timecreated' => transform::datetime($tracking->timecreated),
                ];
            }

            if (!empty($data)) {
                writer::with_context($context)->export_data([get_string('pluginname', 'mod_gear')], (object) ['tracking' => $data]);
            }
        }
    }

    /**
     * Delete all use data which matches the specified context.
     *
     * @param   \context $context A user context.
     */
    public static function delete_data_for_all_users_in_context(\context $context) {
        global $DB;

        if ($context->contextlevel != CONTEXT_MODULE) {
            return;
        }

        $cm = get_coursemodule_from_id('gear', $context->instanceid);
        if (!$cm) {
            return;
        }

        $DB->delete_records('gear_tracking', ['gearid' => $cm->instance]);
    }

    /**
     * Delete all user data for the specified user, in the specified contexts.
     *
     * @param   approved_contextlist $contextlist The approved contexts and user information to delete information for.
     */
    public static function delete_data_for_user(approved_contextlist $contextlist) {
        global $DB;

        if (empty($contextlist->count())) {
            return;
        }

        $userid = $contextlist->get_user()->id;

        foreach ($contextlist->get_contexts() as $context) {
            if ($context->contextlevel != CONTEXT_MODULE) {
                continue;
            }

            $cm = get_coursemodule_from_id('gear', $context->instanceid);
            if (!$cm) {
                continue;
            }

            $DB->delete_records('gear_tracking', ['gearid' => $cm->instance, 'userid' => $userid]);
        }
    }
}
