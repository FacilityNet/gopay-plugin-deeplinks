//
//  CULPlugin.m
//
//  Created by Nikolay Demyankov on 14.09.15.
//

#import "CULPlugin.h"
#import "CULConfigXmlParser.h"
#import "CULConfig.h"
#import "CULPath.h"
#import "CULHost.h"
#import "CULScheme.h"
#import "CDVPluginResult+CULPlugin.h"
#import "CDVInvokedUrlCommand+CULPlugin.h"
#import "CULConfigJsonParser.h"

@interface CULPlugin() {
    CULConfig *_config;
    CDVPluginResult *_storedEvent;
    NSMutableDictionary<NSString *, NSString *> *_subscribers;
}

@end

@implementation CULPlugin

#pragma mark Public API

- (void)pluginInitialize {
    [self localInit];
    // Can be used for testing.
    // Just uncomment, close the app and reopen it. That will simulate application launch from the link.
//    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(onResume:) name:UIApplicationWillEnterForegroundNotification object:nil];
}

//- (void)onResume:(NSNotification *)notification {
//    NSUserActivity *activity = [[NSUserActivity alloc] initWithActivityType:NSUserActivityTypeBrowsingWeb];
//    [activity setWebpageURL:[NSURL URLWithString:@"http://site2.com/news/page?q=1&v=2#myhash"]];
//    
//    [self handleUserActivity:activity];
//}

- (void)handleOpenURL:(NSNotification*)notification {
    id url = notification.object;
    if (![url isKindOfClass:[NSURL class]]) {
        return;
    }
    
    CULHost *host = [self findHostByURL:url];
    if (host) {
        [self storeEventWithHost:host originalURL:url];
        return;
    }

    CULScheme *scheme = [self findSchemeByURL:url];
    if (scheme) {
        [self storeEventWithScheme:scheme originalURL:url];
        return;
    }
}

- (BOOL)handleUserActivity:(NSUserActivity *)userActivity {
    [self localInit];
    
    NSURL *launchURL = userActivity.webpageURL;

    CULHost *host = [self findHostByURL:launchURL];
    if (host != nil) {
        [self storeEventWithHost:host originalURL:launchURL];
        return YES;
    }

    CULScheme *scheme = [self findSchemeByURL:launchURL];
    if (scheme != nil) {
        [self storeEventWithScheme:scheme originalURL:launchURL];
        return YES;
    }

    return NO;
}

- (void)onAppTerminate {
    _config = nil;
    _subscribers = nil;
    _storedEvent = nil;
    
    [super onAppTerminate];
}

#pragma mark Private API

- (void)localInit {
    if (_config) {
        return;
    }
    
    _subscribers = [[NSMutableDictionary alloc] init];
    
    // Get preferences from the config.xml or www/ul.json.
    // For now priority goes to json config.
    _config = [self getPreferences];
}

- (CULConfig *)getPreferences {
    NSString *jsonConfigPath = [[NSBundle mainBundle] pathForResource:@"ul" ofType:@"json" inDirectory:@"www"];
    if (jsonConfigPath) {
        return [CULConfigJsonParser parseConfig:jsonConfigPath];
    }
    
    return [CULConfigXmlParser parse];
}

- (void)storeEventWithScheme:(CULScheme *)scheme originalURL:(NSURL *)originalUrl {
    _storedEvent = [CDVPluginResult resultWithScheme:scheme originalURL:originalUrl];
    [self tryToConsumeEvent];
}

/**
 *  Store event data for future use.
 *  If we are resuming the app - try to consume it.
 *
 *  @param host        host that matches the launch url
 *  @param originalUrl launch url
 */
- (void)storeEventWithHost:(CULHost *)host originalURL:(NSURL *)originalUrl {
    _storedEvent = [CDVPluginResult resultWithHost:host originalURL:originalUrl];
    [self tryToConsumeEvent];
}

- (CULScheme *)findSchemeByURL:(NSURL *)launchURL {
    NSURLComponents *urlComponents = [NSURLComponents componentsWithURL:launchURL resolvingAgainstBaseURL:YES];
    CULScheme *scheme = nil;
    for (CULScheme *supportedScheme in _config.supportedSchemes) {
        if ([supportedScheme.name caseInsensitiveCompare:urlComponents.scheme] == NSOrderedSame) {
            scheme = supportedScheme;
            break;
        }
    }

    return scheme;
}

/**
 *  Find host entry that corresponds to launch url.
 *
 *  @param  launchURL url that launched the app
 *  @return host entry; <code>nil</code> if none is found
 */
- (CULHost *)findHostByURL:(NSURL *)launchURL {
    NSURLComponents *urlComponents = [NSURLComponents componentsWithURL:launchURL resolvingAgainstBaseURL:YES];
    CULHost *host = nil;
    for (CULHost *supportedHost in _config.supportedHosts) {
        NSPredicate *pred = [NSPredicate predicateWithFormat:@"self LIKE[c] %@", supportedHost.name];
        if ([pred evaluateWithObject:urlComponents.host]) {
            host = supportedHost;
            break;
        }
    }
    
    return host;
}

#pragma mark Methods to send data to JavaScript

/**
 *  Try to send event to the web page.
 *  If there is a subscriber for the event - it will be consumed. 
 *  If not - it will stay until someone subscribes to it.
 */
- (void)tryToConsumeEvent {
    if (_subscribers.count == 0 || _storedEvent == nil) {
        return;
    }
    
    NSString *storedEventName = [_storedEvent eventName];
    for (NSString *eventName in _subscribers) {
        if ([storedEventName isEqualToString:eventName]) {
            NSString *callbackID = _subscribers[eventName];
            [self.commandDelegate sendPluginResult:_storedEvent callbackId:callbackID];
            _storedEvent = nil;
            break;
        }
    }
}

#pragma mark Methods, available from JavaScript side

- (void)jsSubscribeForEvent:(CDVInvokedUrlCommand *)command {
    NSString *eventName = [command eventName];
    if (eventName.length == 0) {
        return;
    }
    
    _subscribers[eventName] = command.callbackId;
    [self tryToConsumeEvent];
}

- (void)jsUnsubscribeFromEvent:(CDVInvokedUrlCommand *)command {
    NSString *eventName = [command eventName];
    if (eventName.length == 0) {
        return;
    }
    
    [_subscribers removeObjectForKey:eventName];
}



@end
