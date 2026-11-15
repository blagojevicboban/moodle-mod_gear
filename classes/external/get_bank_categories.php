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

namespace mod_gear\external;

use core_external\external_api;
use core_external\external_function_parameters;
use core_external\external_multiple_structure;
use core_external\external_single_structure;
use core_external\external_value;
use context_course;
use context_module;

/**
 * List question bank categories in the course that have supported quiz questions.
 *
 * @package    mod_gear
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class get_bank_categories extends external_api {
    /**
     * Returns description of method parameters.
     *
     * @return external_function_parameters
     */
    public static function execute_parameters(): external_function_parameters {
        return new external_function_parameters([
            'gearid' => new external_value(PARAM_INT, 'GEAR activity ID'),
        ]);
    }

    /**
     * Return question categories containing supported ready questions.
     *
     * @param int $gearid GEAR activity ID
     * @return array
     */
    public static function execute(int $gearid): array {
        global $DB;

        $params = self::validate_parameters(self::execute_parameters(), ['gearid' => $gearid]);

        $gear = $DB->get_record('gear', ['id' => $params['gearid']], '*', MUST_EXIST);
        $cm = get_coursemodule_from_instance('gear', $gear->id, 0, false, MUST_EXIST);
        $context = context_module::instance($cm->id);
        self::validate_context($context);
        require_capability('mod/gear:manage', $context);

        $coursecontext = context_course::instance($gear->course);
        $sql = "SELECT qc.id, qc.name, COUNT(DISTINCT q.id) AS questioncount
                  FROM {question_categories} qc
                  JOIN {context} ctx ON ctx.id = qc.contextid
                  JOIN {question_bank_entries} qbe ON qbe.questioncategoryid = qc.id
                  JOIN {question_versions} qv ON qv.questionbankentryid = qbe.id
                  JOIN {question} q ON q.id = qv.questionid
                 WHERE q.qtype IN ('multichoice', 'truefalse', 'shortanswer') AND q.parent = 0 AND qv.status = 'ready'
                       AND qv.version = (SELECT MAX(v.version)
                                           FROM {question_versions} v
                                          WHERE v.questionbankentryid = qbe.id AND v.status = 'ready')
                       AND (ctx.id = :courseid OR " . $DB->sql_like('ctx.path', ':path') . ")
              GROUP BY qc.id, qc.name
              ORDER BY qc.name, qc.id";
        $records = $DB->get_records_sql($sql, [
            'courseid' => $coursecontext->id,
            'path' => $DB->sql_like_escape($coursecontext->path) . '/%',
        ]);

        $result = [];
        foreach ($records as $record) {
            $result[] = [
                'id' => (int) $record->id,
                'name' => format_string($record->name),
                'questioncount' => (int) $record->questioncount,
            ];
        }
        return $result;
    }

    /**
     * Returns description of method result value.
     *
     * @return external_multiple_structure
     */
    public static function execute_returns(): external_multiple_structure {
        return new external_multiple_structure(new external_single_structure([
            'id' => new external_value(PARAM_INT, 'Category ID'),
            'name' => new external_value(PARAM_TEXT, 'Category name'),
            'questioncount' => new external_value(PARAM_INT, 'Number of supported ready questions'),
        ]));
    }
}
