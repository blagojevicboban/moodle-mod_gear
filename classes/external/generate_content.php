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
        $system_prompt = "You are a helpful assistant for an Augmented/Virtual Reality learning platform. ";
        $user_prompt = "";

        if ($type === 'quiz') {
            $system_prompt .= "Generate a multiple choice question based on the user's topic. ";
            $system_prompt .= "Return ONLY valid JSON with this structure: { \"question\": \"Question text\", \"options\": [\"A\", \"B\", \"C\"], \"correct\": 0, \"points\": 10, \"explanation\": \"Optional explanation\" }. ";
            $system_prompt .= "Ensure correct index is 0-based. Do not include markdown formatting.";
            $user_prompt = "Topic: " . $prompt;
        } else {
            $system_prompt .= "Write a short, engaging description (max 50 words) about the topic suitable for a popup info card.";
            $user_prompt = "Topic: " . $prompt;
        }

        // Call OpenAI API.
        $url = 'https://api.openai.com/v1/chat/completions';
        $data = [
            'model' => $model,
            'messages' => [
                ['role' => 'system', 'content' => $system_prompt],
                ['role' => 'user', 'content' => $user_prompt]
            ],
            'temperature' => 0.7
        ];

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $apikey
        ]);
        // Moodle proxy support if needed, simpler for now.
        
        $response = curl_exec($ch);
        $httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpcode !== 200 || !$response) {
            throw new \moodle_exception('error:apierror', 'mod_gear', '', $httpcode);
        }

        $json = json_decode($response, true);
        $content = $json['choices'][0]['message']['content'] ?? '';

        // Clean up markdown code blocks if present (common issue with LLMs returning JSON).
        if ($type === 'quiz') {
            $content = trim($content);
            if (strpos($content, '```json') === 0) {
                $content = str_replace(['```json', '```'], '', $content);
            }
            // Validate JSON.
            $test = json_decode($content);
            if (!$test) {
                 throw new \moodle_exception('error:invalidjson', 'mod_gear');
            }
        }

        return [
            'success' => true,
            'content' => $content
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
