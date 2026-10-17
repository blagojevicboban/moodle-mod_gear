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
            'peerid' => new external_value(PARAM_ALPHANUMEXT, 'Random WebRTC peer id of this browser', VALUE_DEFAULT, ''),
        ]);
    }

    /**
     * Sync user session.
     *
     * @param int $gearid GEAR activity ID
     * @param string $position Current position
     * @param string $rotation Current rotation
     * @param string $peerid Random WebRTC peer id
     * @return array List of other active users
     */
    public static function execute(
        int $gearid,
        string $position = '',
        string $rotation = '',
        string $peerid = ''
    ): array {
        global $DB, $USER;

        $params = self::validate_parameters(self::execute_parameters(), [
            'gearid' => $gearid,
            'position' => $position,
            'rotation' => $rotation,
            'peerid' => $peerid,
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

        // Shared sessions are an opt-in feature and not for guests.
        if (!gear_collaboration_enabled() || isguestuser()) {
            throw new \moodle_exception('collabdisabled', 'mod_gear');
        }

        // Update or insert current user session.
        $session = $DB->get_record('gear_sessions', ['gearid' => $gearid, 'userid' => $userid]);
        if ($session) {
            $session->position = $params['position'];
            $session->rotation = $params['rotation'];
            $session->peerid = substr($params['peerid'], 0, 64);
            $session->timemodified = $now;
            $DB->update_record('gear_sessions', $session);
        } else {
            $session = new \stdClass();
            $session->gearid = $gearid;
            $session->userid = $userid;
            $session->position = $params['position'];
            $session->rotation = $params['rotation'];
            $session->peerid = substr($params['peerid'], 0, 64);
            $session->timemodified = $now;
            $DB->insert_record('gear_sessions', $session);
        }

        // Clean up old sessions (optional, maybe run via cron or probability).

        // Fetch other active users.
        $namefields = \core_user\fields::for_name()->get_sql('u', false, '', '', false)->selects;
        $sql = "SELECT s.*, {$namefields}
                  FROM {gear_sessions} s
                  JOIN {user} u ON u.id = s.userid
                 WHERE s.gearid = :gearid
                   AND s.userid != :userid
                   AND s.timemodified > :timeout";

        $params = ['gearid' => $gearid, 'userid' => $userid, 'timeout' => $timeout];
        $visible = gear_get_visible_userids($cm, $context);
        if ($visible !== null) {
            [$insql, $inparams] = $DB->get_in_or_equal($visible, SQL_PARAMS_NAMED, 'vis');
            $sql .= " AND s.userid $insql";
            $params += $inparams;
        }
        $others = $DB->get_records_sql($sql, $params);

        $result = [];
        foreach ($others as $other) {
            $result[] = [
                'userid' => (int) $other->userid,
                'firstname' => $other->firstname,
                'lastname' => $other->lastname,
                'position' => $other->position,
                'rotation' => $other->rotation,
                'peerid' => (string) $other->peerid,
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
                'peerid' => new external_value(PARAM_ALPHANUMEXT, 'WebRTC peer id'),
            ])
        );
    }
}
