/*
Script activates support for Universal Links in the application by setting proper preferences in the xcode project file.
Which is:
- deployment target set to iOS 9.0

Note: this used to also point CODE_SIGN_ENTITLEMENTS at a plugin-generated
.entitlements file and register it as a project resource. That overrode the
cordova-ios generated Entitlements-Debug.plist/Entitlements-Release.plist
(breaking any other plugin, e.g. push notification plugins, that contributes
keys to those files) and tripped Xcode's Copy Bundle Resources validation.
The associated-domains entitlement is now merged into the existing
Entitlements-*.plist files instead - see projectEntitlements.js.
*/

var path = require('path');
var compare = require('node-version-compare');
var ConfigXmlHelper = require('../configXmlHelper.js');
var fileUtil = require('./fileUtil.js');

var IOS_DEPLOYMENT_TARGET = '8.0';
var COMMENT_KEY = /_comment$/;
var context;

module.exports = {
  enableAssociativeDomainsCapability: enableAssociativeDomainsCapability
}

// region Public API

/**
 * Activate associated domains capability for the application.
 *
 * @param {Object} cordovaContext - cordova context object
 */
function enableAssociativeDomainsCapability(cordovaContext) {
  context = cordovaContext;

  var projectFile = loadProjectFile();

  // adjust preferences
  activateAssociativeDomains(projectFile.xcode);

  // save changes
  projectFile.write();
}

// endregion

// region Alter project file preferences

/**
 * Activate associated domains support in the xcode project file by making
 * sure the deployment target is at least iOS 9.
 *
 * @param {Object} xcodeProject - xcode project preferences; all changes are made in that instance
 */
function activateAssociativeDomains(xcodeProject) {
  var configurations = nonComments(xcodeProject.pbxXCBuildConfigurationSection());
  var config;
  var buildSettings;
  var deploymentTargetIsUpdated;

  for (config in configurations) {
    buildSettings = configurations[config].buildSettings;

    // if deployment target is less then the required one - increase it
    if (buildSettings['IPHONEOS_DEPLOYMENT_TARGET']) {
      if (compare(buildSettings['IPHONEOS_DEPLOYMENT_TARGET'], IOS_DEPLOYMENT_TARGET) == -1) {
        buildSettings['IPHONEOS_DEPLOYMENT_TARGET'] = IOS_DEPLOYMENT_TARGET;
        deploymentTargetIsUpdated = true;
      }
    } else {
      buildSettings['IPHONEOS_DEPLOYMENT_TARGET'] = IOS_DEPLOYMENT_TARGET;
      deploymentTargetIsUpdated = true;
    }
  }

  if (deploymentTargetIsUpdated) {
    console.log('IOS project now has deployment target set as: ' + IOS_DEPLOYMENT_TARGET);
  }
}

// endregion

// region Xcode project file helpers

/**
 * Load iOS project file from platform specific folder.
 *
 * @return {Object} projectFile - project file information
 */
function loadProjectFile() {
  var platform_ios;
  var projectFile;
  
  try {
      // try pre-5.0 cordova structure
      platform_ios = context.requireCordovaModule('cordova-lib/src/plugman/platforms')['ios'];
      projectFile = platform_ios.parseProjectFile(fileUtil.iosPlatformPath(context));
  } catch (e) {
      try {
          // let's try cordova 5.0 structure
          platform_ios = context.requireCordovaModule('cordova-lib/src/plugman/platforms/ios');
          projectFile = platform_ios.parseProjectFile(fileUtil.iosPlatformPath(context));
      } catch (e) {
          // Then cordova 7.0
          var project_files = require('glob').sync(path.join(fileUtil.iosPlatformPath(context), '*.xcodeproj', 'project.pbxproj'));
          
          if (project_files.length === 0) {
              throw new Error('does not appear to be an xcode project (no xcode project file)');
          }
          
          var pbxPath = project_files[0];
          
          var xcodeproj = require('xcode').project(pbxPath);
          xcodeproj.parseSync();
          
          projectFile = {
              'xcode': xcodeproj,
              write: function () {
                  var fs = require('fs');
                  
              var frameworks_file = path.join(fileUtil.iosPlatformPath(context), 'frameworks.json');
              var frameworks = {};
              try {
                  frameworks = context.requireCordovaModule(frameworks_file);
              } catch (e) { }
              
              fs.writeFileSync(pbxPath, xcodeproj.writeSync());
                  if (Object.keys(frameworks).length === 0){
                      // If there is no framework references remain in the project, just remove this file
                      require('shelljs').rm('-rf', frameworks_file);
                      return;
                  }
                  fs.writeFileSync(frameworks_file, JSON.stringify(this.frameworks, null, 4));
              }
          };
      }
  }
  
  return projectFile;
  } 

/**
 * Remove comments from the file.
 *
 * @param {Object} obj - file object
 * @return {Object} file object without comments
 */
function nonComments(obj) {
  var keys = Object.keys(obj);
  var newObj = {};

  for (var i = 0, len = keys.length; i < len; i++) {
    if (!COMMENT_KEY.test(keys[i])) {
      newObj[keys[i]] = obj[keys[i]];
    }
  }

  return newObj;
}

// endregion
