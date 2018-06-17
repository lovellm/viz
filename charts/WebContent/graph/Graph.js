function Graph(){
//----------------
//Local Properties
//----------------
var _width,
	_height
	
var _parent,
	_div,
	_svg,
	_tooltip
	
var _gNodes,
	_gLinks,
	_gLabels,
	_selNodes,
	_selLinks,
	_selLabels,
	_dragLink
	
var _nodes,
	_links,
	_sim,
	_idInc = 100
	
var _config = {
	'nodeMeasure' : 'sum',
	'showLabels' : true,
	'nodeMinSize' : 5,
	'nodeMaxSize' : 10,
	'forceScale' : 2,
	'linkMinSize' : 5,
	'linkMaxSize' : 1,
	'ttOffsetY' : 20
}
	
//Object to Return
var chart = {};

/**
 * Draw everything
 */
function _draw(){
	//Make a div to hold everything
	_makeDiv()
	//Get the sizes
	_width = _div.node().clientWidth
	_height = _div.node().clientHeight
	//Make the svg to draw in
	_svg = _div.append('svg')
		.attr('width','100%')
		.attr('height','100%')
		
	//Make some holding groups
	_gLinks = _svg.append('g').attr('id','g-links')
	_gLabels = _svg.append('g').attr('id','g-labels')
	_gNodes = _svg.append('g').attr('id','g-nodes')
	//Draw the items
	_drawItems()
	
	_tooltip = _div.append('div').classed('tooltip',true)
	
	
	//Start the force simulation
	_startForceSim()
}

function _drawItems(){
	//Make the links selection and add the items
	_selLinks = _gLinks.selectAll('line.link').data(_links)
	_selLinks.exit().remove()
	_selLinks.enter().append('line')
		.classed('link', true)
		.attr('stroke-width', _config.linkMaxSize)
	_selLinks = _gLinks.selectAll('line.link')

	//Make the Nodes selection and add the items
	_selNodes = _gNodes.selectAll('circle.node').data(_nodes, function(d){ return d ? d.id : this.id; })
	_selNodes.exit().remove()
	_selNodes.enter().append('circle')
		.classed('node',true)
		.attr('r',_config.nodeMaxSize)
		//Add events for nodes
		.on('mouseover', _nodeMouseOver)
		.on('mouseout', _nodeMouseOut)
	_selNodes = _gNodes.selectAll('circle.node')

	//Make the Labels selection and add the items
	_selLabels = _gLabels.selectAll('text.label').data(_nodes)
	_selLabels.exit().remove()
	_selLabels.enter().append('text')
		.classed('label',true)
		.text(function(d) {
			if ( !d ) { return '' }
			if ( !d.name ) { return '' }
			return d.name
		})
	_selLabels = _gLabels.selectAll('text.label')
}

function _startForceSim(){
	_sim = d3.forceSimulation()
		.force('link', d3.forceLink()
			.id( function(d) { return d.id })
			.distance( _config.nodeMaxSize * 2 * _config.forceScale ))
		.force('charge', d3.forceManyBody()
				.strength(-60/*_config.nodeMaxSize * -_config.forceScale*/)
				.distanceMax(_config.nodeMaxSize * 3 * _config.forceScale))
		//.force('collide', d3.forceCollide(_config.nodeMaxSize))
		.force('center', d3.forceCenter(_width/2, _height/2))
	
	//_sim.velocityDecay(0.6)
	_sim.on('tick', _simTick)
	_sim.nodes(_nodes)
	_sim.force('link').links(_links)
	
	_svg.call(d3.drag()
		.container(_svg.node())
		.subject( function(){ return _sim.find(d3.event.x, d3.event.y, 30) } )
		/*
		.on('start', _dragNodeStart)
		.on('drag', _dragNodedragged)
		.on('end', _dragNodeEnd)
		*/
		.on('start', _dragLinkStart)
		.on('drag', _dragLinkDragged)
		.on('end', _dragLinkEnd)
	)
}

function _simTick(){
	_selNodes
		.attr('cx', function(d){ return d.x })
		.attr('cy', function(d){ return d.y })
		
	_selLinks
		.attr('x1', function(d) { return d.source.x })
		.attr('y1', function(d) { return d.source.y })
		.attr('x2', function(d) { return d.target.x })
		.attr('y2', function(d) { return d.target.y })
		
	_selLabels
		.attr('x', function(d) { return d.x })
		.attr('y', function(d) { return d.y - _config.nodeMaxSize })
}

/**
 * A drag event is started
 */
function _dragNodeStart(){
	if ( !d3.event.active ) _sim.alphaTarget(0.3).restart()
	d3.event.subject.fx = d3.event.subject.x
	d3.event.subject.fy = d3.event.subject.y
}

/**
 * And item is being dragged
 */
function _dragNodedragged(){
	d3.event.subject.fx = d3.event.x
	d3.event.subject.fy = d3.event.y
}

/**
 * A drag event has ended
 */
function _dragNodeEnd(){
	if ( !d3.event.active ) _sim.alphaTarget(0)
	d3.event.subject.fx = null
	d3.event.subject.fy = null
}

function _dragLinkStart(){
	if ( !d3.event.active ){
		_dragLink = _svg.append('line').classed('draglink',true)
			.attr('x1', d3.event.subject.x)
			.attr('y1', d3.event.subject.y)
			.attr('x2', d3.event.x)
			.attr('y2', d3.event.y)
	}
}

function _dragLinkDragged(){
	if ( _dragLink ){
		_dragLink.attr('x2', d3.event.x).attr('y2', d3.event.y)
	}
	
}

function _dragLinkEnd(){
	if ( !d3.event.active ){
		_dragLink.remove()
		_dragLink = null
		var found = _sim.find(d3.event.x, d3.event.y, 30)
		if ( found ){
			_links.push({
				source: d3.event.subject.id,
				target: found.id,
			})
			_drawItems()
			_sim.stop()
			_sim.force('link').links(_links)
			_sim.alpha(0.2).restart()
		}
	}
}

/**
 * What do do on a window resize
 */
function _resize(){
	_width = _div.node().clientWidth
	_height = _div.node().clientHeight
	_sim.force('center', d3.forceCenter(_width/2, _height/2))
	_sim.alphaTarget(0).restart()
}

/**
 * Mouse enters over a node
 */
function _nodeMouseOver(d_event){
	var x = d3.event.pageX
	var y = d3.event.pageY
	
	var linkTo = []
	var linkFrom = []
	
	_selLinks.classed('adj',function(d){
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
	_selNodes.classed('adj',function(d){
		return linkTo[d.id] || linkFrom[d.id]
	})
	_selNodes.classed('sel',function(d){
		return d.id == d_event.id
	})
	
	_tooltip.style('display','block').html(d_event.name)
	
	var ttHeight = _tooltip.node().clientHeight
	var ttWidth = _tooltip.node().clientWidth
	var ttx = d_event.x
	var tty = d_event.y
	if ( ttx - ttWidth/2 < 0 ) { ttx = 0 }
	else if ( ttx + ttWidth/2 > _width ) { ttx = _width - ttWidth }
	else { ttx = ttx - ttWidth/2 }
	if ( tty > _height / 2 ) { tty = tty - ttHeight - _config.ttOffsetY }
	else { tty = tty + _config.ttOffsetY }
	
	_tooltip.style('left', ttx+'px').style('top', tty+'px')
}

/**
 * Mouse exits a node
 */
function _nodeMouseOut(){
	_tooltip.style ('display','none')
	_selLinks.classed('adj',false)
	_selNodes.classed('sel adj',false)
}


function _addNode(){
	var i = _idInc++
	_nodes.push({
		id: ''+i,
		name: 'New Node',
		x: _width/2,
		y: _height/2
	})
	_drawItems()
	_sim.stop()
	_sim.nodes(_nodes)
	_sim.alpha(0.2).restart()
}

function _resetPositions(){
	_sim.stop()
	_nodes.forEach(function(d){
		d.x = Math.random() * (_width-200) + 100
		d.y = Math.random() * (_height-200) + 100
		d.vx = 0
		d.vy = 0
	})
	_sim.alpha(0.5).restart()
}

function _bringNodesIntoVisible(){
	_sim.stop()
	_nodes.forEach(function(d,i){
		if ( d.x < 25 ){ d.x = 25 + ( Math.random() * (_width*0.1) ) }
		else if ( d.x > _width -25 ){ d.x =  _width - 25 - (Math.random() * (_width*0.1)) }
		if ( d.y < 25 ){ d.y = 25 + ( Math.random() * (_height*0.1) ) }
		else if ( d.y > _height -25 ) { d.y =  _height -25 - (Math.random() * (_height*0.1)) }
	})
	_sim.alpha(0.5).restart()
	//_simTick()
}


function _prepareData(_){
	//Check if no parameters
	if ( !arguments.length ){
		_nodes = []
		_links = []
	}
	if ( _.nodes ){
		_nodes = _.nodes
	}
	if ( _.links ){
		_links = _.links
	}
}

function _makeDiv(_){
	//Check if no parameter
	if ( !arguments.length ){
		//See if there is already a parent that is a selection
		if ( typeof _parent == 'undefined' || !(_parent instanceof d3.selection) ){
			//If not, use body
			_parent = d3.select('body')
		}
	}
	//Else, Check if parameter is a selection
	else if ( _ instanceof d3.selection ){
		_parent = _;
	}
	//Else, see if it can be selected
	else {
		try { _parent = d3.select(_) }
		catch(e) { _parent = d3.select('body') }
	}
	//Now, we know we have a parent that is a selection
	//If we have a div, remove it
	if ( typeof _div != 'undefined' && _div !== null ){
		_div.remove()
	}
	//Make a div for the parent
	_div = _parent.append('div').classed('graph',true)
}

//--------------
//Expose Methods
//--------------
chart.draw = _draw
chart.addNode = _addNode
chart.resetPositions = _resetPositions
chart.bringNodesIntoVisible = _bringNodesIntoVisible

//-------------------
//Getters and Setters
//-------------------

/**
 * The parent of that chart area
 */
chart.parent = function(_){
	if ( !arguments.length ) { return _parent }
	_makeDiv(_)
	return chart
}

/**
 * The data to be used
 */
chart.data = function(_){
	if ( !arguments.length ) { 
		data = {}
		
		return data
	}
	_prepareData(_)
	return chart
}

//-------------
//One-Time Runs
//-------------
//Add resize event listener
d3.select(window).on('resize', _resize)

//----------------
//Return the Chart
//----------------
return chart
}