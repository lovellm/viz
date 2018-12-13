function Rel(){
/*
 * If 'new' was not used, use it.
 * Makes sure 'this' refers to instance scope
 */
if ( ! (this instanceof Rel) ){
	return new Rel()
}
//----------------
//Local Properties
//----------------
var _page = {
	width: null,
	height: null,
	parent: null,
	div: null,
	svg: null,
	tooltip: null
}
var _sel = {
	gNodes: null,
	gLinks: null,
	gLabels: null,
	selNodes: null,
	selLinks: null,
	selLabels: null,
	dragLink: null
}
var _data = {
	nodeDict: null,
	allNodes: null,
	allLinks: null,
	nodes: null,
	links: null,
	nodeFilter: [],
	linkFilter: [],
}
var _config = {
	'showLabels' : true,
	'nodeMinSize' : 5,
	'nodeMaxSize' : 10,
	'forceScale' : 4,
	'linkMinSize' : 5,
	'linkMaxSize' : 1,
	'ttOffsetY' : 20,
}

/**
 * Generates UUIDs for Added Nodes
 */
function _generateUUID() { // Public Domain/MIT
    var d = new Date().getTime();
    if (typeof performance !== 'undefined' && typeof performance.now === 'function'){
        d += performance.now(); //use high-precision timer if available
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d / 16);
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

//Given an array and index, finds the first non-truthy index from it, wrapping if needed
function _nextFrom (array, from){
	let arraySize = array.length
	let position = Math.floor(from)
	for ( let i = 0; i < arraySize; i++ ) {
		let testI = position+i >= arraySize ? position+i-arraySize : position+i
		if ( !array[testI] ) { return testI }
	}
	return null
}

/**
 * Draw everything
 */
function _draw(){
	//Make a div to hold everything
	_makeDiv()
	//Get the sizes
	_page.width = _page.div.node().clientWidth
	_page.height = _page.div.node().clientHeight
	//Make the svg to draw in
	_page.svg = _page.div.append('svg')
		.attr('width','100%')
		.attr('height','100%')
	//Make some holding groups
	_sel.gLinks = _page.svg.append('g').attr('id','g-links')
	_sel.gLabels = _page.svg.append('g').attr('id','g-labels')
	_sel.gNodes = _page.svg.append('g').attr('id','g-nodes')
	//Draw the items
	_drawItems()
	_page.tooltip = _page.div.append('div').classed('tooltip',true)
}

function _makeLayout(node, layout, i, top) {
	if ( !node.checked ) {
		var pos;
		if ( top ) {
			pos = _nextFrom(layout.grid,i)
		} else {
			pos = _nextFrom(layout.grid,i+(layout.numNodesX-(i%layout.numNodesX)))
		}
		layout.grid[pos]=1
		node.x = layout.left + ((pos%layout.numNodesX)*layout.sizeX )
		node.y = layout.top + (Math.floor(pos/layout.numNodesX)*layout.sizeY)
		node.checked = true
		node.pos = pos
		if ( node.childs ) {
			node.childs.forEach((n2)=>{
				_makeLayout(n2,layout,pos)
			})
		}
	}
}

function _drawItems(){
	//Make the links selection and add the items
	_sel.selLinks = _sel.gLinks.selectAll('line.link').data(_data.links, (d)=> {return d ? d.id : this.id})
	_sel.selLinks.exit().remove()
	_sel.selLinks.enter().append('line')
		.classed('link', true)
		.attr('stroke-width', _config.linkMaxSize)
	_sel.selLinks = _sel.gLinks.selectAll('line.link')
	//Make the Nodes selection and add the items
	_sel.selNodes = _sel.gNodes.selectAll('circle.node').data(_data.nodes, function(d){ return d ? d.id : this.id; })
	_sel.selNodes.exit().remove()
	_sel.selNodes.enter().append('circle')
		.classed('node',true)
		.attr('r',_config.nodeMaxSize)
		//Add events for nodes
		.on('mouseover', _nodeMouseOver)
		.on('mouseout', _nodeMouseOut)
	_sel.selNodes = _sel.gNodes.selectAll('circle.node')
	//Make the Labels selection and add the items
	_sel.selLabels = _sel.gLabels.selectAll('text.label').data(_data.nodes, function(d){ return d ? d.id : this.id; })
	_sel.selLabels.exit().remove()
	_sel.selLabels.enter().append('text')
		.classed('label',true)
		.classed('hide', !_config.showLabels)
		.text(function(d) { return d && d.name ? d.name : '' })
	_sel.selLabels = _sel.gLabels.selectAll('text.label')
	
	
	var layout = {}
	layout.numNodes = _data.nodes.length
	layout.left = _page.width * 0.1
	layout.right = _page.width - (layout.left)
	layout.top = _page.height * 0.1
	layout.bottom = _page.height - (layout.top/2)
	layout.numNodesX = Math.floor(Math.sqrt(layout.numNodes)* (_page.width/_page.height))
	layout.numNodesY = Math.floor(Math.sqrt(layout.numNodes)* (_page.height/_page.width))
	layout.sizeX = Math.floor((layout.right-layout.left) / layout.numNodesX)
	layout.sizeY = Math.floor((layout.bottom-layout.top) / layout.numNodesY)
	layout.grid = (new Array(layout.numNodes)).fill(0)
	layout.mostRecent = 0;
	_data.nodes = _data.nodes.sort((a,b)=>a._count-b._count)
	
	//Iterate nodes to make some coordinates
	_data.allNodes.forEach((n,i)=>{
		_makeLayout(n,layout,i,true)
	})
	
	//Update Positions
	_sel.selNodes
		.attr('cx', function(d){ return d.x })
		.attr('cy', function(d){ return d.y })
	_sel.selLinks
		.attr('x1', function(d) { return d.source.x })
		.attr('y1', function(d) { return d.source.y })
		.attr('x2', function(d) { return d.target.x })
		.attr('y2', function(d) { return d.target.y })
	_sel.selLabels
		.attr('x', function(d) { return d.x })
		.attr('y', function(d) { return d.y - _config.nodeMaxSize })
}

/**
 * What do do on a window resize
 */
function _resize(){
	_page.width = _page.div.node().clientWidth
	_page.height = _page.div.node().clientHeight
	_drawItems()
}

/**
 * Mouse enters over a node
 */
function _nodeMouseOver(d_event){
	//var x = d3.event.pageX
	//var y = d3.event.pageY
	
	var linkTo = []
	var linkFrom = []
	
	_sel.selLinks.classed('adj',function(d){
		if ( d.source.id == d_event.id ){
			linkTo[d.target.id] = 1
			return true
		}
		if ( d.target.id == d_event.id ){
			linkFrom[d.source.id] = 1
			return true
		}
		return false
	})
	_sel.selNodes.classed('adj',function(d){
		return linkTo[d.id] || linkFrom[d.id]
	})
	_sel.selNodes.classed('sel',function(d){
		return d.id == d_event.id
	})
	
	_page.tooltip.style('display','block').html(d_event.id)
	
	var ttHeight = _page.tooltip.node().clientHeight
	var ttWidth = _page.tooltip.node().clientWidth
	var ttx = d_event.x
	var tty = d_event.y
	if ( ttx - ttWidth/2 < 0 ) { ttx = 0 }
	else if ( ttx + ttWidth/2 > _page.width ) { ttx = _page.width - ttWidth }
	else { ttx = ttx - ttWidth/2 }
	if ( tty > _page.height / 2 ) { tty = tty - ttHeight - _config.ttOffsetY }
	else { tty = tty + _config.ttOffsetY }
	
	_page.tooltip.style('left', ttx+'px').style('top', tty+'px')
}

/**
 * Mouse exits a node
 */
function _nodeMouseOut(){
	_page.tooltip.style ('display','none')
	_sel.selLinks.classed('adj',false)
	_sel.selNodes.classed('sel adj',false)
}

function _prepareData(_){
	_data.nodeFilter = []
	_data.linkFilter = []
	if ( _.nodes ){ _data.allNodes = _.nodes }
	if ( _.links ){	_data.allLinks = _.links }
	if ( !_data.allNodes ) { _data.allNodes = [] }
	if ( !_data.allLinks ) { _data.allLinks = []}
	_data.nodeDict = {}
	var counts = {}
	//Iterate links to get a count of nodes
	_data.allLinks.forEach((l)=>{
		if ( !l.id ) { l.id = _generateUUID() }
		if ( !l.source || !l.target ) { 
			l._skip = true
			return
		}
		if ( typeof counts[l.source] === 'undefined' ) { counts[l.source] = {sc:0,tc:0} }
		if ( typeof counts[l.target] === 'undefined' ) { counts[l.target] = {sc:0,tc:0} }
		counts[l.source].sc++
		counts[l.target].tc++
	})
	_data.maxLinks = 0
	//Iterate nodes to set their count, find the max count, and make the dictionary
	_data.allNodes.forEach((n)=>{
		n._sc = counts[n.id] ? counts[n.id].sc || 0 : 0
		n._tc = counts[n.id] ? counts[n.id].tc || 0 : 0
		n._count = n._sc + n._tc
		if ( n._count > _data.maxLinks ) { _data.maxLinks = n._count }
		_data.nodeDict[n.id] = n
	})
	//Iterate links again to replace their source/target with the object reference
	_data.allLinks.forEach((l)=>{
		l.source = _data.nodeDict[l.source] || {}
		l.target = _data.nodeDict[l.target] || {}
		if ( typeof l.source.childs === 'undefined' ) {
			l.source.childs = []
		}
		l.source.childs.push(l.target)
		if ( typeof l.target.childs === 'undefined' ) {
			l.target.childs = []
		}
		l.target.childs.push(l.source)
	})
	//Set the filtered version to the all version
	_data.nodes = _data.allNodes
	_data.links = _data.allLinks
}

function _filterData(){
	_data.nodes = _data.allNodes.filter((o)=>{
		var match = _data.nodeFilter.length < 1
		_data.nodeFilter.forEach((f)=>{
			if ( f.field ) {
				match = match || (o[f.field] && o[f.field].includes && o[f.field].includes(f.filter))
				if ( match ) { return }
			}
			for ( var prop in o ) {
				match = match || (o[prop] && o[prop].includes && o[prop].includes(f.filter))
				if ( match ) { return }
			}
		})
		return match
	})
	_data.links = _data.allLinks.filter((o)=>{
		var match = _data.linkFilter.length < 1
		_data.linkFilter.forEach((f)=>{
			if ( f.field ) {
				match = match || (o[f.field] && o[f.field].includes && o[f.field].includes(f.filter))
				if ( match ) { return }
			}
			for ( var prop in o ) {
				match = match || (o[prop] && o[prop].includes && o[prop].includes(f.filter))
				if ( match ) { return }
			}
		})
		return match
	})
	_data.links = _data.links.filter((o)=>{
		var source = false;
		var target = false;
		_data.nodes.forEach((n)=>{
			source = source || o.source.id === n.id
			target = target || o.target.id === n.id
		})
		return source && target
	})
	_drawItems()
}

function _makeDiv(_){
	//Check if no parameter
	if ( !arguments.length ){
		//See if there is already a parent that is a selection
		if ( typeof _page.parent == 'undefined' || !(_page.parent instanceof d3.selection) ){
			//If not, use body
			_page.parent = d3.select('body')
		}
	}
	//Else, Check if parameter is a selection
	else if ( _ instanceof d3.selection ){
		_page.parent = _;
	}
	//Else, see if it can be selected
	else {
		try { _page.parent = d3.select(_) }
		catch(e) { _page.parent = d3.select('body') }
	}
	//Now, we know we have a parent that is a selection
	//If we have a div, remove it
	if ( typeof _page.div != 'undefined' && _page.div !== null ){
		_page.div.remove()
	}
	//Make a div for the parent
	_page.div = _page.parent.append('div').classed('graph',true)
}
//================
//Object to Return
//================
var chart = {
	//--------------
	//Expose Methods
	//--------------
	draw: _draw,
	//-------------------
	//Getters and Setters
	//-------------------
	/**
	 * The parent of that chart area
	 */
	parent: function(_){
		if ( !arguments.length ) { return _page.parent }
		_makeDiv(_)
		return this
	},
	/**
	 * The data to be used
	 */
	data: function(_){
		if ( !arguments.length ) { 
			return _data
		}
		_prepareData(_)
		return this
	},
	showLabels: function(_){
		if ( !arguments.length ) { return _config.showLabels }
		_config.showLabels = _
		_sel.selLabels.classed('hide', !_config.showLabels)
		return this
	},
	filterNodes: function(_){
		if ( !arguments.length ) { return _data.nodeFilter }
		if ( _===null ){ _data.nodeFilter = [] }
		else {
			var field = arguments[1] || null;
			_data.nodeFilter.push({field: field, filter: _})
		}
		_filterData()
		return this
	},
	filterLinks: function(_){
		if ( !arguments.length ) { return _data.linkFilter }
		if ( _===null ){ _data.linkFilter = [] }
		else {
			var field = arguments[1] || null;
			_data.linkFilter.push({field: field, filter: _})
		}
		_filterData()
		return this
	}
}
//-------------
//One-Time Runs
//-------------
//Add resize event listener
d3.select(window).on('resize', _resize)
/*
 * Set the returned object's prototype to TimeScatter()'s prototype
 * All it really does is make instanceof TimeScatter return true
 */
chart.__proto__ = this.__proto__
//----------------
//Return the Chart
//----------------
return chart
}