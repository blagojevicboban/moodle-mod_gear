"use strict";

module.exports = function (grunt) {
    var path = require('path');

    // Load standard plugins.
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-eslint');
    grunt.loadNpmTasks('grunt-stylelint');

    // Configure tasks.
    grunt.initConfig({
        uglify: {
            dist: {
                files: {
                    'amd/build/viewer.min.js': ['amd/src/viewer.js']
                },
                options: {
                    sourceMap: true
                }
            }
        },
        watch: {
            js: {
                files: ['amd/src/*.js'],
                tasks: ['uglify']
            }
        }
    });

    // Register tasks.
    grunt.registerTask('amd', ['uglify']);
    grunt.registerTask('default', ['amd']);
};
