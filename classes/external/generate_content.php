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
 * Generate content using AI.
 *
 * @package    mod_gear
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class generate_content extends external_api {
    /**
     * Returns description of method parameters.
     *
     * @return external_function_parameters
     */
    public static function execute_parameters(): external_function_parameters {
        return new external_function_parameters([
             'gearid' => new external_value(PARAM_INT, 'GEAR activity ID'),
             'prompt' => new external_value(PARAM_TEXT, 'Topic or prompt'),
             'type' => new external_value(PARAM_ALPHA, 'Type: info or quiz', VALUE_DEFAULT, 'info'),
        ]);
    }

    /**
     * Generate content.
     *
     * @param int $gearid
     * @param string $prompt
     * @param string $type
     * @return array
     */
    public static function execute(int $gearid, string $prompt, string $type = 'info'): array {
        global $USER;

        $params = self::validate_parameters(self::execute_parameters(), [
            'gearid' => $gearid,
            'prompt' => $prompt,
            'type' => $type,
        ]);

        // Access checks.
        $cm = get_coursemodule_from_instance('gear', $params['gearid'], 0, false, MUST_EXIST);
        $context = context_module::instance($cm->id);
        self::validate_context($context);
        require_capability('mod/gear:manage', $context);

        // The assistant is an opt-in feature that uses the AI providers of the site (Site administration > General > AI).
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

        $instructions = $params['type'] === 'quiz' ? self::quiz_instructions() : self::info_instructions();
        $action = new generate_text(
            contextid: $context->id,
            userid: (int) $USER->id,
            prompttext: $instructions . "\n\nTopic: " . $params['prompt'],
        );
        $response = $manager->process_action($action);
        if (!$response->get_success()) {
            throw new \moodle_exception('error:apierror', 'mod_gear', '', $response->get_errormessage());
        }

        $content = trim((string) ($response->get_response_data()['generatedcontent'] ?? ''));
        if ($params['type'] === 'quiz') {
            $content = self::extract_json($content);
            if (!is_array(json_decode($content, true))) {
                throw new \moodle_exception('error:invalidjson', 'mod_gear');
            }
        }

        return [
            'success' => true,
            'content' => $content,
        ];
    }

    /**
     * Instructions for an information hotspot.
     *
     * @return string
     */
    protected static function info_instructions(): string {
        return 'You help a teacher build an interactive 3D learning scene. Write a short, engaging description '
            . '(at most 50 words) about the topic below, suitable for a popup info card. Return plain text only.';
    }

    /**
     * Instructions for a quiz hotspot.
     *
     * @return string
     */
    protected static function quiz_instructions(): string {
        return 'You help a teacher build an interactive 3D learning scene. '
            . 'Write one multiple choice question about the topic below. '
            . 'Return ONLY valid JSON with this structure: {"question": "Question text", "options": ["A", "B", "C"], '
            . '"correct": 0, "points": 10, "explanation": "Optional explanation"}. The correct index is 0-based. '
            . 'Do not use markdown.';
    }

    /**
     * Cut the JSON object out of a model answer (models like to wrap it in markdown fences or add a sentence around it).
     *
     * @param string $text Model answer
     * @return string JSON text (or the unchanged text when no object was found)
     */
    protected static function extract_json(string $text): string {
        $start = strpos($text, '{');
        $end = strrpos($text, '}');
        return ($start !== false && $end !== false && $end > $start) ? substr($text, $start, $end - $start + 1) : $text;
    }

    /**
     * Returns description of method result value.
     *
     * @return external_single_structure
     */
    public static function execute_returns(): external_single_structure {
        return new external_single_structure([
            'success' => new external_value(PARAM_BOOL, 'Success status'),
            'content' => new external_value(PARAM_RAW, 'Generated content (text or JSON)'),
        ]);
    }
}
