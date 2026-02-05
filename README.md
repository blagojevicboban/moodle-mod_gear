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
| 📍 **Hotspots** | Interactive information points |
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

- **Moodle**: 4.4 - 5.1
- **PHP**: 8.1+
- **Database**: MySQL, MariaDB, or PostgreSQL
- **Browser**: Chrome, Firefox, Safari, Edge (WebGL support)
- **AR/VR**: WebXR-compatible browser

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
1. Enable editing in your course
2. Add activity → GEAR
3. Configure name and settings
4. Upload 3D models (glTF/GLB)
5. Add interactive hotspots

### For Students
1. Open the GEAR activity
2. Interact with 3D model (rotate, zoom)
3. Click hotspots for information
4. Use AR/VR buttons on supported devices

## 🎨 Supported Formats

| Format | Extension | Description |
|--------|-----------|-------------|
| glTF | `.gltf` | Text-based, external textures |
| GLB | `.glb` | Binary, single file (recommended) |

## 🛠️ Development

```bash
# Clone repository
cd /path/to/moodle/mod
git clone https://github.com/blagojevicboban/moodle-mod_gear.git gear

# Run tests
vendor/bin/phpunit --testsuite mod_gear_testsuite

# Check code style
vendor/bin/phpcs --standard=moodle mod/gear

# Build AMD modules
npm install
npx grunt amd

# Watch for changes
npx grunt watch
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
