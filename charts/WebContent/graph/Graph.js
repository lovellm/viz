function Graph(){
/*
 * If 'new' was not used, use it.
 * Makes sure 'this' refers to instance scope
 */
if ( ! (this instanceof Graph) ){
	return new Graph()
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
	allNodes: null,
	allLinks: null,
	nodes: null,
	links: null,
	nodeFilter: [],
	linkFilter: [],
	sim: null
}
var _config = {
	'nodeMeasure' : 'sum',
	'showLabels' : true,
	'nodeMinSize' : 5,
	'nodeMaxSize' : 10,
	'forceScale' : 2,
	'linkMinSize' : 5,
	'linkMaxSize' : 1,
	'ttOffsetY' : 20,
	'dragMode' : 'pull'
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
	//Start the force simulation
	_startForceSim()
}

function _drawItems(){
	//Make the links selection and add the items
	_sel.selLinkss = _sel.gLinks.selectAll('line.link').data(_data.links)
	_sel.selLinkss.exit().remove()
	_sel.selLinkss.enter().append('line')
		.classed('link', true)
		.attr('stroke-width', _config.linkMaxSize)
	_sel.selLinkss = _sel.gLinks.selectAll('line.link')
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
}

function _startForceSim(){
	_data.sim = d3.forceSimulation()
		.force('link', d3.forceLink()
			.id( function(d) { return d.id })
			.distance( _config.nodeMaxSize * 3 * _config.forceScale ))
		.force('charge', d3.forceManyBody()
				.strength(-60/*_config.nodeMaxSize * -_config.forceScale*/)
				.distanceMax(_config.nodeMaxSize * 8 * _config.forceScale))
		.force('collide', d3.forceCollide(_config.nodeMaxSize*2))
		.force('center', d3.forceCenter(_page.width/2, _page.height/2))
	
	//_data.sim.velocityDecay(0.6)
	_data.sim.on('tick', _simTick)
	_data.sim.nodes(_data.nodes)
	_data.sim.force('link').links(_data.links)
	
	_page.svg.call(d3.drag()
		.container(_page.svg.node())
		.subject( function(){ return _data.sim.find(d3.event.x, d3.event.y, 30) } )
		.on('start', _dragStart)
		.on('drag', _dragDrag)
		.on('end', _dragEnd)
	)
}

function _simTick(){
	_sel.selNodes
		.attr('cx', function(d){ return d.x })
		.attr('cy', function(d){ return d.y })
		
	_sel.selLinkss
		.attr('x1', function(d) { return d.source.x })
		.attr('y1', function(d) { return d.source.y })
		.attr('x2', function(d) { return d.target.x })
		.attr('y2', function(d) { return d.target.y })
		
	_sel.selLabels
		.attr('x', function(d) { return d.x })
		.attr('y', function(d) { return d.y - _config.nodeMaxSize })
}

//============
//Drag Related
//============
function _dragStart(){
	switch ( _config.dragMode ) {
	case 'pull': return _dragNodeStart();
	case 'link': return _dragLinkStart();
	default: return null;
	}
}
function _dragDrag(){
	switch ( _config.dragMode ) {
	case 'pull': return _dragNodedragged();
	case 'link': return _dragLinkDragged();
	default: return null;
	}
}
function _dragEnd(){
	switch ( _config.dragMode ) {
	case 'pull': return _dragNodeEnd();
	case 'link': return _dragLinkEnd();
	default: return null;
	}
}
//pull mode: A drag event is started
function _dragNodeStart(){
	if ( !d3.event.active ) _data.sim.alphaTarget(0.3).restart()
	d3.event.subject.fx = d3.event.subject.x
	d3.event.subject.fy = d3.event.subject.y
}
//pull mode: An item is being dragged
function _dragNodedragged(){
	d3.event.subject.fx = d3.event.x
	d3.event.subject.fy = d3.event.y
}
//pull mode: A drag event has ended
function _dragNodeEnd(){
	if ( !d3.event.active ) _data.sim.alphaTarget(0)
	d3.event.subject.fx = null
	d3.event.subject.fy = null
}
//Link Mode: Drag Start
function _dragLinkStart(){
	if ( !d3.event.active ){
		_sel.dragLink = _page.svg.append('line').classed('draglink',true)
			.attr('x1', d3.event.subject.x)
			.attr('y1', d3.event.subject.y)
			.attr('x2', d3.event.x)
			.attr('y2', d3.event.y)
	}
}
//Link Mode: Dragging
function _dragLinkDragged(){
	if ( _sel.dragLink ){
		_sel.dragLink.attr('x2', d3.event.x).attr('y2', d3.event.y)
	}
}
//Link Mode: Drag End
function _dragLinkEnd(){
	if ( !d3.event.active ){
		_sel.dragLink.remove()
		_sel.dragLink = null
		var found = _data.sim.find(d3.event.x, d3.event.y, 30)
		if ( found ){
			_data.links.push({
				source: d3.event.subject.id,
				target: found.id,
			})
			_drawItems()
			_data.sim.stop()
			_data.sim.force('link').links(_data.links)
			_data.sim.alpha(0.2).restart()
		}
	}
}

/**
 * What do do on a window resize
 */
function _resize(){
	_page.width = _page.div.node().clientWidth
	_page.height = _page.div.node().clientHeight
	_data.sim.force('center', d3.forceCenter(_page.width/2, _page.height/2))
	_data.sim.alphaTarget(0).restart()
}

/**
 * Mouse enters over a node
 */
function _nodeMouseOver(d_event){
	//var x = d3.event.pageX
	//var y = d3.event.pageY
	
	var linkTo = []
	var linkFrom = []
	
	_sel.selLinkss.classed('adj',function(d){
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
	
	_page.tooltip.style('display','block').html(d_event.name)
	
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
	_sel.selLinkss.classed('adj',false)
	_sel.selNodes.classed('sel adj',false)
}


function _addNode(){
	_data.nodes.push({
		id: _generateUUID,
		name: 'New Node',
		x: _page.width/2,
		y: _page.height/2
	})
	_drawItems()
	_data.sim.stop()
	_data.sim.nodes(_data.nodes)
	_data.sim.alpha(0.2).restart()
}

function _resetPositions(){
	_data.sim.stop()
	_data.nodes.forEach(function(d){
		d.x = Math.random() * (_page.width-200) + 100
		d.y = Math.random() * (_page.height-200) + 100
		d.vx = 0
		d.vy = 0
	})
	_data.sim.alpha(0.5).restart()
}

function _bringNodesIntoVisible(){
	_data.sim.stop()
	_data.nodes.forEach(function(d,i){
		if ( d.x < 25 ){ d.x = 25 + ( Math.random() * (_page.width*0.1) ) }
		else if ( d.x > _page.width -25 ){ d.x =  _page.width - 25 - (Math.random() * (_page.width*0.1)) }
		if ( d.y < 25 ){ d.y = 25 + ( Math.random() * (_page.height*0.1) ) }
		else if ( d.y > _page.height -25 ) { d.y =  _page.height -25 - (Math.random() * (_page.height*0.1)) }
	})
	_data.sim.alpha(0.5).restart()
	//_simTick()
}


function _prepareData(_){
	_data.nodeFilter = []
	_data.linkFilter = []
	//Check if no parameters
	if ( !arguments.length ){
		_data.allNodes = []
		_data.allLinks = []
	}
	if ( _.nodes ){
		_data.allNodes = _.nodes
	}
	if ( _.links ){
		_data.allLinks = _.links
	}
	if ( !_data.allNodes ) { _data.allNodes = [] }
	if ( !_data.allLinks ) { _data.allLinks = []}
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
	addNode: _addNode,
	resetPositions: _resetPositions,
	bringNodesIntoVisible: _bringNodesIntoVisible,
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
			let data = {}
			return data
		}
		_prepareData(_)
		return this
	},
	dragMode: function(_){
		if ( !arguments.length ) { return _config.dragMode }
		_config.dragMode = _
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
		if ( _===null ) { _resetPositions() }
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
		if ( _===null ) { _resetPositions() }
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