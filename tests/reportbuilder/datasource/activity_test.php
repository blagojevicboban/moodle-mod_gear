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

declare(strict_types=1);

namespace mod_gear\reportbuilder\datasource;

use core_reportbuilder\local\filters\text;

defined('MOODLE_INTERNAL') || die();

global $CFG;
require_once("{$CFG->dirroot}/reportbuilder/tests/helpers.php");

/**
 * Tests for the GEAR activity tracking report source.
 *
 * @package    mod_gear
 * @category   test
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 * @covers     \mod_gear\reportbuilder\datasource\activity
 * @covers     \mod_gear\reportbuilder\local\entities\tracking
 */
final class activity_test extends \core_reportbuilder_testcase {
    /**
     * The default report lists the tracked actions with the user, the activity and the course.
     */
    public function test_default_datasource(): void {
        global $DB;
        $this->resetAfterTest();

        $course = $this->getDataGenerator()->create_course(['fullname' => 'Gear course']);
        $student = $this->getDataGenerator()->create_and_enrol($course, 'student');
        /** @var \mod_gear_generator $generator */
        $generator = $this->getDataGenerator()->get_plugin_generator('mod_gear');
        $gear = $generator->create_instance(['course' => $course->id, 'name' => 'Engine']);
        $DB->insert_record('gear_tracking', (object) [
            'gearid' => $gear->id,
            'userid' => $student->id,
            'action' => 'hotspot_click',
            'data' => '{}',
            'duration' => 5,
            'timecreated' => time(),
        ]);

        /** @var \core_reportbuilder_generator $reportgenerator */
        $reportgenerator = $this->getDataGenerator()->get_plugin_generator('core_reportbuilder');
        $report = $reportgenerator->create_report(['name' => 'Gear', 'source' => activity::class, 'default' => 1]);

        $content = $this->get_custom_report_content($report->get('id'));
        $this->assertCount(1, $content);
        $row = array_values(reset($content));
        $this->assertSame('Gear course', $row[0]);
        $this->assertSame('Engine', $row[1]);
        $this->assertSame('hotspot_click', $row[3]);
    }

    /**
     * Test the filters of the source.
     *
     * @dataProvider filters_provider
     * @param string $filter Filter unique identifier
     * @param array $values Filter values
     * @param bool $expected Whether the row is listed
     */
    public function test_filters(string $filter, array $values, bool $expected): void {
        global $DB;
        $this->resetAfterTest();

        $course = $this->getDataGenerator()->create_course();
        $student = $this->getDataGenerator()->create_and_enrol($course, 'student');
        /** @var \mod_gear_generator $generator */
        $generator = $this->getDataGenerator()->get_plugin_generator('mod_gear');
        $gear = $generator->create_instance(['course' => $course->id, 'name' => 'Engine']);
        $DB->insert_record('gear_tracking', (object) [
            'gearid' => $gear->id,
            'userid' => $student->id,
            'action' => 'hotspot_click',
            'data' => '{}',
            'duration' => 5,
            'timecreated' => time(),
        ]);

        /** @var \core_reportbuilder_generator $reportgenerator */
        $reportgenerator = $this->getDataGenerator()->get_plugin_generator('core_reportbuilder');
        $report = $reportgenerator->create_report(['name' => 'Gear', 'source' => activity::class, 'default' => 0]);
        $reportgenerator->create_column(['reportid' => $report->get('id'), 'uniqueidentifier' => 'tracking:action']);
        $reportgenerator->create_filter(['reportid' => $report->get('id'), 'uniqueidentifier' => $filter]);

        $content = $this->get_custom_report_content($report->get('id'), 0, $values);
        $this->assertCount($expected ? 1 : 0, $content);
    }

    /**
     * Data for test_filters.
     *
     * @return array[]
     */
    public static function filters_provider(): array {
        return [
            'Activity name matches' => ['tracking:name', ['tracking:name_operator' => text::IS_EQUAL_TO,
                'tracking:name_value' => 'Engine'], true],
            'Activity name differs' => ['tracking:name', ['tracking:name_operator' => text::IS_EQUAL_TO,
                'tracking:name_value' => 'Other'], false],
            'Action matches' => ['tracking:action', ['tracking:action_operator' => text::IS_EQUAL_TO,
                'tracking:action_value' => 'hotspot_click'], true],
            'Action differs' => ['tracking:action', ['tracking:action_operator' => text::IS_EQUAL_TO,
                'tracking:action_value' => 'quiz_submit'], false],
        ];
    }

    /**
     * Stress test the source (every column, filter and condition is valid SQL).
     */
    public function test_datasource_stress(): void {
        global $DB;
        $this->resetAfterTest();
        $course = $this->getDataGenerator()->create_course();
        $student = $this->getDataGenerator()->create_and_enrol($course, 'student');
        /** @var \mod_gear_generator $generator */
        $generator = $this->getDataGenerator()->get_plugin_generator('mod_gear');
        $gear = $generator->create_instance(['course' => $course->id]);
        // The stress test expects every column to return data, so there must be a tracked action.
        $DB->insert_record('gear_tracking', (object) [
            'gearid' => $gear->id,
            'userid' => $student->id,
            'action' => 'hotspot_click',
            'data' => '{}',
            'duration' => 5,
            'timecreated' => time(),
        ]);

        $this->datasource_stress_test_columns(activity::class);
        $this->datasource_stress_test_columns_aggregation(activity::class);
        $this->datasource_stress_test_conditions(activity::class, 'tracking:name');
    }
}
