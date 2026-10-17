# GEAR 1.7.1

Requires Moodle 4.5 LTS or later (tested on 4.5, 5.0, 5.1, 5.2 and 5.3) and PHP 8.2 or later.

## Upgrade notes

- **Moodle 4.1 to 4.4 are no longer supported.** Stay on 1.7.0 if you run one of them.
- **The AI assistant now uses Moodle's AI subsystem.** The plugin's own OpenAI key and model settings were removed. After upgrading, configure an AI provider with text generation under *Site administration, General, AI*; the GEAR setting *Enable AI Assistant* keeps its value. Each user accepts the Moodle AI usage policy once.
- **Collaborative mode (shared sessions, voice and chat) is now an admin setting.** It is off for new installs and stays on where it was already used. You can point it to your own PeerJS server.

## Security

- Quiz scores can no longer be forged: only the server records quiz results.
- Correct answers and locked hotspots are no longer sent to students; unlocking is decided on the server and survives a reload.
- Hotspot content and the analytics report are sanitised (stored XSS fixed); chat messages, quiz feedback and tooltips no longer insert untrusted text as HTML.
- A teacher can no longer change hotspots of another activity.
- Model files are served only to people who can view the activity.
- WebRTC peers use random ids and are accepted only if they are in the session; guests cannot join.

## New

- Completion rules: open every hotspot, and/or earn a minimum of quiz points.
- Group mode: with separate groups the leaderboard and shared session show only your groups.
- Draco and Meshopt compressed models, loading progress, and a visible error when a model cannot be loaded.
- Several models in one scene; *Save Current View* remembers each of them.
- AR on iPhone and iPad through AR Quick Look: upload a `.usdz` file with the same name as the model (experimental, not tested on a physical device).
- Accessibility: labelled dialogs with focus handling, labelled controls, screen reader announcements, reduced motion support.
- Performance: no rendering or polling in hidden tabs, PeerJS loaded only when a second person joins.
- Teacher and student guides, screenshots, events, a scheduled cleanup task, course reset, PHPUnit and Behat tests.

## Fixed

- The AR and VR buttons were always disabled, even in browsers with WebXR.
- Grades counted only one quiz submission per user; the best score per hotspot now counts and the total is scaled to the activity grade.
- Editing the activity settings no longer resets the saved camera and the hotspot options.
- The viewer no longer fails for an activity without a model.
- Backup and restore keep unlock rules and skip users that were not restored; the grade item is removed with the activity.

Full list: [CHANGELOG.md](../CHANGELOG.md).
