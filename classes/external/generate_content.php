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
        global $CFG;

        $params = self::validate_parameters(self::execute_parameters(), [
            'gearid' => $gearid,
            'prompt' => $prompt,
            'type' => $type,
        ]);

        // Access checks.
        $cm = get_coursemodule_from_instance('gear', $gearid, 0, false, MUST_EXIST);
        $context = context_module::instance($cm->id);
        self::validate_context($context);
        require_capability('mod/gear:manage', $context);

        // Check settings.
        $enabled = get_config('mod_gear', 'ai_enabled');
        $apikey = get_config('mod_gear', 'ai_apikey');
        $model = get_config('mod_gear', 'ai_model') ?: 'gpt-3.5-turbo';

        if (!$enabled || empty($apikey)) {
            throw new \moodle_exception('error:ainotconfigured', 'mod_gear');
        }

        // Construct System Prompt.
        $systemprompt = "You are a helpful assistant for an Augmented/Virtual Reality learning platform. ";
        $userprompt = "";

        if ($type === 'quiz') {
            $systemprompt .= "Generate a multiple choice question based on the user's topic. ";
            $systemprompt .= "Return ONLY valid JSON with this structure: { \"question\": \"Question text\", ";
            $systemprompt .= "\"options\": [\"A\", \"B\", \"C\"], \"correct\": 0, \"points\": 10, ";
            $systemprompt .= "\"explanation\": \"Optional explanation\" }. ";
            $systemprompt .= "Ensure correct index is 0-based. Do not include markdown formatting.";
            $userprompt = "Topic: " . $prompt;
        } else {
            $systemprompt .= "Write a short, engaging description (max 50 words) about the topic ";
            $systemprompt .= "suitable for a popup info card.";
            $userprompt = "Topic: " . $prompt;
        }

        // Call OpenAI API.
        $url = 'https://api.openai.com/v1/chat/completions';
        $apidata = [
            'model' => $model,
            'messages' => [
                ['role' => 'system', 'content' => $systemprompt],
                ['role' => 'user', 'content' => $userprompt],
            ],
            'temperature' => 0.7,
        ];

        require_once($CFG->libdir . '/filelib.php');
        $curl = new \curl();
        $curl->setHeader([
            'Content-Type: application/json',
            'Authorization: Bearer ' . $apikey,
        ]);

        $response = $curl->post($url, json_encode($apidata));
        $info = $curl->get_info();
        $httpcode = $info['http_code'] ?? 0;

        if ($httpcode !== 200 || !$response) {
            throw new \moodle_exception('error:apierror', 'mod_gear', '', $httpcode);
        }

        $json = json_decode($response, true);
        $content = $json['choices'][0]['message']['content'] ?? '';

        // Clean up markdown code blocks if present (common issue with LLMs returning JSON).
        if ($type === 'quiz') {
            $content = trim($content);
            $content = str_replace([chr(96) . chr(96) . chr(96) . 'json', chr(96) . chr(96) . chr(96)], '', $content);
            // Validate JSON.
            $test = json_decode($content);
            if (!$test) {
                 throw new \moodle_exception('error:invalidjson', 'mod_gear');
            }
        }

        return [
            'success' => true,
            'content' => $content,
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
            'content' => new external_value(PARAM_RAW, 'Generated content (text or JSON)'),
        ]);
    }
}
