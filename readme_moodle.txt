Third-party JavaScript libraries in mod_gear
============================================

1. Three.js (v0.160.0, MIT license)
   - Source: https://github.com/mrdoob/three.js
   - Bundled into: amd/build/viewer.min.js (along with OrbitControls, TransformControls, and GLTFLoader)
   - Why bundled: Three.js r160+ distributes ES modules with bare 'three' imports that cannot be compiled directly by Moodle's standard AMD Grunt task without a module resolver.
   - How to update/rebuild:
     1. Update the "three" version in package.json and run `npm install`.
     2. Run `npx grunt amd` inside the plugin directory (uses @rollup/plugin-node-resolve + grunt-contrib-uglify).
     3. Update the version number in thirdpartylibs.xml.

2. PeerJS (v1.5.4, MIT license)
   - Source: https://github.com/peers/peerjs
   - Location: vendorjs/peerjs.min.js
   - How to update:
     1. Download the prebuilt `peerjs.min.js` from the official PeerJS release (or `node_modules/peerjs/dist/peerjs.min.js`), strip the trailing sourceMappingURL comment if needed, and place it in `vendorjs/peerjs.min.js`.
     2. Update the version number in thirdpartylibs.xml.

3. Draco decoder (MIT-compatible Apache-2.0 license)
   - Source: https://github.com/google/draco (the prebuilt decoder shipped with Three.js)
   - Location: vendorjs/draco/ (draco_decoder.js, draco_decoder.wasm, draco_wasm_wrapper.js)
   - How to update: copy the three files from node_modules/three/examples/jsm/libs/draco/gltf/ after updating Three.js, and keep the version in thirdpartylibs.xml.

4. meshoptimizer decoder (MIT license)
   - Bundled into amd/build/viewer.min.js from three/examples/jsm/libs/meshopt_decoder.module.js; it is updated together with Three.js.
