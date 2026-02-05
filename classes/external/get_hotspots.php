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

defined('MOODLE_INTERNAL') || die();

use core_external\external_api;
use core_external\external_function_parameters;
use core_external\external_multiple_structure;
use core_external\external_single_structure;
use core_external\external_value;
use context_module;

/**
 * Get hotspots for a GEAR activity.
 *
 * @package    mod_gear
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class get_hotspots extends external_api {
    /**
     * Returns description of method parameters.
     *
     * @return external_function_parameters
     */
    public static function execute_parameters(): external_function_parameters {
        return new external_function_parameters([
            'gearid' => new external_value(PARAM_INT, 'GEAR activity ID'),
        ]);
    }

    /**
     * Get hotspots for a GEAR activity.
     *
     * @param int $gearid GEAR activity ID
     * @return array
     */
    public static function execute(int $gearid): array {
        global $DB;

        $params = self::validate_parameters(self::execute_parameters(), ['gearid' => $gearid]);
        $gearid = $params['gearid'];

        // Get the course module.
        $gear = $DB->get_record('gear', ['id' => $gearid], '*', MUST_EXIST);
        $cm = get_coursemodule_from_instance('gear', $gearid, 0, false, MUST_EXIST);
        $context = context_module::instance($cm->id);

        // Check capability.
        self::validate_context($context);
        require_capability('mod/gear:view', $context);

        // Get hotspots.
        $hotspots = $DB->get_records('gear_hotspots', ['gearid' => $gearid], 'sortorder ASC');

        $result = [];
        foreach ($hotspots as $hotspot) {
            $result[] = [
                'id' => $hotspot->id,
                'modelid' => $hotspot->modelid ?? 0,
                'type' => $hotspot->type ?? 'info',
                'title' => $hotspot->title ?? '',
                'content' => $hotspot->content ?? '',
                'position' => $hotspot->position ?? '{"x":0,"y":0,"z":0}',
                'icon' => $hotspot->icon ?? 'info',
                'sortorder' => $hotspot->sortorder,
            ];
        }

        return ['hotspots' => $result];
    }

    /**
     * Returns description of method result value.
     *
     * @return external_single_structure
     */
    public static function execute_returns(): external_single_structure {
        return new external_single_structure([
            'hotspots' => new external_multiple_structure(
                new external_single_structure([
                    'id' => new external_value(PARAM_INT, 'Hotspot ID'),
                    'modelid' => new external_value(PARAM_INT, 'Model ID'),
                    'type' => new external_value(PARAM_TEXT, 'Hotspot type'),
                    'title' => new external_value(PARAM_TEXT, 'Hotspot title'),
                    'content' => new external_value(PARAM_RAW, 'Hotspot content'),
                    'position' => new external_value(PARAM_RAW, 'JSON position'),
                    'icon' => new external_value(PARAM_TEXT, 'Icon name'),
                    'sortorder' => new external_value(PARAM_INT, 'Sort order'),
                ])
            ),
        ]);
    }
}
