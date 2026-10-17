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

namespace mod_gear\reportbuilder\local\entities;

use core_reportbuilder\local\entities\base;
use core_reportbuilder\local\filters\{date, number, text};
use core_reportbuilder\local\helpers\format;
use core_reportbuilder\local\report\{column, filter};
use lang_string;

/**
 * Entity for one tracked action of a user in a GEAR activity (hotspot views, quiz answers, AR/VR sessions).
 *
 * @package    mod_gear
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class tracking extends base {
    /**
     * Database tables that this entity uses.
     *
     * @return string[]
     */
    protected function get_default_tables(): array {
        return ['gear_tracking', 'gear'];
    }

    /**
     * The default title for this entity.
     *
     * @return lang_string
     */
    protected function get_default_entity_title(): lang_string {
        return new lang_string('entitytracking', 'mod_gear');
    }

    /**
     * Initialise the entity.
     *
     * @return base
     */
    public function initialise(): base {
        foreach ($this->get_all_columns() as $column) {
            $this->add_column($column);
        }
        foreach ($this->get_all_filters() as $filter) {
            $this->add_filter($filter)->add_condition($filter);
        }
        return $this;
    }

    /**
     * Columns.
     *
     * @return column[]
     */
    protected function get_all_columns(): array {
        $trackingalias = $this->get_table_alias('gear_tracking');
        $gearalias = $this->get_table_alias('gear');

        $columns[] = (new column('name', new lang_string('name'), $this->get_entity_name()))
            ->add_joins($this->get_joins())
            ->set_type(column::TYPE_TEXT)
            ->add_field("{$gearalias}.name")
            ->set_is_sortable(true)
            ->add_callback(static fn(?string $name): string => format_string((string) $name));

        $columns[] = (new column('action', new lang_string('action', 'mod_gear'), $this->get_entity_name()))
            ->set_type(column::TYPE_TEXT)
            ->add_field("{$trackingalias}.action")
            ->set_is_sortable(true);

        $columns[] = (new column('timecreated', new lang_string('time', 'mod_gear'), $this->get_entity_name()))
            ->set_type(column::TYPE_TIMESTAMP)
            ->add_field("{$trackingalias}.timecreated")
            ->set_is_sortable(true)
            ->add_callback([format::class, 'userdate']);

        $columns[] = (new column('duration', new lang_string('trackingduration', 'mod_gear'), $this->get_entity_name()))
            ->set_type(column::TYPE_INTEGER)
            ->add_field("COALESCE({$trackingalias}.duration, 0)", 'duration')
            ->set_is_sortable(true)
            ->add_callback(static fn($seconds): string => $seconds === null ? '' : format_time((int) $seconds));

        return $columns;
    }

    /**
     * Filters.
     *
     * @return filter[]
     */
    protected function get_all_filters(): array {
        $trackingalias = $this->get_table_alias('gear_tracking');
        $gearalias = $this->get_table_alias('gear');

        $filters[] = (new filter(text::class, 'name', new lang_string('name'), $this->get_entity_name(), "{$gearalias}.name"))
            ->add_joins($this->get_joins());
        $filters[] = new filter(
            text::class,
            'action',
            new lang_string('action', 'mod_gear'),
            $this->get_entity_name(),
            "{$trackingalias}.action"
        );
        $filters[] = new filter(
            date::class,
            'timecreated',
            new lang_string('time', 'mod_gear'),
            $this->get_entity_name(),
            "{$trackingalias}.timecreated"
        );
        $filters[] = new filter(
            number::class,
            'duration',
            new lang_string('trackingduration', 'mod_gear'),
            $this->get_entity_name(),
            "COALESCE({$trackingalias}.duration, 0)"
        );
        return $filters;
    }
}
