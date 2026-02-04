# GEAR - Immersive AR/VR Learning for Moodle

[![Moodle Plugin](https://img.shields.io/badge/Moodle-4.4+-orange.svg)](https://moodle.org)
[![License](https://img.shields.io/badge/License-GPL%20v3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![PHP](https://img.shields.io/badge/PHP-8.1+-purple.svg)](https://php.net)

**GEAR** (Geospatial Educational Augmented Reality) is a Moodle activity module that enables immersive AR/VR learning experiences with 3D models, hotspots, and WebXR support.

## ✨ Features

- 🎮 **3D Model Viewer** - Upload and display glTF/GLB models with orbit controls
- 📱 **AR Mode** - View 3D content in augmented reality on mobile devices
- 🥽 **VR Mode** - Immersive VR experience with headset support
- 📍 **Interactive Hotspots** - Add clickable information points to 3D scenes
- 📊 **Progress Tracking** - Built-in completion and activity tracking
- 🌐 **WebXR Support** - No app installation required, works in browser

## 📋 Requirements

- Moodle 4.4 or higher
- PHP 8.1 or higher
- Modern browser with WebGL support
- For AR: Chrome on Android or Safari on iOS
- For VR: WebXR-compatible browser and headset

## 🚀 Installation

### Method 1: Direct Installation
1. Download the plugin
2. Extract to `/mod/gear/` in your Moodle installation
3. Visit Site Administration → Notifications
4. Follow the installation prompts

### Method 2: Git Clone
```bash
cd /path/to/moodle/mod
git clone https://github.com/yourusername/moodle-mod_gear.git gear
```

### Method 3: CLI Installation
```bash
php admin/cli/upgrade.php
```

## 📖 Usage

### For Teachers
1. Turn editing on in your course
2. Click "Add an activity or resource"
3. Select "GEAR" from the activity list
4. Configure name, description, and AR/VR options
5. Upload 3D models (glTF/GLB format)
6. Add hotspots with information or quizzes
7. Save and display to students

### For Students
1. Open the GEAR activity in your course
2. View the 3D model using mouse/touch controls
3. Click hotspots to view information
4. Use AR button on mobile to view in your space
5. Use VR button with a headset for immersive experience

## 🎨 Supported Formats

| Format | Extension | Best For |
|--------|-----------|----------|
| glTF | .gltf | Text-based, external textures |
| GLB | .glb | Binary, single file |

## 🛠️ Development

### Building AMD Modules
```bash
cd /path/to/moodle
npx grunt amd
```

### Running Tests
```bash
vendor/bin/phpunit --testsuite mod_gear_testsuite
vendor/bin/behat --config mod/gear/tests/behat/behat.yml
```

### Code Style
```bash
vendor/bin/phpcs --standard=moodle mod/gear
```

## 📁 File Structure

```
mod/gear/
├── version.php          # Plugin metadata
├── lib.php              # Moodle API functions
├── mod_form.php         # Activity creation form
├── view.php             # Activity view page
├── index.php            # Course instance list
├── styles.css           # Plugin styles
├── db/
│   ├── install.xml      # Database schema
│   └── access.php       # Capabilities
├── lang/
│   ├── en/gear.php      # English strings
│   └── sr/gear.php      # Serbian strings
├── templates/
│   └── view.mustache    # View template
├── amd/src/
│   └── viewer.js        # 3D/AR/VR viewer
├── classes/
│   └── event/           # Moodle events
└── pix/
    ├── icon.svg         # Activity icon
    └── monologo.svg     # Monochrome icon
```

## 🔧 Configuration

### Admin Settings
- **AR Enable Default**: Enable AR mode by default for new activities
- **VR Enable Default**: Enable VR mode by default for new activities
- **Max File Size**: Maximum upload size for 3D models
- **Default Lighting**: Default lighting preset (Studio/Outdoor/Dark)

## 🌍 Languages

- 🇬🇧 English
- 🇷🇸 Serbian (Srpski)

## 📄 License

This plugin is licensed under the [GNU GPL v3](https://www.gnu.org/licenses/gpl-3.0.html).

## 👤 Author

**Boban Blagojevic**

## 🙏 Acknowledgments

- [A-Frame](https://aframe.io/) - WebXR framework
- [Three.js](https://threejs.org/) - 3D library
- [AR.js](https://ar-js-org.github.io/AR.js-Docs/) - AR tracking

---

Made with ❤️ for immersive education
