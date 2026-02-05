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
 * Get leaderboard scores.
 *
 * @package    mod_gear
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class get_leaderboard extends external_api {
    /**
     * Returns description of method parameters.
     *
     * @return external_function_parameters
     */
    public static function execute_parameters(): external_function_parameters {
        return new external_function_parameters([
            'gearid' => new external_value(PARAM_INT, 'GEAR activity ID'),
            'limit' => new external_value(PARAM_INT, 'Number of results', VALUE_DEFAULT, 10),
        ]);
    }

    /**
     * Get leaderboard.
     *
     * @param int $gearid GEAR activity ID
     * @param int $limit Number of results
     * @return array List of top scores
     */
    public static function execute(int $gearid, int $limit = 10): array {
        global $DB;

        $params = self::validate_parameters(self::execute_parameters(), [
            'gearid' => $gearid,
            'limit' => $limit,
        ]);

        $gearid = $params['gearid'];
        $limit = $params['limit'];

        // Get the course module for access control.
        $cm = get_coursemodule_from_instance('gear', $gearid, 0, false, MUST_EXIST);
        $context = context_module::instance($cm->id);
        self::validate_context($context);
        require_capability('mod/gear:view', $context);

        // Aggregate scores from tracking table.
        // We need to fetch all quiz_submit actions and process them because 
        // the score is inside the JSON data.
        // Note: For high scale, this should be cached or stored in a dedicated table.
        
        $sql = "SELECT t.userid, u.firstname, u.lastname, t.data
                  FROM {gear_tracking} t
                  JOIN {user} u ON u.id = t.userid
                 WHERE t.gearid = :gearid
                   AND t.action = 'quiz_submit'";
        
        $records = $DB->get_records_sql($sql, ['gearid' => $gearid]);
        
        $user_scores = [];

        foreach ($records as $record) {
            $data = json_decode($record->data, true);
            if (isset($data['score']) && isset($data['hotspotid'])) {
                // Determine unique key if we want sum of BEST attempts per hotspot?
                // Logic used in lib.php: gear_get_user_grades sums max score per hotspot.
                
                $uid = $record->userid;
                if (!isset($user_scores[$uid])) {
                    $user_scores[$uid] = [
                        'userid' => $uid,
                        'fullname' => fullname($record),
                        'hotspots' => [],
                        'total' => 0
                    ];
                }
                
                $hid = $data['hotspotid'];
                $current_max = isset($user_scores[$uid]['hotspots'][$hid]) ? $user_scores[$uid]['hotspots'][$hid] : 0;
                
                if ($data['score'] > $current_max) {
                    $user_scores[$uid]['hotspots'][$hid] = $data['score'];
                }
            }
        }
        
        // Calculate totals
        $leaderboard = [];
        foreach ($user_scores as $uid => $data) {
            $total = array_sum($data['hotspots']);
            if ($total > 0) {
                $leaderboard[] = [
                    'userid' => $uid,
                    'fullname' => $data['fullname'],
                    'score' => $total
                ];
            }
        }
        
        // Sort by score desc
        usort($leaderboard, function($a, $b) {
            return $b['score'] - $a['score'];
        });
        
        // Limit
        return array_slice($leaderboard, 0, $limit);
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
                'fullname' => new external_value(PARAM_TEXT, 'User Fullname'),
                'score' => new external_value(PARAM_INT, 'Total Score'),
            ])
        );
    }
}
