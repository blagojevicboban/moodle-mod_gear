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
use core_text;


/**
 * Save scene configuration (currently just camera settings).
 *
 * @package    mod_gear
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class save_scene_config extends external_api {
    /**
     * Returns description of method parameters.
     *
     * @return external_function_parameters
     */
    public static function execute_parameters(): external_function_parameters {
        return new external_function_parameters([
            'gearid' => new external_value(PARAM_INT, 'GEAR activity ID'),
            'camera' => new external_value(PARAM_RAW, 'JSON camera settings (position, target)', VALUE_DEFAULT, ''),
            'animation' => new external_value(PARAM_RAW, 'JSON default animation (clip, autoplay, speed)', VALUE_DEFAULT, ''),
            'variant' => new external_value(PARAM_TEXT, 'Default material variant name', VALUE_DEFAULT, null),
            'tour' => new external_value(PARAM_RAW, 'JSON list of guided tour steps', VALUE_DEFAULT, ''),
        ]);
    }

    /**
     * Save scene config.
     *
     * @param int $gearid GEAR activity ID
     * @param string $camera JSON camera settings
     * @param string $animation JSON default animation settings
     * @param string|null $variant Default material variant name
     * @param string $tour JSON list of guided tour steps
     * @return array
     */
    public static function execute(
        int $gearid,
        string $camera = '',
        string $animation = '',
        ?string $variant = null,
        string $tour = ''
    ): array {
        global $DB;

        $params = self::validate_parameters(self::execute_parameters(), [
            'gearid' => $gearid,
            'camera' => $camera,
            'animation' => $animation,
            'variant' => $variant,
            'tour' => $tour,
        ]);

        $gear = $DB->get_record('gear', ['id' => $params['gearid']], '*', MUST_EXIST);
        $cm = get_coursemodule_from_instance('gear', $gear->id, 0, false, MUST_EXIST);
        $context = context_module::instance($cm->id);

        // Check capability.
        self::validate_context($context);
        require_capability('mod/gear:manage', $context);

        $config = json_decode($gear->scene_config ?? '{}', true);
        if (!is_array($config)) {
            $config = [];
        }

        if ($params['camera'] !== '') {
            $config['camera'] = json_decode($params['camera'], true);
        }
        if ($params['animation'] !== '') {
            $config['animation'] = self::clean_animation(json_decode($params['animation'], true));
        }
        if ($params['variant'] !== null) {
            $config['variant'] = $params['variant'];
        }
        if ($params['tour'] !== '') {
            $config['tour'] = self::clean_tour(json_decode($params['tour'], true), (int) $gear->id);
        }

        $DB->set_field('gear', 'scene_config', json_encode($config), ['id' => $gear->id]);

        return [
            'success' => true,
        ];
    }

    /**
     * Keep only the known, validated animation settings.
     *
     * @param mixed $animation Decoded JSON
     * @return array
     */
    public static function clean_animation($animation): array {
        $animation = is_array($animation) ? $animation : [];
        return [
            'clip' => clean_param((string) ($animation['clip'] ?? ''), PARAM_TEXT),
            'autoplay' => !empty($animation['autoplay']),
            'speed' => max(0.1, min(3.0, (float) ($animation['speed'] ?? 1))),
        ];
    }

    /**
     * Validate the guided tour: at most 30 steps with a title, a text, a camera position and target.
     *
     * @param mixed $tour Decoded JSON
     * @param int $gearid GEAR activity the hotspots of the steps must belong to (0 to skip the check)
     * @return array
     */
    public static function clean_tour($tour, int $gearid = 0): array {
        global $DB;

        $vector = static function ($value): ?array {
            if (!is_array($value) || count($value) !== 3) {
                return null;
            }
            $result = [];
            foreach ($value as $number) {
                if (!is_numeric($number)) {
                    return null;
                }
                $result[] = round((float) $number, 4);
            }
            return $result;
        };
        $steps = [];
        foreach (array_slice(is_array($tour) ? $tour : [], 0, 30) as $step) {
            if (!is_array($step)) {
                continue;
            }
            $position = $vector($step['position'] ?? null);
            $target = $vector($step['target'] ?? null);
            if ($position === null || $target === null) {
                continue;
            }
            $hotspot = (int) ($step['hotspot'] ?? 0);
            if ($hotspot && $gearid && !$DB->record_exists('gear_hotspots', ['id' => $hotspot, 'gearid' => $gearid])) {
                $hotspot = 0;
            }
            $steps[] = [
                'title' => core_text::substr(clean_param((string) ($step['title'] ?? ''), PARAM_TEXT), 0, 120),
                'text' => core_text::substr(clean_param((string) ($step['text'] ?? ''), PARAM_TEXT), 0, 1000),
                'position' => $position,
                'target' => $target,
                'hotspot' => $hotspot,
                'clip' => core_text::substr(clean_param((string) ($step['clip'] ?? ''), PARAM_TEXT), 0, 100),
                'variant' => core_text::substr(clean_param((string) ($step['variant'] ?? ''), PARAM_TEXT), 0, 100),
            ];
        }
        return $steps;
    }

    /**
     * Returns description of method result value.
     *
     * @return external_single_structure
     */
    public static function execute_returns(): external_single_structure {
        return new external_single_structure([
            'success' => new external_value(PARAM_BOOL, 'Success status'),
        ]);
    }
}
