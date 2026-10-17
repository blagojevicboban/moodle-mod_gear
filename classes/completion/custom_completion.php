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

namespace mod_gear\completion;

use core_completion\activity_custom_completion;

defined('MOODLE_INTERNAL') || die();

require_once(__DIR__ . '/../../lib.php');

/**
 * Custom completion rules of the GEAR activity.
 *
 * @package    mod_gear
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class custom_completion extends activity_custom_completion {
    /**
     * Completion state of one custom rule for the user.
     *
     * @param string $rule Rule name
     * @return int COMPLETION_COMPLETE or COMPLETION_INCOMPLETE
     */
    public function get_state(string $rule): int {
        $this->validate_rule($rule);

        $gearid = (int) $this->cm->instance;
        if ($rule === 'completionhotspots') {
            $done = gear_user_opened_all_hotspots($gearid, $this->userid);
        } else {
            $required = (int) ($this->cm->customdata['customcompletionrules']['completionpoints'] ?? 0);
            $done = gear_get_user_points($gearid, $this->userid) >= $required;
        }
        return $done ? COMPLETION_COMPLETE : COMPLETION_INCOMPLETE;
    }

    /**
     * Names of the custom rules.
     *
     * @return string[]
     */
    public static function get_defined_custom_rules(): array {
        return ['completionhotspots', 'completionpoints'];
    }

    /**
     * Descriptions of the enabled rules, shown to the user.
     *
     * @return array Rule name => description
     */
    public function get_custom_rule_descriptions(): array {
        $points = (int) ($this->cm->customdata['customcompletionrules']['completionpoints'] ?? 0);
        return [
            'completionhotspots' => get_string('completiondetail:hotspots', 'mod_gear'),
            'completionpoints' => get_string('completiondetail:points', 'mod_gear', $points),
        ];
    }

    /**
     * Order in which the rules are shown.
     *
     * @return string[]
     */
    public function get_sort_order(): array {
        return ['completionview', 'completionhotspots', 'completionpoints', 'completionusegrade', 'completionpassgrade'];
    }
}
