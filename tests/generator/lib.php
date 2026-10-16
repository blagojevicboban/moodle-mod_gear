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
 * Data generator for mod_gear.
 *
 * @package    mod_gear
 * @category   test
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

/**
 * GEAR module data generator class.
 *
 * @package    mod_gear
 * @category   test
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class mod_gear_generator extends testing_module_generator {
    /** @var int Number of created hotspots. */
    protected int $hotspotcount = 0;

    /**
     * Reset generator state.
     *
     * @return void
     */
    public function reset(): void {
        $this->hotspotcount = 0;
        parent::reset();
    }

    /**
     * Create a new GEAR activity instance.
     *
     * @param array|stdClass|null $record Activity record
     * @param array|null $options Module options
     * @return stdClass Created activity record
     */
    public function create_instance($record = null, ?array $options = null): stdClass {
        $record = (object) (array) $record;

        $defaults = [
            'grade' => 100,
            'ar_enabled' => 1,
            'vr_enabled' => 1,
            'background_color' => '#1a1a2e',
            'lighting' => 'studio',
            'hotspot_scale' => 1.5,
            'enablehotspots' => 1,
            'edithotspots' => 1,
        ];

        foreach ($defaults as $name => $value) {
            if (!isset($record->{$name})) {
                $record->{$name} = $value;
            }
        }

        return parent::create_instance($record, (array) $options);
    }

    /**
     * Create a hotspot record in gear_hotspots.
     *
     * @param array|stdClass|null $record Hotspot data
     * @return stdClass Created hotspot record
     */
    public function create_hotspot($record = null): stdClass {
        global $DB;

        $record = (object) (array) $record;
        if (empty($record->gearid)) {
            throw new coding_exception('Hotspot generator requires $record->gearid');
        }

        $this->hotspotcount++;
        $record->modelid = $record->modelid ?? null;
        $record->type = $record->type ?? 'info';
        $record->title = $record->title ?? ('Hotspot ' . $this->hotspotcount);
        $record->content = $record->content ?? ('<p>Hotspot content ' . $this->hotspotcount . '</p>');
        $record->position = $record->position ?? '{"x":0,"y":0,"z":0}';
        $record->icon = $record->icon ?? 'info';
        $record->config = $record->config ?? '{}';
        $record->sortorder = $record->sortorder ?? $this->hotspotcount;
        $record->timecreated = $record->timecreated ?? time();

        $record->id = $DB->insert_record('gear_hotspots', $record);
        return $record;
    }

    /**
     * Create a model record in gear_models.
     *
     * @param array|stdClass|null $record Model data
     * @return stdClass Created model record
     */
    public function create_model($record = null): stdClass {
        global $DB;

        $record = (object) (array) $record;
        if (empty($record->gearid)) {
            throw new coding_exception('Model generator requires $record->gearid');
        }

        $record->name = $record->name ?? 'triangle.glb';
        $record->filepath = $record->filepath ?? $record->name;
        $record->filesize = $record->filesize ?? 512;
        $record->format = $record->format ?? 'glb';
        $record->metadata = $record->metadata ?? '{}';
        $record->position = $record->position ?? '{"x":0,"y":0,"z":0}';
        $record->rotation = $record->rotation ?? '{"x":0,"y":0,"z":0}';
        $record->scale = $record->scale ?? 1.0;
        $record->timecreated = $record->timecreated ?? time();

        $record->id = $DB->insert_record('gear_models', $record);
        return $record;
    }
}

