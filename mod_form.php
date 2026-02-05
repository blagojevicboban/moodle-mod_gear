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
 * Activity module form for mod_gear.
 *
 * @package    mod_gear
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

require_once($CFG->dirroot . '/course/moodleform_mod.php');

/**
 * GEAR activity module form.
 *
 * @package    mod_gear
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class mod_gear_mod_form extends moodleform_mod {
    /**
     * Define the form elements.
     *
     * @return void
     */
    public function definition(): void {
        global $CFG;

        $mform = $this->_form;

        // General section.
        $mform->addElement('header', 'general', get_string('general', 'form'));

        // Activity name.
        $mform->addElement('text', 'name', get_string('gearname', 'gear'), ['size' => '64']);
        $mform->setType('name', PARAM_TEXT);
        $mform->addRule('name', null, 'required', null, 'client');
        $mform->addRule('name', get_string('maximumchars', '', 255), 'maxlength', 255, 'client');
        $mform->addHelpButton('name', 'gearname', 'gear');

        // Description.
        $this->standard_intro_elements();

        // 3D Models section.
        $mform->addElement('header', 'modelsection', get_string('modelsection', 'gear'));

        // File picker for 3D models.
        $maxbytes = get_max_upload_file_size($CFG->maxbytes);
        $mform->addElement(
            'filemanager',
            'modelfiles',
            get_string('modelfiles', 'gear'),
            null,
            [
                'subdirs' => 0,
                'maxbytes' => $maxbytes,
                'maxfiles' => 10,
                'accepted_types' => ['.gltf', '.glb', '.obj', '.fbx'],
            ]
        );
        $mform->addHelpButton('modelfiles', 'modelfiles', 'gear');

        // Scene settings section.
        $mform->addElement('header', 'scenesettings', get_string('scenesettings', 'gear'));

        // AR enabled.
        $mform->addElement('advcheckbox', 'ar_enabled', get_string('ar_enabled', 'gear'));
        $mform->setDefault('ar_enabled', 1);
        $mform->addHelpButton('ar_enabled', 'ar_enabled', 'gear');

        // VR enabled.
        $mform->addElement('advcheckbox', 'vr_enabled', get_string('vr_enabled', 'gear'));
        $mform->setDefault('vr_enabled', 1);
        $mform->addHelpButton('vr_enabled', 'vr_enabled', 'gear');

        // Background color.
        $mform->addElement('text', 'background_color', get_string('background_color', 'gear'), ['size' => '10']);
        $mform->setType('background_color', PARAM_TEXT);
        $mform->setDefault('background_color', '#1a1a2e');

        // Lighting preset.
        $lightingoptions = [
            'studio' => get_string('lighting_studio', 'gear'),
            'outdoor' => get_string('lighting_outdoor', 'gear'),
            'dark' => get_string('lighting_dark', 'gear'),
        ];
        $mform->addElement('select', 'lighting', get_string('lighting', 'gear'), $lightingoptions);
        $mform->setDefault('lighting', 'studio');

        // Hotspots settings.
        $mform->addElement('header', 'hotspotsettings', get_string('hotspots', 'gear'));
        $mform->addElement('advcheckbox', 'enablehotspots', get_string('enablehotspots', 'gear'));
        $mform->setDefault('enablehotspots', 1);
        $mform->addHelpButton('enablehotspots', 'enablehotspots', 'gear');

        $mform->addElement('advcheckbox', 'edithotspots', get_string('edithotspots', 'gear'));
        $mform->setDefault('edithotspots', 0);
        $mform->addHelpButton('edithotspots', 'edithotspots', 'gear');

        // Standard course module elements.
        $this->standard_coursemodule_elements();

        // Action buttons.
        $this->add_action_buttons();
    }

    /**
     * Perform data validation.
     *
     * @param array $data The form data
     * @param array $files The uploaded files
     * @return array Validation errors
     */
    public function validation($data, $files): array {
        $errors = parent::validation($data, $files);

        // Validate background color format.
        if (!empty($data['background_color'])) {
            if (!preg_match('/^#[0-9A-Fa-f]{6}$/', $data['background_color'])) {
                $errors['background_color'] = get_string('invalidcolor', 'gear');
            }
        }

        return $errors;
    }

    /**
     * Preprocess form data before display.
     *
     * @param array $defaultvalues The default values
     * @return void
     */
    public function data_preprocessing(&$defaultvalues): void {
        parent::data_preprocessing($defaultvalues);

        // Decode scene config if present.
        if (!empty($defaultvalues['scene_config'])) {
            $config = json_decode($defaultvalues['scene_config'], true);
            if ($config) {
                $defaultvalues['background_color'] = $config['background'] ?? '#1a1a2e';
                $defaultvalues['lighting'] = $config['lighting'] ?? 'studio';
            }
        }

        // Prepare file manager for existing files.
        if ($this->current->instance) {
            $context = context_module::instance($this->current->coursemodule);
            $draftitemid = file_get_submitted_draft_itemid('modelfiles');
            file_prepare_draft_area(
                $draftitemid,
                $context->id,
                'mod_gear',
                'model',
                0,
                ['subdirs' => 0, 'maxfiles' => 10]
            );
            $defaultvalues['modelfiles'] = $draftitemid;
        }
    }
}
