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
 * Import scene configuration and hotspots from JSON.
 *
 * @package    mod_gear
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class import_scene extends external_api {
    /**
     * Returns description of method parameters.
     *
     * @return external_function_parameters
     */
    public static function execute_parameters(): external_function_parameters {
        return new external_function_parameters([
            'gearid' => new external_value(PARAM_INT, 'GEAR activity ID'),
            'scenedata' => new external_value(PARAM_RAW, 'JSON scene export data'),
            'mode' => new external_value(PARAM_ALPHA, 'Import mode: replace or merge', VALUE_DEFAULT, 'replace'),
        ]);
    }

    /**
     * Import scene JSON into a gear activity.
     *
     * @param int $gearid GEAR activity ID
     * @param string $scenedata JSON scene export data
     * @param string $mode 'replace' or 'merge'
     * @return array
     */
    public static function execute(int $gearid, string $scenedata, string $mode = 'replace'): array {
        global $DB;

        $params = self::validate_parameters(self::execute_parameters(), [
            'gearid' => $gearid,
            'scenedata' => $scenedata,
            'mode' => $mode,
        ]);

        $gear = $DB->get_record('gear', ['id' => $params['gearid']], '*', MUST_EXIST);
        $cm = get_coursemodule_from_instance('gear', $params['gearid'], 0, false, MUST_EXIST);
        $context = context_module::instance($cm->id);

        self::validate_context($context);
        require_capability('mod/gear:manage', $context);

        $decoded = json_decode($params['scenedata'], true);
        if (!is_array($decoded)) {
            throw new \invalid_parameter_exception('Invalid JSON data');
        }

        // Apply scene_config if present and valid JSON.
        if (isset($decoded['scene_config']) && is_string($decoded['scene_config'])) {
            $testcfg = json_decode($decoded['scene_config'], true);
            if (is_array($testcfg)) {
                $DB->set_field('gear', 'scene_config', $decoded['scene_config'], ['id' => $gear->id]);
            }
        }

        $importedcount = 0;
        $hotspots = $decoded['hotspots'] ?? [];
        if (is_array($hotspots) && !empty($hotspots)) {
            if ($params['mode'] === 'replace') {
                // Delete existing hotspots.
                $fs = get_file_storage();
                foreach ($DB->get_records('gear_hotspots', ['gearid' => $gear->id], '', 'id') as $oldh) {
                    $fs->delete_area_files($context->id, 'mod_gear', 'hotspot_media', $oldh->id);
                }
                $DB->delete_records('gear_hotspots', ['gearid' => $gear->id]);
            }

            $indextonewid = [];
            $inserted = [];
            $maxorder = (int) $DB->get_field_sql('SELECT MAX(sortorder) FROM {gear_hotspots} WHERE gearid = ?', [$gear->id]);

            foreach ($hotspots as $item) {
                if (!is_array($item)) {
                    continue;
                }
                $h = new \stdClass();
                $h->gearid = $gear->id;
                $h->modelid = null;
                $h->type = in_array($item['type'] ?? '', ['info', 'quiz', 'audio', 'video', 'teleport'], true)
                    ? $item['type'] : 'info';
                $h->title = clean_param($item['title'] ?? '', PARAM_TEXT);
                $h->content = clean_text($item['content'] ?? '', FORMAT_HTML);
                $h->position = is_string($item['position'] ?? null) ? $item['position'] : '{"x":0,"y":0,"z":0}';
                $h->icon = clean_param($item['icon'] ?? 'info', PARAM_TEXT);
                $h->config = is_string($item['config'] ?? null) ? $item['config'] : '';
                $h->sortorder = isset($item['sortorder']) ? (int) $item['sortorder'] : ++$maxorder;
                $h->timecreated = time();

                $newid = $DB->insert_record('gear_hotspots', $h);
                if (isset($item['export_idx'])) {
                    $indextonewid[$item['export_idx']] = $newid;
                }
                $inserted[] = $newid;
                $importedcount++;
            }

            // Resolve requires_export_idx references among imported hotspots.
            foreach ($inserted as $newid) {
                $rec = $DB->get_record('gear_hotspots', ['id' => $newid]);
                if ($rec && !empty($rec->config)) {
                    $cfg = json_decode($rec->config, true);
                    if (is_array($cfg) && isset($cfg['requires_export_idx']) && isset($indextonewid[$cfg['requires_export_idx']])) {
                        $cfg['requires_id'] = (string) $indextonewid[$cfg['requires_export_idx']];
                        unset($cfg['requires_export_idx']);
                        $DB->set_field('gear_hotspots', 'config', json_encode($cfg), ['id' => $newid]);
                    }
                }
            }
        }

        return [
            'success' => true,
            'count' => $importedcount,
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
            'count' => new external_value(PARAM_INT, 'Number of imported hotspots'),
        ]);
    }
}

