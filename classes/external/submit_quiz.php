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
 * Submit a quiz answer.
 *
 * @package    mod_gear
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class submit_quiz extends external_api {
    /**
     * Returns description of method parameters.
     *
     * @return external_function_parameters
     */
    public static function execute_parameters(): external_function_parameters {
        return new external_function_parameters([
            'gearid' => new external_value(PARAM_INT, 'GEAR activity ID'),
            'hotspotid' => new external_value(PARAM_INT, 'Hotspot ID'),
            'answer' => new external_value(PARAM_RAW, 'Selected answer index or value'),
        ]);
    }

    /**
     * Submit a quiz answer.
     *
     * @param int $gearid GEAR activity ID
     * @param int $hotspotid Hotspot ID
     * @param string $answer Selected answer
     * @return array
     */
    public static function execute(
        int $gearid,
        int $hotspotid,
        string $answer
    ): array {
        global $DB, $USER;

        $params = self::validate_parameters(self::execute_parameters(), [
            'gearid' => $gearid,
            'hotspotid' => $hotspotid,
            'answer' => $answer,
        ]);

        // Get the course module.
        $gear = $DB->get_record('gear', ['id' => $params['gearid']], '*', MUST_EXIST);
        $cm = get_coursemodule_from_instance('gear', $params['gearid'], 0, false, MUST_EXIST);
        $context = context_module::instance($cm->id);

        // Check capability.
        self::validate_context($context);
        require_capability('mod/gear:view', $context);

        // Get hotspot to verify answer.
        $hotspot = $DB->get_record('gear_hotspots', ['id' => $params['hotspotid'], 'gearid' => $gear->id], '*', MUST_EXIST);
        
        $config = json_decode($hotspot->config, true);
        $correct = false;
        $score = 0;
        $feedback = '';

        if ($config && isset($config['correctAnswer'])) {
            // Compare answers (assuming index comparison for now).
            if ((string)$config['correctAnswer'] === (string)$params['answer']) {
                $correct = true;
                $score = isset($config['points']) ? (int)$config['points'] : 10;
                $feedback = get_string('correct', 'core');
            } else {
                $feedback = get_string('incorrect', 'core');
            }
        }

        // Record tracking data.
        // Check if user already submitted this hotspot? (Optional: prevent multiple attempts).
        // For now, allow multiple attempts but only record if score > previous? Or just record everything.
        // Let's record everything, and lib.php can handle aggregation (e.g., sum distinct hotspots).
        
        $record = new \stdClass();
        $record->gearid = $gear->id;
        $record->userid = $USER->id;
        $record->action = 'quiz_submit';
        $record->data = json_encode([
            'hotspotid' => $hotspot->id,
            'answer' => $params['answer'],
            'correct' => $correct,
            'score' => $score
        ]);
        $record->timecreated = time();
        
        // We might want to remove previous attempts for *this* hotspot to avoid summing same question multiple times.
        // But that's complex logic for SQL.
        // Let's just insert for now.
        $DB->insert_record('gear_tracking', $record);

        // Trigger grade update.
        gear_update_grades($gear, $USER->id);

        return [
            'correct' => $correct,
            'score' => $score,
            'feedback' => $feedback
        ];
    }

    /**
     * Returns description of method result value.
     *
     * @return external_single_structure
     */
    public static function execute_returns(): external_single_structure {
        return new external_single_structure([
            'correct' => new external_value(PARAM_BOOL, 'Is answer correct'),
            'score' => new external_value(PARAM_INT, 'Score awarded'),
            'feedback' => new external_value(PARAM_TEXT, 'Feedback message'),
        ]);
    }
}
