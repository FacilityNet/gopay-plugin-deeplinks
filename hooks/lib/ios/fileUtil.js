const path = require('path');
const cordova_ios = require('cordova-ios');

let projectFolder;
let entitlementsFilePath;
let projectInfoFilePath;

/**
 * Projects root folder path.
 *
 * @return {String} absolute path to the projects root
 */
function getProjectRoot(context) {
  return context.opts.projectRoot;
}

function iosPlatformPath(context) {
  return path.join(getProjectRoot(context), 'platforms', 'ios');
}

/**
 * Name of the project from config.xml
 *
 * @return {String} project name
 */
function getProjectFolder(context) {
  if (projectFolder === undefined) {
    const iosProjectFilePath = iosPlatformPath(context);
    const iosProject = new cordova_ios('ios', iosProjectFilePath);
    projectFolder = iosProject.locations.xcodeCordovaProj;
  }

  return projectFolder;
}

/**
 * Path to entitlements file.
 *
 * @return {String} absolute path to entitlements file
 */
function pathToEntitlementsFile(context) {
  if (entitlementsFilePath === undefined) {
    const projectFolder = getProjectFolder(context);
    const projectName = path.basename(projectFolder);
    entitlementsFilePath = path.join(projectFolder, 'Resources', projectName + '.entitlements');
  }

  return entitlementsFilePath;
}

/**
 * Path to Info.plist file.
 *
 * @return {String} absolute path to Info.plist file
 */
function pathToProjectInfoFile(context) {
    if (projectInfoFilePath === undefined) {
        const projectFolder = getProjectFolder(context);
        const projectName = path.basename(projectFolder);
        projectInfoFilePath = path.join(projectFolder, projectName + '-Info.plist');
    }

    return projectInfoFilePath;
}

/**
 * Path to the ios web hook directory.
 *
 * @return {String} path to web hook directory
 */
function pathToWebHookDirectory(context) {
  return path.join(getProjectRoot(context), 'ul_web_hooks', 'ios');
}

module.exports = {
  iosPlatformPath: iosPlatformPath,
  getProjectFolder: getProjectFolder,
  pathToEntitlementsFile: pathToEntitlementsFile,
  pathToProjectInfoFile: pathToProjectInfoFile,
  pathToWebHookDirectory: pathToWebHookDirectory,
};
