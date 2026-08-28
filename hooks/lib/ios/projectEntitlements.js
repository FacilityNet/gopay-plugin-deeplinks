/*
Script merges the com.apple.developer.associated-domains entitlement, built from
the hosts specified in config.xml, into the cordova-ios generated
Entitlements-Debug.plist and Entitlements-Release.plist files.

Those files already exist by the time this hook runs (cordova-ios generates
them and points CODE_SIGN_ENTITLEMENTS at them). We only set our one key and
leave everything else - e.g. keys other plugins added via a config-file
target pointed at the Entitlements plists - untouched.
*/

var fs = require('fs');
var path = require('path');
var plist = require('plist');
var fileUtil = require('./fileUtil.js');
var ASSOCIATED_DOMAINS = 'com.apple.developer.associated-domains';
var BUILD_CONFIGURATIONS = ['Debug', 'Release'];
var context;

module.exports = {
  generateAssociatedDomainsEntitlements: generateEntitlements
};

// region Public API

/**
 * Merge associated-domains entitlement into the existing per-configuration
 * entitlements plists.
 *
 * @param {Object} cordovaContext - cordova context object
 * @param {Object} pluginPreferences - plugin preferences from config.xml; already parsed
 */
function generateEntitlements(cordovaContext, pluginPreferences) {
  context = cordovaContext;

  var associatedDomains = generateAssociatedDomainsContent(pluginPreferences);

  BUILD_CONFIGURATIONS.forEach(function(buildConfiguration) {
    mergeAssociatedDomainsIntoPlist(buildConfiguration, associatedDomains);
  });
}

// endregion

// region Work with entitlements plist

/**
 * Read an existing Entitlements-<buildConfiguration>.plist, set the
 * associated-domains key on it and write it back. Skips the configuration if
 * the file doesn't exist rather than creating one.
 *
 * @param {String} buildConfiguration - 'Debug' or 'Release'
 * @param {Array} associatedDomains - list of 'applinks:<host>' entries
 */
function mergeAssociatedDomainsIntoPlist(buildConfiguration, associatedDomains) {
  var filePath = fileUtil.pathToBuildEntitlementsPlist(context, buildConfiguration);
  var content;

  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    console.warn('Entitlements-' + buildConfiguration + '.plist not found at ' + filePath + '; skipping associated domains injection.');
    return;
  }

  var entitlements = plist.parse(content);
  entitlements[ASSOCIATED_DOMAINS] = associatedDomains;

  fs.writeFileSync(filePath, plist.build(entitlements), 'utf8');
  console.log('Added associated domains to ' + path.basename(filePath));
}

/**
 * Generate content for associated-domains dictionary in the entitlements file.
 *
 * @param {Object} pluginPreferences - list of hosts from conig.xml
 * @return {Object} associated-domains dictionary content
 */
function generateAssociatedDomainsContent(pluginPreferences) {
  var domainsList = [];

  // generate list of host links
  pluginPreferences.hosts.forEach(function(host) {
    var link = domainsListEntryForHost(host);
    if (domainsList.indexOf(link) == -1) {
      domainsList.push(link);
    }
  });

  return domainsList;
}

/**
 * Generate domain record for the given host.
 *
 * @param {Object} host - host entry
 * @return {String} record
 */
function domainsListEntryForHost(host) {
  return 'applinks:' + host.name;
}

// endregion
