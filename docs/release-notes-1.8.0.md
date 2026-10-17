# GEAR 1.8.0

Requires Moodle 4.5 LTS or later (tested on 4.5, 5.0, 5.1, 5.2 and 5.3) and PHP 8.2 or later. There are no database changes.

## New

- **Text alternative for the 3D scene.** The activity settings have a new *Scene description* field. Screen reader users hear it (or the activity name and the number of hotspots) when they reach the viewer, and a hidden list of hotspots lets them open each one from the keyboard.

## Improved

- Browser pop-ups are gone: deleting a hotspot asks for confirmation in a Moodle dialog, and the AI assistant asks for its topic in a Moodle dialog (focus in the field, Enter confirms).
- Chat messages show the user that the server lists for the sender, so a sender name cannot be faked.
- Error title, "points awarded", the hotspot fallback name, the chat names and the viewer label are now translatable language strings (English and Serbian).
- The viewer code is free of ESLint warnings.

## Verified

- Chat between two browsers over WebRTC with a local PeerJS server.
- Automated tests on Moodle 4.5, 5.0, 5.1, 5.2 and 5.3.

Full list: [CHANGELOG.md](../CHANGELOG.md).
