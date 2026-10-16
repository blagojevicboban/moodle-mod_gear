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

namespace mod_gear\event;

/**
 * Quiz submitted event.
 *
 * @package    mod_gear
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class quiz_submitted extends \core\event\base {
    /**
     * Init method.
     *
     * @return void
     */
    protected function init(): void {
        $this->data['objecttable'] = 'gear_hotspots';
        $this->data['crud'] = 'c';
        $this->data['edulevel'] = self::LEVEL_PARTICIPATING;
    }

    /**
     * Returns localised general event name.
     *
     * @return string
     */
    public static function get_name(): string {
        return get_string('eventquizsubmitted', 'mod_gear');
    }

    /**
     * Returns description of what happened.
     *
     * @return string
     */
    public function get_description(): string {
        $score = (int) ($this->other['score'] ?? 0);
        return "The user with id '$this->userid' submitted a quiz answer for hotspot with id '$this->objectid' " .
            "in the GEAR activity with course module id '$this->contextinstanceid' (score: $score).";
    }

    /**
     * Get URL related to the action.
     *
     * @return \moodle_url
     */
    public function get_url(): \moodle_url {
        return new \moodle_url('/mod/gear/view.php', ['id' => $this->contextinstanceid]);
    }

    /**
     * Get mapping for restoring.
     *
     * @return array
     */
    public static function get_objectid_mapping(): array {
        return ['db' => 'gear_hotspots', 'restore' => 'gear_hotspot'];
    }
}

