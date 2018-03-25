(function() {

	'use strict';

	//attach to global scope..
	window.particles = {};

	/**
	 * @constructs
	 * @param {domElement} container
	 * @param {Stats} stats
	 * @param {number} bufferSize - amount of particles to use
	 */
	particles.World = function(container, stats, bufferSize) {

		/**
		 * Settings
		 * @public
		 */
		this.celSize = 3;
		this.bufferSize = bufferSize || 3000;

		// this.rowsx = 20;
		// this.rowsy = 15;
		this.rowsx = Math.ceil(window.innerWidth / this.celSize);
		this.rowsy = Math.ceil(window.innerHeight / this.celSize);
		this.displacement = 2;
		this.rows = [];
		this.baseline = 140;
		this.clear = true;
		this.clearOpacity = 0.1;
		this.blocked = true;

		this.particleRatio = 0.2;
		this.particlesNr = 4000;
		this.particles = [];
		this.color = [255, 255, 255];
		this.colorIntensity = 0.8;
		this.maxAge = 100;
		this.deadCycles = 6;
		this.size = 2;

		this.wind = new THREE.Vector2(0.02, 0);
		this.globalWind = true;
		this.drag = 0.7;
		this.turbulence = 0.6;
		this.maxSpeed = 5.0;
		this.medianSpeed = 1.5;

		this.colorMix = 0.1;
		this.colorOffset = 1.7;
		this.useColorOffset = false;
		this.invertColor = false;

		this.brush = {
			intensity: 0.3,
			size: 3,
			multiplier: 1,
			blend: false,
			smooth: true,
			random: false
		};

		this.emitter = {
			on: false,
			x: 25,
			y: 25,
			size: 5,
			random: false
		};

		this.mouseOver = {
			range: 300,
			multiplier: 0.8,
			turbulence: 5,
			wind: true
		};

		this.transition = {
			attractorSpeed: 1,
			attractorForce: 0.8,
			destinationForce: 1.2,
			limitSpeed: false
		};

		this.centerAttractor = new THREE.Vector2(0, 0);

		//create 3D world
		this.webgl = new particles.WebGL(this);
		this.webgl.init(container);

		//Create mouse variables
		this.mouse = new particles.Mouse(this);
		this.offset = { x: 0, y: 0 };

		//create new empty grid
		this.grid = new particles.Grid(this);

		//variables needed for rendering
		var clock = new THREE.Clock();

		/**
		 * Render new frame
		 * @private
		 */
		this.webgl.renderManager.pipe('physics', function() {

			if (stats) {
				stats.begin();
			}

			clock.getDelta();

			//render all particles
			for ( var i = 0 ; i < this.particles.length ; i++ ) {
				this.particles[i].tick();
			}

			//do mouse effect
			this.mouse.tick();

			//trigger rerendering of vertices/particles by THREEjs
			this.webgl.indicateChange();

			//rotate center attractor
			this.centerAttractor.set(
				Math.sin(clock.elapsedTime * this.transition.attractorSpeed) * (window.innerWidth / 2) + window.innerWidth / 2,
				Math.cos(clock.elapsedTime * this.transition.attractorSpeed) * (window.innerHeight / 2) + window.innerHeight / 2
			);

			if (stats) {
				stats.end();
			}

		}.bind(this));

		/**
		 * Start rendering
		 * @returns {this} - Chainable
		 */
		this.start = function() {
			this.webgl.renderManager.start();
			return this;
		};

		/**
		 * Stop rendering
		 * @returns {this} - Chainable
		 */
		this.stop = function() {
			this.webgl.renderManager.stop();
			return this;
		};

		/**
		 * Reset particles, and create new particles
		 * @returns {this} - Chainable
		 */
		this.resetParticles = function(force) {

			if (force) {
				this.particles = [];
			}

			if (this.particles.length === 0 || force) {

				for ( var i = 0 ; i < this.webgl.particles.length ; i++ ) {

					var particle = new particles.Particle(this);

					//create point in cloud
					particle.vertex = this.webgl.particles[i];
					particle.color = this.webgl.colors[i];
					this.particles.push(particle);

				}

			}

			this.webgl.indicateChange();
			this.start();

			return this;

		}.bind(this);

		/**
		 * Replace current grid with another instance of particles.Grid
		 * Destroys grid currently in use afterwards
		 * @param {particles.Grid} newGrid - new instance of grid
		 */
		this.replaceGrid = function(newGrid, transition) {
			var oldGrid = this.grid;
			this.grid = newGrid;

			if (transition) {

				for ( var i = 0 ; i < this.particles.length ; i++ ) {

					var particle = this.particles[i];
					particle.search = true;
					particle.destination = undefined;

				}

			}

			window.setTimeout(function() {
				oldGrid.destroy();
				oldGrid = undefined;
			});

		};

		/*
		 * Replace current grid with a new empty grid
		 * Destroys grid currently in use afterwards
		 */
		this.clearGrid = function() {

			var newGrid = new particles.Grid(this);
			newGrid.resetGrid();
			this.replaceGrid(newGrid);
			this.resetParticles();

		};

		/**
		 * Triggers resize of grid
		 */
		this.resize = function() {

			this.width = this.webgl.canvas.parentNode.offsetWidth;
			this.height = this.webgl.canvas.parentNode.offsetHeight;

			this.rowsx = Math.ceil(this.width / this.celSize);
			this.rowsy = Math.ceil(this.height / this.celSize);

			//recalculate offset again
			this.offset.x = this.webgl.canvas.parentNode.offsetLeft;
			this.offset.y = this.webgl.canvas.parentNode.offsetTop;

			this.webgl.resize();

		}.bind(this);

		//trigger creating grid and particles on startup
		this.resize();
		this.grid.reset();

	};

}());

(function() {

	'use strict';

	/**
	 * Creates a grid with forces
	 * @constructs
	 * @param {particles.World} world
	 */
	particles.Grid = function(world) {

		this.rows = [];

		/**
		 * Convert pixels to cell position
		 * @param {Integer} x - Horizontal pixel position
		 * @param {Integer} y - Vertical pixel position
		 * @returns {Array}
		 */
		this.getCellPosition = function(x, y) {
			return [
				Math.round( x / (world.rowsx * world.celSize) * world.rowsx ),
				Math.round( y / (world.rowsy * world.celSize) * world.rowsy )
			];
		};

		/**
		 * Get cell data for pixel position
		 * @param {Integer} x - Horizontal pixel position
		 * @param {Integer} y - Vertical pixel position
		 * @returns {Object}
		 */
		this.getCell = function(x, y) {

			var cell = this.getCellPosition(x, y);

			if (cell[0] < world.rowsx - 1 && cell[1] < world.rowsy - 1) {

				var row = this.rows[cell[0]];
				var col = row ? row[cell[1]] : [];
				return col || {};

			} else {
				return {};
			}

		};

		this.getVec2 = function(x, y) {
			var cell = this.getCellPosition(x, y);
			return new THREE.Vector2(cell.x, cell.y);
		};

		/**
		 * Add wind to cell
		 * @param {Integer} x - Horizontal cell position
		 * @param {Integer} y - Vertical cell position
		 * @param {Vector2} wind - Vector2 representing force
		 */
		this.changeCell = function(x, y, wind) {

			this.rows[x][y].type = 'custom';
			this.rows[x][y].wind = wind;

			//this.removeUse(x, y);
			this.inUse.push({ 'x': x, 'y': y });

		};

		/**
		 * Return cell with force randomly
		 * @returns {Object|undefined}
		 */
		this.getUsedCell = function() {
			if (this.inUse.length > 0) {
				return this.inUse[ Math.floor(this.inUse.length * Math.random()) ];
			} else {
				return undefined;
			}
		};

		/**
		 * Remove cell from list of cells with force
		 * @param {Integer} x - Horizontal cell position
		 * @param {Integer} y - Vertical cell position
		 *
		 */
		this.removeUse = function(x, y) {

			for ( var i = 0 ; i < this.inUse ; i++ ) {

				if (this.inUse[i].x === x && this.inUse[i].y === y) {
					this.inUse.splice(i, 1);
				}

			}

		};

		/**
		 * Get cells within radius for a position
		 * @param {Integer} x - Horizontal cell position
		 * @param {Integer} y - Vertical cell position
		 * @param {Integer} maxDistance - Size of radius
		 * @param {Function} cb - Callback for each cell in radius
		 * @returns {Array}
		 */
		this.getRadius = function(x, y, maxDistance, cb) {

			var inRadius = [];
			var pos = this.getCellPosition(x, y);
			x = pos[0];
			y = pos[1];

			var min = [ Math.floor(x - maxDistance), Math.floor(y - maxDistance) ];
			var max = [ Math.ceil(x + maxDistance), Math.ceil(y + maxDistance) ];

			for ( var i = min[0] ; i < max[0] ; i++ ) {
				for ( var j = min[1] ; j < max[1] ; j++ ) {

					var distance = Math.sqrt(Math.pow(Math.abs(x - i), 2) + Math.pow(Math.abs(y - j), 2));

					if (distance <= maxDistance) {

						//bounds?
						if (!this.rows[i] || !this.rows[i][j]) {
							continue;
						}

						inRadius.push( this.rows[i][j] );

						if (cb) {
							cb(this.rows[i][j]);
						}

					}

				}
			}

			return inRadius;

		};

		/**
		 * Reset all forces in grid
		 * @returns {this}
		 */
		this.resetGrid = function() {

			this.rows = [];
			this.inUse = [];

			//create rows
			for ( var i = 0 ; i < world.rowsx ; i++ ) {

				this.rows.push([]);

				for ( var j = 0 ; j < world.rowsy ; j++ ) {
					this.rows[i].push({
						'type': 'standard',
						'x': i,
						'y': j
					});
				}
			}

			//chainable
			return this;

		};

		/**
		 * Reset forces and particles
		 * @returns {this}
		 */
		this.reset = function() {

			world.rowsx = Math.round(world.rowsx);
			world.rowsy = Math.round(world.rowsy);

			this.resetGrid();
			world.resetParticles();

			//chainable
			return this;

		}.bind(this);

		this.destroy = function() {
			this.rows = [];
		};

	};

}());

(function() {

	'use strict';

	/**
	 * Particle controlled by a grid
	 * @constructs
	 * @param {World} world - particles.World instance
	 */
	particles.Particle = function(world) {

		//possible sizes of a particle
		var sizes = [0.5, 1.2, 2, 2];

		//survived first itteration (to ensure equal spread)
		var survived = false;

		/**
		 * Reset particle to a new position and state
		 */
		this.reset = function() {

			var x, y;

			//generate random position onscreen
			if (!world.emitter.on) {

				// x = Math.random() * grid.canvas.width;
				// y = Math.random() * grid.canvas.height;
				var randomCell = world.grid.getUsedCell();

				if (randomCell) {
					x = randomCell.x * world.celSize;
					y = randomCell.y * world.celSize;
				} else {
					x = window.innerWidth * Math.random();
					y = window.outerHeight * Math.random();
				}

				x = x - (x % world.displacement);
				y = y - (y % world.displacement);

			} else if (world.emitter.random) {
				x = Math.random() * world.width;
				y = Math.random() * world.height;
				x = x - (x % world.displacement);
				y = y - (y % world.displacement);

			} else {
				x = world.celSize * world.emitter.x + Math.floor(Math.random() * world.emitter.size + 1);
				y = world.celSize * world.emitter.y + Math.floor(Math.random() * world.emitter.size + 1);
			}

			this.position = new THREE.Vector2(x, y);
			this.velocity = new THREE.Vector2(0, 0);
			this.age = 0;
			this.dead = 0;

			this.search = false;
			this.destination = undefined;

			this.colorOffset = Math.random() * 30;
			this.size = sizes [ Math.round(Math.random() * sizes.length) ];

			this.startOffset = Math.random() * world.maxAge * 0.75;

		};

		this.reset();

		/**
		 * Renders particle
		 */
		this.tick = function() {

			this.age++;

			if (this.startOffset >= this.age && !survived) {

				//keep out of view, awaiting time to be visible
				this.vertex.setX(-1);
				this.vertex.setY(-1);
				this.vertex.setZ(100);
				return false;

			} else if (this.startOffset < this.age && !survived) {

				//survived first itteration
				survived = true;
				this.reset();

			}

			//get cell
			var cel = world.grid.getCell(this.position.x, this.position.y);

			//search mode?
			if (this.search) {

				var distance = 9999;

				//move to destination
				if (this.destination) {
					distance = this.destination.clone().sub(this.position);
				}

				if (cel && cel.type === 'custom' && this.destination && distance.length() < 5) {

					//destination found, so no longer searching
					this.search = false;

				} else if (this.destination) {

					//go to a predefined destination

					var direction = distance.normalize().multiplyScalar(world.transition.destinationForce);
					this.velocity.add(direction);

					//center attractor
					var attractCenter = world.centerAttractor.clone().sub(this.position).normalize().multiplyScalar(world.transition.attractorForce);
					this.velocity.add(attractCenter);

					//can't die while in transition
					this.age = this.startOffset;

				} else {

					var cell = world.grid.getUsedCell();

					if (cell) {
						this.destination = new THREE.Vector2(cell.x * world.celSize, cell.y * world.celSize);
					}

				}

			}

			//apply turbulence
			var turbulence = new THREE.Vector2( Math.random() - 0.5, Math.random() - 0.5 );
			turbulence.multiplyScalar(world.turbulence);
			this.velocity.add(turbulence);

			//apply global wind
			if (world.globalWind) {
				this.velocity.add( world.wind );
			}

			//apply wind of cell below particle
			if (cel && cel.type === 'custom' && cel.wind) {
				this.velocity.add( cel.wind );

				// this.velocity.multiplyScalar( grid.brush.multiplier );
			} else {

				//not on a cell with wind forces, so let it die
				this.dead++;

			}

			//drag to slow down particles
			if (!this.search || world.transition.limitSpeed) {
				this.velocity.clampScalar(-world.maxSpeed, world.maxSpeed);
			}

			//mouse over
			var mouseDistance = world.mouse.distanceTo(this.position);
			if ( mouseDistance < world.mouseOver.range ) {

				// this.age = 1;
				this.dead = 1;

				var relDistance = 1 - mouseDistance / world.mouseOver.range;
				var distractor = this.position.clone().sub(world.mouse.pos).normalize().multiplyScalar(relDistance * world.mouseOver.multiplier);
				this.velocity.add(distractor);

			}

			//add velocity to position of particle
			this.position.add( this.velocity );

			//create drag for velocity
			this.velocity.multiplyScalar(world.drag);

			//bounds?
			if (
				this.position.x < 0 ||
				this.position.y < 0 ||
				this.position.x > world.width ||
				this.position.y > world.height
			) {
				this.reset();
			}

			//die when too old
			if (this.age > world.maxAge) {
				this.reset();
			}

			//die when not (alomst) not moving anymore
			if (this.velocity.length() < 0.0001 && !this.search) {
				this.dead++;
			}

			//Reset when too much dead cycles
			if (this.dead > world.deadCycles && !this.search) {
				this.reset();
			}

			var color;

			//do coloring
			if (!world.customColor) {

				var speedValue = (this.velocity.length() / (world.medianSpeed * (1 - world.colorIntensity))) + world.colorIntensity;
				color = [speedValue, speedValue, speedValue];

			} else {

				//fetch custom color for particle
				color = world.customColor(this.position.x, this.position.y);
				var offset = 0;

				if (world.useColorOffset) {
					offset = Math.sin(world.webgl.renderManager.clock.elapsedTime + this.startOffset) * (this.colorOffset / 255) * world.colorOffset;
				}

				//apply (possible) offset
				color[0] += offset;
				color[1] += offset;
				color[2] += offset;

				if (world.invertColor) {
					color[0] = 1 - color[0];
					color[1] = 1 - color[1];
					color[2] = 1 - color[2];
				}
			}

			//transition colors
			var newColor = new THREE.Color(color[0], color[1], color[2]);
			this.color.lerp(newColor, world.colorMix);

			if (this.age === 0) {
				this.color.copy(newColor);
			}

			//update position
			this.vertex.setX( this.position.x );
			this.vertex.setY( world.height - this.position.y );
			this.vertex.setZ( 0 );

		};

	};

}());

(function() {
	'use strict';

	/**
	 * Create a curve on the grid
	 * @constructs
	 */
	particles.Curve = function(world) {

		var paths = [];
		var scale = 1;

		// var maxPoints = 20;
		var translate = { x: 0, y: 0 };
		var bbox;

		var drawPoint = function(grid, point, wind) {

			grid.getRadius( (scale * point.x) + translate.x, (scale * point.y) + translate.y, world.brush.size, function(point) {
				grid.changeCell(point.x, point.y, wind);
			});

		};

		/**
		 * Draw a single path to a specified grid
		 * @private
		 * @param {THREE.Path} path - THREEjs path instance
		 * @param {Grid} grid - grid instance
		 *
		 */
		var drawPath = function(path, grid) {

			var length = path.getLength();
			var nrPoints = length / (world.celSize * 2);

			// nrPoints = 2;

			var points = path.getSpacedPoints( nrPoints );

			// var points = path.getPoints( nrPoints );

			for ( var i = points.length - 1 ; i >= 0 ; i-- ) {

				var wind;
				var point = points[i];

				wind = path.getTangentAt( i / points.length );
				wind.multiplyScalar(world.brush.intensity);

				drawPoint(grid, point, wind);

			}

		};

		/*
		 * Returns boundingbox (and save/retrieve cache)
		 * @returns {Object}
		 */
		this.boundingbox = function() {

			var min = {};
			var max = {};

			//save to cache when not already in cache
			if (!bbox) {

				//see area for all paths
				for ( var i = 0 ; i < paths.length ; i++ ) {

					var path = paths[i];
					var points = path.getPoints(10);

					for ( var j = 0 ; j < points.length ; j++ ) {

						var point = points[j];

						if ( !min.x || point.x < min.x ) {
							min.x = point.x;
						}
						if ( !min.y || point.y < min.y ) {
							min.y = point.y;
						}
						if ( !max.x || point.x > max.x ) {
							max.x = point.x;
						}
						if ( !max.y || point.y > max.y ) {
							max.y = point.y;
						}

					}

				}

				bbox = {
					'min': min,
					'max': max,
					'width': max.x - min.x,
					'height': max.y - min.y
				};

			}

			return bbox;

		};

		/**
		 * Draw collection of paths to a specified grid
		 * @param {Grid} grid - Instance of grid
		 *
		 */
		this.draw = function(grid) {

			//draw all paths to grid
			for ( var i = 0 ; i < paths.length ; i++ ) {

				drawPath( paths[i], grid );

			}

		};

		/**
		 * Scale curve
		 * @param {Integer} s - Scale
		 * @returns {this}
		 */
		this.scale = function(s) {

			scale = s;

			//chainable
			return this;
		};

		/**
		 * Translate from point of origin (0,0)
		 * @param {Integer} x - horizontal translation
		 * @param {Integer} y - vertical translation
		 * @returns {this}
		 */
		this.translate = function(x, y) {

			translate = { 'x': x, 'y': y };

			//chainable
			return this;

		};

		// var current = [];
		// var reflection = [];

		/**
		 * Convert relative to absolute path, used for SVG paths
		 * @private
		 * @param {Array} coord - coordinate
		 * @param {Array} prev - previous coordinate
		 * @param {string} mode - See if in relative mode
		 * @returns {Array}
		 * @see http://www.w3.org/TR/SVG/paths.html
		 */
		var toAbs = function(coord, prev, mode) {

			//convert when mode is not capitalize, thus relative
			if ( (mode !== mode.toUpperCase()) && prev.length === 2) {
				return [prev[0] + coord[0], prev[1] + coord[1]];
			} else {
				return coord;
			}

		};

		var convertPath = function(path) {

			var splitted = [];

			//split on '-' and ',' but keep those symbols in string
			for ( var i = 0 ; i < path.length ; i++) {

				if (path[i] === ',' || path[i] === '-' || path[i] === ' ' || i === 0) {
					splitted.push(path[i]);
				} else {
					splitted[splitted.length - 1] = splitted[splitted.length - 1] + path[i];
				}

			}

			return splitted;

		};

		/*
		 * Clean paths given by SVG file
		 */
		var cleanRegex = function(p) {

			//no commas allowed
			p = p.replace(',', '');

			if (!p.match(/[A-Z]/i)) {
				return parseFloat( p );
			} else {
				return p;
			}

		};

		/**
		 * Add SVG path
		 * @param {string} path - SVG path
		 * @returns {this}
		 * @see http://www.w3.org/TR/SVG/paths.html
		 */
		this.addPath = function(path) {

			var _path = new THREE.Path();
			var points = path.split(/([A-Z])/ig);

			var mode = 'L';
			var current = [];
			var reflection = [];
			var start = [];

			for ( var i = 0 ; i < points.length ; i++ ) {

				//prevent junk
				if ( points[i] === '' ) {
					continue;
				}

				// point = points[i].split(',');
				// var point = points[i].split(/(,[^,|^-]*)|(\-[^,|^-]*)/);
				var point = convertPath(points[i]);

				//filter junk from regex
				point = point.filter(function(p) {
					return !(p === undefined || p === '');
				});

				//clean up regex
				point = point.map(cleanRegex);

				//check if mode has changes
				//for more explanation of commands/modes see: http://www.w3.org/TR/SVG/paths.html#PathDataCubicBezierCommands
				if ( points[i].match(/m/) ) {
					mode = 'm';
					continue;
				}
				if ( points[i].match(/M/) ) {
					mode = 'M';
					continue;
				} else if ( points[i].match(/c/) ) {
					mode = 'c';
					continue;
				} else if ( points[i].match(/C/) ) {
					mode = 'C';
					continue;
				} else if ( points[i].match(/q/) ) {
					mode = 'q';
					continue;
				} else if ( points[i].match(/Q/) ) {
					mode = 'Q';
					continue;
				} else if ( points[i].match(/s/) ) {
					mode = 's';
					continue;
				} else if ( points[i].match(/S/) ) {
					mode = 'S';
					continue;
				} else if ( points[i].match(/l/) ) {
					mode = 'l';
					continue;
				} else if ( points[i].match(/L/) ) {
					mode = 'L';
					continue;
				} else if ( points[i].match(/h/) ) {
					mode = 'h';
					continue;
				} else if ( points[i].match(/H/) ) {
					mode = 'H';
					continue;
				} else if ( points[i].match(/v/) ) {
					mode = 'v';
					continue;
				} else if ( points[i].match(/V/) ) {
					mode = 'V';
					continue;
				} else if ( points[i].match(/z/) ) {
					mode = 'z';
					continue;
				} else if ( points[i].match(/Z/) ) {
					mode = 'Z';
					continue;
				}

				//console.log('point', point);

				var p, p1, p2, p3;

				if (mode === 'm' || mode === 'M') {

					//begin point

					p = toAbs([ point[0], point[1] ], current, mode);

					//console.log('Start', mode, point);
					_path.moveTo( point[0], point[1] );

					current = [ point[0], point[1] ];

					//set starting point, needed for closing paths
					if (start.length !== 2) {
						start = [ point[0], point[1] ];
					}

				} else if ( mode === 'C' || mode === 'c' ) {

					//cubic bezier

					p1 = toAbs([ point[0], point[1] ], current, mode);
					p2 = toAbs([ point[2], point[3] ], current, mode);
					p3 = toAbs([ point[4], point[5] ], current, mode);

					//console.log('Cubic', p1, p2, p3);

					_path.bezierCurveTo( p1[0], p1[1], p2[0], p2[1], p3[0], p3[1] );

					current = p3;

					//needed for the simple curves
					reflection = [
						(current[0] - p2[0]) + current[0],
						(current[1] - p2[1]) + current[1]
					];

				} else if ( mode === 'S' || mode === 's' ) {

					//`simple` cubic bezier

					p1 = reflection;
					p2 = toAbs([ point[0], point[1] ], current, mode);
					p3 = toAbs([ point[2], point[3] ], current, mode);

					//console.log('Simple Cubic', p1, p2, p3);

					_path.bezierCurveTo( p1[0], p1[1], p2[0], p2[1], p3[0], p3[1] );

					current = p3;

					//needed for the simple curves
					reflection = [
						(current[0] - p2[0]) + current[0],
						(current[1] - p2[1]) + current[1]
					];

				} else if ( mode === 'Q' || mode === 'q' ) {

					//quadratic bezier

					p1 = toAbs(point[0], mode);
					p2 = toAbs(point[1], mode);

					//console.log('Quadratic', p1, p2);
					_path.quadraticCurveTo( p1[0], p1[1], p2[0], p2[1] );

					current = p2;

				} else if ( mode === 'l' || mode === 'L') {

					//line

					p = toAbs([ point[0], point[1] ], current, mode);

					//console.log('normal line', p)
					_path.lineTo( p[0], p[1] );

					current = p;

				} else if ( mode === 'h' || mode === 'H') {

					//Horizontal line

					p = toAbs([ point[0], current[1] ], current, mode);

					//make sure y point isnt transformed
					p[1] = current[1];

					//console.log('horizontal line', p, point)
					_path.lineTo( p[0], p[1] );

					current = p;

				} else if ( mode === 'v' || mode === 'V') {

					//Vertical line

					p = toAbs([ current[0], point[0] ], current, mode);

					//make sure y point isnt transformed
					p[0] = current[0];

					//console.log('vertical line', p, point)
					_path.lineTo( p[0], p[1] );

					current = p;

				} else if ( mode === 'z' || mode === 'Z') {

					//close path

					//console.log('close path')
					_path.lineTo( start[0], start[1] );

					current = start;

				}

			}

			paths.push(_path);

			//chainable
			return this;

		};

	};

}());

(function() {

	'use strict';

	/**
	 * Create a font, a collection of curves
	 * @constructs
	 * @param {Grid} grid - Instance of particles.Grid
	 */
	particles.Font = function(world) {

		var self = this;

		this.font = {};
		this.kerning = {};
		this.shift = {};
		this.baselines = [];
		this.letterSpace = 30;
		this.lineSpace = 55;
		this.lineheight = 0;
		var pointer = { x: 0, y: 0 };
		var origin = { x: 0, y: 0 };
		var bbox = {};
		var scale = 1;

		/**
		 * Reset pointer
		 * @returns {this}
		 */
		this.reset = function() {
			pointer = { x: 0, y: 0 };
			bbox = {};

			//chainable
			return this;
		};

		/**
		 * Set origin of pointer
		 * @returns {this}
		 */
		this.origin = function(x, y) {
			origin.x = x;
			origin.y = y;

			//chainable
			return this;
		};

		/**
		 * Move pointer
		 * @param {Integer} x - Horizontal translation
		 * @param {Integer} y - Vertical translation
		 * @returns {this}
		 */
		this.translate = function(x, y) {
			pointer.x += x;
			pointer.y += y;

			//chainable
			return this;
		};

		/**
		 * Move pointer to a new line
		 * @returns {this}
		 */
		this.newLine = function() {
			pointer.x = 0;
			pointer.y += (this.lineheight * scale) + (this.lineSpace * scale);

			//chainable
			return this;
		};

		/**
		 * Scale font
		 * @param {Integer} s - Scale
		 * @returns {this}
		 */
		this.scale = function(s) {
			scale = s;

			//chainable
			return this;
		};

		/**
		 * Render character
		 * @private
		 * @param {string} character - Character to render
		 * @param {string|undefined} nextCharacter - Next character to render, needed for kerning
		 * @param {boolean} dry - Indicate dry-run, will only return width of character
		 */
		var renderCharacter = function(grid, character, nextCharacter, dry) {

			var width = 0;

			//get character [and transform to uppercase!]
			character = character.toUpperCase();

			//enter
			if (character === '|') {
				this.newLine();
				return width;
			}

			//apostrophe fix
			if (character === '’') {
				character = '\'';
			}

			//invisible character needed for half degree sign for splitted CLEVER°FRANKE logo
			if (character === '}') {
				width = renderCharacter(grid, '>', undefined, true);
				this.translate((this.letterSpace * scale), 0);
				return width;
			}

			//get curve
			var curve = this.font[character];
			if (!curve) {
				return width;
			}

			//get boundingbox
			var bbox = curve.boundingbox();

			//baseline shift
			// var baseline = this.getBaseline(bbox.max.y, bbox.min.y);
			// var dy = baseline - bbox.max.y;
			// dy *= scale;

			//custom shift - based on size of bounding box
			var dy = -scale * this.getShift(character);

			//draw curve to grid
			if (!dry) {

				curve
					.translate(origin.x + pointer.x - (scale * bbox.min.x), origin.y + pointer.y - (scale * bbox.min.y) - dy)
					.scale(scale)
					.draw(grid);

			}

			//get width of character
			width = bbox.width * scale;

			//get kerning
			if (nextCharacter) {

				var dist = width * this.getKerning(character, nextCharacter);
				width += dist;

			}

			//move pointer
			width += scale * this.letterSpace;
			if (!dry) {
				this.translate(width, 0);
			}

			return width;

		}.bind(this);

		var renderWord = function() {

			var words = this.words;
			var self = this.self;
			var text = this.text;
			var dry = this.dry;
			var grid = this.grid;

			var c, character, nextCharacter;

			var _nextRender = {
				'self': this.self,
				'dry': this.dry,
				'text': this.text,
				'words': this.words,
				'start': this.start + this.chunkSize,
				'chunkSize': this.chunkSize,
				'done': this.done,
				'grid': this.grid,
				'renderID': this.renderID
			};
			var nextRender = renderWord.bind(_nextRender);

			//prevent rendering and old timeout
			if (self.renderID !== this.renderID) {
				return false;
			}

			for ( var i = this.start ; i < this.start + this.chunkSize ; i++ ) {

				var word = words[i];

				//done?
				if (i > this.words.length - 1) {
					this.done();
					return false;
				}

				//prevent junk due to regex
				if (word === undefined) {
					continue;
				}

				//render word
				for ( c = 0 ; c < word.length ; c++ ) {

					character = word[c];
					nextCharacter = c < (text.length - 1) ? word[c + 1] : undefined;

					if (!dry) {
						renderCharacter(grid, character, nextCharacter, false);
					} else {
						var width = renderCharacter(grid, character, nextCharacter, true);
						self.translate(width, 0);
					}

				}

				//update dimensions of boundingbox when it is exceeded by drawing
				if (!bbox.right || pointer.x > bbox.right) {
					bbox.right = pointer.x - (scale * self.letterSpace * 1.2);
				}
				if (!bbox.bottom || pointer.y + (self.lineheight * scale) > bbox.bottom) {
					bbox.bottom = pointer.y + (self.lineheight * scale);
				}

				//space after word, only if not on begining of current line
				if (pointer.x > 0) {
					self.translate(scale * self.letterSpace * 1.5, 0);
				}

			}

			window.setTimeout(nextRender, 0);

		};

		/**
		 * (Re)draw text
		 * @param {string} text - Text to draw on canvas
		 * @param {boolean} dry - Only simulate drawing, so a boundingbox can be retrieved
		 * @returns {this}
		 */
		this.generate = function(text, dry, done) {

			this.renderID = +Date.now() * Math.random();

			// console.time('generate font');
			var _pointer, grid;

			if (!dry) {
				grid = new particles.Grid(world);
				grid.resetGrid();
			}

			if (dry) {

				//clone pointer to revert translations when in dry mode
				_pointer = { x: pointer.x, y: pointer.y };
			}

			world.brush.size = 2.8 * scale;

			//reset boundingbox
			bbox = {};

			//do for all words, non blocking
			window.setTimeout( renderWord.bind({
				'self': this,
				'grid': grid,
				'text': text,
				'dry': dry,
				'words': text.split(/[ ]|([|])/),
				'start': 0,
				'chunkSize': 1,
				'renderID': this.renderID,
				'done': function() {

					//revert translations when in dry mode
					if (dry) {

						pointer = _pointer;

					} else {

						//replace grid
						world.replaceGrid(grid);

						//do transitions?
						this.self.transition();

					}

					// console.timeEnd('generate font');

					if (done) {
						done.call(this.self, this);
					}

				}
			}), 0);

			//chainable
			return this;

		};

		/**
		 * Triggers transitioning
		 * @returns {this} - Chainable
		 */
		this.transition = function() {

			for ( var i = 0 ; i < world.particles.length ; i++ ) {

				var particle = world.particles[i];
				particle.search = true;
				particle.destination = undefined;

			}

			//chainable
			return this;

		};

		/**
		 * get bottom point of generated text
		 * @returns {Integer}
		 * @deprecated replaced by this.getBoundingbox.bottom
		 */
		this.getCurrentHeight = function() {

			return origin.y + pointer.y + (this.lineheight * scale);

		};

		/**
		 * Get bounding box for last generated text
		 * @returns {Object} boundingbox
		 */
		this.getBoundingBox = function() {

			var _bbox = {
				left: origin.x,
				top: origin.y,
				right:  origin.x + bbox.right,
				bottom: origin.y + bbox.bottom,
				lineheight: (this.lineheight * scale)
			};

			_bbox.width = _bbox.right - _bbox.left;
			_bbox.height = _bbox.bottom - _bbox.top;

			return _bbox;

		};

		/**
		 * Do a dry-run to get a boundingbox for a text
		 * @param {string} text - Text to do a dry-run for
		 * @param {Function} callback - Callback function, gives bounding box as first param
		 * @async
		 */
		this.getBoundingBoxFor = function(text, callback) {

			this.generate(text, true, function() {
				callback(this.getBoundingBox());
			});

		};

		/**
		 * Draw text inside (given) bounding box
		 * @param {string} text - Text to draw
		 * @param {Object} box - Bounding box to draw in (optional)
		 * @param {Object} offset - Apply offset to boundingbox (optional)
		 * @param {boolean} center - Do centering?
		 * @async
		 */
		this.fitInBoundingBox = function(text, box, offset, center) {

			var self = this;

			if (!box) {
				box = {
					left: origin.x,
					right: world.width - origin.x,
					top: origin.y,
					bottom: world.height - origin.y
				};
			}

			if (offset) {
				box.top += offset.top;
				box.bottom -= offset.bottom;
				box.left += offset.left;
				box.right -= offset.right;
			}

			//get bounding box of text
			this.getBoundingBoxFor(text, function(letterbox) {

				box.width = box.right - box.left;
				box.height = box.bottom - box.top;

				var scaleX = box.width / letterbox.width;
				var scaleY = box.height / letterbox.height;
				var newScale = scaleX < scaleY ? scaleX : scaleY;

				//update scale
				scale = scale * newScale;

				if (center) {

					//new dimensions
					var newWidth = letterbox.width * newScale;
					var newHeight = letterbox.height * newScale;

					//center
					var left = (box.width - newWidth) / 2;
					var top = (box.height - newHeight) / 2;

					//give offset
					origin.x += left;
					origin.y += top;

				}

				self.generate(text);

			});

			//chainable
			return this;

		};

		/**
		 * Get kerning for a character pair
		 * @private
		 * @param {string} a - First character
		 * @param {string} b - Second character
		 */
		this.getKerning = function(a, b) {

			if (this.kerning[a] && this.kerning[a][b]) {
				return this.kerning[a][b];
			} else {
				return 0;
			}

		};

		/**
		 * Get kerning for a character pair
		 * @private
		 * @param {string} a - First character
		 * @param {string} b - Second character
		 * @param {Integer} distance - Distance between character A and B
		 * @returns {this}
		 */
		this.addKerningPair = function(a, b, distance) {

			if (!this.kerning[a]) {
				this.kerning[a] = {};
			}

			this.kerning[a][b] = distance;

			return this;

		};

		/**
		 * Save XML-element to a file
		 * @private
		 * @param {XMLElement} data - Font data to save
		 * @param {string} filename - Optional
		 */
		var saveFile = function(data, filename) {

			if (!filename) {
				filename = 'font.svg';
			}

			data = new XMLSerializer().serializeTostring(data);

			var blob	= new Blob([data], { type: 'image/svg+xml' }),
					e			= document.createEvent('MouseEvents'),
					a			= document.createElement('a');

			a.download = filename;
			a.href = window.URL.createObjectURL(blob);
			a.dataset.downloadurl =  ['image/svg+xml', a.download, a.href].join(':');
			e.initMouseEvent('click', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
			a.dispatchEvent(e);

		};

		/**
		 * Save kernings and shift to an SVG file
		 *
		 * @todo Should be removed in production version
		 */
		this.save = function() {

			//save kerning table
			var kernTable = document.createElement('kerning');

			for ( var a in this.kerning ) {
				for ( var b in this.kerning[a] ) {

					var distance = this.kerning[a][b];

					//createn node
					var pair = document.createElement('pair');
					pair.setAttribute('u1', a);
					pair.setAttribute('u2', b);
					pair.setAttribute('k', distance);

					kernTable.appendChild(pair);

				}

			}

			//save shift table
			var shiftTable = document.createElement('shift');

			for ( var char in this.shift ) {

				//createn node
				var _char = document.createElement('character');
				_char.setAttribute('name', char);
				_char.setAttribute('distance', this.shift[char]);

				shiftTable.appendChild(_char);

			}

			//add to imported file when possible
			if (this._import) {

				var svg = this._import.querySelector('svg');
				var prev = this._import.querySelector('kerning');
				var prev2 = this._import.querySelector('shift');

				//replace kernings table when already there
				if (prev) {
					svg.removeChild(prev);
				}

				//replace shift table when already there
				if (prev2) {
					svg.removeChild(prev2);
				}

				svg.appendChild(kernTable);
				svg.appendChild(shiftTable);
				saveFile(svg);

			}

		};

		/**
		 * Add baseline
		 * @private
		 * @param {Integer} y - vertical position of baseline
		 */
		this.addBaseline = function(y) {
			this.baselines.push(y);
		};

		/**
		 * Retrieve a baseline for a character
		 * @private
		 * @param {Integer} y - vertical position for bottom of character
		 * @param {Integer} minY - vertical position for top of character
		 * @returns {this}
		 */
		this.getBaseline = function(y, minY) {

			var shortest;

			for ( var i = 0 ; i < this.baselines.length ; i++ ) {

				if (
					( !shortest || Math.abs(y - this.baselines[i]) < Math.abs( y - shortest ) ) &&
					this.baselines[i] > minY
				) {
					shortest = this.baselines[i];
				}

			}

			return shortest;

		};

		/**
		 * Add vertical shift for a character
		 * @private
		 * @param {string} char - Character to change shift for
		 * @param {Integer} distance - Distance between -1 and 1
		 *
		 */
		this.addShift = function(char, distance) {
			this.shift[char] = distance;
		};

		/**
		 * Get vertical shift for a character
		 * @private
		 * @param {string} char - Character to get shift for
		 * @returns {Integer} Distance between -1 and 1
		 */
		this.getShift = function(char) {
			return this.shift[char] || 0;
		};

		/**
		 * Convert Hex character to ASCII
		 * @private
		 * @param {string} hex - Hex string to be converted
		 * @see http://www.rapidtables.com/convert/number/hex-to-ascii.htm
		 *
		 */
		var fromHex = function(hex) {

			hex = hex.match(/[0-9A-Fa-f]{2}/g);
			var len = hex.length;
			if ( len === 0 ) {
				return;
			}
			var txt = '';
			for ( var i = 0 ; i < len ; i++)
			{
				var h = hex[i];
				var code = parseInt(h, 16);
				var t = String.fromCharCode(code);
				txt += t;
			}

			if (hex === 'x2019') {
				return '\'';
			}

			return txt;

		};

		/**
		 * Load data
		 * @param {string} data - SVG file represented as string
		 * @param {Function} cb - Callback when loaded
		 *
		 */
		this.load = function(data, cb) {

			var i, j;

			//reset
			this.baselines = [];
			this.font = {};
			this.kerning = {};

			//convert to XML [how about IE?]
			var parser = new DOMParser();
			var file = parser.parseFromString(data, 'text/xml');
			this._import = file;

			//read all characters
			var characters = file.querySelectorAll('g');
			for ( i = 0 ; i < characters.length ; i++ ) {

				var character = characters[i];
				var name = character.id;

				//regex?
				if ( /[xX][0-9a-fA-F]+/.test(name) ) {
					name = name.match(/[xX][0-9a-fA-F]+/)[0];
					name = fromHex(name);
				}

				//baseline
				if (character.id.match(/baseline/i)) {
					var lines = character.querySelectorAll('line');
					for ( j = 0 ; j < lines.length ; j++ ) {
						this.addBaseline(parseInt( lines[j].getAttribute('y1') ));
					}

					continue;
				}

				//check for junk
				if (!name || (name.length > 1) ) {
					continue;
				}

				//create curve
				var curve = new particles.Curve(world);
				curve.emitters = [];

				//read paths and add to curve
				var paths = character.querySelectorAll('path');
				for ( j = 0 ; j < paths.length ; j++ ) {

					var path = paths[j].getAttribute('d');

					//fix for IE
					path = path.replace(/\d?\s\d/g, function(txt) {
						return txt.replace(' ', ',');
					});
					path = path.replace(/\s/g, '');

					curve.addPath(path);
				}

				//read all emitters
				var rects = character.querySelectorAll('rect');
				for ( j = 0 ; j < rects.length ; j++ ) {
					curve.emitters.push( { x: rects[j].getAttribute('x'), y: rects[j].getAttribute('y') });
				}

				//add curves to font
				this.font[name.toUpperCase()] = curve;

				//get boundingbox
				var bbox = curve.boundingbox();

				//check if lineheights needs to be bigger?
				if (bbox.height > this.lineheight) {
					this.lineheight = bbox.height;
				}

			}

			//read all kernings
			var kernings = file.querySelector('kerning');

			if (kernings) {

				var pairs = kernings.querySelectorAll('pair');
				for ( i = 0 ; i < pairs.length ; i++ ) {
					var pair = pairs[i];
					this.addKerningPair(pair.getAttribute('u1'), pair.getAttribute('u2'), pair.getAttribute('k'));
				}

			}

			//read all
			var shift = file.querySelector('shift');

			if (shift) {

				var chars = shift.querySelectorAll('character');
				for ( i = 0 ; i < chars.length ; i++ ) {
					var char = chars[i];
					this.addShift(char.getAttribute('name'), parseFloat(char.getAttribute('distance')));
				}

			}

			//callback?
			if (cb) {
				cb();
			}

		};

		/**
		 * Callback of event for loading file via fileselector
		 * @private
		 * @param {Event} evt - event
		 */
		var handleFileSelect = function(evt) {

			var reader = new FileReader();
			var file = evt.target.files[0];

			reader.onload = function() {
				self.load(reader.result);
			};

			// Read in the image file as a data URL.
			reader.readAsText(file);

		};

		/**
		 * Load file via filesector
		 */
		this.loadFile = function() {

			var picker = document.querySelector('#filepicker');
			picker.style.display = 'block';

			picker.click();
			picker.addEventListener('change', handleFileSelect, false);

			// picker.style.display = 'none';

		};

		/**
		 * Simple AJAX request shim
		 * @private
		 * @param {string} url - url to retrieve
		 * @param {Function} callback - Callback when retrieved
		 *
		 * @todo Should be removed and replaced by framework
		 */
		var request = function(url, callback) {

			var xhr;

					if (typeof XMLHttpRequest !== 'undefined') {
				xhr = new XMLHttpRequest();
			} else {
				var versions = ['MSXML2.XmlHttp.5.0',
								'MSXML2.XmlHttp.4.0',
								'MSXML2.XmlHttp.3.0',
								'MSXML2.XmlHttp.2.0',
								'Microsoft.XmlHttp'];

				for (var i = 0, len = versions.length; i < len; i++) {
					try {
						xhr = new window.ActiveXObject(versions[i]);
						break;
					}
					catch (e) {}
				} // end for
			}

			xhr.onreadystatechange = function() {
				if (xhr.readyState < 4) {
					return;
				}

				if (xhr.status !== 200) {
					return;
				}

				// all is well
				if (xhr.readyState === 4) {
					callback(xhr);
				}
			};

			try {

				xhr.open('GET', url, true);
				xhr.send('');

			} catch (e) {}

			};

		/**
		 * Load font by URL
		 * @param {string} url - url of SVG font file
		 * @param {Function} cb - Callback when finished
		 */
		this.loadUrl = function(url, cb) {

			request(url, function(data) {

				this.load(data.responseText, cb);

			}.bind(this));

		};

	};

}());

(function() {

	'use strict';
	/* global noise, particles */

	particles.Overview = function(world, size) {

		var blocks = [];

		this.factor = 20;
		this.multiply = 0.5;

		this.addBlock = function(x,y,width,height) {
			blocks.push({
				x: x,
				y: y,
				width: height,
				height: height
			});

			//chainable
			return this;
		};

		var getCell = function(x,y) {

			for ( var i = 0 ; i < blocks.length ; i++ ) {

				if (
					x >= blocks[i].x && x < (blocks[i].x + blocks[i].width) &&
					y >= blocks[i].y && y < (blocks[i].y + blocks[i].height)
				) {
					return true;
				}

			}

			return false;

		};

		noise.seed(Math.random());

		var getDirection = function(position, wind) {

			//spiral position
			// var center = new THREE.Vector2(grid.width/2, grid.height/2);
			// var angle = Math.atan2(center.y,center.x) - Math.atan2(position.y,position.x);
			// angle += (Math.random() * 2 - 1) * 0.1;

			var factor = this.factor || 20;
			var multiply = this.multiply || 0.5;
			var angle = noise.simplex2(position.x / factor, position.y / factor);
			var angle2 = noise.simplex2(position.y / factor, position.x / factor);
			wind = new THREE.Vector2( angle * multiply, angle2 * multiply );

			// wind = new THREE.Vector2( Math.cos(angle), Math.sin(angle) );

			// console.log(wind);

			// return wind;

			//prevent artifacting due to perlin noise edges
			if (wind.x === 0 && wind.y === 0) {

				// wind.x = Math.random();
				// wind.y = Math.random();
			}

			//do iteration of force
			var _wind = wind
				.clone()
				.normalize()
				.round();

			//get next block
			var current = getCell(position.x, position.y);
			var next = position.clone().add(_wind);
			next = getCell(next.x, next.y);

			var PI = Math.PI;
			var directions = [2 * PI, PI / 2, PI, (3 * PI) / 2];

			//blocked
			if (current) {
				return new THREE.Vector2(0,0);
			} else if (next) {

				var closest, _closest;
				var rotation = wind.clone().normalize();
				rotation = Math.atan2(rotation.y, rotation.x);

				for ( var i = 0 ; i < directions.length ; i++ ) {

					var direction = directions[i];
					var dist = Math.abs( rotation - direction );

					var test = new THREE.Vector2( Math.cos(direction), Math.sin(direction) );
					test.normalize().round();
					test = position.clone().add(test);
					var inUse = getCell(test.x, test.y);

					if (!closest || dist < closest && !inUse) {
						closest = dist;
						_closest = direction;
					}

				}

				return new THREE.Vector2( Math.cos(_closest), Math.sin(_closest) );

			} else {

				//not blocked so just use 'normal' wind
				return wind;
			}

		}.bind(this);

		var convertGrid = function(smallGrid) {

			var scaleX = world.grid.rows.length / smallGrid.length;
			var scaleY = world.grid.rows[0].length / smallGrid[0].length;

			//create new grid
			var bigGrid = new particles.Grid(world);
			bigGrid.resetGrid();

			for ( var x = 0 ; x < bigGrid.rows.length ; x++ ) {

				for ( var y = 0 ; y < bigGrid.rows[x].length ; y++ ) {

					var _x = Math.floor( x / scaleX );
					var _y = Math.floor( y / scaleY );

					var force = { x: 0, y:0 };

					if (smallGrid[_x] && smallGrid[_x][_y]) {
						force = smallGrid[_x][_y];
					}

					if (force.x !== 0 && force.y !== 0) {
						bigGrid.changeCell(x, y, force);
					}

				}
			}

			world.replaceGrid(bigGrid, true);

		};

		this.generate = function(wind) {

			var bigBlocks = [];
			wind = wind || new THREE.Vector2(0.1,0.1);
			var blockSize = world.width / size;
			blockSize = 20;

			//get forces on larger grid
			for ( var x = 0 ; x < Math.ceil(world.width / blockSize) ; x++ ) {

				bigBlocks[x] = [];

				for ( var y = 0 ; y < Math.ceil(world.height / blockSize) ; y++ ) {

					bigBlocks[x][y] = getDirection( new THREE.Vector2(x,y), wind );

				}

			}

			//apply forces to smaller grid
			convertGrid(bigBlocks);

		};

	};

}());

(function() {

	'use strict';

	particles.Mouse = function(world) {

		var mousePos = new THREE.Vector2(0, 0);
		var mousePrev = new THREE.Vector2(0, 0);
		var mouseDelta = new THREE.Vector2(0, 0);
		var mousePressed = false;

		//Update actual mouse position
		var updateMouse = function(evt) {
			mousePos.set(evt.clientX - world.offset.x, evt.clientY - world.offset.y);
		};

		//Determine if user has button of mouse pressed
		var mouseUp = function() {
			mousePressed = false;
		};
		var mouseDown = function() {
			mousePressed = true;
		};

		var brush = function() {

			var delta = mousePos.clone().sub(mousePrev);

			//check for movement
			if (delta.length() < 2) {
				return false;
			}

			//get rotational difference with previous mouse position
			var theta = Math.atan2(delta.y, delta.x);

			//get grid cells to change
			var points = world.grid.getRadius(mousePos.x, mousePos.y, world.brush.size);
			var gridPos = world.grid.getCellPosition(mousePos.x, mousePos.y);

			points.forEach(function(point) {

				var distance = Math.sqrt(Math.pow(Math.abs(point.x - gridPos[0]), 2) + Math.pow(Math.abs(point.y - gridPos[1]), 2));

				if (!point.wind) {
					point.type = 'custom';
					point.wind = new THREE.Vector2(0, 0);
				}

				var intensity = (world.brush.size - distance) * world.brush.intensity;
				var vector = new THREE.Vector2(Math.cos(theta), Math.sin(theta));

				//blending of rotations
				if (brush.blend && point.wind.x !== 0 && point.wind.y !== 0) {
					vector.lerp(point.wind, 1 - distance / brush.size);
				}

				//make sure intensity of cell isn't getting lower, by getting length?
				var prevIntensity = point.wind.length();
				if (prevIntensity > 0 && prevIntensity < intensity) {
					intensity = prevIntensity;
				}

				//smoothing?
				if (!brush.smooth) {
					intensity = world.brush.intensity;
				}

				//minimal intensity
				intensity = intensity < 0.05 ? 0.05 : intensity;

				//change cell
				world.grid.changeCell(point.x, point.y, vector.multiplyScalar(intensity));

			});

		};

		/**
		 *  Do all calculations needed for the mouse, will be executed from Grid render fn.
		 * @private */
		this.tick = function() {

			var delta = mousePrev.clone().sub(mousePos);
			delta.x = delta.x / window.innerWidth;
			delta.y = delta.y / window.innerHeight;

			mouseDelta.add(delta);
			mouseDelta.multiplyScalar(0.8);
			mouseDelta.clampScalar(-1.5, 1.5);

			//steer wind with mouse
			if (world.mouseOver.wind) {
				world.wind.set(mouseDelta.x * -5, mouseDelta.y * -5);
			}

			//Be able to draw with the mouse
			if (mousePressed) {
				brush();
			}

			//save mouse for next iteration
			mousePrev = mousePos.clone();

		};

		/**
		 * Calculate distance to a vec2 from mouse position
		 * @param {THREE.Vector2} vec2
		 * @return {THREE.Vector2}
		 */
		this.distanceTo = function(vec2) {
			return mousePos.distanceTo(vec2);
		};

		this.pos = mousePos;

		//listen to updates from mouse
		window.addEventListener('mousemove', updateMouse, false);
		window.addEventListener('mousedown', mouseDown, false);
		window.addEventListener('mouseup', mouseUp, false);

		//destroy this, (probably not needed)
		this.destroy = function() {
			window.removeEventListener('mousemove', updateMouse, false);
			window.removeEventListener('mousedown', mouseDown, false);
			window.removeEventListener('mouseup', mouseUp, false);
		};

	};

}());

(function() {
'use strict';

	particles.WebGL = function(grid) {

		var renderer, scene, camera, cloud;
		var renderPass, trace, TiltVert, TiltHori, save;

		/**
		 * Creates a circle, which can be used as a canvas texture
		 * @return {THREE.Texture}
		 */
		var createTexture = function() {

			//use canvas object for shape
			var _canvas = document.createElement('canvas');
			var _context = _canvas.getContext('2d');

			//square dimensions
			_context.canvas.width = 32;
			_context.canvas.height = 32;

			//draw circle
			_context.fillStyle = 'rgba(250,255,255,1.0)';
			_context.beginPath();
			_context.arc(16, 16, 12, 0, 2 * Math.PI);
			_context.fill();

			//create texture
			var texture = new THREE.Texture(_canvas);
			texture.needsUpdate = true;

			return texture;

		};

		/**
		 * Initialize all Webgl elements
		 * @param {HtmlElement} container
		 */
		this.init = function(container) {

			var width = container.offsetWidth;
			var height = container.offsetHeight;

			//setup renderer
			// renderer = new THREE.WebGLRenderer({ alpha: true, preserveDrawingBuffer: true });
			renderer = new THREE.WebGLRenderer({ alpha: true, devicePixelRatio: 1, precision: 'mediump' });
			renderer.setSize( width, height );

			// renderer.autoClear = false;

			container.appendChild(renderer.domElement);
			this.canvas = renderer.domElement;

			//setup scene
			scene = new THREE.Scene();
			camera = new THREE.OrthographicCamera( width / -2, width / 2, height / 2, height / -2, 0, 2 );

			// camera.position.z = 1;

			//create geometry, all vertices represent one particle
			var geometry = new THREE.Geometry();

			for ( var i = 0 ; i < grid.bufferSize ; i++ ) {
				geometry.vertices.push( new THREE.Vector3( window.innerWidth / 2, window.innerHeight / 2, -1000 ) );
				geometry.colors.push( new THREE.Color('#cccccc') );
			}

			//create point cloud material, use custom texture
			var material = new THREE.PointsMaterial({
				size: 3.5,
				vertexColors: true,
				sizeAttenuation: false,
				map: createTexture()
			});

			material.alphaTest = 0.5;
			cloud = new THREE.Points( geometry, material );
			cloud.frustumCulled = false;

			//position in 3d space
			cloud.position.z = -1;
			cloud.position.x -= width / 2;
			cloud.position.y -= height / 2;

			//add to 3D space
			scene.add(cloud);

			//shortcut to geometry vertices, for easy changing of vertices
			this.particles = cloud.geometry.vertices;
			this.colors = cloud.geometry.colors;

			//create FX
			this.renderManager = new THREE.renderPipeline(renderer);
			renderPass = new THREE.RenderStep(width, height, scene, camera);
			trace = new THREE.ShaderStep(width, height);
			TiltVert = new THREE.ShaderStep(width, height);
			TiltHori = new THREE.ShaderStep(width, height);
			save = new THREE.ShaderStep(width, height);

			trace
				.import(function() {
					return [255, 255, 255, 0.1];
				})
				.setting('pathLength', 'f', 0.04)
				.link(renderPass, 'texRenderPass')
				.shader('vertex', THREE.TraceShader.vertexShader )
				.shader('fragment', THREE.TraceShader.fragmentShader );

			save
				.shader('vertex', THREE.CopyShader.vertexShader )
				.shader('fragment', THREE.CopyShader.fragmentShader )
				.pipe()
				.renderToScreen(true)
				.needSwap(false);

			var pos = 0.5;

			TiltVert
				.setting('v', 'f', 1 / height * 10)
				.setting('r', 'f', pos)
				.setting('spread', 'f', 1.4)
				.shader('vertex', THREE.VerticalTiltShiftShader.vertexShader)
				.shader('fragment', THREE.VerticalTiltShiftShader.fragmentShader)
				.pipe();

			TiltHori
				.setting('h', 'f', 1 / width * 10)
				.setting('r', 'f', pos)
				.setting('spread', 'f', 1.4)
				.shader('vertex', THREE.HorizontalTiltShiftShader.vertexShader)
				.shader('fragment', THREE.HorizontalTiltShiftShader.fragmentShader)
				.pipe();

			this.renderManager
				.pipe('render', renderPass)
				.pipe('trace', trace)
				.pipe('tilt-v', TiltVert)
				.pipe('tilt-h', TiltHori)
				.pipe('save', save)
				.start();

			//for DAT.GUI settings
			this.tracing = trace;
			this.tiltH = TiltHori;
			this.tiltV = TiltVert;
			this.material = material;

		};

		/**
		 * Indicate that particles have changed, so that they may get renderered again
		 */
		this.indicateChange = function() {
			cloud.geometry.verticesNeedUpdate = true;

			// cloud.geometry.dirtyVertices = true;
			cloud.geometry.colorsNeedUpdate = true;
		};

		/**
		 * Resize all webgl elements
		 */
		this.resize = function() {

			var camFactor = 2;
			renderer.setSize(grid.width, grid.height);
			camera.left = -grid.width / camFactor;
			camera.right = grid.width / camFactor;
			camera.top = grid.height / camFactor;
			camera.bottom = -grid.height / camFactor;
			camera.updateProjectionMatrix();

			cloud.position.x = grid.width / -2;
			cloud.position.y = grid.height / -2;

			//resize shaders
			// renderPass.setSize( grid.width, grid.height );
			trace.setSize( grid.width, grid.height );
			TiltVert.setSize( grid.width, grid.height );
			TiltHori.setSize( grid.width, grid.height );
			save.setSize( grid.width, grid.height );

		};

		/*
		 * Clears canvas
		 */
		this.clear = function() {
			renderer.clear();
		};

	};

}());

(function() {

	'use strict';
	/* global console */

	/**
	 * Measure FPS to determine if particles are running smoothly
	 * @param {particles.World} word
	 * @param {Function} cb - Callback with test results, when test is completed
	 */
	particles.Stats = function(world, cb) {

		cb = cb || function() {
			console.warn('FPS is too low');
		};

		var frames = 0;
		var avgs = [];
		var sampleLength = 1000;
		var sampleSize = 10;

		var clock = world.webgl.renderManager.clock;
		var lastTime = clock.elapsedTime;
		var threshold = 30;

		window.setTimeout(function() {

			//add to render tick
			world.webgl.renderManager.pipe('stats', function() {

				frames++;
				var elapsed = clock.elapsedTime * 1000;

				if ( elapsed - lastTime > sampleLength) {

					var fps = Math.round( ( frames * 1000 ) / ( elapsed - lastTime ) );
					avgs.push(fps);

					//clear
					frames = 0;
					lastTime = elapsed;

				}

				if (avgs.length >= sampleSize) {

					//get total average
					var total = avgs.reduce(function(a, b) { return a + b; });
					var totalAvg = total / avgs.length;

					//check if below threshold, then provide callback
					cb(totalAvg < threshold, totalAvg, avgs);

					//stop this
					world.webgl.renderManager.remove('stats');

				}

			});

		}, 3000);

	};

}());

/**
 * @author alteredq / http://alteredqualia.com/
 *
 * Full-screen textured quad shader
 */

THREE.CopyShader = {

	vertexShader: [

		'varying vec2 vUv;',

		'void main() {',

			'vUv = uv;',
			'gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',

		'}'

	].join('\n'),

	fragmentShader: [

		'uniform sampler2D texData;',
		'varying vec2 vUv;',

		'void main() {',

			'gl_FragColor = texture2D( texData, vUv );',

		'}'

	].join('\n')

};

/**
 * @author alteredq / http://alteredqualia.com/
 *
 * Full-screen textured quad shader
 */

THREE.TraceShader = {

	vertexShader: [

		'varying vec2 vUv;',

		'void main() {',

			'vUv = uv;',
			'gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',

		'}'

	].join('\n'),

	fragmentShader: [

		'uniform sampler2D texData;',
		'uniform sampler2D texRenderPass;',
		'uniform float pathLength;',
		'varying vec2 vUv;',

		'void main() {',

			'vec4 texel = texture2D( texData, vUv );',
			'vec4 texelNew = texture2D( texRenderPass, vUv );',
			'vec4 mixed = mix(texel, texelNew, pathLength);',
			'mixed = clamp(mixed, 0.0, 0.85);',
			'gl_FragColor = mixed;',

		'}'

	].join('\n')

};

(function() {

	'use strict';

	THREE.renderPipeline = function(renderer) {

		var list = [];

		//create clock
		var clock = new THREE.Clock();
		this.clock = clock;

		var search = function(name) {

			for ( var i = 0 ; i < list.length ; i++ ) {

				if ( list[i].name === name) {
					return i;
				}

			}

		};

		var createShader = function() {

			for ( var i = 0 ; i < list.length ; i++ ) {

				if (!list[i].isCreated && list[i].create) {
					list[i].create(renderer);
					list[i].isCreated = true;
				}

			}

		};

		var createProcess = function(name, step, place) {

			var _process = {
				'name': name,
				'render': step,
				'process': {
					'active': true,
					'runOnce': false
				}
			};

			if (step instanceof THREE.ShaderStep || step instanceof THREE.RenderStep) {
				_process.create = step.create;
				_process.render = step.render;
			}

			//process controls
			if (step.process) {
				_process.process = step.process;
			}

			//add to list
			if (!place) {
				list.push(_process);
			} else {
				list.splice(place, 0, _process);
			}

			//create shader?
			if (isStarted) {
				createShader();
			}

		};

		this.pipe = function(name, step) {
			createProcess(name, step);

			//chainable
			return this;
		};

		this.before = function(before, name, step) {
			createProcess(name, step, search(name) );

			//chainable
			return this;
		};

		this.after = function(after, name, step) {
			createProcess(name, step, search(name) + 1 );

			//chainable
			return this;
		};

		this.remove = function(name) {
			var index = search(name);
			list.splice(index, 1);

			//chainable
			return this;
		};

		this.clear = function() {
			list = [];

			//chainable
			return this;
		};

		var play = false;
		var isStarted = false;
		var currentRender;

		var render = function() {

			//stop when needed
			if (!play) {
				return false;
			}

			//get delta since last run
			var delta = clock.getDelta();
			var currentOutput;

			for ( var i = 0 ; i < list.length ; i++ ) {

				if (list[i].process.active) {
					currentOutput = list[i].render(delta, currentOutput);
				}

				if (list[i] && list[i].process.runOnce) {
					list[i].process.active = false;
					list[i].process.runOnce = false;
				}

			}

			//schedule next frame
			currentRender = requestAnimationFrame( render );

		};

		this.start = function() {

			createShader();
			isStarted = true;

			if (!play) {
				play = true;
				cancelAnimationFrame(currentRender);
				render();
			}

			//chainable
			return this;

		};

		this.stop = function() {

			play = false;
			cancelAnimationFrame(currentRender);

			//chainable
			return this;

		};

	};

}());

(function() {

	'use strict';
	/*jshint camelcase: false */

	THREE.ShaderStep = function(width, height) {

		var renderer;

		//settings
		this.textureId = 'texData';
		this.uniforms = {};
		this.vertexShader = '';
		this.fragmentShader = '';

		//create swap buffers
		var buffer1 = new THREE.WebGLRenderTarget(width, height, {
			minFilter: THREE.NearestFilter,
			magFilter: THREE.NearestFilter,
			type: THREE.FloatType,
			stencilBuffer:false,
			depthBuffer:false
		});
		buffer1.texture.generateMipmaps = false;
		var buffer2 = buffer1.clone();
		this.writeBuffer = buffer1;
		this.readBuffer = buffer2;

		//create scene variables
		var camera = new THREE.OrthographicCamera( -1, 1, 1, -1, 0, 1 );
		var geom = new THREE.PlaneBufferGeometry( 2, 2 );
		var scene = new THREE.Scene();
		var CustomMesh = THREE.Mesh;
		var startImage, mesh, renderToScreen, pipe;
		var needSwap = true;

		this._camera = camera;

		this.process = {
			active: true,
			runOnce: false
		};

		/**
		 * from own RenderTarget
		 * @param {THREE.WebGLRenderTarget} renderTarget
		 * @return {this} - Chainable
		 */
		this.fromRenderTarget = function(renderTarget) {
			buffer1 = renderTarget.clone();
			buffer2 = buffer1.clone();

			return this;
		};

		this.camera = function(_camera) {
			camera = _camera;
			return this;
		};

		/**
		 * Set geometry, else it will be plane geom
		 * @param {THREE.Geometry} geo
		 * @return {this} - Chainable
		 */
		this.geometry = function(geo) {
			geom = geo;
			this.CUSTOMGEOM = true;
			return this;
		};

		/**
		 * Set mesh creation function
		 * @param {Function} build - Function to build mesh
		 * @return {this} - Chainable
		 */
		this.mesh = function(build) {
			CustomMesh = build || THREE.Mesh;
			return this;
		};

		/**
		 * Render to screen (useful for a save/copy pass)
		 * @param {boolean} save
		 * @return {this} - Chainable
		 */
		this.renderToScreen = function(save) {
			renderToScreen = save || true;
			return this;
		};

		this.needSwap = function(_need) {
			needSwap = _need;
			return this;
		};

		/**
		 * Use output of previous shader
		 * @param {boolean} save
		 * @return {this} - Chainable
		 */
		this.pipe = function(save) {
			pipe = save || true;
			return this;
		};

		/**
		 * Uniform settings
		 * @param {string} name
		 * @param {string} type
		 * @param {*} value
		 * @return {this} - Chainable
		 */
		this.setting = function(name, type, value) {

			if (this.uniforms[name]) {

				//change value
				this.uniforms[name].value = value;

			} else {

				//add uniform
				this.uniforms[name] = {
					'type': type,
					'value': value
				};

			}

			return this;

		};

		/**
		 * Link to another shader
		 * @param {THREE.ShaderStep} shaderStep
		 * @param {string} name - Name of uniform
		 * @return {this|Buffer} - Chainable or image buffer to use in other shaders
		 */
		this.link = function(shaderStep, name) {

			name = name || 'compute';

			//when not given andother shader this shader is being linked into another shader
			if (!shaderStep) {
				return this.writeBuffer;
			}

			//add to uniforms list
			this.uniforms[name] = {
				'type': 't',
				'value': shaderStep.link()
			};

			return this;

		};

		/**
		 * Link shaders
		 * @param {string} type - Fragment or vertex
		 * @param {string|Array} shader
		 * @return {this} - Chainable
		 */
		this.shader = function(type, shader) {

			//assign to right key
			var key = type === 'fragment' || type === 'fragmentShader' ? 'fragmentShader' : 'vertexShader';

			//when an array join
			if ( shader instanceof Array ) {
				shader = shader.join('\n');
			}

			//save
			this[key] = shader;

			//chainable
			return this;

		};

		/**
		 * Create shader
		 * @private
		 */
		this.create = function(_renderer) {

			//create material
			if (!geom) {
				geom = new THREE.PlaneGeometry( 2, 2 );
			}

			//link to self
			this.uniforms[this.textureId] = {
				'type': 't',
				'value': this.readBuffer
			};

			//send resolution & time
			this.uniforms.u_resolution = {
				'type': 'v2',
				'value': new THREE.Vector2(width, height)
			};
			this.uniforms.u_time = {
				'type': 'f',
				'value': 0.0
			};

			//create shader
			var material = new THREE.ShaderMaterial({

				uniforms: this.uniforms,
				vertexShader: this.vertexShader,
				fragmentShader: this.fragmentShader

			});

			//create geometry
			mesh = new CustomMesh( geom, material );
			scene.add( mesh );

			//save reference to renderer
			renderer = _renderer;

		}.bind(this);

		/**
		 * Resize buffer, resets data
		 * @param {number} width
		 * @param {number} height
		 */
		this.setSize = function(_width, _height) {

			buffer1.setSize( _width, _height );
			buffer2.setSize( _width, _height );

		};

		/**
		 * Swap buffers because you can't read and write to same buffer
		 */
		this.swap = function() {

			var tmp = this.readBuffer;
			this.readBuffer = this.writeBuffer;
			this.writeBuffer = tmp;

		};

		/**
		 * Import image from JS as starting point for shader
		 * @param {domElement|Function} - Image/canvas element or callback function to create image
		 * @return {this} - Chainable
		 */
		this.import = function(img) {

			if (img instanceof Function) {

				startImage = document.createElement('canvas');
				startImage.width = THREE.Math.nearestPowerOfTwo( width );
				startImage.height = THREE.Math.nearestPowerOfTwo( height );
				var context = startImage.getContext('2d');
				var imageData = context.createImageData(width, height);

				var setPixel = function(imageData, x, y, color) {
					var index = (x + y * imageData.width) * 4;
					imageData.data[index + 0] = color[0];
					imageData.data[index + 1] = color[1];
					imageData.data[index + 2] = color[2];
					imageData.data[index + 3] = color[3] || 255;
				};

				for (var x = 0 ; x < width ; x++) {
					for (var y = 0 ; y < height ; y++) {

						var pixel = img(x, y);
						setPixel(imageData, x, y, pixel);

					}
				}

				context.putImageData(imageData, 0, 0);

				// console.log(startImage.toDataURL())

			} else {

				startImage = img;

			}

			return this;

		};

		/**
		 * Export shader to image so it's readable by JS again
		 * @param {boolean} convert - Convert to pixel array
		 */
		this.export = function(convert) {

			convert = convert || true;

			//don't convert, just pass buffer
			if (!convert) {
				return this.readBuffer;
			}

			var pixels = new Uint8Array(4 * width * height); // be careful - allocate memory only once

			var gl = renderer.context;
			var framebuffer = this.readBuffer.__webglFramebuffer;
			gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
			gl.viewport(0, 0, width, height);
			gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);

			var data = [];

			//make better readable
			for ( var x = 0 ; x < width ; x++ ) {

				data.push([]);

				for ( var y = 0 ; y < height ; y++ ) {
					var startIndex = ((x * width) + y) * 4;

					//get RGBA pixels
					data[x][y] = [
						pixels[startIndex],
						pixels[startIndex + 1],
						pixels[startIndex + 2],
						pixels[startIndex + 3]
					];
				}
			}

			return data;

		};

		/**
		 * Enable/disable rendering of this shader
		 * @param {boolean} active
		 * @return {this} - Chainable
		 */
		this.enable = function(active) {
			this.process.active = active || true;
			return this;
		};

		/**
		 * Enable rendering of this shader for only one iteration
		 * @param {boolean} run
		 * @return {this} - Chainable
		 */
		this.runOnce = function(run) {
			this.process.runOnce = run || true;
			return this;
		};

		/**
		 * Render a frame
		 */
		this.render = function(delta, previousStep) {

			//use correct readBuffer
			this.uniforms[ this.textureId ].value = this.readBuffer;

			//send previous step to shader
			if (pipe) {
				this.uniforms[ this.textureId ].value = previousStep;
			}

			//start image?
			if (startImage) {
				startImage = new THREE.Texture(startImage);
				startImage.needsUpdate = true;
				this.uniforms[ this.textureId ].value = startImage;
			}

			//update time
			this.uniforms.u_time.value += 0.05;

			//render
			if (renderToScreen) {
				renderer.render( scene, camera );
			} else {
				renderer.render( scene, camera, this.writeBuffer, false );
			}

			var output = this.writeBuffer;

			//swap again for next itteration
			if (needSwap) {
				this.swap();
			}

			//remove start image after render
			startImage = undefined;

			//send output to next step
			return output;

		}.bind(this);

	};

}());

(function() {

	'use strict';

	THREE.RenderStep = function(width, height, scene, camera) {

		var renderer;
		var buffer = new THREE.WebGLRenderTarget(width, height, {
			minFilter: THREE.NearestFilter,
			magFilter: THREE.NearestFilter,
			type: THREE.FloatType,
			stencilBuffer:false,
			depthBuffer:false
		});
		buffer.texture.generateMipmaps = false;

		/**
		 * Do resize of buffer
		 * @param {number} width
		 * @param {number} height
		 */
		this.setSize = function(_width, _height) {

			width = _width;
			height = _height;

			//cloning of buffers, and set new size
			buffer.setSize(_width, _height);

			return this;
		};

		/**
		 * Link to another shader
		 * @return {Buffer} - WebGL Buffer to use in other shaders
		 */
		this.link = function() {
			return buffer;
		};

		/**
		 * Bind to WebGL renderer
		 * @private
		 */
		this.create = function(_renderer) {
			renderer = _renderer;
		};

		/**
		 * Render a frame
		 * @return {Buffer} Reference to rendered buffer
		 */
		this.render = function() {

			renderer.render( scene, camera, buffer );
			return buffer;

		}.bind(this);

	};

}());

/**
 * @author alteredq / http://alteredqualia.com/
 *
 * Simple fake tilt-shift effect, modulating two pass Gaussian blur (see above) by vertical position
 *
 * - 9 samples per pass
 * - standard deviation 2.7
 * - 'h' and 'v' parameters should be set to '1 / width' and '1 / height'
 * - 'r' parameter control where 'focused' horizontal line lies
 */

THREE.HorizontalTiltShiftShader = {

	uniforms: {

		'texData': { type: 't', value: null },
		'h':        { type: 'f', value: 1.0 / 512.0 },
		'r':        { type: 'f', value: 0.35 },
		'spread':   { type: 'f', value: 1.2 }

	},

	vertexShader: [

		'varying vec2 vUv;',

		'void main() {',

			'vUv = uv;',
			'gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',

		'}'

	].join('\n'),

	fragmentShader: [

		'uniform sampler2D texData;',
		'uniform float h;',
		'uniform float r;',
		'uniform float spread;',

		'varying vec2 vUv;',

		'void main() {',

			'vec4 sum = vec4( 0.0 );',

			'float hh = h * pow( abs( r - vUv.y) , spread);',

			'sum += texture2D( texData, vec2( vUv.x - 4.0 * hh, vUv.y ) ) * 0.051;',
			'sum += texture2D( texData, vec2( vUv.x - 3.0 * hh, vUv.y ) ) * 0.0918;',
			'sum += texture2D( texData, vec2( vUv.x - 2.0 * hh, vUv.y ) ) * 0.12245;',
			'sum += texture2D( texData, vec2( vUv.x - 1.0 * hh, vUv.y ) ) * 0.1531;',
			'sum += texture2D( texData, vec2( vUv.x, vUv.y ) ) * 0.1633;',
			'sum += texture2D( texData, vec2( vUv.x + 1.0 * hh, vUv.y ) ) * 0.1531;',
			'sum += texture2D( texData, vec2( vUv.x + 2.0 * hh, vUv.y ) ) * 0.12245;',
			'sum += texture2D( texData, vec2( vUv.x + 3.0 * hh, vUv.y ) ) * 0.0918;',
			'sum += texture2D( texData, vec2( vUv.x + 4.0 * hh, vUv.y ) ) * 0.051;',

			'gl_FragColor = sum;',

		'}'

	].join('\n')

};

/**
 * @author alteredq / http://alteredqualia.com/
 *
 * Simple fake tilt-shift effect, modulating two pass Gaussian blur (see above) by vertical position
 *
 * - 9 samples per pass
 * - standard deviation 2.7
 * - 'h' and 'v' parameters should be set to '1 / width' and '1 / height'
 * - 'r' parameter control where 'focused' horizontal line lies
 */

THREE.VerticalTiltShiftShader = {

	uniforms: {

		'texData': { type: 't', value: null },
		'v':        { type: 'f', value: 1.0 / 512.0 },
		'r':        { type: 'f', value: 0.35 },
		'spread':   { type: 'f', value: 1.2 }

	},

	vertexShader: [

		'varying vec2 vUv;',

		'void main() {',

			'vUv = uv;',
			'gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',

		'}'

	].join('\n'),

	fragmentShader: [

		'uniform sampler2D texData;',
		'uniform float v;',
		'uniform float r;',
		'uniform float spread;',

		'varying vec2 vUv;',

		'void main() {',

			'vec4 sum = vec4( 0.0 );',

			'float vv = v * pow( abs( r - vUv.y ) ,spread);',

			'sum += texture2D( texData, vec2( vUv.x, vUv.y - 4.0 * vv ) ) * 0.051;',
			'sum += texture2D( texData, vec2( vUv.x, vUv.y - 3.0 * vv ) ) * 0.0918;',
			'sum += texture2D( texData, vec2( vUv.x, vUv.y - 2.0 * vv ) ) * 0.12245;',
			'sum += texture2D( texData, vec2( vUv.x, vUv.y - 1.0 * vv ) ) * 0.1531;',
			'sum += texture2D( texData, vec2( vUv.x, vUv.y ) ) * 0.1633;',
			'sum += texture2D( texData, vec2( vUv.x, vUv.y + 1.0 * vv ) ) * 0.1531;',
			'sum += texture2D( texData, vec2( vUv.x, vUv.y + 2.0 * vv ) ) * 0.12245;',
			'sum += texture2D( texData, vec2( vUv.x, vUv.y + 3.0 * vv ) ) * 0.0918;',
			'sum += texture2D( texData, vec2( vUv.x, vUv.y + 4.0 * vv ) ) * 0.051;',

			'gl_FragColor = sum;',

		'}'

	].join('\n')

};
