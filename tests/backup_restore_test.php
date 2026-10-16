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

namespace mod_gear;

/**
 * Backup and restore tests for mod_gear.
 *
 * @package    mod_gear
 * @category   test
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 * @covers     \backup_gear_activity_structure_step
 * @covers     \restore_gear_activity_structure_step
 */
final class backup_restore_test extends \advanced_testcase {
    /**
     * Test duplicating a GEAR activity preserves models, hotspots, and remaps requires_id.
     */
    public function test_duplicate_activity_remaps_hotspot_dependencies(): void {
        global $DB;
        $this->resetAfterTest();
        $this->setAdminUser();

        $course = $this->getDataGenerator()->create_course();
        /** @var \mod_gear_generator $generator */
        $generator = $this->getDataGenerator()->get_plugin_generator('mod_gear');

        $gear = $generator->create_instance(['course' => $course->id, 'name' => 'Original GEAR']);
        $model = $generator->create_model(['gearid' => $gear->id, 'name' => 'cube.glb']);
        $qspot = $generator->create_hotspot([
            'gearid' => $gear->id,
            'modelid' => $model->id,
            'type' => 'quiz',
            'title' => 'Gate Quiz',
            'config' => json_encode(['options' => ['1', '2'], 'correctAnswer' => 1, 'points' => 10]),
        ]);
        $generator->create_hotspot([
            'gearid' => $gear->id,
            'modelid' => $model->id,
            'type' => 'info',
            'title' => 'Unlocked Info',
            'config' => json_encode(['requires_id' => $qspot->id]),
        ]);

        $cm = get_coursemodule_from_id('gear', $gear->cmid, 0, false, MUST_EXIST);
        $newcm = duplicate_module($course, $cm);
        $this->assertNotEmpty($newcm);

        $newmodels = array_values($DB->get_records('gear_models', ['gearid' => $newcm->instance]));
        $this->assertCount(1, $newmodels);
        $this->assertNotEquals($model->id, $newmodels[0]->id);

        $newhotspots = array_values($DB->get_records('gear_hotspots', ['gearid' => $newcm->instance], 'sortorder ASC'));
        $this->assertCount(2, $newhotspots);
        $this->assertEquals($newmodels[0]->id, $newhotspots[0]->modelid);

        $unlockedcfg = json_decode($newhotspots[1]->config, true);
        $this->assertEquals($newhotspots[0]->id, $unlockedcfg['requires_id']);
    }
}
