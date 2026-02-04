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
 * Serbian language strings for mod_gear.
 *
 * @package    mod_gear
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

$string['pluginname'] = 'GEAR - Imerzivno učenje';
$string['modulename'] = 'GEAR';
$string['modulenameplural'] = 'GEAR Aktivnosti';
$string['modulename_help'] = 'GEAR modul omogućava nastavnicima kreiranje imerzivnih AR/VR obrazovnih iskustava sa 3D modelima, hotspotovima i interaktivnim elementima.';

// Capabilities.
$string['gear:addinstance'] = 'Dodaj novu GEAR aktivnost';
$string['gear:view'] = 'Pregledaj GEAR sadržaj';
$string['gear:manage'] = 'Upravljaj GEAR sadržajem';

// Form fields.
$string['gearname'] = 'Naziv aktivnosti';
$string['gearname_help'] = 'Unesite naziv za ovu AR/VR aktivnost.';
$string['geardescription'] = 'Opis';

// Scene settings.
$string['scenesettings'] = 'Podešavanja scene';
$string['ar_enabled'] = 'Omogući AR režim';
$string['ar_enabled_help'] = 'Dozvoli korisnicima da pregledaju sadržaj u proširenoj stvarnosti na podržanim uređajima.';
$string['vr_enabled'] = 'Omogući VR režim';
$string['vr_enabled_help'] = 'Dozvoli korisnicima da pregledaju sadržaj u virtuelnoj stvarnosti sa headsetom.';
$string['background_color'] = 'Boja pozadine';
$string['lighting'] = 'Preset osvetljenja';
$string['lighting_studio'] = 'Studio';
$string['lighting_outdoor'] = 'Spoljašnje';
$string['lighting_dark'] = 'Tamno';

// Models.
$string['models'] = '3D Modeli';
$string['addmodel'] = 'Dodaj 3D model';
$string['modelfile'] = 'Fajl modela';
$string['modelfile_help'] = 'Učitajte 3D model u glTF (.gltf, .glb) formatu.';
$string['supportedformats'] = 'Podržani formati: glTF, GLB';

// Hotspots.
$string['hotspots'] = 'Hotspotovi';
$string['addhotspot'] = 'Dodaj hotspot';
$string['hotspottype'] = 'Tip hotspota';
$string['hotspottype_info'] = 'Informacija';
$string['hotspottype_quiz'] = 'Kviz';
$string['hotspottype_audio'] = 'Audio';
$string['hotspottype_link'] = 'Link';
$string['hotspottitle'] = 'Naslov hotspota';
$string['hotspotcontent'] = 'Sadržaj hotspota';

// Viewer.
$string['enterarvr'] = 'Uđi u AR/VR';
$string['enterar'] = 'Pregledaj u AR';
$string['entervr'] = 'Uđi u VR';
$string['exitvr'] = 'Izađi iz VR';
$string['fullscreen'] = 'Ceo ekran';
$string['autorotate'] = 'Auto-rotacija';
$string['loadingmodel'] = 'Učitavanje 3D modela...';

// Errors.
$string['nomodels'] = 'Nema dodatih 3D modela u ovoj aktivnosti.';
$string['webxrnotsupported'] = 'WebXR nije podržan u vašem pregledaču.';
$string['arnotsupported'] = 'AR nije podržan na ovom uređaju.';
$string['invalidcolor'] = 'Neispravan format boje. Koristite format #RRGGBB.';

// Privacy.
$string['privacy:metadata:gear_tracking'] = 'Informacije o interakcijama korisnika sa GEAR sadržajem.';
$string['privacy:metadata:gear_tracking:userid'] = 'ID korisnika.';
$string['privacy:metadata:gear_tracking:action'] = 'Akcija koju je korisnik izvršio.';
$string['privacy:metadata:gear_tracking:timecreated'] = 'Vreme kada je akcija zabeležena.';
