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

namespace mod_gear\external;

use core_external\external_api;
use core_external\external_function_parameters;
use core_external\external_multiple_structure;
use core_external\external_single_structure;
use core_external\external_value;
use context_module;

/**
 * Sync user session.
 *
 * @package    mod_gear
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class sync_session extends external_api {
    /**
     * Returns description of method parameters.
     *
     * @return external_function_parameters
     */
    public static function execute_parameters(): external_function_parameters {
        return new external_function_parameters([
            'gearid' => new external_value(PARAM_INT, 'GEAR activity ID'),
            'position' => new external_value(PARAM_RAW, 'JSON position {x,y,z}', VALUE_DEFAULT, ''),
            'rotation' => new external_value(PARAM_RAW, 'JSON rotation {x,y,z}', VALUE_DEFAULT, ''),
        ]);
    }

    /**
     * Sync user session.
     *
     * @param int $gearid GEAR activity ID
     * @param string $position Current position
     * @param string $rotation Current rotation
     * @return array List of other active users
     */
    public static function execute(
        int $gearid,
        string $position = '',
        string $rotation = ''
    ): array {
        global $DB, $USER;

        $params = self::validate_parameters(self::execute_parameters(), [
            'gearid' => $gearid,
            'position' => $position,
            'rotation' => $rotation,
        ]);

        $gearid = $params['gearid'];
        $userid = $USER->id;
        $now = time();
        $timeout = $now - 10; // Users active in last 10 seconds.

        // Get the course module for access control.
        $cm = get_coursemodule_from_instance('gear', $gearid, 0, false, MUST_EXIST);
        $context = context_module::instance($cm->id);
        self::validate_context($context);
        require_capability('mod/gear:view', $context);

        // Update or insert current user session.
        $session = $DB->get_record('gear_sessions', ['gearid' => $gearid, 'userid' => $userid]);
        if ($session) {
            $session->position = $params['position'];
            $session->rotation = $params['rotation'];
            $session->timemodified = $now;
            $DB->update_record('gear_sessions', $session);
        } else {
            $session = new \stdClass();
            $session->gearid = $gearid;
            $session->userid = $userid;
            $session->position = $params['position'];
            $session->rotation = $params['rotation'];
            $session->timemodified = $now;
            $DB->insert_record('gear_sessions', $session);
        }

        // Clean up old sessions (optional, maybe run via cron or probability).
        // $DB->delete_records_select('gear_sessions', 'timemodified < :timeout', ['timeout' => $now - 60]);

        // Fetch other active users.
        $sql = "SELECT s.*, u.firstname, u.lastname
                  FROM {gear_sessions} s
                  JOIN {user} u ON u.id = s.userid
                 WHERE s.gearid = :gearid
                   AND s.userid != :userid
                   AND s.timemodified > :timeout";
        
        $others = $DB->get_records_sql($sql, [
            'gearid' => $gearid,
            'userid' => $userid,
            'timeout' => $timeout
        ]);

        $result = [];
        foreach ($others as $other) {
            $result[] = [
                'userid' => $other->userid,
                'firstname' => $other->firstname,
                'lastname' => $other->lastname,
                'position' => $other->position,
                'rotation' => $other->rotation,
            ];
        }

        return $result;
    }

    /**
     * Returns description of method result value.
     *
     * @return external_multiple_structure
     */
    public static function execute_returns(): external_multiple_structure {
        return new external_multiple_structure(
            new external_single_structure([
                'userid' => new external_value(PARAM_INT, 'User ID'),
                'firstname' => new external_value(PARAM_TEXT, 'First Name'),
                'lastname' => new external_value(PARAM_TEXT, 'Last Name'),
                'position' => new external_value(PARAM_RAW, 'JSON position'),
                'rotation' => new external_value(PARAM_RAW, 'JSON rotation'),
            ])
        );
    }
}
