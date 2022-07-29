var path = require('path');
var fs = require('fs');
var mkpath = require('mkpath');
var plist = require('plist');
var ConfigXmlHelper = require('../configXmlHelper.js');

var CF_BUNDLE_URL_TYPES = "CFBundleURLTypes";
var CF_BUNDLE_URL_NAME = "CFBundleURLName";
var CF_BUNDLE_TYPE_ROLE = "CFBundleTypeRole";
var CF_BUNDLE_TYPE_ROLE_EDITOR = "Editor";
var CF_BUNDLE_URL_SCHEMES = "CFBundleURLSchemes";

var context;
var configHelper;
var projectInfoFilePath;

module.exports = {
    generateCustomUrlSchemes: generateUrlSchemes
}

function generateUrlSchemes(cordovaContext, pluginPreferences) {
    context = cordovaContext;

    var currentProjectInfo = getProjectInfoFileContent();
    var cleanedProjectInfo = removeOldCustomSchemes(currentProjectInfo);
    var newProjectInfo = injectPreferences(cleanedProjectInfo, pluginPreferences);

    saveContentToProjectInfoFile(newProjectInfo);
}

function saveContentToProjectInfoFile(content) {
    var plistContent = plist.build(content);
    var filePath = pathToProjectInfoFile();

    mkpath.sync(path.dirname(filePath));
    fs.writeFileSync(filePath, plistContent, "utf8");
}

function getProjectInfoFileContent() {
    var filePath = pathToProjectInfoFile();
    var content;

    try {
        content = fs.readFileSync(filePath, "utf8");
    } catch (err) {
        return {};
    }

    return plist.parse(content);
}

function removeOldCustomSchemes(currentProjectInfo) {
    console.log("Removing old custom schemes from project info plist file")

    var cleanedProjectInfo = currentProjectInfo;
    var urlTypes = getUrlTypes(currentProjectInfo);
    var cleanedUrlTypes = urlTypes.filter(function(entry) {
        // Remove any entry with the schemes property
        return !entry.hasOwnProperty(CF_BUNDLE_URL_SCHEMES);
    });

    cleanedProjectInfo[CF_BUNDLE_URL_TYPES] = cleanedUrlTypes;
    return cleanedProjectInfo;
}

function injectPreferences(currentProjectInfo, pluginPreferences) {
    var newProjectInfo = currentProjectInfo;
    var urlTypes = getUrlTypes(newProjectInfo);

    var content = generateUrlSchemesDictionary(pluginPreferences);

    urlTypes.push(content);
    newProjectInfo[CF_BUNDLE_URL_TYPES] = urlTypes;
    return newProjectInfo;
}

function getUrlTypes(projectInfo) {
    var urlTypes = projectInfo[CF_BUNDLE_URL_TYPES];

    if (!urlTypes) {
        console.log(`${CF_BUNDLE_URL_TYPES} entry not found [adding it]`)
        urlTypes = [];
    }

    return urlTypes;
}

function generateUrlSchemesDictionary(pluginPreferences) {
    var content = generateUrlSchemesArray(pluginPreferences);

    return ({
        [CF_BUNDLE_URL_NAME]: getPackageName(),
        [CF_BUNDLE_TYPE_ROLE]: CF_BUNDLE_TYPE_ROLE_EDITOR,
        [CF_BUNDLE_URL_SCHEMES]: content,
    })
}

function generateUrlSchemesArray(pluginPreferences) {
    var schemesList = [];

    pluginPreferences.schemes.forEach(function(scheme) {
        var entry = entryForCustomScheme(scheme);
        schemesList.push(entry);
    });

    return schemesList;
}

function entryForCustomScheme(scheme) {
    console.log(`Adding custom scheme to project info plist file: ${scheme.name}`)
    return scheme.name;
}

// region Path helper methods

/**
 * Path to entitlements file.
 *
 * @return {String} absolute path to entitlements file
 */
function pathToProjectInfoFile() {
    if (projectInfoFilePath === undefined) {
        projectInfoFilePath = path.join(getProjectRoot(), 'platforms', 'ios', getProjectName(), getProjectName() + '-Info.plist');
    }

    return projectInfoFilePath;
}

/**
 * Projects root folder path.
 *
 * @return {String} absolute path to the projects root
 */
function getProjectRoot() {
    return context.opts.projectRoot;
}

/**
 * Name of the project from config.xml
 *
 * @return {String} project name
 */
function getProjectName() {
    if (configHelper === undefined) {
        configHelper = new ConfigXmlHelper(context);
    }

    return configHelper.getProjectName();
}

function getPackageName() {
    if (configHelper === undefined) {
        configHelper = new ConfigXmlHelper(context);
    }

    return configHelper.getPackageName();
}

// endregion
