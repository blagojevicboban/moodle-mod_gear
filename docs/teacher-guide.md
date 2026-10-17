# GEAR – teacher guide

GEAR is a Moodle activity: you upload a 3D model, place **hotspots** on it and students explore it, answer in-world quizzes
and (optionally) work together. Quiz points go to the Moodle gradebook.

## 1. Add the activity

1. In your course, turn editing on and choose **Add an activity or resource → GEAR**.
2. Give it a **name** and an optional description.
3. Under **3D models** upload a `.glb` file (recommended, one file) or a `.gltf` together with its `.bin` and texture images
   (up to 20 files). Other file types are not accepted.
   You can upload several models; they appear together in one scene and *Save Current View* remembers where you placed each of them. Draco and Meshopt compressed models are supported, which keeps big models small.
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

If the administrator has enabled it (**Site administration → Plugins → Activity modules → GEAR → Enable AI Assistant**) and configured an AI provider with text generation (**Site administration → General → AI**), the hotspot editor shows **AI Assist**. The first time you use it Moodle asks you to accept the AI usage policy.
Type a short topic and the plugin fills in the text or, for quizzes, the options and the correct answer. Review what it generates before saving.
Only the topic text you type is sent to the AI provider configured by your administrator.

### Completion

Under **Completion conditions** choose automatic completion and tick **The student has opened every hotspot** and/or **The student earns at least this many quiz points**. Teleport points and hotspots that are still locked do not count for the first rule.

## Large models

Keep models under about 500,000 triangles for phones. GEAR reads Draco and Meshopt compressed geometry and KTX2 compressed textures (for example made with `gltf-transform` or `gltfpack`), which makes the files much smaller. When a model has more than a million triangles you see a warning in the viewer and the scene is drawn at a lower resolution.

## Quiz types

A *Quiz* hotspot has a **Question type**: *One correct answer* (the number of the right option, counting from 0), *Several correct answers* (the numbers separated by commas, for example `0, 2`; the student must tick exactly those) or *Typed answer* (one accepted answer per line, `*` matches any characters, and you can make letter case matter).

## Quiz questions from the question bank

When you add or edit a *Quiz* hotspot, press **Import from question bank**, pick a multiple choice, true/false or short answer question of the course and save. The title, the text, the answers and the correct answer are copied into the hotspot (images are not). Changing the question in the bank later does not change the hotspot.

## Student progress

Open **Analytics Reports** in the activity. Below the totals, *Student progress* lists every student (choose a group if the activity uses groups): hotspots opened out of the ones available to that student, quizzes solved, points, grade and the last activity. Click a name to see each hotspot (views, quiz attempts, best score, still locked), or download the table with *Download table data as*.

## Reports per student (Report Builder)

*Site administration > Reports > Report builder > Custom reports > New report*, source **GEAR activity tracking**. The report lists every tracked action (hotspot views, quiz answers, AR/VR sessions) with the user, course, activity, time and duration. Use *Aggregation* on the action column (count) and group by user to get totals per student, and the filters to limit the report to one course or activity.

## Animations, variants and tour

- If the model has animations, a panel appears at the bottom left of the viewer: choose a clip, play/pause it and change the speed. Models with material variants also get a *Material variant* selector. Pick what students should see first and press **Save as default**.
- **Guided tour:** press *Guided tour*, move the camera to the first view and press *Add step from the current view*, then write a title and a text. In the same dialog you can choose a hotspot to open, an animation to play and a material variant to show at that step. Repeat for every step; use the arrows to reorder, the pencil to edit the text and the bin to delete. Students see the same panel with *Previous* and *Next*.

## 3. Results

- **Gradebook:** each quiz hotspot counts once, with the best score of the student; the total is scaled to the activity grade.
- **Leaderboard:** the trophy button shows the top scores. With **separate groups** a student sees only members of their own groups; teachers with *access all groups* see everyone.
- **Analytics:** the *Analytics Reports* button (teachers only) shows how many times each hotspot was opened.

## 4. Collaborative mode

Students who open the same activity see each other as 3D avatars and can use text chat and microphone voice chat.
An administrator has to enable it first (**Site administration → Plugins → Activity modules → GEAR → Enable collaborative mode**; off by default on new sites). The browsers connect directly to each other (WebRTC) through a PeerJS broker (the public PeerJS cloud, or your own server set under *PeerJS server URL*); no audio or chat is stored in Moodle. Only people who are in the activity's session list can call or chat with each other, and guests cannot join.

## 5. Accessibility

- **Scene description:** fill in *Scene description* in the activity settings (for example "Cross section of a four-stroke engine; the hotspots label the valves and the crankshaft"). Screen reader users hear it when they reach the 3D viewer; if you leave it empty the activity name and the number of hotspots are used. A hidden list of all hotspots lets them open each one without the mouse.

- Focus the viewer with **Tab**, move between hotspots with the **arrow keys**, open one with **Enter** or **Space**, close it with **Escape**.
- The focused hotspot is announced to screen readers.
- Dialogs trap the keyboard and return focus to the button that opened them.
- Animations are reduced for users who ask for it in their system settings.

## 6. Good to know

- **Browsers:** WebGL is required. VR/AR needs a WebXR-capable browser and device. On iPhone and iPad the 3D viewer works but WebXR AR does not; to offer AR there, upload a `.usdz` file with the same name next to the model (`engine.glb` + `engine.usdz`) and the **View in AR** button opens it in Apple's AR Quick Look.
- **Backup and restore:** models, hotspots and branching rules are included; learner data only when "include user data" is selected.
- **Large models:** keep the file small (a few MB). Compress textures and reduce polygons before uploading.
