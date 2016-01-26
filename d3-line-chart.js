(function(d3, undefined){
    //helpers
    function translateDomain(obj){
        if(typeof(obj.start) !== 'undefined' && typeof(obj.end) !== 'undefined'){
            return [obj.start, obj.end];
        }
        throw Error('Bad domain configuration!');
    }

    /* TODO:
     * - configurable svg (line & axis colors and widths etc) ?
     * - refactor everything :D
     * - save method
     * - responsiveness
     */
    Polymer({

        is: 'd3-line-chart',

        behaviors: [Polymer.IronResizableBehavior],

        properties: {
            /**
             * Array containing axes configuration. Each axis configuration is an object as described below:
             * ```
             * [{
           *    name: String (required)
           *    label: String
           *    scale: String - scale of axis, defaults to scale attribute value
           *      String - type of scale
           *      Object - scale configuration (properties values will be applied to scale methods with corresponding names)
           *    domain: Object {start, end} - domain of axis (if not specified covers all data)
           *    interpolation: String - mode of line interpolation for axis, defaults to interpolation attribute value
           *    config: Object - axis configuration (properties values will be applied to axis methods with corresponding names)
           * }, ...]
             * ```
             * See D3.js documentation for [available axis methods](https://github.com/mbostock/d3/wiki/SVG-Axes#ticks)
             *
             * Note that x axis configuration should be first object in array and chart can display at most 3 axes [x, y1, y2].
             *
             * @attribute axes
             * @type Array
             * @default [{ name: 'xAxis' }, { name: 'yAxis' }]
             */
            axes: {
                type: Array,
                observer: '_refresh',
                value: function(){
                    return [{ name: 'xAxis' }, { name: 'yAxis' }];
                }
            },
            /**
             * Array containing series configuration. Each series configuration is an object as described below:
             * ```
             * [{
           *    label: String (recommended if `legend` attribute set)
           *    axis: String - name of axis the series belongs to, if not set defaults to 'yAxis'
           *    interpolation: String - mode of line interpolation for series, defaults to axis.interpolation
           *    grid: boolean - enable or disable grid lines for axis, defaults to grid attribute value
           *    nice: boolean - enable or disable domain smoothing for axis, defaults to nice attribute value
           *    x: String or function()
           *      String - sets x getter to function(record){ return record[x]; }
           *      function(record) - function getting x from record
           *    y: String or function(record)
           *      String - sets x getter function(record){ return record[y]; }
           *      function(record) - function getting y from record (required if `data` contains objects)
           * }, ...]
             * ```
             * Note that first element of array is drawn with lowest 'z-index'
             *
             * @attribute metadata
             * @type Array
             * @default [{ axis: 'yAxis' }]
             */
            metadata: {
                type: Array,
                observer: '_refresh',
                value: function(){
                    return [{ axis: 'yAxis' }];
                }
            },
            /**
             * Array of records in form of:
             *  - Objects (requires usage of metadata.y and recommended metadata.x)
             *  - Arrays (does not require x y getters but you can still use them for derivative data display)
             *
             *
             *  ```
             *  //ready to go
             *  chart.data = [[x1,y1],[x2,y2], ...];
             *  //requires getter for y in metadata, possible getter for x (eg. date)
             *  chart.data = [{ date: Date1, income: 5000 },{ date: Date2, income: 1500 }, ...];
             *  ```
             *
             * @attribute data
             * @type Array
             * @default []
             */
            data: {
                type: Array,
                observer: '_checkAndRedraw',
                value: function(){
                    return [];
                }
            },
            /**
             * Default line interpolation mode
             * #### Possible values:
             *  - `linear` - piecewise linear segments, as in a polyline.
             *  - `linear-closed` - close the linear segments to form a polygon.
             *  - `step` - alternate between horizontal and vertical segments, as in a step function.
             *  - `step-before` - alternate between vertical and horizontal segments, as in a step function.
             *  - `step-after` - alternate between horizontal and vertical segments, as in a step function.
             *  - `basis` - a B-spline, with control point duplication on the ends.
             *  - `basis-open` - an open B-spline; may not intersect the start or end.
             *  - `basis-closed` - a closed B-spline, as in a loop.
             *  - `bundle` - equivalent to basis, except the tension parameter is used to straighten the spline.
             *  - `cardinal` - a Cardinal spline, with control point duplication on the ends.
             *  - `cardinal-open` - an open Cardinal spline; may not intersect the start or end, but will intersect other control points.
             *  - `cardinal-closed` - a closed Cardinal spline, as in a loop.
             *  - `monotone` - cubic interpolation that preserves monotonicity in y.
             *
             * @attribute interpolation
             * @type String
             * @default 'linear'
             */
            interpolation: {
                type: String,
                value: 'linear',
                observer: '_refresh'
            },
            /**
             * Object specifying X domain of the chart. If not defined domain covers all data
             * #### Properties:
             * - start
             * - end
             *
             * @attribute domain
             * @type Object
             * @default null
             */
            domain: {
                type: Object,
                value: null,
                observer: 'redraw'
            },
            /**
             * Default scale mode for axes
             * #### Possible values:
             *  - `linear` - construct a linear quantitative scale
             *  - `time` - construct a linear time scale
             *  - `pow` - construct a quantitative scale with an exponential transform, setting exponent recommended
             *  - `sqrt` - construct a quantitative scale with a square root transform
             *  - `log` - construct a quantitative scale with an logarithmic transform, requires non 0 x values
             *  - `quantile` - construct a quantitative scale mapping to quantiles, requires setting domain and range
             *  - `quantize` - construct a linear quantitative scale with a discrete output range
             *  - `threshold` - construct a threshold scale with a discrete output range
             *  - `ordinal` - construct an ordinal scale
             *
             *
             *  If you want to add additional settings to your scale turn it to object with property `type` containing selected scale mode.
             *  ```
             *  //scale without extra configuration
             *  scale = 'sqrt';
             *  //scale with configuration
             *  scale = { type: 'pow', exponent: 2 };
             *  ```
             *
             *  See D3.js documentation for [available scale settings](https://github.com/mbostock/d3/wiki/API-Reference#d3scale-scales)
             *
             * @attribute scale
             * @type String or Object
             * @default 'linear'
             */
            scale: {
                type: String,
                value: 'linear',
                observer: '_refresh'
            },
            /**
             * The `nice` attribute if set enables broadening axes domain which is applied for better display of data close to range extremes.
             * Can be overwritten in specific axis.
             *
             * @attribute nice
             * @type boolean
             * @default false
             */
            nice: {
                type: Boolean,
                value: false,
                reflectToAttribute: true,
                observer: 'redraw'
            },
            /**
             * The `grid` attribute if set enables grid display on axes that didn't defined own setting.
             *
             * @attribute grid
             * @type boolean
             * @default false
             */
            grid: {
                type: Boolean,
                value: false,
                reflectToAttribute: true,
                observer: '_refresh'
            },
            ///**
            // * The `legend` attribute if set enables legend display.
            // *
            // * @attribute legend
            // * @type boolean
            // * @default false
            // */
            //legend: {
            //    value: false,
            //    reflectToAttribute: true
            //},
            ///**
            // * The `vertical` attribute if set enables placing legend on the bottom of chart.
            // *
            // * @attribute vertical
            // * @type boolean
            // * @default false
            // */
            //vertical: {
            //    type: Boolean,
            //    value: false,
            //    reflectToAttribute: true
            //},
            /**
             * Object with settings for default svg margins override
             * #### Properties:
             *  - `top` - default 10
             *  - `right` - default 20 (or 60 if there are 3 axes)
             *  - `bottom` - default 60
             *  - `left` - default 60
             *
             * @attribute margin
             * @type Object
             * @default null
             */
            margin: {
                type: Object,
                value: null,
                observer: '_refresh'
            },
            /**
             * The `factory` attribute if set disables display of chart which simplifies using it as svg factory.
             *
             * @attribute factory
             * @type boolean
             * @default false
             */
            factory: {
                type: Boolean,
                value: false,
                reflectToAttribute: true
            }
        },

        //watchers
        listeners: {
            'iron-resize': '_sizeChanged'
        },

        //lifecycle
        attached: function(){
            var me = this;
            me.uid = me.newUID(); //required because of svg clip paths overlapping
            me.colors = me.colors || ['#ff0000', '#ff9900', '#ccff00', '#33ff00', '#00ff66', '#00ffff', '#0066ff', '#3300ff', '#cc00ff', '#ff0099'];
            this.async(function(){
                this.prepare();
            }.bind(this));
        },

        /**
         * The `prepare([width, height, target])` method recreates chart with updated configuration attributes & size.
         * You can also use it to create svg node of desired width/height & current configuration by passing width and height.
         * If you add target parameter created svg will be appended to target node or chart will be written to it (if it is SVG node).
         * You can also pass target node as a css selector.
         *
         * @method prepare
         * @param {int} [width]
         * @param {int} [height]
         * @param {String} [target]
         * @return {boolean} Returns true if succeeded, otherwise false.
         */
        prepare: function(width, height, target){
            var me = this,
                xAxis = me.axes[0],
                yAxis = me.axes[1],
                y1Axis = me.axes[2],
                bounds = me.getBoundingClientRect(),
                external = (width && height),
                uid = (external) ? me.newUID() : me.uid,
                dataPresent = me.data && me.data.length,
                svg;

            //select target svg
            if(external){
                if(target){
                    svg = (target.nodeName === 'SVG') ? d3.select(target) : d3.select(target).append('svg');
                }else{
                    svg = d3.select(document.createElement('svg'));
                }
            }else{
                svg = d3.select(me.$.paper);
            }

            //clear svg and ensure namespace
            svg.attr('version', '1.1').attr('xmlns', 'http://www.w3.org/2000/svg');
            svg.selectAll('*').remove();

            //if no config present abandon preparation
            if((!me.axes  || me.axes.length < 2) || !me.metadata){
                return false;
            }

            //margin secure
            var margin = me.margin || {};
            margin.top = (isNaN(margin.top)) ? 20 : +margin.top;
            margin.right = (!isNaN(margin.right)) ? +margin.right : (me.axes.length < 3) ? 20 : 60;
            margin.bottom = (isNaN(margin.bottom)) ? 60 : +margin.bottom;
            margin.left = (isNaN(margin.left)) ? 60 : +margin.left;

            //update svg size to match component and find size of draw area
            if((!me.initialized || me.sizeChanged) && !external){
                if(!bounds.width || !bounds.height){ //if element is not visible abandon preparation
                    return false;
                }
                width = bounds.width - margin.left - margin.right;
                height = bounds.height - margin.top - margin.bottom;
                svg.attr('width', bounds.width);
                svg.attr('height', bounds.height);
                me.initialized = true;
                me.sizeChanged = false;
            }else{
                if(width && height){
                    svg.attr('width', width);
                    svg.attr('height', height);
                    width = width - margin.left - margin.right;
                    height = height - margin.top - margin.bottom;
                }else{
                    width = svg.attr('width') - margin.left - margin.right;
                    height = svg.attr('height') - margin.top - margin.bottom;
                }
            }

            //define scale for x axis and y axes and apply configuration
            var _scale, scale, scaleType, option;
            me.axes.forEach(function(axis, i){
                if(axis.scale){
                    scale = (typeof(axis.scale) === 'string') ? { type: axis.scale } : axis.scale;
                }else{
                    scale = (typeof(me.scale) === 'string') ? { type: me.scale } : me.scale;
                }
                scaleType = (scale) ? scale.type : 'linear';
                scaleType = (scaleType === 'time' || typeof(d3.scale[scaleType]) === 'function') ? scaleType : 'linear';
                _scale = axis._scale = ((scaleType === 'time') ? d3.time.scale() : d3.scale[scaleType]()).range((i > 0) ? [height, 0] : [0, width]);
                for(option in axis.scale){
                    if(option !== 'type' && scale.hasOwnProperty(option) && typeof(axis._scale[option]) === 'function'){
                        axis._scale[option](axis.scale[option]);
                    }
                }
            });

            //create focus objects configurations
            var lines = [], line;
            if(dataPresent){
                me.metadata.forEach(function(dataset){
                    dataset.axis = dataset.axis || 'yAxis';
                    var getterX, getterY, axis = me.axes.filter(function(axis){
                        return axis.name === dataset.axis;
                    })[0];

                    if(axis){
                        line = d3.svg.line();
                        line.interpolate(dataset.interpolation || axis.interpolation || me.interpolation || 'linear');
                        getterX = me.getXgetter(dataset);
                        line.x(function(d){
                            return xAxis._scale(getterX(d));
                        });
                        getterY = me.getYgetter(dataset);
                        line.y(function(d){
                            return axis._scale(getterY(d));
                        });
                        line.defined(function(d) {
                            return !isNaN(getterY(d)) && !isNaN(getterX(d));
                        });
                        lines.push(line);
                    }
                });
            }

            //configure axes
            var axisOrientation, config, orientations = ['bottom', 'left', 'right'];
            me.axes.forEach(function(axis, key){
                axisOrientation = orientations[key];
                axis._axis = d3.svg.axis().scale(axis._scale).orient(axisOrientation);
                if(axis.grid || (axis.grid === undefined && me.grid)){
                    axis._grid = d3.svg.axis().scale(axis._scale).orient(axisOrientation).tickFormat('');
                }else{
                    axis._grid = undefined;
                }
                config = axis.config;
                for(option in config){
                    if(option !== 'type' && config.hasOwnProperty(option) && typeof(axis._axis[option]) === 'function'){
                        axis._axis[option](config[option]);
                    }
                }
            });

            //create svg groups
            var chart = svg.append('g').attr('class', 'display').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')'),
                grid = chart.append('g').attr('class', 'grid').attr('opacity', '0.7'),
                focus = chart.append('g').attr('class', 'focus').attr('clip-path', 'url(#cp' + uid + ')'),
                axes = chart.append('g').attr('class', 'axes'),
                labels = svg.append('g').attr('class', 'labels');

            //append grids to svg
            if(xAxis._grid){
                grid.append('g').attr('class', 'x grid ' + xAxis.name).attr('transform', 'translate(0,' + height + ')').call(xAxis._grid.tickSize(-height, 0, 0));
            }
            if(yAxis._grid){
                grid.append('g').attr('class', 'y grid ' + yAxis.name).call(yAxis._grid.tickSize(-width, 0, 0));
            }
            if(y1Axis && y1Axis._grid){
                grid.append('g').attr('class', 'y grid ' + y1Axis.name).attr('transform', 'translate(' + width + ' ,0)').call(y1Axis._grid.tickSize(-width, 0, 0));
            }

            //append axes to svg
            axes.append('g').attr('class', 'x axis ' + xAxis.name).attr('transform', 'translate(0,' + height + ')').call(xAxis._axis);
            axes.append('g').attr('class', 'y axis ' + yAxis.name).call(yAxis._axis);
            if(y1Axis){
                axes.append('g').attr('class', 'y axis ' + y1Axis.name).attr('transform', 'translate(' + width + ' ,0)').call(y1Axis._axis);
            }

            //append labels to svg
            if(xAxis.label){
                labels.append('text').attr('y', margin.top + height + margin.bottom).attr('x', margin.left + width/2).attr('dy', '-1.2em').style('text-anchor', 'middle').text(xAxis.label);
            }
            if(yAxis.label){
                labels.append('text').attr('transform', 'rotate(90)').attr('y', 0).attr('x', margin.top + height/2).attr('dy', '-1.2em').style('text-anchor', 'middle').text(yAxis.label);
            }
            if(y1Axis && y1Axis.label){
                labels.append('text').attr('transform', 'rotate(-90)').attr('y', width + margin.right + margin.left).attr('x', margin.top - height/2).attr('dy', '-1.2em').style('text-anchor', 'middle').text(y1Axis.label);
            }

            //append lines to svg
            lines.forEach(function(line, i){
                focus.append('path').attr('class', 'line l' + i);
            });

            //append clipping path to svg
            svg.append('defs').append('clipPath')
                .attr('id', 'cp' + uid)
                .append('rect')
                .attr('width', width)
                //height & translate manipulation for proper display
                .attr('height', height + 2)
                .attr('transform', 'translate(0 ,-2)');

            //create redraw function
            var redraw = function(){
                var domain, epsilon, nice;

                //setting domains
                me.axes.forEach(function(axis, key){
                    nice = axis.nice || (axis.nice === undefined && me.nice);
                    if(key > 0){
                        if(axis.domain){ //if axis has predefined domain
                            axis._scale.domain(translateDomain(axis.domain));
                        }else{
                            //set y domain for all data in axis
                            domain = (dataPresent) ? d3.extent(me.getYs(axis.name)) : [0, 1];
                            if(nice){
                                epsilon = (domain[1] - domain[0]) * 0.02;
                                domain = [domain[0] - epsilon, domain[1] + epsilon];
                            }
                            axis._scale.domain(domain);
                            if(nice && typeof(axis._scale.nice) === 'function'){
                                axis._scale.nice();
                            }
                        }
                    }else{
                        //set predefined x domain or cover all x
                        domain = me.domain && translateDomain(me.domain) || axis.domain && translateDomain(axis.domain);
                        domain = (domain) ? domain : (dataPresent) ? d3.extent(me.getXs()) : [0, 1];
                        axis._scale.domain(domain);
                    }
                });

                //update grids
                me.axes.forEach(function(axis){
                    if(axis._grid){
                        grid.select('.grid.' + axis.name).transition().call(axis._grid);
                    }
                });

                //update axes
                me.axes.forEach(function(axis){
                    axes.select('.axis.' + axis.name).transition().call(axis._axis);
                });

                //update lines
                lines.forEach(function(line, i){
                    focus.select('.line.l' + i).datum(me.data).transition().attr('d', line);
                });

                //update display properties for axes and grid
                svg.selectAll('.axis path, .axis line').attr('fill', 'none').attr('stroke', '#818181').attr('stroke-width', '1px').attr('shape-rendering', 'crispEdges');
                svg.selectAll('.grid .tick').attr('stroke', 'lightgrey').attr('stroke-width', '1px').attr('shape-rendering', 'crispEdges');
                svg.selectAll('.grid path').attr('visibility', 'hidden');
            };

            //do first redraw
            redraw();

            //if not external svg update redraw
            if(!external){
                me.redraw = redraw;
            }else{ //if external apply styles as attributes
                if(!me.factory){
                    me.prepare();
                }
            }

            //setup display properties
            svg.select('.focus').attr('fill', 'none').attr('stroke-width', '1px').attr('shape-rendering', 'geometricPrecision');
            svg.selectAll('.line').attr('stroke', function(d, key){ return me.colors[key]; });

            //set flag if prepared
            if(dataPresent){
                me.prepared = true;
            }

            //return svg
            return svg.node();
        },

        /**
         * The `redraw()` method redraws the chart with current data.
         *
         * @method redraw
         */
        redraw: function(){
            //placeholder
        },

        //proxy for prepare
        _refresh: function(){
            this.prepare();
        },

        //proxy for size change triggered prepare
        _sizeChanged: function(){
            this.sizeChanged = true;
            this.prepare();
        },

        //checker for redraw
        _checkAndRedraw: function(){
            if(this.prepared){
                this.redraw();
            }else{
                this.prepare();
            }
        },

        //helpers
        getXgetter: function(dataset){
            var me = this, sample;
            if(!me.data || !me.data.length){
                throw Error('Can\'t sample records, no data');
            }
            sample = me.data[0];
            if(typeof(dataset.x) === 'function'){
                return function(d){
                    return dataset.x(d);
                };
            }else if(dataset.x){
                return function(d){
                    return d[dataset.x];
                };
            }else if(isNaN(sample[0])){
                return function(d){
                    return me.data.indexOf(d) + 1;
                };
            }else{
                return function(d){
                    return d[0];
                };
            }
        },

        getYgetter: function(dataset){
            var me = this, sample;
            if(!me.data || !me.data.length){
                throw Error('Can\'t sample records, no data');
            }
            sample = me.data[0];
            if(typeof(dataset.y) === 'function'){
                return function(d){
                    return dataset.y(d);
                };
            }else if(dataset.y){
                return function(d){
                    return d[dataset.y];
                };
            }else{
                return function(d){
                    return d[1];
                };
            }
        },

        newUID: function(){
            return ('0000' + (Math.random()*Math.pow(36,4) << 0).toString(36)).slice(-4); // jshint ignore:line
        },

        /**
         * The `getXs()` method returns all x values from current data.
         *
         * @method getXs
         * @return {Array}
         */
        getXs: function(){
            if(!this.data || !this.data.length){
                return [];
            }
            var me = this, getter;
            return d3.merge(me.metadata.map(function(dataset){
                getter = me.getXgetter(dataset);
                return me.data.map(getter);
            }));
        },

        /**
         * The `getYs(axisName)` method returns all y values from selected axis.
         *
         * @method getYs
         * @param {String} axisName
         * @return {Array}
         */
        getYs: function(axisName){
            if(!this.data || !this.data.length){
                return [];
            }
            axisName = axisName || this.axes[1].name;
            var me = this, getter,
                datasets = me.metadata.filter(function(dataset){
                    return dataset.axis === axisName;
                });
            return d3.merge(datasets.map(function(dataset){
                getter = me.getYgetter(dataset);
                return me.data.map(getter);
            }));
        }
    });
})(window.d3);
