domino.settings({
    shortcutPrefix: "::" // Hack: preventing a bug related to a port in a URL for Ajax
    ,verbose: true
})

;(function($, domino, dmod, undefined){
    
    // Check that config is OK
    if(HYPHE_CONFIG === undefined)
        alert('Your installation of Hyphe has no configuration.\nCreate a file at "_config/config.js" in the same directory than index.php, with at least this content:\n\nHYPHE_CONFIG = {\n"SERVER_ADDRESS":"http://YOUR_RPC_ENDPOINT_URL"\n}')

    // Stuff we reuse often when we initialize Domino
    var rpc_url = HYPHE_CONFIG.SERVER_ADDRESS
        ,rpc_contentType = 'application/x-www-form-urlencoded'
        ,rpc_type = 'POST'
        ,rpc_expect = function(data){return data[0] !== undefined && data[0].code !== undefined && data[0].code == 'success'}
        ,rpc_error = function(data){alert('Oops, an error occurred... \n'+data)}

    var D = new domino({
        name: 'main'
        ,properties: [
            {
                id:'cannotFindWebentities'
                ,type: 'boolean'
                ,value: true
                ,dispatch: 'cannotFindWebentities_updated'
                ,triggers: 'update_cannotFindWebentities'
            },{
                id:'urlslistText'
                ,dispatch: 'urlslistText_updated'
                ,triggers: 'update_urlslistText'
            }
        ]


        ,services: [
            {
                id: 'getWebentities'
                ,setter: 'webentities'
                ,data: function(settings){ return JSON.stringify({ //JSON RPC
                        'method' : HYPHE_API.WEBENTITIES.GET,
                        'params' : [],
                    })}
                ,path:'0.result'
                ,url: rpc_url, contentType: rpc_contentType, type: rpc_type, expect: rpc_expect, error: rpc_error
            },{
                id: 'declarePage'
                ,setter: 'currentWebentity'
                ,data: function(settings){ return JSON.stringify({ //JSON RPC
                        'method' : HYPHE_API.PAGE.DECLARE,
                        'params' : [settings.url],
                    })}
                ,path:'0.result'
                ,url: rpc_url, contentType: rpc_contentType, type: rpc_type, expect: rpc_expect, error: rpc_error
            },{
                id: 'addStartPage'
                ,setter: 'addstartpageValidation'
                ,data: function(settings){ return JSON.stringify({ //JSON RPC
                        'method' : HYPHE_API.WEBENTITY.STARTPAGE.ADD,
                        'params' : [
                            settings.webentityId
                            ,settings.url
                        ],
                    })}
                ,path:'0.result'
                ,url: rpc_url, contentType: rpc_contentType, type: rpc_type, expect: rpc_expect, error: rpc_error
            },{
                id: 'removeStartPage'
                ,setter: 'removestartpageValidation'
                ,data: function(settings){ return JSON.stringify({ //JSON RPC
                        'method' : HYPHE_API.WEBENTITY.STARTPAGE.REMOVE,
                        'params' : [
                            settings.webentityId
                            ,settings.url
                        ],
                    })}
                ,path:'0.result'
                ,url: rpc_url, contentType: rpc_contentType, type: rpc_type, expect: rpc_expect, error: rpc_error
            },{
                id: 'urlLookup'
                ,setter: 'urllookupValidation'
                ,data: function(settings){ return JSON.stringify({ //JSON RPC
                        'method' : HYPHE_API.URL_LOOKUP,
                        'params' : [
                            settings.url
                            ,settings.timeout
                        ],
                    })}
                ,path:'0.result'
                ,url: rpc_url, contentType: rpc_contentType, type: rpc_type, expect: rpc_expect, error: rpc_error
            }
        ]


        ,hacks:[
            {
                // When the text area is typed in, if it is not empty, enable the button 'find web entities'
                triggers: ['urlslistText_updated']
                ,method: function(){
                    var urlslistText = D.get('urlslistText')
                    if(urlslistText !== undefined && urlslistText.length>0){
                        D.dispatchEvent(['update_cannotFindWebentities'], {
                            cannotFindWebentities: false
                        })
                    } else {
                        D.dispatchEvent(['update_cannotFindWebentities'], {
                            cannotFindWebentities: true
                        })
                    }
                }
            },{
                // When the button 'find web entities' is pushed, do it
                triggers: ['ui_findWebentities']
                ,method: function(){
                    var urls = extractWebentities(D.get('urlslistText'))
                    // TODO
                }
            }
        ]
    })



    //// Modules

    // Text area: paste URLs list
    D.addModule(dmod.TextArea, [{
        element: $('#urlsList')
        ,content_property: 'urlslistText'
        ,content_dispatch: 'update_urlslistText'
    }])

    // Button: Find web entities
    D.addModule(dmod.Button, [{
        element: $('#button_findWebentities')
        ,label: "Find the web entities"
        ,disabled_property: 'cannotFindWebentities'
        ,dispatch: 'ui_findWebentities'
    }])
    



    //// On load
    $(document).ready(function(){
        
    })



    //// Processing
    var extractWebentities = function(text){
        var raw_urls = text.split(/[ \n\r\t]+/gi).filter(function(expression){
            return Utils.URL_validate(expression)
        }).map(function(url){
            if(url.indexOf('http')!=0)
                return 'http://'+url
            return url
        })
        return Utils.extractCases(raw_urls)
    }

})(jQuery, domino, (window.dmod = window.dmod || {}))