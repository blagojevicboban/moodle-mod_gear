# GEAR - Immersive AR/VR Learning for Moodle

[![Moodle Plugin CI](https://github.com/blagojevicboban/moodle-mod_gear/actions/workflows/ci.yml/badge.svg)](https://github.com/blagojevicboban/moodle-mod_gear/actions/workflows/ci.yml)
[![Moodle](https://img.shields.io/badge/Moodle-4.4%20to%205.1-orange.svg)](https://moodle.org)
[![PHP](https://img.shields.io/badge/PHP-8.1%2B-purple.svg)](https://php.net)
[![License](https://img.shields.io/badge/License-GPL%20v3-blue.svg)](LICENSE)

**GEAR** (Geospatial Educational Augmented Reality) is a Moodle activity module that enables immersive AR/VR learning experiences with 3D models, hotspots, and WebXR support.

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🎮 **3D Viewer** | Display glTF/GLB models with orbit controls |
| 📱 **AR Mode** | View 3D content in augmented reality |
| 🥽 **VR Mode** | Immersive VR experience with headsets |
| 📍 **Hotspots** | Interactive information points (Info, Quiz, Audio) |
| ✨ **AI Assist** | Generate hotspot content and quizzes using AI |
| 📝 **Quizzes** | In-world multiple choice questions with grading |
| 👥 **Collaborative** | Real-time multi-user sessions with avatars |
| 🏆 **Leaderboards** | Gamification with top score display |
| 🔊 **Spatial Audio** | Positional audio guides that react to distance |
| 📊 **Tracking** | Built-in completion, grading, and activity tracking |
| 🌐 **WebXR** | No app installation required |
| 🔒 **Privacy** | GDPR compliant (Privacy API) |
| 📦 **Backup** | Full Backup/Restore support |
| 📱 **Mobile** | Moodle Mobile App support |

## 📋 Requirements

- **Moodle**: 4.4+
- **PHP**: 8.1+
- **Database**: MySQL, MariaDB, or PostgreSQL
- **Browser**: Chrome, Firefox, Safari, Edge (WebGL support)
- **AR/VR**: WebXR-compatible browser
- **OpenAI API Key**: Required for AI Assistant features

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

1.  **Activity Setup**:
    -   Add activity → **GEAR**.
    -   Upload a **3D model** (.glb recommended).
2.  **Interactive Scene**:
    -   Open the activity and click the **Edit** (pencil) icon.
    -   **Shift + Click** anywhere on the 3D model to add a hotspot.
3.  **Hotspot Types**:
    -   **Info**: Simple text description.
    -   **Quiz**: Multiple choice questions with automated grading.
    -   **Audio**: Positional audio (upload .mp3/wav URL).
4.  **✨ AI Assistant**:
    -   In the Hotspot editor, enter a short prompt and click **AI Assist**.
    -   For **Quizzes**, the AI will automatically generate options and select the correct answer.

### For Students

1.  **Exploration**: Rotate, zoom, and move around the 3D model.
2.  **Interaction**: Click hotspots to view info, take quizzes, or listen to audio guides.
3.  **Collaboration**: See other students in the same scene as 3D avatars.
4.  **Spatial Audio**: Move closer to audio hotspots to hear them louder. Use headphones for the best experience.

## ⚙️ Configuration

To use the **AI Assistant**, you must configure the OpenAI API:
1. Go to **Site Administration → Plugins → Activity Modules → GEAR**.
2. Select **OpenAI** as the AI Provider.
3. Enter your **OpenAI API Key**.
4. (Optional) Choose the model (e.g., `gpt-4o-mini`).

## 🎨 Supported Formats

| Format | Extension | Description |
|--------|-----------|-------------|
| glTF | `.gltf` | Text-based, external textures |
| GLB | `.glb` | Binary, single file (recommended) |

## 🛠️ Development

```bash
# Clone repository
git clone https://github.com/blagojevicboban/moodle-mod_gear.git gear

# Install dependencies
npm install

# Build & Minify JS
npx grunt amd

# Run PHP tests
vendor/bin/phpunit --testsuite mod_gear_testsuite
```

## 📁 Structure

```
mod/gear/
├── amd/              # JavaScript modules
├── backup/           # Backup/restore handlers
├── classes/          # PHP classes
├── db/               # Database schema
├── lang/             # Language files
├── pix/              # Icons
├── templates/        # Mustache templates
├── lib.php           # Core functions
├── mod_form.php      # Activity form
├── view.php          # Main view
└── version.php       # Plugin metadata
```

## 🌍 Languages

- 🇬🇧 English
- 🇷🇸 Srpski (Serbian)

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

GNU GPL v3 - see [LICENSE](https://www.gnu.org/licenses/gpl-3.0.html)

## 👤 Author

**Boban Blagojevic**  
[GitHub](https://github.com/blagojevicboban)

## 🙏 Credits

- [Three.js](https://threejs.org/) - 3D library
- [WebXR](https://immersiveweb.dev/) - AR/VR API

---

Made with ❤️ for immersive education
