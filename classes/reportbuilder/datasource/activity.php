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

use core_reportbuilder\datasource;
use core_reportbuilder\local\entities\{course, user};
use mod_gear\reportbuilder\local\entities\tracking;

/**
 * Report source with every tracked action of the users in GEAR activities.
 *
 * @package    mod_gear
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class activity extends datasource {
    /**
     * User friendly name of the report source.
     *
     * @return string
     */
    public static function get_name(): string {
        return get_string('reportsource', 'mod_gear');
    }

    /**
     * Initialise the report.
     */
    protected function initialise(): void {
        $trackingentity = new tracking();
        $trackingalias = $trackingentity->get_table_alias('gear_tracking');
        $gearalias = $trackingentity->get_table_alias('gear');

        $this->set_main_table('gear_tracking', $trackingalias);
        $this->add_entity($trackingentity->add_join("JOIN {gear} {$gearalias} ON {$gearalias}.id = {$trackingalias}.gearid"));

        $courseentity = new course();
        $coursealias = $courseentity->get_table_alias('course');
        $this->add_entity($courseentity
            ->add_joins($trackingentity->get_joins())
            ->add_join("JOIN {course} {$coursealias} ON {$coursealias}.id = {$gearalias}.course"));

        $userentity = new user();
        $useralias = $userentity->get_table_alias('user');
        $this->add_entity($userentity->add_join("JOIN {user} {$useralias} ON {$useralias}.id = {$trackingalias}.userid"));

        // Every entity added above (Moodle 5.0 and 5.1 expect entity names here, later versions entity objects).
        $this->add_all_from_entities();
    }

    /**
     * Columns added to a new report.
     *
     * @return string[]
     */
    public function get_default_columns(): array {
        return ['course:fullname', 'tracking:name', 'user:fullname', 'tracking:action', 'tracking:timecreated'];
    }

    /**
     * Default sorting of a new report.
     *
     * @return int[]
     */
    public function get_default_column_sorting(): array {
        return ['course:fullname' => SORT_ASC, 'tracking:name' => SORT_ASC, 'tracking:timecreated' => SORT_DESC];
    }

    /**
     * Filters added to a new report.
     *
     * @return string[]
     */
    public function get_default_filters(): array {
        return ['course:courseselector', 'tracking:name', 'tracking:action'];
    }

    /**
     * Conditions added to a new report.
     *
     * @return string[]
     */
    public function get_default_conditions(): array {
        return [];
    }
}
