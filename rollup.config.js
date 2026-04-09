/**
 * Rollup configuration for bundling Three.js ES modules into AMD format for Moodle.
 *
 * @package    mod_gear
 * @copyright  2026 Boban Blagojevic
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
    input: 'amd/src/viewer.js',
    output: {
        file: 'amd/build/viewer.min.js',
        format: 'amd',
        sourcemap: true,
        // Moodle expects module name to match js_call_amd() first parameter
        amd: {
            id: 'mod_gear/viewer'
        },
        // Ensure default export is directly returned (not wrapped in .default)
        exports: 'default',
        interop: 'compat'
    },
    external: [
        'jquery',
        'core/ajax',
        'core/notification',
        'core/str',
        'core/templates'
    ],
    plugins: [
        resolve({
            browser: true,
            preferBuiltins: false
        }),
        commonjs()
    ]
};
