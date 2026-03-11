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
 * Save model transformation (position, rotation, scale).
 *
 * @package    mod_gear
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class save_model_transform extends external_api {
    /**
     * Returns description of method parameters.
     *
     * @return external_function_parameters
     */
    public static function execute_parameters(): external_function_parameters {
        return new external_function_parameters([
            'id' => new external_value(PARAM_INT, 'Model ID'),
            'position' => new external_value(PARAM_RAW, 'JSON position', VALUE_DEFAULT, null),
            'rotation' => new external_value(PARAM_RAW, 'JSON rotation', VALUE_DEFAULT, null),
            'scale' => new external_value(PARAM_FLOAT, 'Scale factor', VALUE_DEFAULT, null),
        ]);
    }

    /**
     * Save model transformation.
     *
     * @param int $id Model ID
     * @param string|null $position JSON position
     * @param string|null $rotation JSON rotation
     * @param float|null $scale Scale factor
     * @return array
     */
    public static function execute(int $id, ?string $position = null, ?string $rotation = null, ?float $scale = null): array {
        global $DB;

        $params = self::validate_parameters(self::execute_parameters(), [
            'id' => $id,
            'position' => $position,
            'rotation' => $rotation,
            'scale' => $scale,
        ]);

        $model = $DB->get_record('gear_models', ['id' => $params['id']], '*', MUST_EXIST);
        $cm = get_coursemodule_from_instance('gear', $model->gearid, 0, false, MUST_EXIST);
        $context = context_module::instance($cm->id);

        // Check capability.
        self::validate_context($context);
        require_capability('mod/gear:manage', $context);

        $update = new \stdClass();
        $update->id = $model->id;

        if ($params['position'] !== null) {
            $update->position = $params['position'];
        }
        if ($params['rotation'] !== null) {
            $update->rotation = $params['rotation'];
        }
        if ($params['scale'] !== null) {
            $update->scale = $params['scale'];
        }

        $DB->update_record('gear_models', $update);

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
