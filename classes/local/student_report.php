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

namespace mod_gear\local;

use stdClass;

/**
 * Progress of the students of a GEAR activity: opened hotspots, solved quizzes, points and the last activity.
 *
 * @package    mod_gear
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class student_report {
    /** @var stdClass GEAR instance */
    protected $gear;

    /** @var stdClass[] Hotspots of the activity (without teleport waypoints), by id */
    protected $hotspots;

    /**
     * Constructor.
     *
     * @param stdClass $gear GEAR instance record
     */
    public function __construct(stdClass $gear) {
        global $CFG, $DB;
        require_once($CFG->dirroot . '/mod/gear/lib.php');
        $this->gear = $gear;
        $select = "gearid = :gearid AND type <> 'teleport'";
        $fields = 'id, title, type, config';
        $this->hotspots = $DB->get_records_select('gear_hotspots', $select, ['gearid' => $gear->id], 'id', $fields);
    }

    /**
     * Tracked actions of the given users, grouped by user.
     *
     * @param int[] $userids User ids
     * @return array userid => list of tracking records
     */
    protected function tracking(array $userids): array {
        global $DB;
        $result = array_fill_keys($userids, []);
        if (!$userids) {
            return $result;
        }
        [$insql, $params] = $DB->get_in_or_equal($userids, SQL_PARAMS_NAMED);
        $params['gearid'] = $this->gear->id;
        $select = "gearid = :gearid AND userid $insql";
        $fields = 'id, userid, action, data, timecreated';
        $records = $DB->get_recordset_select('gear_tracking', $select, $params, 'timecreated, id', $fields);
        foreach ($records as $record) {
            $result[(int) $record->userid][] = $record;
        }
        $records->close();
        return $result;
    }

    /**
     * Points a quiz hotspot is worth.
     *
     * @param stdClass $hotspot Hotspot record
     * @return int
     */
    protected static function points(stdClass $hotspot): int {
        $config = json_decode($hotspot->config ?? '', true);
        return isset($config['points']) ? (int) $config['points'] : 10;
    }

    /**
     * Per hotspot state of one user, computed from the tracked actions.
     *
     * @param stdClass[] $records Tracking records of the user
     * @return array hotspotid => [views, attempts, correct, best]
     */
    protected function hotspot_state(array $records): array {
        $state = [];
        foreach ($this->hotspots as $id => $hotspot) {
            $state[$id] = ['views' => 0, 'attempts' => 0, 'correct' => false, 'best' => 0];
        }
        foreach ($records as $record) {
            $data = json_decode($record->data ?? '', true) ?: [];
            if ($record->action === 'hotspot_click') {
                $id = (int) ($data['hotspotId'] ?? 0);
                if (isset($state[$id])) {
                    $state[$id]['views']++;
                }
            } else if ($record->action === 'quiz_submit') {
                $id = (int) ($data['hotspotid'] ?? 0);
                if (isset($state[$id])) {
                    $state[$id]['attempts']++;
                    $state[$id]['correct'] = $state[$id]['correct'] || !empty($data['correct']);
                    $state[$id]['best'] = max($state[$id]['best'], (int) ($data['score'] ?? 0));
                }
            }
        }
        return $state;
    }

    /**
     * One summary row per user.
     *
     * @param stdClass[] $users Users (id, firstname, lastname and the other name fields)
     * @return array[] Rows with userid, fullname, viewed, viewable, solved, quizzes, points, maxpoints, grade, lastactivity
     */
    public function rows(array $users): array {
        $tracking = $this->tracking(array_map(fn($u) => (int) $u->id, array_values($users)));
        $quizzes = array_filter($this->hotspots, fn($h) => $h->type === 'quiz');
        $maxpoints = array_sum(array_map([self::class, 'points'], $quizzes));
        $rows = [];
        foreach ($users as $user) {
            $records = $tracking[(int) $user->id] ?? [];
            $state = $this->hotspot_state($records);
            $solved = array_keys(array_filter($state, fn($s) => $s['correct']));
            $viewable = 0;
            $viewed = 0;
            foreach ($this->hotspots as $id => $hotspot) {
                if (gear_hotspot_is_unlocked($hotspot, $solved, false)) {
                    $viewable++;
                    $viewed += $state[$id]['views'] > 0 ? 1 : 0;
                }
            }
            $points = array_sum(array_map(fn($id) => $state[$id]['best'], array_keys($quizzes)));
            $grade = null;
            if ($this->gear->grade > 0 && $maxpoints > 0) {
                $grade = min((float) $this->gear->grade, $points / $maxpoints * $this->gear->grade);
            }
            $last = $records ? (int) end($records)->timecreated : 0;
            $rows[] = [
                'userid' => (int) $user->id,
                'fullname' => fullname($user),
                'viewed' => $viewed,
                'viewable' => $viewable,
                'solved' => count($solved),
                'quizzes' => count($quizzes),
                'points' => $points,
                'maxpoints' => $maxpoints,
                'grade' => $grade,
                'lastactivity' => $last,
            ];
        }
        return $rows;
    }

    /**
     * Per hotspot details of one user.
     *
     * @param int $userid User id
     * @return array[] Rows with id, title, type, locked, views, attempts, correct, best, points
     */
    public function details(int $userid): array {
        $state = $this->hotspot_state($this->tracking([$userid])[$userid]);
        $solved = array_keys(array_filter($state, fn($s) => $s['correct']));
        $rows = [];
        foreach ($this->hotspots as $id => $hotspot) {
            $rows[] = [
                'id' => (int) $id,
                'title' => format_string($hotspot->title),
                'type' => $hotspot->type,
                'locked' => !gear_hotspot_is_unlocked($hotspot, $solved, false),
                'views' => $state[$id]['views'],
                'attempts' => $state[$id]['attempts'],
                'correct' => $state[$id]['correct'],
                'best' => $state[$id]['best'],
                'points' => $hotspot->type === 'quiz' ? self::points($hotspot) : 0,
            ];
        }
        return $rows;
    }
}
