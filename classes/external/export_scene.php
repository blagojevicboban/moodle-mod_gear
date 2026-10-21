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
 * Export scene configuration and hotspots as JSON.
 *
 * @package    mod_gear
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class export_scene extends external_api {
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
     * Get the export structure for a gear activity.
     *
     * @param int $gearid
     * @return array
     */
    public static function get_scene_export_data(int $gearid): array {
        global $DB;

        $gear = $DB->get_record('gear', ['id' => $gearid], '*', MUST_EXIST);
        $hotspots = $DB->get_records('gear_hotspots', ['gearid' => $gearid], 'sortorder ASC, id ASC');

        $idtoindex = [];
        $idx = 0;
        foreach ($hotspots as $h) {
            $idtoindex[$h->id] = $idx++;
        }

        $exportedhotspots = [];
        foreach ($hotspots as $h) {
            $cfg = json_decode($h->config ?? '', true);
            if (is_array($cfg) && !empty($cfg['requires_id']) && isset($idtoindex[$cfg['requires_id']])) {
                $cfg['requires_export_idx'] = $idtoindex[$cfg['requires_id']];
            }
            $exportedhotspots[] = [
                'export_idx' => $idtoindex[$h->id],
                'type' => $h->type,
                'title' => $h->title,
                'content' => $h->content,
                'position' => $h->position,
                'icon' => $h->icon,
                'config' => is_array($cfg) ? json_encode($cfg) : ($h->config ?? ''),
                'sortorder' => (int) $h->sortorder,
            ];
        }

        return [
            'gear_export_version' => '1.0',
            'exported_at' => time(),
            'name' => $gear->name,
            'scene_config' => $gear->scene_config ?? '',
            'hotspots' => $exportedhotspots,
        ];
    }

    /**
     * Export scene JSON.
     *
     * @param int $gearid
     * @return array
     */
    public static function execute(int $gearid): array {
        global $DB;

        $params = self::validate_parameters(self::execute_parameters(), [
            'gearid' => $gearid,
        ]);

        $gear = $DB->get_record('gear', ['id' => $params['gearid']], '*', MUST_EXIST);
        $cm = get_coursemodule_from_instance('gear', $params['gearid'], 0, false, MUST_EXIST);
        $context = context_module::instance($cm->id);

        self::validate_context($context);
        require_capability('mod/gear:manage', $context);

        $data = self::get_scene_export_data($params['gearid']);
        $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $filename = 'gear-scene-' . clean_filename($gear->name) . '-' . date('Ymd-His') . '.gear.json';

        return [
            'success' => true,
            'json' => $json,
            'filename' => $filename,
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
            'json' => new external_value(PARAM_RAW, 'Scene export JSON'),
            'filename' => new external_value(PARAM_TEXT, 'Suggested filename'),
        ]);
    }
}
