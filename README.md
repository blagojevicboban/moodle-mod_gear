# GEAR - Immersive AR/VR Learning for Moodle

[![Moodle Plugin CI](https://github.com/blagojevicboban/moodle-mod_gear/actions/workflows/ci.yml/badge.svg)](https://github.com/blagojevicboban/moodle-mod_gear/actions/workflows/ci.yml)
[![Moodle](https://img.shields.io/badge/Moodle-4.5%20to%205.3-orange.svg)](https://moodle.org)
[![PHP](https://img.shields.io/badge/PHP-8.2%2B-purple.svg)](https://php.net)
[![License](https://img.shields.io/badge/License-GPL%20v3-blue.svg)](LICENSE)

**GEAR** (Geospatial Educational Augmented Reality) is a Moodle activity module that enables immersive AR/VR learning experiences with 3D models, hotspots, and WebXR support.

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🎮 **3D Viewer** | Display glTF/GLB models with orbit controls |
| 📱 **AR Mode** | View 3D content in augmented reality |
| 🥽 **VR Mode** | Immersive WebXR experience with interactive hand controllers |
| 📍 **Hotspots** | Interactive information points (Info, Quiz, Audio, Video, Teleport) |
| 💬 **Tooltips** | Hover tooltips with icons, titles, and descriptions for quick context |
| ♿ **Accessibility** | Keyboard navigation, screen reader labels, and touch/long-press for mobile |
| 🎞️ **Video** | Embed MP4s, YouTube, or Vimeo directly in 3D scenes |
| 🧩 **Gamification** | Branching scenarios & escape-room style conditional unlocking |
| ✨ **AI Assist** | Generate hotspot content and quizzes using OpenAI-compatible API |
| 🗣️ **Text-to-Speech**| Native auto-narration of informational hotspots |
| 📝 **Quizzes** | In-world multiple choice questions with grading |
| 👥 **Collaborative** | Real-time multi-user sessions with avatars |
| 💬 **P2P Chat** | Real-time Peer-to-Peer WebRTC spatial voice and text chat |
| 🏆 **Leaderboards** | Gamification with top score display |
| 🔊 **Spatial Audio** | Positional audio guides that react to distance |
| 📊 **Analytics** | Teacher dashboard displaying hotspot click charts and event tracking |
| 🌐 **WebXR** | No app installation required |
| ⚡ **Performance** | Optimized WebGL & WebXR scaling for mobile devices |
| 🔒 **Privacy** | Implements Moodle Privacy API (metadata, export, deletion) |
| 📦 **Backup** | Full Backup/Restore support |
| 📱 **Mobile** | Moodle Mobile App support |

## 📋 Requirements

- **Moodle**: 4.5 LTS to 5.3+
- **PHP**: 8.2+
- **Database**: MySQL, MariaDB, or PostgreSQL
- **Browser**: Chrome, Firefox, Safari, Edge (WebGL support)
- **AR/VR**: WebXR-compatible browser
- **OpenAI API Key**: Optional, required only for AI Assistant features

## 🚀 Installation

### Via Git
```bash
cd /path/to/moodle/mod
git clone https://github.com/blagojevicboban/moodle-mod_gear.git gear
php admin/cli/upgrade.php
```

### Via Download
1. Download the [latest release](https://github.com/blagojevicboban/moodle-mod_gear/releases)
2. Extract to `/mod/gear/`
3. Visit Site Administration → Notifications

## 📖 Usage

### For Teachers

1. **Activity Setup**:
   - Add activity → **GEAR**.
   - Upload a **3D model** (`.glb` or `.gltf` with companion `.bin` and texture image files).
2. **Interactive Scene**:
   - Open the activity and click the **Edit** (pencil) icon.
   - **Shift + Click** anywhere on the 3D model to add a hotspot.
   - Use the **Visual Authoring Gizmo** (3D Arrows) to position hotspots along the X, Y, and Z axes.
3. **Scene Configuration**:
   - Adjust the camera to your preferred starting position and zoom level.
   - Click **Save Current View (Set as default)** to save the initial state for all students.
4. **Hotspot Types**:
   - **Info**: Rich text description.
   - **Quiz**: Multiple choice questions with automated grading.
   - **Audio**: Positional audio (`.mp3`/`.wav` URL).
   - **Video**: Embed videos (MP4, YouTube, Vimeo URL).
   - **Teleport**: Seamlessly fly the camera to new locations.
5. **Branching Scenarios**:
   - Set a **"Requires Quiz (Unlock)"** condition on any hotspot to hide it until a student correctly answers a specific 3D quiz.
6. **✨ AI Assistant**:
   - In the Hotspot editor, enter a short prompt and click **AI Assist**.
   - For **Quizzes**, the AI will automatically generate options and select the correct answer.

### For Students

1. **Exploration**: Rotate, zoom, and move around the 3D model.
2. **Interaction**: Click hotspots to view info, take quizzes, or listen to audio guides.
3. **Accessibility**:
   - Use **Tab** to focus the 3D viewer, then **Arrow keys** to navigate between hotspots and **Enter** to activate them.
   - Use the Text-to-Speech button on info hotspots to have the content read aloud.
   - On mobile, **long-press** (0.5s) on a hotspot to view its tooltip.
4. **Collaboration**: See other students in the same scene as 3D avatars. Connect via microphone for real-time WebRTC 3D voice chat.
5. **Spatial Audio**: Move closer to audio hotspots or other speaking students to hear them louder. Use headphones for the best experience.

## ⚙️ Configuration

To use the **AI Assistant**, configure the API settings:
1. Go to **Site Administration → Plugins → Activity Modules → GEAR**.
2. Enable **Enable AI Assistant**.
3. Enter your **API Key**.
4. (Optional) Specify the **AI Model** (default: `gpt-4o-mini`).

## 🎨 Supported Formats

| Format | Extension | Description |
|--------|-----------|-------------|
| GLB | `.glb` | Binary glTF single file (recommended) |
| glTF | `.gltf` + `.bin` + images | JSON glTF with companion binary/texture assets |

## 🛠️ Development

```bash
# Clone repository
git clone https://github.com/blagojevicboban/moodle-mod_gear.git gear

# Install dependencies
npm install

# Build & Minify JS
npx grunt amd

# Run PHPUnit tests (from the Moodle root after phpunit init)
vendor/bin/phpunit mod/gear/tests/
```

## 📁 Structure

```
mod/gear/
├── amd/              # AMD JavaScript modules
├── backup/           # Backup/restore handlers
├── classes/          # PHP classes (events, external, privacy, task)
├── db/               # Database schema, capabilities, services, tasks
├── lang/             # Language files (en, sr)
├── pix/              # Icons
├── templates/        # Mustache templates
├── tests/            # PHPUnit & Behat tests
├── vendorjs/         # Self-hosted PeerJS library
├── lib.php           # Core Moodle module callbacks
├── mod_form.php      # Activity settings form
├── report.php        # Analytics report page
├── settings.php      # Admin settings
├── styles.css        # Module stylesheet
├── thirdpartylibs.xml# Third-party library metadata
├── view.php          # Main activity view
└── version.php       # Plugin metadata
```

## 🌍 Languages

- 🇬🇧 English
- 🇷🇸 Srpski (Serbian)

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

GNU GPL v3 or later - see [LICENSE](LICENSE)

## 👤 Author

**Boban Blagojević**  
[GitHub](https://github.com/blagojevicboban)

## 🙏 Credits

- [Three.js](https://threejs.org/) - 3D library (MIT)
- [PeerJS](https://peerjs.com/) - WebRTC wrapper (MIT)
- [WebXR](https://immersiveweb.dev/) - AR/VR API
