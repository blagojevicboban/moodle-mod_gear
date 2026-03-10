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
use core_external\external_single_structure;
use core_external\external_value;
use context_module;

/**
 * Track a user event.
 *
 * @package    mod_gear
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class track_event extends external_api {
    /**
     * Returns description of method parameters.
     *
     * @return external_function_parameters
     */
    public static function execute_parameters(): external_function_parameters {
        return new external_function_parameters([
            'gearid' => new external_value(PARAM_INT, 'GEAR activity ID'),
            'action' => new external_value(PARAM_TEXT, 'Action name'),
            'data' => new external_value(PARAM_RAW, 'JSON extra data', VALUE_DEFAULT, '{}'),
        ]);
    }

    /**
     * Track an event.
     *
     * @param int $gearid GEAR activity ID
     * @param string $action Action name
     * @param string $data JSON extra data
     * @return array
     */
    public static function execute(int $gearid, string $action, string $data = '{}'): array {
        global $DB, $USER;

        $params = self::validate_parameters(self::execute_parameters(), [
            'gearid' => $gearid,
            'action' => $action,
            'data' => $data,
        ]);

        // Validate context.
        $cm = get_coursemodule_from_instance('gear', $params['gearid'], 0, false, MUST_EXIST);
        $context = context_module::instance($cm->id);
        self::validate_context($context);
        require_capability('mod/gear:view', $context);

        $record = new \stdClass();
        $record->gearid = $params['gearid'];
        $record->userid = $USER->id;
        $record->action = $params['action'];
        $record->data = $params['data'];
        $record->timecreated = time();

        $DB->insert_record('gear_tracking', $record);

        return [
            'success' => true,
        ];
    }

    /**
     * Returns description of method result value.
     *
     * @return external_single_structure
     */
    public static function execute_returns(): external_single_structure {
        return new external_single_structure([
            'success' => new external_value(PARAM_BOOL, 'Success status'),
        ]);
    }
}
