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

/**
 * External services definitions for mod_gear.
 *
 * @package    mod_gear
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

$functions = [
    'mod_gear_get_hotspots' => [
        'classname'     => 'mod_gear\external\get_hotspots',
        'description'   => 'Get hotspots for a GEAR activity',
        'type'          => 'read',
        'ajax'          => true,
        'capabilities'  => 'mod/gear:view',
    ],
    'mod_gear_save_hotspot' => [
        'classname'     => 'mod_gear\external\save_hotspot',
        'description'   => 'Create or update a hotspot',
        'type'          => 'write',
        'ajax'          => true,
        'capabilities'  => 'mod/gear:manage',
    ],
    'mod_gear_delete_hotspot' => [
        'classname'     => 'mod_gear\external\delete_hotspot',
        'description'   => 'Delete a hotspot',
        'type'          => 'write',
        'capabilities'  => 'mod/gear:manage',
    ],
    'mod_gear_submit_quiz' => [
        'classname'     => 'mod_gear\external\submit_quiz',
        'description'   => 'Submit a quiz answer',
        'type'          => 'write',
        'ajax'          => true,
        'capabilities'  => 'mod/gear:view',
    ],
];
