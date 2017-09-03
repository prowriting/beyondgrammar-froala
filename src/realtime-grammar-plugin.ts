require('style!css!./styles/froala-plugin-styles.css');

(($)=>{
    
    let settings = {
        service : {
            i18n : { en : "./libs/i18n-en.js" },
            sourcePath : "//prowriting.azureedge.net/realtimegrammar/1.0.121/dist/bundle.js",
            userId : null,
            apiKey : null,
            serviceUrl: "//rtg.prowritingaid.com"
        },
        grammar : {
            languageFilter: null,
            languageIsoCode: null,
            checkStyle: true,
            checkSpelling: true,
            checkGrammar: true,
            checkerIsEnabled: true
        },
        hideDisable: false
    };

    let getOptionsHtml = ()=>{
        if (!checker || checker.length==0) {
            console.log('No checker available');
            return '<ul class="fr-dropdown-list" role="presentation"></ul>';
        }

        var html = '<ul class="fr-dropdown-list" role="presentation">';
        var languages = checker[0]
            .getAvailableLanguages();
        if (languages) {
            languages
                .forEach((lang)=> {
                var bullet = lang.isoCode == language ? ' •' : '';
                html += '<li role="presentation"><a class="fr-command" tabindex="-1" role="option" data-cmd="rtg-switcher" data-param1="' + lang.isoCode + '" title="' + lang.displayName + '" aria-selected="false">' + lang.displayName + bullet + '</a></li>';
            });
        }else{
            console.log('No languages available');
        }

        if (!settings.hideDisable) {
            // add a disable checking option
            var offBullet = "off" == language ? ' •' : '';
            html += '<li role="presentation"><a class="fr-command" tabindex="-1" role="option" data-cmd="rtg-switcher" data-param1="off" title="No Checking" aria-selected="false">No Checking' + offBullet + '</a></li>';
        }
        html+='</ul>'
        return html;

    };

    window.addEventListener(
        "pwa-language-change",
        (event) => {
            checker.forEach((c)=>{
                var settings = c.getSettings();
                // clone the settings
                settings = JSON.parse(JSON.stringify(settings));
                //console.log('Changing language from: '+settings.languageIsoCode+" to "+(<any>event).detail.language);
                settings.languageIsoCode=(<any>event).detail.language;
                c.setSettings(settings);
            });
            },
        false);

    // get the default language from the browser
    // or from a cookie
    let browserLanguage = (<any>window.navigator).userLanguage || window.navigator.language;
    let language = browserLanguage=="en-GB"?'en-GB':'en-US';
    let checker = [];

    $.FroalaEditor.DefineIconTemplate('rtg', '<i class="rtg-toolbar-icon"></i>');
    $.FroalaEditor.DefineIcon('rtg-icon', { NAME: 'icon', template : "rtg"});
    $.FroalaEditor.RegisterCommand('rtg-switcher', {
        title: 'Real-time Grammar Checking',
        type: 'dropdown',
        icon: 'rtg-icon',
        focus: false,
        undo: false,
        refreshAfterCallback: true,
        html: ()=>{
            return getOptionsHtml();
        },
        callback: function (cmd, val) {

        },
        // Callback on refresh.
        refresh: function ($btn) {
            //console.log ('do refresh');
        },
        // Callback on dropdown show.
        refreshOnShow: function ($btn, $dropdown) {
            //console.log ('do refresh when show');
            var editorInstance = this,
                list = $dropdown.find('ul.fr-dropdown-list');

            $(list).html(getOptionsHtml());

            // if the menu is wider than the editor then
            // we want to make it right aligned
            var rightSideOfMenu = $btn.offset().left - $btn.parent().offset().left + $dropdown.width();
            var parentWidth = $btn.parent().width();
            if (rightSideOfMenu>parentWidth) {
                var left = $btn.offset().left - $btn.parent().offset().left - ($dropdown.width() - $btn.outerWidth());
                $dropdown.hide();
                setTimeout(()=> {
                    $dropdown.css('left', left + 'px');
                    $dropdown.show();
                }, 1);
            }
        }
    });
	
    $.FroalaEditor.PLUGINS.RealtimeGrammarPlugin = function (editor){
        let states = [ "loading", "connected", "disconnected", "off" ];        
        let labelsByState = {
            "loading" : "Real-time Grammar is loading",
            "connected" : "Real-time Grammar is online (click to change language)",
            "disconnected" : "Real-time Grammar is offline (click to start)",
            "off" : "Real-time Grammar is stopped (click to change language)"
        };
        
        let plugin = {
            state : "",
            checker : null,
            
            _init : ()=>{
                
                if (editor.opts && editor.opts.rtgOptions){
                    let opts = editor.opts.rtgOptions;
                    let grammar = opts.grammar || {};
                    let service = opts.service || {};
                    
                    //Grammar options applying
                    if (!grammar.languageIsoCode){
                        grammar.languageIsoCode = language;
                    }

                    settings.grammar = grammar;

                    //Service options applying
                    settings.service.sourcePath = service.sourcePath || settings.service.sourcePath;
                    settings.service.serviceUrl = service.serviceUrl || settings.service.serviceUrl;
                    settings.service.userId = service.userId;
                    settings.service.apiKey = service.apiKey;
                    
                    //Froala specific options
                    settings.hideDisable = (typeof opts.disableHidden == "undefined") ? false : opts.disableHidden;
                }

                editor.events.on('html.get', (html) => {
                    // clean the html and return the cleaned html
                    let $html = $('<div>'+html+'</div>');
                    $html.find('.pwa-mark,.pwa-mark-done').contents().unwrap();
                    return $html.html();
                });

                editor.events.on('commands.after', (command) => {
                    if (command == 'html'){
                        // force a check in case they've just returned from code view
                        plugin.checker.checkAll();
                    }
                });

                plugin.setState("loading");
                if (window["Pwa"] && window["Pwa"].GrammarChecker){
                    plugin.activate();
                    plugin.setState("connected");
                }
                else if (window["Pwa-plugins"]){
                    // the script is still loading
                    window["Pwa-plugins"].push(plugin);
                    plugin.setState("connected");
                }
                else {
                    window["Pwa-plugins"] = [];
                    window["Pwa-plugins"].push(plugin);

                    plugin.loadScript(settings.service.sourcePath, ()=> {
                        window["Pwa-plugins"].forEach((p)=>{
                            p.activate();
                            p.setState("connected");
                        });
                        window["Pwa-plugins"]=null;
                    });
                }
            },
            
            onRefreshButton : ($btn)=>{
                $btn.find(".rtg-toolbar-icon").removeClass(states.join(" ")).addClass(plugin.state);
                $btn.data("title", labelsByState[plugin.state]);
            },
            
            onToolbarButtonClick : ()=>{
                if( plugin.state == "loading" ) {
                    return;
                }

                if( plugin.state != "off" ) {
                    plugin.deactivate();
                } else {
                    plugin.activate();
                }
            },

            onLanguageOptionClick : (cmd, val)=>{
                if( plugin.state == "loading" ) {
                    return;
                }

                if( val == "off" ) {
                    var settings = plugin.checker.getSettings();
                    // clone the settings
                    settings = JSON.parse(JSON.stringify(settings));
                    settings.checkerIsEnabled=false;
                    plugin.checker.setSettings(settings);
                } else {
                    if( plugin.state == "off" ) {
                        plugin.activate();
                    }
                    var settings = plugin.checker.getSettings();
                    // clone the settings
                    settings = JSON.parse(JSON.stringify(settings));
                    settings.languageIsoCode=val;
                    settings.checkerIsEnabled=true;
                    plugin.checker.setSettings(settings);
                }
                language = val;

                // Create the event.
                var event = document.createEvent('CustomEvent');

				// Define that the event name is 'build'.
                console.log('Init language change event');
                event.initCustomEvent('pwa-language-change', true, true, {
                    language: val
                });

				// target can be any Element or other EventTarget.
                window.dispatchEvent(event);
            },


            activate : ()=>{
                plugin.setState("loading");

                plugin.checker = new window["Pwa"].GrammarChecker(editor.$el[0], settings.service);

                plugin.checker.setSettings(settings.grammar);
                checker.push(plugin.checker);
                
                plugin.checker.onConnectionChange = (status)=>{
                    plugin.setState(status);
                };
                
                plugin.checker.init().then(()=>plugin.checker.activate());
            },
            
            deactivate : ()=>{
                console.log('Deactivating grammar checker');
                var indexOf = checker.indexOf(plugin);
                if (indexOf>=0){
                    checker.splice(indexOf,1);
                }
                plugin.checker.deactivate();
                plugin.checker.onConnectionChange = null;
                plugin.setState("off");
            },
            
            setState : ( state : string )=>{
                plugin.state = state;
                editor.button.bulkRefresh();
            },
            
            loadScript : (src, onComplete)=>{
                let script = document.createElement("script");
                script.onload = onComplete || (()=>console.log(`"${src}" was loaded`));
                script.src = src;
                document.body.appendChild(script);
            }
        };

        $.FroalaEditor.COMMANDS["rtg-switcher"].callback = (cmd,val)=>plugin.onLanguageOptionClick(cmd,val);
        $.FroalaEditor.COMMANDS["rtg-switcher"].refresh = ($btn)=>plugin.onRefreshButton($btn);
        
        return plugin
    };
})(window["jQuery"]);