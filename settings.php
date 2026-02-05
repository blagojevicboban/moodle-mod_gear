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
 * Settings for GEAR plugin.
 *
 * @package    mod_gear
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die;

if ($ADMIN->fulltree) {
    // AI Settings Section.
    $settings->add(new admin_setting_heading('mod_gear/ai_settings',
        get_string('aisettings', 'mod_gear'),
        get_string('aisettings_desc', 'mod_gear')));

    // Enable AI.
    $settings->add(new admin_setting_configcheckbox('mod_gear/ai_enabled',
        get_string('enableai', 'mod_gear'),
        get_string('enableai_desc', 'mod_gear'),
        0));

    // API Key (Password field).
    $settings->add(new admin_setting_configpasswordunmask('mod_gear/ai_apikey',
        get_string('aiapikey', 'mod_gear'),
        get_string('aiapikey_desc', 'mod_gear'),
        ''));

    // Model Name.
    $settings->add(new admin_setting_configtext('mod_gear/ai_model',
        get_string('aimodel', 'mod_gear'),
        get_string('aimodel_desc', 'mod_gear'),
        'gpt-4o-mini', PARAM_TEXT));
}
