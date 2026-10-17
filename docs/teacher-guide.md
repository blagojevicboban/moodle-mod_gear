# GEAR – teacher guide

GEAR is a Moodle activity: you upload a 3D model, place **hotspots** on it and students explore it, answer in-world quizzes
and (optionally) work together. Quiz points go to the Moodle gradebook.

## 1. Add the activity

1. In your course, turn editing on and choose **Add an activity or resource → GEAR**.
2. Give it a **name** and an optional description.
3. Under **3D models** upload a `.glb` file (recommended, one file) or a `.gltf` together with its `.bin` and texture images
   (up to 20 files). Other file types are not accepted.
4. Under **Scene settings** choose the background colour, lighting (studio, outdoor, dark), the default hotspot diameter and whether
   hotspots are shown and can be edited.
5. Under **Grade** set the maximum grade. The points of all quiz hotspots together equal the full grade.
6. Save and display.

## 2. Place hotspots

Open the activity and use the controls on the scene.

| Action | How |
|--------|-----|
| Rotate | Left mouse button + drag (touch: one finger) |
| Pan | Right mouse button + drag or Shift + drag (touch: two fingers) |
| Zoom | Mouse wheel (touch: pinch) |
| **Add a hotspot** | **Shift + click** on the model |
| Move a hotspot | Open it and choose **Move**, then use the gizmo arrows or click a new place on the model |
| Edit or delete | Open the hotspot and use the buttons in its popup |
| Set the starting view | Position the camera and choose **Save Current View (Set as default)** |

### Hotspot types

- **Information** – formatted text. Students can have it read aloud (text-to-speech).
- **Quiz** – a question with options and one correct answer (index 0, 1, 2 …) and a number of points. The correct answer is checked on the server and is never sent to students' browsers.
- **Audio** – positional sound from an MP3 or WAV URL; it gets louder when the student comes closer.
- **Video** – an MP4, YouTube or Vimeo link shown in the hotspot.
- **Teleport** – flies the camera to a new place in the scene.

### Escape-room style unlocking

On any hotspot set **Requires Quiz (Unlock)** to another quiz hotspot. The hotspot stays hidden until the student answers that quiz correctly.

### AI Assistant (optional)

If the administrator has enabled it (**Site administration → Plugins → Activity modules → GEAR**), the hotspot editor shows **AI Assist**:
type a short topic and the plugin fills in the text or, for quizzes, the options and the correct answer. Review what it generates before saving.
Only the topic text you type is sent to the configured AI service.

## 3. Results

- **Gradebook:** each quiz hotspot counts once, with the best score of the student; the total is scaled to the activity grade.
- **Leaderboard:** the trophy button shows the top scores.
- **Analytics:** the *Analytics Reports* button (teachers only) shows how many times each hotspot was opened.

## 4. Collaborative mode

Students who open the same activity see each other as 3D avatars and can use text chat and microphone voice chat.
An administrator has to enable it first (**Site administration → Plugins → Activity modules → GEAR → Enable collaborative mode**; off by default on new sites). The browsers connect directly to each other (WebRTC) through a PeerJS broker (the public PeerJS cloud, or your own server set under *PeerJS server URL*); no audio or chat is stored in Moodle. Only people who are in the activity's session list can call or chat with each other, and guests cannot join.

## 5. Accessibility

- Focus the viewer with **Tab**, move between hotspots with the **arrow keys**, open one with **Enter** or **Space**, close it with **Escape**.
- The focused hotspot is announced to screen readers.
- Dialogs trap the keyboard and return focus to the button that opened them.
- Animations are reduced for users who ask for it in their system settings.

## 6. Good to know

- **Browsers:** WebGL is required. VR/AR needs a WebXR-capable browser and device. On iPhone and iPad the 3D viewer works but WebXR AR does not.
- **Backup and restore:** models, hotspots and branching rules are included; learner data only when "include user data" is selected.
- **Large models:** keep the file small (a few MB). Compress textures and reduce polygons before uploading.
