'use strict';

angular.module('hyphe.webentityController', [])

  .controller('webentity', ['$scope', 'api', 'utils', 'corpus', '$routeParams', 'store', '$location'
  ,function($scope, api, utils, corpus, $routeParams, store, $location) {
    $scope.currentPage = 'webentity'
    $scope.Page.setTitle('Web Entity')
    $scope.corpusName = corpus.getName()
    $scope.corpusId = corpus.getId()

    $scope.explorerActive = false
    
    $scope.webentity = {id:$routeParams.webentityId, loading:true}

    $scope.reCrawl = function(){
      var webentity = $scope.webentity
      ,obj = {webentity:webentity}
      
      if(webentity !== undefined){
        store.set('webentities_toCrawl', [obj])
        $location.path('/project/'+$scope.corpusId+'/checkStartPages')
      } else {
        $scope.status = {message:'No Web Entity to send', background:'danger'}
      }
    }

    // Init
    fetchWebentity($routeParams.webentityId)

    // Functions
    function fetchWebentity(id){
      api.getWebentities({
          id_list:[id]
          ,crawledOnly: false
        }
        ,function(result){
          $scope.webentity = result[0]
          $scope.webentity.loading = false
          console.log($scope.webentity.name, $scope.webentity)
          $scope.Page.setTitle($scope.webentity.name)
        }
        ,function(){
          $scope.status = {message: 'Error loading web entity', background: 'danger'}
        }
      )
    }
  }])

  .controller('webentity.pagesNetwork', ['$scope', 'api', 'utils', 'corpus', '$routeParams', '$window'
  ,function($scope, api, utils, corpus, $routeParams, $window) {
    $scope.currentPage = 'webentity.pagesNetwork'
    $scope.corpusName = corpus.getName()
    $scope.corpusId = corpus.getId()

    $scope.webentity = {id:$routeParams.webentityId, loading:true}

    $scope.network
    $scope.sigmaInstance
    $scope.spatializationRunning = false
    $scope.overNode = false

    $scope.$on("$destroy", function(){
      killSigma()
    })
    
    $scope.sigmaRecenter = function(){
      var c = $scope.sigmaInstance.cameras[0]
      c.goTo({
        ratio: 1
        ,x: 0
        ,y: 0
      })
    }

    $scope.sigmaZoom = function(){
      var c = $scope.sigmaInstance.cameras[0]
      c.goTo({
        ratio: c.ratio / c.settings('zoomingRatio')
      })
    }

    $scope.sigmaUnzoom = function(){
      var c = $scope.sigmaInstance.cameras[0]
      c.goTo({
        ratio: c.ratio * c.settings('zoomingRatio')
      })
    }

    $scope.toggleSpatialization = function(){
      if($scope.spatializationRunning){
        $scope.sigmaInstance.stopForceAtlas2()
        $scope.spatializationRunning = false
      } else {
        $scope.sigmaInstance.startForceAtlas2()
        $scope.spatializationRunning = true
      }
    }

    $scope.runSpatialization = function(){
      $scope.spatializationRunning = true
      $scope.sigmaInstance.startForceAtlas2()
    }

    $scope.stopSpatialization = function(){
      $scope.spatializationRunning = false
      $scope.sigmaInstance.stopForceAtlas2()
    }

    $scope.downloadNetwork = function(){
      var network = $scope.network

      var blob = new Blob(json_graph_api.buildGEXF(network), {'type':'text/gexf+xml;charset=utf-8'});
      saveAs(blob, $scope.corpusName + ".gexf");
    }

    // Init
    fetchWebentity($routeParams.webentityId)

    // Functions
    function fetchWebentity(id){
      $scope.status = {message: 'Loading Webentity pages'}
      api.getWebentities({
          id_list:[id]
          ,crawledOnly: false
        }
        ,function(result){
          $scope.webentity = result[0]
          loadNetwork()
        }
        ,function(){
          $scope.status = {message: 'Error loading web entity', background: 'danger'}
        }
      )
    }

    function loadNetwork(){
      api.getPagesNetwork({
          webentityId:$scope.webentity.id
        }
        ,function(result){
          $scope.status = {}
          $scope.webentity.loading = false

          buildNetwork(result)
          initSigma()
        }
        ,function(){
          $scope.status = {message: 'Error loading web entity', background: 'danger'}
        }
      )
    }

    function buildNetwork(json){
      var nIndex = {}
      json.forEach(function(d){
        nIndex[d[0]] = true
        nIndex[d[1]] = true
      })

      $scope.network = {}

      $scope.network.attributes = []

      $scope.network.nodesAttributes = [
        {id:'attr_lru', title:'LRU', type:'string'}
        ,{id:'attr_url', title:'URL', type:'string'}
      ]
      
      $scope.network.nodes = []
      var nodesId_byLru = {}
      ,count = 0
      for(var lru in nIndex){
        var id = 'n' + count++
        ,url = utils.LRU_to_URL(lru)
        nodesId_byLru[lru] = id
        $scope.network.nodes.push({
          id: id
          ,label: url
          ,color: '#999999'
          ,attributes: [
            {attr:'attr_lru', val: lru }
            ,{attr:'attr_url', val: url }
          ]
        })
      }

      $scope.network.edgesAttributes = [
        {id:'attr_w', title:'Hyphe Weight', type:'integer'}
      ]

      $scope.network.edges = json
        .map(function(d){
          return {
            sourceID: nodesId_byLru[d[0]]
            ,targetID: nodesId_byLru[d[1]]
            ,attributes: [
              {attr:'attr_w', val:d[2]}
            ]
          }
        })

      json_graph_api.buildIndexes($scope.network)
    }

    function initSigma(){
      $scope.sigmaInstance = new sigma('sigma-example');

      $scope.sigmaInstance.settings({
        defaultLabelColor: '#666'
        ,edgeColor: 'default'
        ,defaultEdgeColor: '#D1C9C3'
        ,defaultNodeColor: '#999'
        ,minNodeSize: 0.3
        ,maxNodeSize: 5
        ,zoomMax: 5
        ,zoomMin: 0.002
      });

      var nodesIndex = {}

      // Populate
      $window.g = $scope.network
      $scope.network.nodes
        .forEach(function(node){
          nodesIndex[node.id] = node
          $scope.sigmaInstance.graph.addNode({
            id: node.id
            ,label: node.label
            ,'x': Math.random()
            ,'y': Math.random()
            ,'size': 1 + Math.log(1 + 0.1 * ( node.inEdges.length + node.outEdges.length ) )
            ,'color': node.color
          })
        })
      $scope.network.edges
        .forEach(function(link, i){
          $scope.sigmaInstance.graph.addEdge({
            'id': 'e'+i
            ,'source': link.sourceID
            ,'target': link.targetID
          })
        })

      // Force Atlas 2 settings
      $scope.sigmaInstance.configForceAtlas2({
        slowDown: 2 * (1 + Math.log($scope.network.nodes.length))
        ,worker: true
        ,scalingRatio: 10
        ,strongGravityMode: true
        ,gravity: 0.1
        ,barnesHutOptimize: $scope.network.nodes.length > 1000
      })

      // Bind interactions
      $scope.sigmaInstance.bind('overNode', function(e) {
        if(Object.keys(e.data.captor).length > 0){  // Sigma bug turnaround
          $scope.overNode = true
          $scope.$apply()
        }
      })

      $scope.sigmaInstance.bind('outNode', function(e) {
        if(Object.keys(e.data.captor).length > 0){  // Sigma bug turnaround
          $scope.overNode = false
          $scope.$apply()
        }
      })

      $scope.sigmaInstance.bind('clickNode', function(e) {
        $window.open(e.data.node.label, '_blank')
      })

      $scope.runSpatialization()
    }

    function killSigma(){
      if ($scope.sigmaInstance) {
        $scope.stopSpatialization()
        $scope.sigmaInstance.kill()
      }
    }
  }])



  .controller('webentity.explorer', ['$scope', 'api', 'utils', '$route', 'corpus', '$routeParams', '$location', '$rootScope'
  ,function($scope, api, utils, $route, corpus, $routeParams, $location, $rootScope) {
    $scope.currentPage = 'webentity.explorer'
    $scope.corpusName = corpus.getName()
    $scope.corpusId = corpus.getId()

    $scope.explorerActive = false
    
    $scope.webentity = {id:$routeParams.webentityId, loading:true}

    var tree
      , currentNode

    $scope.loading = true

    $scope.pages
    $scope.subWebentities
    $scope.parentWebentities

    $scope.path
    $scope.pathUrl
    $scope.items_pages
    $scope.items_folders
    $scope.items_prefixes
    $scope.items_webentities

    $scope.creationRuleLoaded = false
    $scope.creationRule = null

    $scope.pagination_max_size = 7
    $scope.pagination_items_per_page = 20
    $scope.items_page = 1
    $scope.items_folder = 1
    $scope.items_webentity = 1

    $scope.sort_pages = 'sortlabel'
    $scope.sort_asc_pages = true
    $scope.sort_folders = 'sortlabel'
    $scope.sort_asc_folders = true
    $scope.sort_prefixes = 'pagesCount'
    $scope.sort_asc_prefixes = false
    $scope.sort_webentities = 'sortlabel'
    $scope.sort_asc_webentities = true

    // Init
    fetchWebentity($routeParams.webentityId)

    $scope.goTo = function(node){
      currentNode = node
      $scope.items_page = 1
      $scope.items_folder = 1
      $scope.items_webentity = 1
      updateExplorer()
    }

    $scope.goToParent = function(){
      $scope.goTo(currentNode.parent)
    }

    $rootScope.$on('$locationChangeSuccess', function() {
      if ($scope.webentity.lru_prefixes && tree) {
        updateFromPath()
        updateExplorer()
      }
    })

    $scope.newWebEntity = function(obj){
      $scope.status = {message: 'Declaring web entity'}
      api.declareWebentity({
          prefixes:
            utils.LRU_variations(obj.lru, {
                wwwlessVariations: true
                ,wwwVariations: true
                ,httpVariations: true
                ,httpsVariations: true
                ,smallerVariations: false
              })
          ,name: utils.nameLRU(obj.lru)
          ,startPages: [obj.url]
        }
        ,function(result){
          $route.reload();
        }
        ,function(){
          $scope.status = {message: 'Web entity could not be declared', background: 'danger'}
        }
      )
    }

    $scope.removePrefix = function(obj){
      $scope.status = {message: 'Removing prefix'}
      api.removePrefix({
          webentityId: $scope.webentity.id
          ,lru: obj.lru
        }
        ,function(result){
          $route.reload();
        }
        ,function(){
          $scope.status = {message: 'Prefix could not be removed', background: 'danger'}
        }
      )
    }

    $scope.mergeIntoCurrent = function(old_id){
      $scope.status = {message: 'Merging web entities'}
      api.webentityMergeInto({
          oldWebentityId: old_id
          ,goodWebentityId: $scope.webentity.id
        }
        ,function(result){
          $route.reload();
        }
        ,function(){
          $scope.status = {message: 'Web entities could not be merged', background: 'danger'}
        }
      )
    }

    $scope.toogleSortPrefixes = function(field){
      if($scope.sort_prefixes == field){
        $scope.sort_asc_prefixes = !$scope.sort_asc_prefixes
      } else {
        $scope.sort_asc_prefixes = true
        $scope.sort_prefixes = field
      }
    }

    $scope.toogleSortFolders = function(field){
      if($scope.sort_folders == field){
        $scope.sort_asc_folders = !$scope.sort_asc_folders
      } else {
        $scope.sort_asc_folders = true
        $scope.sort_folders = field
      }
    }

    $scope.toogleSortPages = function(field){
      if($scope.sort_pages == field){
        $scope.sort_asc_pages = !$scope.sort_asc_pages
      } else {
        $scope.sort_asc_pages = true
        $scope.sort_pages = field
      }
    }

    $scope.toogleSortWebentities = function(field){
      if($scope.sort_webentities == field){
        $scope.sort_asc_webentities = !$scope.sort_asc_webentities
      } else {
        $scope.sort_asc_webentities = true
        $scope.sort_webentities = field
      }
    }

    $scope.addWECreationRule = function(){
      $scope.status = {message: 'Loading'}
      $scope.loading = true

      api.addWECreationRules({
          prefix: currentNode.lru
          ,regexp: 'prefix+1'
          ,apply_to_existing_pages: true
        }
        ,function(result){

          $scope.status = {message: ''}
          $scope.loading = false
          fetchWebentity($routeParams.webentityId)
          updateExplorer()
        }
        ,function(){
          $scope.status = {message: 'Error adding creation rule', background: 'danger'}
        }
      )
    }

    $scope.removeWECreationRule = function(){
      $scope.status = {message: 'Loading'}
      $scope.loading = true

      api.removeWECreationRules({
          prefix: currentNode.lru
        }
        ,function(result){

          $scope.status = {message: ''}
          $scope.loading = false
          updateExplorer()
        }
        ,function(){
          $scope.status = {message: 'Error removing creation rule', background: 'danger'}
        }
      )
    }

    // Functions
    function fetchWebentity(id){

      $scope.status = {message: 'Loading'}
      
      api.getWebentities({
          id_list:[id]
          ,crawledOnly: false
        }
        ,function(result){
          $scope.webentity = result[0]
          $scope.webentity.loading = false
          
          // Triple loading
          loadPages()
          loadSubWebentities()
          loadParentWebentities()
        }
        ,function(){
          $scope.status = {message: 'Error loading web entity', background: 'danger'}
        }
      )
    }

    function loadPages(){
      api.getPages({
          webentityId:$scope.webentity.id
        }
        ,function(result){

          $scope.pages = result

          checkTripleLoading()

        }
        ,function(){
          $scope.status = {message: 'Error loading pages', background: 'danger'}
        }
      )
    }

    function loadSubWebentities(){

      api.getSubWebentities({
          webentityId:$scope.webentity.id
        }
        ,function(result){

          $scope.subWebentities = result
          
          checkTripleLoading()

        }
        ,function(){
          $scope.status = {message: 'Error loading sub web entities', background: 'danger'}
        }
      )
    }

    function loadParentWebentities(){

      api.getParentWebentities({
          webentityId:$scope.webentity.id
        }
        ,function(result){

          $scope.parentWebentities = result
          
          checkTripleLoading()

        }
        ,function(){
          $scope.status = {message: 'Error loading sub web entities', background: 'danger'}
        }
      )
    }

    function checkTripleLoading(){
      var count = 0

      if($scope.pages !== undefined){
        count++
      }
      if($scope.subWebentities !== undefined){
        count++
      }
      if($scope.parentWebentities !== undefined){
        count++
      }
      if(count < 3){
        $scope.status = {message: 'Loading ' + count + '/3', progress:count*33}
      } else {
        $scope.loading = false

        buildExplorerTree()

        $scope.status = {message: ''}
      }
    }

    function loadWECreationRules(lru){

      $scope.creationRuleLoaded = false
      
      api.getWECreationRules({
          prefix:lru
        }
        ,function(result){

          $scope.creationRuleLoaded = true
          $scope.creationRule = result

        }
        ,function(){
          $scope.status = {message: 'Error loading w.e. creation rule', background: 'danger'}
        }
      )
    }
    
    function updateExplorer(){
      $scope.items_pages = []
      $scope.items_folders = []
      $scope.items_prefixes = []
      $scope.items_webentities = []

      if(!currentNode){
        
        // Home: display prefixes
        
        for(var p in tree.prefix){
          if(tree.prefix[p].data.prefix){
            pushPrefix(
              cleanStem(p)                // label
              ,utils.LRU_to_URL(p)        // url
              ,p                          // lru
              ,tree.prefix[p]             // node
              ,tree.prefix[p].pagesCount  // page count
            )
          }
          if(tree.prefix[p].data.page){
            pushPage(
              utils.LRU_to_URL(p)         // label
              ,utils.LRU_to_URL(p)        // url
              ,p                          // lru
              ,tree.prefix[p].data.page   // page data
              ,tree.prefix[p].data.prefix // is a prefix
            )
          }
        }

        // Path
        $scope.path = []
        $scope.pathUrl = ''

        $scope.creationRuleLoaded = true
        $scope.creationRule = null

      } else {

        // Display the children

        for(var stem in currentNode.children){
          var childNode = currentNode.children[stem]
          if(childNode.data.page){
            pushPage(
              cleanStem(stem)                   // label
              ,utils.LRU_to_URL(childNode.lru)  // url
              ,childNode.lru                    // lru
              ,childNode.data.page              // page data
              ,!!childNode.data.webentity       // is a prefix
              ,stem.substr(0,1)
            )
          }
          if(childNode.data.webentity){
            pushWebentityPrefix(
              cleanStem(stem)                   // label
              ,utils.LRU_to_URL(childNode.lru)  // url
              ,childNode.lru                    // lru
              ,childNode.data.webentity         // data
            )
          }
          if(Object.keys(childNode.children).length>0){
            pushFolder(
              cleanStem(stem)                   // label
              ,utils.LRU_to_URL(childNode.lru)  // url
              ,childNode.lru                    // lru
              ,childNode                        // node
              ,childNode.pagesCount             // page data
              ,!!childNode.data.webentity       // is a prefix
              ,stem.substr(0,1)                 // type
            )
          }
        }

        // Path
        $scope.path = []
        var ancestor = currentNode
        while(ancestor !== undefined){
          var item = {
            label: cleanStem(ancestor.stem)
            ,node: ancestor
            ,pagesCount: ancestor.pagesCount
            ,data: ancestor.data || {}
          }
          $scope.path.unshift(item)
          ancestor = ancestor.parent
        }
        $scope.pathUrl = utils.LRU_to_URL(currentNode.lru)
        
        // Web entity creation rule
        loadWECreationRules(currentNode.lru)

      }

      // Record path in location
      $location.search({'p':$scope.path.map(function(d){return d.node.stem}).join('/')})

      // Internal functions
      function pushPrefix(label, url, lru, node, pageCount){
        $scope.items_prefixes.push({
          label: label
          ,sortlabel: label
          ,url: url
          ,lru: lru
          ,node: node
          ,pagesCount: pageCount
        })
      }

      function pushFolder(label, url, lru, node, pageCount, isPrefix, type){
        $scope.items_folders.push({
          label: label
          ,sortlabel: label
          ,url: url
          ,lru: lru
          ,node: node
          ,pagesCount: pageCount
          ,isPrefix: isPrefix
          ,type: explicitType(type)
        })
      }

      function pushPage(label, url, lru, data, isPrefix, type){
        $scope.items_pages.push({
          label: label
          ,sortlabel: label
          ,url: url
          ,lru: lru
          ,data: data
          ,isPrefix: isPrefix
          ,crawled: data.sources.some(function(d){return d == 'CRAWL'})
          ,type: explicitType(type)
        })
      }

      function pushWebentityPrefix(label, url, lru, data){
        $scope.items_webentities.push({
          label: label
          ,sortlabel: label
          ,url: url
          ,lru: lru
          ,data: data
          ,webentityname: data.name
        })
      }
      
    }

    function buildExplorerTree(){
      
      // Init tree
      // It is a weird structure because it starts with prefixes, which we do not split in stems.
      tree = {prefix:{}}
      
      var prefixes = $scope.webentity.lru_prefixes

      prefixes.forEach(function(p){
        tree.prefix[p] = {children:{}, pagesCount:0, lru:p, stem:p, data:{}}
      })

      
      var pushBranch = function(lru, properties, addPageCount){
        try{
          // Find the prefix of the lru
          var prefix = prefixes.filter(function(prefix){
              return lru.indexOf(prefix) == 0
            })
            .reduce(function(current, candidate){
              return (current.length>=candidate.length)?(current):(candidate)
            }, '')
          ,path = prefix 
          ,stub = lru.substr(prefix.length, lru.length - prefix.length) || ''
          ,currentNode = tree.prefix[prefix]

          /*
          
          EXAMPLE
            lru =     'river|of|tears|'
            prefix =  'river|'
    
          In the beginning:
            path =    'river|'
            stub =    'of|tears|'

          We always have: path + stub = lru

          So at the next step:
            path = 'river|of|'
            stub = 'tears|'

          Until the stub is empty string

          */
          
          while(stub.length > 0){
            
            // console.log(stub)

            if(addPageCount)
              currentNode.pagesCount++
            
            var stem = stub.substr(0, stub.indexOf('|') + 1)
            if(stem.length == 0){
              throw('Empty stem')
            }
            currentNode.children[stem] = currentNode.children[stem] || {children:{}, pagesCount:0, parent:currentNode, lru:currentNode.lru+stem, stem:stem, data:{}}
            currentNode = currentNode.children[stem]
            stub = stub.substr(stem.length, stub.length)

          }

          // Copy properties
          for(var k in properties){
            currentNode.data[k] = properties[k]
          }

        } catch(e){
          console.log('Unable to push branch in explorer tree', 'lru: '+lru, e)
        }

      }

      prefixes.forEach(function(p){
        pushBranch(p, {prefix:true}, false)
      })

      $scope.pages.forEach(function(page){
        pushBranch(page.lru, {page:page}, true)
      })

      $scope.subWebentities.forEach(function(we){
        we.lru_prefixes.forEach(function(lru){
          pushBranch(lru, {webentity:we}, false)
        })
      })

      // Now we get current node from path if possible
      updateFromPath()
      
    }

    function updateFromPath(){
      var path = ($location.search()['p'] || '').split('/')
      var candidateNode = tree.prefix[path[0]]
      for(var i in path){
        if(i>0 && candidateNode !== undefined){
          candidateNode = candidateNode.children[path[i]]
        }
      }
      $scope.goTo(candidateNode)
    }

    function cleanStem(stem){
      if(stem.match(/.*\|.*\|/gi)){
        return stem.substr(0, stem.length-1).split('|').map(function(s){return s.substr(2, s.length-2)}).join(' / ')
      } else {
        var type = stem.substr(0, 1)
        return stem.substr(2, stem.length-3)
          .replace(/[\n\r]/gi, '<line break>')
          .replace(/^$/gi, '<empty>')
          .replace(/^ $/, '<space>')
          .replace(/(  +)/, ' <spaces> ')
      }
    }

    function explicitType(type){
      switch(type){
        case('h'):
          return 'Host'
          break
        case('p'):
          return 'Path'
          break
        case('q'):
          return 'Query'
          break
        case('f'):
          return 'Fragment'
          break
        default:
          return 'Misc.'
          break
      }
    }

  }])
