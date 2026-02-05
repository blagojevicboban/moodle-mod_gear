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
 * Save (create or update) a hotspot.
 *
 * @package    mod_gear
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class save_hotspot extends external_api {
    /**
     * Returns description of method parameters.
     *
     * @return external_function_parameters
     */
    public static function execute_parameters(): external_function_parameters {
        return new external_function_parameters([
            'id' => new external_value(PARAM_INT, 'Hotspot ID (0 for new)', VALUE_DEFAULT, 0),
            'gearid' => new external_value(PARAM_INT, 'GEAR activity ID'),
            'modelid' => new external_value(PARAM_INT, 'Model ID', VALUE_DEFAULT, 0),
            'type' => new external_value(PARAM_TEXT, 'Hotspot type', VALUE_DEFAULT, 'info'),
            'title' => new external_value(PARAM_TEXT, 'Hotspot title'),
            'content' => new external_value(PARAM_RAW, 'Hotspot content', VALUE_DEFAULT, ''),
            'position' => new external_value(PARAM_RAW, 'JSON position {x,y,z}'),
            'icon' => new external_value(PARAM_TEXT, 'Icon name', VALUE_DEFAULT, 'info'),
            'config' => new external_value(PARAM_RAW, 'JSON config', VALUE_DEFAULT, ''),
        ]);
    }

    /**
     * Save a hotspot.
     *
     * @param int $id Hotspot ID (0 for new)
     * @param int $gearid GEAR activity ID
     * @param int $modelid Model ID
     * @param string $type Hotspot type
     * @param string $title Hotspot title
     * @param string $content Hotspot content
     * @param string $position JSON position
     * @param string $icon Icon name
     * @return array
     */
    public static function execute(
        int $id,
        int $gearid,
        int $modelid,
        string $type,
        string $title,
        string $content,
        string $position,
        string $icon,
        string $config = ''
    ): array {
        global $DB;

        $params = self::validate_parameters(self::execute_parameters(), [
            'id' => $id,
            'gearid' => $gearid,
            'modelid' => $modelid,
            'type' => $type,
            'title' => $title,
            'content' => $content,
            'position' => $position,
            'icon' => $icon,
            'config' => $config,
        ]);

        // Get the course module.
        $gear = $DB->get_record('gear', ['id' => $params['gearid']], '*', MUST_EXIST);
        $cm = get_coursemodule_from_instance('gear', $params['gearid'], 0, false, MUST_EXIST);
        $context = context_module::instance($cm->id);

        // Check capability.
        self::validate_context($context);
        require_capability('mod/gear:manage', $context);

        $hotspot = new \stdClass();
        $hotspot->gearid = $params['gearid'];
        $hotspot->modelid = $params['modelid'] ?: null;
        $hotspot->type = $params['type'];
        $hotspot->title = $params['title'];
        $hotspot->content = $params['content'];
        $hotspot->position = $params['position'];
        $hotspot->position = $params['position'];
        $hotspot->icon = $params['icon'];
        $hotspot->config = $params['config'];

        if ($params['id'] > 0) {
            // Update existing.
            $hotspot->id = $params['id'];
            $DB->update_record('gear_hotspots', $hotspot);
        } else {
            // Create new.
            $maxorder = $DB->get_field_sql(
                'SELECT MAX(sortorder) FROM {gear_hotspots} WHERE gearid = ?',
                [$params['gearid']]
            );
            $hotspot->sortorder = ($maxorder !== false) ? $maxorder + 1 : 0;
            $hotspot->id = $DB->insert_record('gear_hotspots', $hotspot);
        }

        return [
            'success' => true,
            'id' => $hotspot->id,
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
            'id' => new external_value(PARAM_INT, 'Hotspot ID'),
        ]);
    }
}
