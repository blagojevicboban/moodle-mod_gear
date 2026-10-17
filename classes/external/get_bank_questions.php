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
 * List the single answer multiple choice and true/false questions of the course question banks.
 *
 * The teacher copies one of them into a quiz hotspot (the hotspot keeps its own copy of the text and options).
 *
 * @package    mod_gear
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class get_bank_questions extends external_api {
    /** @var int Maximum number of questions returned. */
    const LIMIT = 300;

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
     * Find the questions that can be turned into a quiz hotspot.
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

        // Question categories are in the course context (Moodle 4.x) or in the contexts of the course's
        // question bank and quiz modules (Moodle 5.0 and later).
        $coursecontext = context_course::instance($gear->course);
        $sql = "SELECT q.id, q.name, q.questiontext, q.questiontextformat, q.qtype
                  FROM {question} q
                  JOIN {question_versions} qv ON qv.questionid = q.id
                  JOIN {question_bank_entries} qbe ON qbe.id = qv.questionbankentryid
                  JOIN {question_categories} qc ON qc.id = qbe.questioncategoryid
                  JOIN {context} ctx ON ctx.id = qc.contextid
                 WHERE q.qtype IN ('multichoice', 'truefalse') AND q.parent = 0 AND qv.status = 'ready'
                       AND qv.version = (SELECT MAX(v.version)
                                           FROM {question_versions} v
                                          WHERE v.questionbankentryid = qbe.id AND v.status = 'ready')
                       AND (ctx.id = :courseid OR " . $DB->sql_like('ctx.path', ':path') . ")
              ORDER BY q.name, q.id";
        $questions = $DB->get_records_sql($sql, [
            'courseid' => $coursecontext->id,
            'path' => $DB->sql_like_escape($coursecontext->path) . '/%',
        ], 0, self::LIMIT);

        $result = [];
        foreach ($questions as $question) {
            $item = self::convert($question);
            if ($item !== null) {
                $result[] = $item;
            }
        }
        return $result;
    }

    /**
     * Convert a question to the data of a quiz hotspot.
     *
     * @param \stdClass $question Row of the question table
     * @return array|null Null when the question has no single correct answer
     */
    protected static function convert(\stdClass $question): ?array {
        global $DB;

        if ($question->qtype === 'multichoice') {
            $single = $DB->get_field('qtype_multichoice_options', 'single', ['questionid' => $question->id]);
            if (!$single) {
                return null;
            }
        }
        $answers = $DB->get_records('question_answers', ['question' => $question->id], 'id');
        $options = [];
        $correct = null;
        foreach ($answers as $answer) {
            if ((float) $answer->fraction > 0.999) {
                if ($correct !== null) {
                    return null;
                }
                $correct = count($options);
            }
            $options[] = self::plain($answer->answer, (int) $answer->answerformat);
        }
        if ($correct === null || count($options) < 2) {
            return null;
        }
        return [
            'id' => (int) $question->id,
            'name' => format_string($question->name),
            'qtype' => $question->qtype,
            'text' => self::plain($question->questiontext, (int) $question->questiontextformat),
            'options' => $options,
            'correct' => $correct,
        ];
    }

    /**
     * Plain text version of a piece of question text.
     *
     * @param string $text Text
     * @param int $format Text format
     * @return string
     */
    protected static function plain(string $text, int $format): string {
        // Files of the question (@@PLUGINFILE@@) are not copied, so images are dropped.
        $text = preg_replace('/<img\b[^>]*>/i', '', $text);
        $html = format_text($text, $format, ['noclean' => false, 'filter' => false, 'para' => false]);
        // The function html_to_text() would turn bold text into capitals, so break lines and strip the tags here.
        $html = preg_replace('~(</p>|</div>|</li>|<br\s*/?>)~i', "$1\n", $html);
        $text = html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        return trim(preg_replace('/[ \t]+/', ' ', preg_replace('/\s*\n\s*/', "\n", $text)));
    }

    /**
     * Returns description of method result value.
     *
     * @return external_multiple_structure
     */
    public static function execute_returns(): external_multiple_structure {
        return new external_multiple_structure(new external_single_structure([
            'id' => new external_value(PARAM_INT, 'Question ID'),
            'name' => new external_value(PARAM_TEXT, 'Question name'),
            'qtype' => new external_value(PARAM_ALPHANUMEXT, 'Question type'),
            'text' => new external_value(PARAM_RAW, 'Question text as plain text'),
            'options' => new external_multiple_structure(new external_value(PARAM_RAW, 'Answer as plain text')),
            'correct' => new external_value(PARAM_INT, 'Index of the correct answer'),
        ]));
    }
}
