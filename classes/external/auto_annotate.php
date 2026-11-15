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
use core_ai\aiactions\generate_text;
use core_ai\manager;

/**
 * Automatically generate hotspot annotations for named 3D model parts using AI.
 *
 * @package    mod_gear
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class auto_annotate extends external_api {
    /**
     * Returns description of method parameters.
     *
     * @return external_function_parameters
     */
    public static function execute_parameters(): external_function_parameters {
        return new external_function_parameters([
            'gearid' => new external_value(PARAM_INT, 'GEAR activity ID'),
            'parts' => new external_value(PARAM_RAW, 'JSON array of part names'),
        ]);
    }

    /**
     * Generate annotations for a list of 3D mesh part names.
     *
     * @param int $gearid
     * @param string $parts
     * @return array
     */
    public static function execute(int $gearid, string $parts): array {
        global $USER, $DB;

        $params = self::validate_parameters(self::execute_parameters(), [
            'gearid' => $gearid,
            'parts' => $parts,
        ]);

        $cm = get_coursemodule_from_instance('gear', $params['gearid'], 0, false, MUST_EXIST);
        $gear = $DB->get_record('gear', ['id' => $params['gearid']], '*', MUST_EXIST);
        $context = context_module::instance($cm->id);
        self::validate_context($context);
        require_capability('mod/gear:manage', $context);

        if (!gear_ai_available()) {
            throw new \moodle_exception('error:ainotconfigured', 'mod_gear');
        }
        $manager = \core\di::get(manager::class);
        $checkcontext = method_exists($manager, 'is_action_enabled_in_context');
        if ($checkcontext && !$manager->is_action_enabled_in_context($context, generate_text::class)) {
            throw new \moodle_exception('error:aidisabledhere', 'mod_gear');
        }
        if (!manager::get_user_policy_status((int) $USER->id)) {
            throw new \moodle_exception('error:aipolicy', 'mod_gear');
        }

        $partlist = json_decode($params['parts'], true);
        if (!is_array($partlist) || empty($partlist)) {
            throw new \moodle_exception('error:invalidjson', 'mod_gear');
        }
        $cleanparts = array_slice(array_values(array_filter(array_map('strval', $partlist))), 0, 15);

        $prompt = "You help a teacher annotate a 3D learning model named \"" . format_string($gear->name) . "\".\n"
            . "Given these 3D mesh part names, generate one educational hotspot per part (mix of info and quiz).\n"
            . "Return ONLY a valid JSON array (no markdown) with objects matching:\n"
            . '[{"partName":"exact name","type":"info","title":"Short title","content":"2-sentence explanation"},'
            . '{"partName":"exact name","type":"quiz","title":"Quiz title","question":"Question?",'
            . '"options":["A","B","C"],"correct":0,"points":10,"explanation":"Why it is correct"}]' . "\n\n"
            . "Parts:\n" . json_encode($cleanparts);

        $action = new generate_text(
            contextid: $context->id,
            userid: (int) $USER->id,
            prompttext: $prompt,
        );
        $response = $manager->process_action($action);
        if (!$response->get_success()) {
            throw new \moodle_exception('error:apierror', 'mod_gear', '', $response->get_errormessage());
        }

        $raw = trim((string) ($response->get_response_data()['generatedcontent'] ?? ''));
        $start = strpos($raw, '[');
        $end = strrpos($raw, ']');
        $json = ($start !== false && $end !== false && $end > $start) ? substr($raw, $start, $end - $start + 1) : $raw;
        $decoded = json_decode($json, true);
        if (!is_array($decoded)) {
            throw new \moodle_exception('error:invalidjson', 'mod_gear');
        }

        return [
            'success' => true,
            'annotations' => json_encode($decoded),
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
            'annotations' => new external_value(PARAM_RAW, 'JSON array of generated hotspots'),
        ]);
    }
}
