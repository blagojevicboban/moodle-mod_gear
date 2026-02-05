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

defined('MOODLE_INTERNAL') || die();

/**
 * GEAR module data generator class.
 *
 * @package    mod_gear
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class mod_gear_generator extends testing_module_generator {

    /**
     * Creates a new gear instance.
     *
     * @param array|stdClass $record data for module being generated.
     * @param array|null $options general options for course module.
     * @return stdClass record from gear table with extra cmid field.
     */
    public function create_instance($record = null, ?array $options = null) {
        $record = (object)(array)$record;

        if (!isset($record->intro)) {
            $record->intro = 'Test GEAR description';
        }
        if (!isset($record->introformat)) {
            $record->introformat = FORMAT_HTML;
        }
        if (!isset($record->background_color)) {
            $record->background_color = '#1a1a2e';
        }
        if (!isset($record->lighting)) {
            $record->lighting = 'studio';
        }

        return parent::create_instance($record, (array)$options);
    }
}
