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

defined('MOODLE_INTERNAL') || die();

/**
 * Save scene configuration (currently just camera settings).
 *
 * @package    mod_gear
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class save_scene_config extends external_api {
    /**
     * Returns description of method parameters.
     *
     * @return external_function_parameters
     */
    public static function execute_parameters(): external_function_parameters {
        return new external_function_parameters([
            'gearid' => new external_value(PARAM_INT, 'GEAR activity ID'),
            'camera' => new external_value(PARAM_RAW, 'JSON camera settings (position, target)'),
        ]);
    }

    /**
     * Save scene config.
     *
     * @param int $gearid GEAR activity ID
     * @param string $camera JSON camera settings
     * @return array
     */
    public static function execute(int $gearid, string $camera): array {
        global $DB;

        $params = self::validate_parameters(self::execute_parameters(), [
            'gearid' => $gearid,
            'camera' => $camera,
        ]);

        $gear = $DB->get_record('gear', ['id' => $params['gearid']], '*', MUST_EXIST);
        $cm = get_coursemodule_from_instance('gear', $gear->id, 0, false, MUST_EXIST);
        $context = context_module::instance($cm->id);

        // Check capability.
        self::validate_context($context);
        require_capability('mod/gear:manage', $context);

        $config = json_decode($gear->scene_config ?? '{}', true);
        if (!is_array($config)) {
            $config = [];
        }

        $config['camera'] = json_decode($params['camera'], true);

        $DB->set_field('gear', 'scene_config', json_encode($config), ['id' => $gear->id]);

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
