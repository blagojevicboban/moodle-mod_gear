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
 * Handle direct upload of media files (audio/video) for hotspots.
 *
 * @package    mod_gear
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

define('AJAX_SCRIPT', true);

require_once(__DIR__ . '/../../config.php');
require_once(__DIR__ . '/lib.php');

$cmid = required_param('cmid', PARAM_INT);
$draftitemid = optional_param('draftitemid', 0, PARAM_INT);

$cm = get_coursemodule_from_id('gear', $cmid, 0, false, MUST_EXIST);
$course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
$context = context_module::instance($cm->id);

require_login($course, false, $cm);
require_sesskey();
require_capability('mod/gear:manage', $context);

header('Content-Type: application/json; charset=utf-8');

if (empty($_FILES['file']) || !is_uploaded_file($_FILES['file']['tmp_name'])) {
    echo json_encode([
        'success' => false,
        'message' => 'No file uploaded',
    ]);
    exit;
}

$fileinfo = $_FILES['file'];
if ($fileinfo['error'] !== UPLOAD_ERR_OK) {
    echo json_encode([
        'success' => false,
        'message' => 'Upload error: ' . $fileinfo['error'],
    ]);
    exit;
}

// Validate file extension.
$filename = clean_param($fileinfo['name'], PARAM_FILE);
$ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
$allowed = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'mp4', 'webm', 'ogv'];
if (!in_array($ext, $allowed, true)) {
    echo json_encode([
        'success' => false,
        'message' => 'Unsupported media file type',
    ]);
    exit;
}

if ($draftitemid == 0) {
    $draftitemid = file_get_unused_draft_itemid();
}

$usercontext = context_user::instance($USER->id);
$fs = get_file_storage();

// Delete previous files in this draft itemid to keep only one file per hotspot media field.
$fs->delete_area_files($usercontext->id, 'user', 'draft', $draftitemid);

$filerecord = [
    'contextid' => $usercontext->id,
    'component' => 'user',
    'filearea' => 'draft',
    'itemid' => $draftitemid,
    'filepath' => '/',
    'filename' => $filename,
    'userid' => $USER->id,
];

try {
    $file = $fs->create_file_from_pathname($filerecord, $fileinfo['tmp_name']);
    $drafturl = moodle_url::make_draft_file_url($draftitemid, '/', $filename)->out(false);

    echo json_encode([
        'success' => true,
        'draftitemid' => $draftitemid,
        'filename' => $filename,
        'filesize' => $file->get_filesize(),
        'url' => $drafturl,
    ]);
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
    ]);
}
