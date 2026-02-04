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
 * English language strings for mod_gear.
 *
 * @package    mod_gear
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

$string['pluginname'] = 'GEAR - Immersive Learning';
$string['modulename'] = 'GEAR';
$string['modulenameplural'] = 'GEAR Activities';
$string['modulename_help'] = 'The GEAR activity module enables teachers to create immersive AR/VR learning experiences with 3D models, hotspots, and interactive elements.';

// Capabilities.
$string['gear:addinstance'] = 'Add a new GEAR activity';
$string['gear:view'] = 'View GEAR content';
$string['gear:manage'] = 'Manage GEAR content';

// Form fields.
$string['gearname'] = 'Activity name';
$string['gearname_help'] = 'Enter a name for this AR/VR activity.';
$string['geardescription'] = 'Description';

// Scene settings.
$string['scenesettings'] = 'Scene Settings';
$string['ar_enabled'] = 'Enable AR mode';
$string['ar_enabled_help'] = 'Allow users to view content in Augmented Reality on supported devices.';
$string['vr_enabled'] = 'Enable VR mode';
$string['vr_enabled_help'] = 'Allow users to view content in Virtual Reality with a headset.';
$string['background_color'] = 'Background color';
$string['lighting'] = 'Lighting preset';
$string['lighting_studio'] = 'Studio';
$string['lighting_outdoor'] = 'Outdoor';
$string['lighting_dark'] = 'Dark';

// Models.
$string['models'] = '3D Models';
$string['addmodel'] = 'Add 3D model';
$string['modelfile'] = 'Model file';
$string['modelfile_help'] = 'Upload a 3D model in glTF (.gltf, .glb) format.';
$string['supportedformats'] = 'Supported formats: glTF, GLB';

// Hotspots.
$string['hotspots'] = 'Hotspots';
$string['addhotspot'] = 'Add hotspot';
$string['hotspottype'] = 'Hotspot type';
$string['hotspottype_info'] = 'Information';
$string['hotspottype_quiz'] = 'Quiz';
$string['hotspottype_audio'] = 'Audio';
$string['hotspottype_link'] = 'Link';
$string['hotspottitle'] = 'Hotspot title';
$string['hotspotcontent'] = 'Hotspot content';

// Viewer.
$string['enterarvr'] = 'Enter AR/VR';
$string['enterar'] = 'View in AR';
$string['entervr'] = 'Enter VR';
$string['exitvr'] = 'Exit VR';
$string['fullscreen'] = 'Fullscreen';
$string['autorotate'] = 'Auto-rotate';
$string['loadingmodel'] = 'Loading 3D model...';

// Errors.
$string['nomodels'] = 'No 3D models have been added to this activity.';
$string['webxrnotsupported'] = 'WebXR is not supported in your browser.';
$string['arnotsupported'] = 'AR is not supported on this device.';
$string['invalidcolor'] = 'Invalid color format. Please use #RRGGBB format.';

// Privacy.
$string['privacy:metadata:gear_tracking'] = 'Information about user interactions with GEAR content.';
$string['privacy:metadata:gear_tracking:userid'] = 'The ID of the user.';
$string['privacy:metadata:gear_tracking:action'] = 'The action performed by the user.';
$string['privacy:metadata:gear_tracking:timecreated'] = 'The time when the action was recorded.';
