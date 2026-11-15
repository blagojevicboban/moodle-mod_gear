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

use context_module;
use core_external\external_api;
use core_external\external_function_parameters;
use core_external\external_multiple_structure;
use core_external\external_single_structure;
use core_external\external_value;

/**
 * Get 3D analytics heatmap data per hotspot for managers.
 *
 * @package    mod_gear
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class get_heatmap_data extends external_api {
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
     * Get aggregated hotspot views and quiz error rates.
     *
     * @param int $gearid GEAR activity ID
     * @return array
     */
    public static function execute(int $gearid): array {
        global $DB;

        $params = self::validate_parameters(self::execute_parameters(), [
            'gearid' => $gearid,
        ]);

        $cm = get_coursemodule_from_instance('gear', $params['gearid'], 0, false, MUST_EXIST);
        $context = context_module::instance($cm->id);
        self::validate_context($context);
        require_capability('mod/gear:manage', $context);

        $hotspots = $DB->get_records('gear_hotspots', ['gearid' => $cm->instance], 'id ASC', 'id, title, type');
        $stats = [];
        foreach ($hotspots as $hs) {
            $stats[(int) $hs->id] = [
                'hotspotid' => (int) $hs->id,
                'title' => (string) $hs->title,
                'type' => (string) $hs->type,
                'views' => 0,
                'attempts' => 0,
                'correct' => 0,
                'errorrate' => 0,
            ];
        }

        $records = $DB->get_records_select(
            'gear_tracking',
            "gearid = :gearid AND action IN ('hotspot_click', 'hotspot_view', 'quiz_submit')",
            ['gearid' => $cm->instance],
            'id ASC',
            'id, action, data'
        );

        foreach ($records as $rec) {
            $data = json_decode((string) $rec->data, true);
            $rawid = is_array($data) ? ($data['hotspotid'] ?? $data['hotspotId'] ?? 0) : 0;
            $hid = (int) $rawid;
            if ($hid <= 0 || !isset($stats[$hid])) {
                continue;
            }
            if ($rec->action === 'hotspot_click' || $rec->action === 'hotspot_view') {
                $stats[$hid]['views']++;
            } else if ($rec->action === 'quiz_submit') {
                $stats[$hid]['attempts']++;
                if (!empty($data['correct'])) {
                    $stats[$hid]['correct']++;
                }
            }
        }

        $result = [];
        foreach ($stats as $row) {
            if ($row['attempts'] > 0) {
                $incorrect = $row['attempts'] - $row['correct'];
                $row['errorrate'] = (int) round(($incorrect / $row['attempts']) * 100);
            }
            $result[] = $row;
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
                    'hotspotid' => new external_value(PARAM_INT, 'Hotspot ID'),
                    'title' => new external_value(PARAM_TEXT, 'Hotspot title'),
                    'type' => new external_value(PARAM_ALPHA, 'Hotspot type'),
                    'views' => new external_value(PARAM_INT, 'Number of views'),
                    'attempts' => new external_value(PARAM_INT, 'Quiz attempts'),
                    'correct' => new external_value(PARAM_INT, 'Correct attempts'),
                    'errorrate' => new external_value(PARAM_INT, 'Error rate percentage (0-100)'),
                ])
            ),
        ]);
    }
}
