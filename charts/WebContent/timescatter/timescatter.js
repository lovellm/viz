function TimeScatter(){
	/*
	 * If 'new' was not used, use it.
	 * Makes sure 'this' refers to instance scope
	 */
	if ( ! (this instanceof TimeScatter) ){
		return new TimeScatter()
	}
	
	/*
	 * Properties that drive behavior or look
	 */
	var _props = {
		width : null
		,height : null
		,padTop : 10
		,padBottom : 20
		,padLeft : 40
		,padRight: 20
		,startAtZero : true
		,limitValueMax : null
		,limitOutliers : true
		,showStatLines : true
		,title : null
	}
	/*
	 * D3 Selections that are used throughout
	 */
	var _sel = {
		parent : null
		,div : null
		,svg : null
	}
	/*
	 * D3 Scales
	 */
	var _scales = {
		value : null
		,time : null
		,color : null
	}
	/*
	 * The actual data (.data) and related information
	 */
	var _data = {
		ready : false
		,timeName : 'time'
		,timeExtent : null
		,valueName : 'value'
		,valueExtent : null
		,mean : null
		,median : null
		,colors : {}
		,colorsName : null
		,data : []
	}
	
	/**
	 * Create the chart's div element within the parent.
	 * Should only be called after setting the parent selection
	 */
	function _makeDiv() {
		if ( typeof _sel.div != 'undefined' && _sel.div !== null ) {
			_sel.div.remove();
		}
		_sel.div = _sel.parent.append('div')
			.classed('timescatter',true)
	}
	
	/**
	 * Prepares the data and sets properties related to the data
	 */
	function _readyData() {
		/*
		 * If data was already prepared, skip processing.
		 * Anything that would make processing needed will set ready to false
		 */
		if ( _data.ready ) { return }
		
		//Reset some values, incase the chart is being re-used
		_data.timeExtent = null
		_data.valueExtent = null
		_data.mean = null
		_data.median = null
		_data.colors = {}
		
		//To hold working version of the extents
		let minValue = null;
		let maxValue = null;
		let sumValue = 0;
		let countValue = 0;
		let tempValues = [];
		let minTime = null;
		let maxTime = null;
		
		//Loop through all the data items
		_data.data.forEach(function(e) {
			//Make sure a property with the time's name exists
			if ( e.hasOwnProperty(_data.timeName) ) {
				//Cast as a date and store as local property in the item
				//e._time = new Date(e[_data.timeName])
				//moment.js gives more reliable parsing
				e._time = moment(e[_data.timeName]).toDate()
				
				//Update the working versions of the extents
				minTime = minTime == null ? e._time : minTime;
				maxTime = maxTime == null ? e._time : maxTime;
				if ( e._time < minTime ) { minTime = e._time }
				if ( e._time > maxTime ) { maxTime = e._time }
			}
			//Make sure a property with the value's name exists
			if ( e.hasOwnProperty(_data.valueName) ) {
				//Cast as a number and store as a local property in the item
				e._value = +e[_data.valueName]
				//If the cast failed, strip some characters and try casting again
				//NaN is only thing that does not equal itself
				if ( e._value !== e._value ){
					e._value = +(e[_data.valueName].replace(/[^0-9\.]/,''))
				}
				
				//Update the working versions of the extents
				minValue = minValue == null ? e._value : minValue;
				maxValue = maxValue == null ? e._value : maxValue;
				if ( e._value < minValue ) { minValue = e._value }
				if ( e._value > maxValue ) { maxValue = e._value }
				
				sumValue += e._value
				countValue += 1
				tempValues.push(e._value)
			}
			
			//Update the color category
			if ( _data.colorsName != null && e.hasOwnProperty(_data.colorsName) ) {
				//Make sure we have a color name set and it exists as a property
				e._color = e[_data.colorsName]
			} else {
				//Otherwise just set to unknown
				e._color = 'Unknown'
			}
			//If this color has not yet been added, add it with a value of 0
			if ( ! _data.colors.hasOwnProperty(e._color) ) {
				_data.colors[e._color] = 0
			}
			//Add one to the value of this color
			_data.colors[e._color] += 1
		})
				
		//Store the mean
		if ( countValue > 0 ) {
			_data.mean = sumValue / countValue
		}
		//Sort values to get percentiles
		tempValues.sort()
		//Get the index
		let indexMedian = Math.ceil(tempValues.length / 2)
		let indexPercent75 = Math.ceil(tempValues.length * 0.75)
		//Make sure the index is valid
		if ( indexMedian > 0 && indexMedian >= tempValues.length ) { indexMedian = tempValues.length - 1 }
		if ( indexPercent75 > 0 && indexPercent75 >= tempValues.length ) { indexPercent75 = tempValues.length - 1 }
		//Store the median and make sure it is a value
		_data.median = tempValues[indexMedian]
		if ( typeof _data.median == 'undefined' ) { _data.median = 0 }
		_data.percent75 = tempValues[indexPercent75]
		if ( typeof _data.percent75 == 'undefined' ) { _data.percent75 = 0 }
		//If we should start at 0, overwrite the minimum value extent
		if ( _props.startAtZero ) { minValue = 0 }
		
		//If we should limit outliers, get the standard deviation
		if ( _props.limitOutliers ) {
			_data.stddev = d3.deviation(_data.data, function(e){ return e._value })
			_props.limitValueMax = _data.mean + ( 2 * _data.stddev )
		}
		if ( _props.limitValueMax != null ) { maxValue = _props.limitValueMax }
		//Set the final extent properties
		_data.timeExtent = [minTime, maxTime]
		_data.valueExtent = [minValue, maxValue]
		
		//Reduce the data to only the elements with valid properties
		_data.data = _data.data.filter(function(e){
			if ( e.hasOwnProperty('_time') && e.hasOwnProperty('_value') ){
				return true;
			}
			return false;
		})
		
		//Indicate that data is ready
		_data.ready = true
	}
	
	/**
	 * Draw reference lines over the chart based on the mouse coordinates
	 */
	function _onCursorLines(){
		let coord = d3.mouse(_sel.svg.node())
		let y = coord[1];
		let x = coord[0];
		
		//If the group already exists, remove it and return.
		if ( _sel.gCursor ) {
			_sel.gCursor.remove();
			//Effectively turns clicks into a toggle display instead of just
			//repositioning the display
			_sel.gCursor = null
			return;
		}
		
		//Make the group and its items
		_sel.gCursor = _sel.svg.append('g').classed('cursor-line', true)
		//Horizontal Bar
		_sel.gCursor.append('line')
			.attr('x1', _props.padLeft).attr('y1', y)
			.attr('x2', _props.width-_props.padRight).attr('y2', y)
		//Vertical Bar
		_sel.gCursor.append('line')
			.attr('x1', x).attr('y1', _props.padTop)
			.attr('x2', x).attr('y2', _props.height-_props.padBottom)
		//Text for Cursor
		let dateFormat = d3.timeFormat("%Y-%m-%d %H:%M:%S")
		let text = '('
			+ dateFormat(_scales.time.invert(x-_props.padLeft))
			+ ', '
			+ Math.round(_scales.value.invert(y-_props.padTop))
			+ ')'
		//Background box to make it easier to read
		_sel.gCursor.append('rect')
			.attr('x', x).attr('y', y-20)
			.attr('height', 20).attr('width', text.length * 6)
		//Text Box
		_sel.gCursor.append('text')
			.attr('x', x+5).attr('y', y-5)
			.text(text)

	}
	
	/*
	 * The object to be returned
	 * 'this' refers to things within the object, not the above,
	 * which are available via the closure scope
	 */
	var chart = {
		
		/**
		 * Get/Set the Width of the SVG element
		 * If Null: use client width
		 * Default: null
		 */
		width : function(_) {
			if ( !arguments.length ) { return _props.width }
			_props.width = +_;
			return this
		}
	
		/**
		 * Get/Set the Height of the SVG element
		 * If Null: use client height 
		 * Default: null
		 */
		,height : function(_) {
			if ( !arguments.length ) { return _props.height }
			_props.height = +_
			return this
		}
		
		/**
		 * Get/Set whether to limit outliers
		 * If True, caps the display at Mean+(2*StdDev)
		 * Default: True
		 */
		,limitOutliers : function(_) {
			if ( !arguments.length ) { return _props.limitOutliers }
			_props.limitOutliers = _
			_data.ready = false
			return this
		}
		
		/**
		 * Get/Set whether to limit the max displayed value
		 * If set, caps the display at this value
		 * Default: null
		 */
		,limitValueMax : function(_) {
			if ( !arguments.length ) { return _props.limitValueMax }
			_props.limitValueMax = _
			_props.limitOutliers = false
			_data.ready = false
			return this
		}
		
		/**
		 * Get/Set whether to show stat lines
		 * Default: True
		 */
		,showStatLines : function(_) {
			if ( !arguments.length ) { return _props.showStatLines }
			_props.showStatLines = _
			return this
		}
		
		/**
		 * Get/Set the title to show
		 * If Null, no title is displayed
		 * Default: null
		 */
		,title : function(_) {
			if ( !arguments.length ) { return _props.title }
			_props.title = _
			return this
		}
		
		/**
		 * Get/Set the data to be used.
		 * This should be an array of objects
		 * Default: empty array
		 */
		,data : function(_) {
			if ( !arguments.length ) { return _data.data }
			//If given value is not an array, just ignore it
			if ( !Array.isArray(_) ) { return this }
			_data.data = _
			_data.ready = false
			return this
		}
		
		/**
		 * Get/Set the name of property in the data representing the value
		 * Default: 'value'
		 */
		,valueName : function(_) {
			if ( !arguments.length ) { return _data.valueName }
			_data.valueName = _
			_data.ready = false
			return this
		}
		
		/**
		 * Get/Set the name of the property in the data representing the time
		 * Default: 'time'
		 */
		,timeName : function(_) {
			if ( !arguments.length ) { return _data.timeName }
			_data.timeName = _
			_data.ready = false
			return this
		}
		
		/**
		 * Get/Set the name of the property in the data representing colors
		 * If Null, do not label by color
		 * Default: null
		 */
		,colorsName : function(_) {
			if ( !arguments.length ) { return _data.colorsName }
			_data.colorsName = _
			_data.ready = false
			return this
		}
		
		/**
		 * Get/Set the parent container in which this chart should be placed.
		 * If not a selection or not able to be selected, uses body.
		 */
		,container : function (_) {
			if ( !arguments.length ) { return _sel.parent }
			if ( _ instanceof d3.selection ) {
				_sel.parent = _
			} else {
				try { _sel.parent = d3.select(_) }
				catch(e) { _sel.parent = d3.select('body') }
			}
			_makeDiv()
			return this
		}
		
		/**
		 * Draw the chart
		 */
		,draw : function() {
			/*
			 * Make sure we have a parent. Since parent is only set via container method,
			 * this also makes sure we have a div as that method creates it
			 */
			if ( _sel.parent == null ){
				this.container('body')
			}
			//Empty the div
			_sel.div.selectAll('*').remove()
			_sel.svg = null
						
			/*
			 * Initialize some measurements
			 */
			if ( _props.width == null ) { _props.width = _sel.div.node().clientWidth }
			if ( _props.height == null ) { _props.height = _sel.div.node().clientHeight }
			let areaHeight = _props.height - _props.padTop - _props.padBottom
			let areaWidth = _props.width - _props.padLeft - _props.padRight
			let translateText = 'translate('+_props.padLeft+','+_props.padTop+')';
			
			/*
			 * Prepare the data
			 */
			_readyData()
			/*
			 * Make the Scales
			 */
			_scales.value = d3.scaleLinear()
				.domain(_data.valueExtent)
				.range([areaHeight, 0])
			if ( _props.limitValueMax != null ) {
				_scales.value.clamp(true) //Limits to domain
			}
			_scales.time = d3.scaleTime()
				.domain(_data.timeExtent)
				.range([0, areaWidth])
			_scales.color = d3.scaleOrdinal(d3.schemeCategory10)
				.domain(Object.keys(_data.colors))
			
			/*
			 * Make the title before SVG, if set
			 */
			if ( _props.title != null && _props.title.length > 0 ){
				_sel.div.append('h1').text(_props.title)
			}
				
			/*
			 * Prepare the SVG
			 */

			//Make a new SVG element
			_sel.svg = _sel.div.append('svg')
			//Set the width and height
			_sel.svg.attr('width', _props.width).attr('height', _props.height)
						
			/*
			 * Make the SVG grouping selections
			 */
			let gPoints = _sel.svg.append('g')
				.classed('points',true)
				.attr('transform',translateText);
			let gAxisX = _sel.svg.append('g')
				.classed('axis', true)
				.attr('transform','translate('+_props.padLeft+','+(_props.height-_props.padBottom)+')')
			let gAxisY = _sel.svg.append('g')
				.classed('axis', true)
				.attr('transform',translateText)
			
			/*
			 * Bind the data and make the circles
			 */
			let points = gPoints.selectAll('circle').data(_data.data)
			points.enter().append('circle')
				.classed('marker',true)
				.attr('cx', function(d){
					return _scales.time(d._time)
				})
				.attr('cy', function(d){
					return _scales.value(d._value)
				})
				.attr('r', 5)
				.attr('fill', function(d) { return _scales.color(d._color) })
			
			/*
			 * Make the axes
			 */
			//axisX = Time axis
			let axisX = d3.axisBottom(_scales.time)
			axisX.tickFormat(d3.timeFormat("%b %d %H:%M:%S"));
			//axisY = Value axis
			let axisY = d3.axisLeft(_scales.value)
			//Draw the axes
			gAxisX.call(axisX)
			gAxisY.call(axisY)
			
			/*
			 * Draw some references
			 */
			if ( _props.showStatLines ) {
				//Line Group
				let gStatLines = _sel.svg.append('g')
					.classed('stat-line', true)
					.attr('transform',translateText)
				
				//Mean Line
				gStatLines.append('line')
					.attr('x1',0).attr('x2',_scales.time(_data.timeExtent[1]))
					.attr('y1',_scales.value(_data.mean)).attr('y2',_scales.value(_data.mean))
				//Median Line
				gStatLines.append('line')
					.attr('x1',0).attr('x2',_scales.time(_data.timeExtent[1]))
					.attr('y1',_scales.value(_data.median)).attr('y2',_scales.value(_data.median))			
				//Percentile 75 line
				gStatLines.append('line')
					.attr('x1', 0).attr('x2', _scales.time(_data.timeExtent[1]))
					.attr('y1', _scales.value(_data.percent75)).attr('y2', _scales.value(_data.percent75))

				//Mean Line Text
				gStatLines.append('text')
					.attr('x',5)
					.attr('y',_scales.value(_data.mean)-2)
					.text('Mean: '+Math.round(_data.mean))
				//Median Line Text
				gStatLines.append('text')
					.attr('x',5)
					.attr('y',_scales.value(_data.median)-2)
					.text('50%: '+_data.median)
				//3rd Quartile Text
				gStatLines.append('text')
					.attr('x',5)
					.attr('y',_scales.value(_data.percent75)-2)
					.text('75%: ' + _data.percent75)	
					
			}
			
			/*
			 * Make a color legend, below the SVG in its own div
			 */
			if ( _data.colorsName != null ) {
				let legend = _sel.div.append('div').classed('legend', true)
				let legendItems = legend.selectAll('.legend-item').data(_scales.color.domain())
				legendItems.enter().append('span').classed('legend-item', true)
					.style('border-color', function(d) { return _scales.color(d) })
					.style('border-style', 'solid')
					.style('border-width', '2px')
					.text(function(d) { return d + ' ('+_data.colors[d]+')' })
			}
			
			
			//Attach a click event to SVG for reference lines
			_sel.svg.on('click', _onCursorLines)
			
			return this;
		}
	}
	
	/*
	 * Set the returned object's prototype to TimeScatter()'s prototype
	 * All it really does is make instanceof TimeScatter return true
	 */
	chart.__proto__ = this.__proto__
	
	//Return our chart instead of the default of 'this'
	return chart
}