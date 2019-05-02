/**
 * Gruntfile.js
 *
 * Copyright (c) 2015 Accusoft Corporation. All rights reserved.
 */

/* global module */

module.exports = function(grunt) {
    grunt.initConfig({
        less: {
            style: {
                options: {
                    compress: false,
                    optimization: 2,
                    sourceMap: true,
                    sourceMapFilename: 'css/style.css.map',
                    sourceMapURL: 'style.css.map'
                },
                files: {
                    "css/style.css": "less/style.less"
                }
            },
            prod: {
                options: {
                    compress: false,
                    optimization: 2
                },
                files: {
                    "css/style.css": "less/style.less"
                }
            }
        },
        watch: {
            styles: {
                files: ['less/**/*.less'],
                tasks: ['builddev'],
                options: {
                  nospawn: true
                }
            }
        }
    });

    // Load tasks from plugins in NPM
    grunt.loadNpmTasks('grunt-contrib-less');
    grunt.loadNpmTasks('grunt-contrib-watch');

    // During development, add the watch task to build when a change occurs
    grunt.registerTask('dev', ['builddev', 'watch']);
    
    grunt.registerTask('buildprod', ['less:prod']);
    grunt.registerTask('builddev', ['less:style']);

    // By default, only run the build tasks
    grunt.registerTask('default', ['buildprod']);
};