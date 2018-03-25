(function() {
	'use strict';
	var routeTimeout = 300;

	/**
	 * Check if we're running on the production environment.
	 * @type {boolean}
		*/
	var debug = false;
	angular
		.module('cf-website', [ 'ui.router', 'ngAnimate', 'ngSanitize', 'duScroll', 'bc.Flickity', 'ec.stickyfill'])
		.value('duScrollGreedy', true)
		.value('duScrollBottomSpy', true)
		.config([
			'$stateProvider',
			'$urlRouterProvider',
			'$compileProvider',
			'$locationProvider',
			'$urlMatcherFactoryProvider',
			'FlickityConfigProvider',
			function(
				$stateProvider,
				$urlRouterProvider,
				$compileProvider,
				$locationProvider,
				$urlMatcherFactoryProvider,
				FlickityConfigProvider
			) {
				// Default Flickity options
				FlickityConfigProvider.cellAlign = 'left';
				FlickityConfigProvider.friction = 0.45;
				FlickityConfigProvider.selectedAttraction = 0.05;
				FlickityConfigProvider.arrowShape = {
					x0: 15,
					x1: 60,
					y1: 45,
					x2: 65,
					y2: 40,
					x3: 25
				};

				//Use pretty urls
				$locationProvider.html5Mode(true);
				$urlMatcherFactoryProvider.strictMode(true);
				$compileProvider.debugInfoEnabled(debug);
				$urlRouterProvider.otherwise('/404');

				function retrieveJSON($q, API, $timeout, url) {
					var deferred = $q.defer();

					function onload(result) {
						if (result.data.slug === 'home' || result.data.slug === 'work') {
							result.data.route = result.data.slug;
						} else {
							result.data.route = url.includes('work') ? 'project' : 'page';
						}

						$timeout(function() {
							deferred.resolve(result);
						}, routeTimeout);
					}

					function onerror(error) {
						deferred.reject(error);
					}

					API.retrieve(url).then(onload, onerror);
					return deferred.promise;
				}

				// Home
				$stateProvider.state('home', {
						url: '/',
						controller: 'HomeCtrl',
						templateUrl: 'app/home/home.tpl.html',
						resolve: {
							JSONdata: ["$q", "API", "$timeout", function($q, API, $timeout) {
								return retrieveJSON($q, API, $timeout, 'home.json');
							}]
						}
					})
					// Work Overview
					.state('work', {
						url: '/work',
						urlSlug: 'work',
						controller: 'WorkCtrl',
						templateUrl: 'app/work/work.tpl.html',
						resolve: {
							JSONdata: ["$q", "API", "$timeout", function($q, API, $timeout) {
								return retrieveJSON($q, API, $timeout, 'work.json');
							}]
						}
					})
					// Case page
					.state('project', {
						url: '/work/:urlSlug',
						controller: 'PageCtrl',
						templateUrl: 'app/page/page.tpl.html',
						resolve: {
							JSONdata: ["$q", "API", "$stateParams", "$timeout", function($q, API, $stateParams, $timeout) {
								return retrieveJSON($q, API, $timeout, 'work/' + $stateParams.urlSlug + '.json');
							}]
						}
					})
					// Pages
					.state('page', {
						url: '/:urlSlug',
						controller: 'PageCtrl',
						templateUrl: 'app/page/page.tpl.html',
						resolve: {
							JSONdata: ["$q", "API", "$stateParams", "$timeout", function($q, API, $stateParams, $timeout) {
								return retrieveJSON($q, API, $timeout, $stateParams.urlSlug + '.json');
							}]
						}
					});
			}
		])
		.run(["$rootScope", "$state", "$log", "$timeout", function($rootScope, $state, $log, $timeout) {
			$rootScope.$on('$stateChangeStart', function($current, $next) {
				if ($next.name !== 'work' && $next.name !== 'project') {
					// reset position when not going to work overview page or case
					$rootScope.lastActiveCase = undefined;
				}

				// reset scroll state on view change
				$timeout(function() {
					// let controller itself decide what scroll position needs to be
					if ($next.name === 'work' && $rootScope.lastActiveCase) {
						return false;
					}

					angular.element(document).scrollTop(0);
					$rootScope.$broadcast('after-view-change');
				}, routeTimeout + 100);
			});

			// On state change error redirect to 404 page and log error message
			$rootScope.$on('$stateChangeError', function(
				event,
				toState,
				toParams,
				fromState,
				fromParams,
				error
			) {
				$log.error(error);
				$state.go('page', { urlSlug: '404' });
			});

			// Track page views after successful route changes
			$rootScope.$on('$stateChangeSuccess', function(event, toState, toParams) {
				if (window.ga) {
					var path = '';

					if (toState.name === 'work') {
						path = 'work';
					} else if (toState.name === 'project') {
						path = 'work/' + toParams.urlSlug;
					} else if (toState.name === 'page') {
						path = toParams.urlSlug;
					}

					var relativeUrl = '/' + path;
					ga('set', 'page', relativeUrl);
					ga('send', 'pageview');
				}
			});

			// onintersect is called when an observed element appears in the viewhold,
			// with a ratio of the set threshold. It broadcasts an event, emitting the target DOM node.
			$rootScope.onIntersect = function(entries, observer) {
				entries.forEach(function(entry) {
					if (isVisible(entry.boundingClientRect, entry.intersectionRect, observer)) {
						$rootScope.$broadcast('intersectionChange', {
							target: entry.target
						});
					}
				});
			};

			// create a new observer for a specific element.
			$rootScope.createObserver = function(threshold) {
				return new IntersectionObserver($rootScope.onIntersect, {
					threshold: threshold
				});
			};

			// isVisible checks in how far the DOM element is visible in the viewport
			function isVisible(boundingClientRect, intersectionRect, observer) {
				return (
					intersectionRect.width *
						intersectionRect.height /
						(boundingClientRect.width * boundingClientRect.height) >=
					observer.thresholds[0]
				);
			}

			// put this here for IE, otherwise event won't trigger
			angular.element(window).one('load', function() {
				$rootScope.$broadcast('page-load');
			});

			//hire text
			if (/PhantomJS/.test(window.navigator.userAgent) === false) {
				var hire = [
					'#################################################################',
					'PLEASE JOIN THE C°F TEAM',
					'',
					'We’re always looking for talented developers who would like to join our team:',
					'Check: http://jobs.cleverfranke.com',
					'################################################################'
				];

				$log.info(hire.join('\n'));
			}
		}]);
})();

angular.module("cf-website").run(["$templateCache", function($templateCache) {$templateCache.put("app/home/home.tpl.html","<div class=\"home__container view__container section section--black\" ng-class=\"{\'home__container--full\':!overlay}\">\n\n	<!-- background -->\n	<div class=\"fixed-bg__container\" ng-if=\"block.fallbackImage\">\n		<img\n			class=\"fixed-bg__image\"\n			ng-if=\"block.fallbackImage[\'scaled-versions\']\"\n			breakpoint-image\n			scaled-versions=\"{{ block.fallbackImage[\'scaled-versions\'] }}\"\n			sizes=\"(min-width: 1024px) 100vw, 100vw\"\n			data-width=\"{{ block.fallbackImage[\'scaled-versions\'][0].width }}\"\n			data-height=\"{{ block.fallbackImage[\'scaled-versions\'][0].height }}\"\n		>\n	</div>\n\n	<!-- slideshow -->\n	<ul class=\"home__slider\">\n		<li ng-repeat=\"image in images\" class=\"home__slider__item\" ng-class=\"{\'home__slider__item--active\': $index === currentSlide}\">\n			<img\n				breakpoint-image\n				scaled-versions=\"{{ image[\'scaled-versions\'] }}\"\n				sizes=\"(min-width: 1024px) 100vw, 180vw\"\n				data-width=\"{{ image[\'scaled-versions\'][0].width }}\"\n				data-height=\"{{ image[\'scaled-versions\'][0].height }}\">\n		</li>\n	</ul>\n\n	<!-- video -->\n	<div class=\"home home__video\">\n		<!-- HTML5 video -->\n		<div class=\"video__container home__video\" ng-class=\"{\'video__container--darken\':overlay}\">\n			<video\n				ng-if=\"useMP4 && block.vimeo_mp4_url\"\n				class=\"video--intro video-js vjs-sublime-skin home__video\"\n				controls=\"true\"\n				preload=\"metadata\"\n				width=\"100%\"\n				height=\"100%\"\n				videojs=\"{{block.vimeo_mp4_url}}\"\n				poster=\"{{block.fallbackImage.url}}\"\n			></video>\n		</div>\n\n		<!-- fallback for html5 video -->\n		<div ng-if=\"!useMP4\">\n			<iframe class=\"home__video__embed\" ng-src=\"{{embedUrl}}\" width=\"500\" height=\"281\" frameborder=\"0\" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>\n		</div>\n\n		<!-- overlay -->\n		<div class=\"home__video__overlay\" ng-class=\"{\'home__video__overlay--hide\':!overlay}\"></div>\n\n		<!-- close -->\n		<div class=\"home__video__close\" ng-class=\"{\'home__video__close--show\':!overlay}\" ng-show=\"!overlay\" ng-click=\"hideVideo()\"></div>\n	</div>\n\n	<!-- title -->\n	<div class=\"home__welcome clearfix\" ng-class=\"{\'home__welcome--hide\': !overlay}\">\n		<h1 class=\"heading heading--large heading--no-line\" ng-class=\"{\'home__title--hide\': usingParticles}\" ng-bind=\"block.introText.fallbackText\">\"</h1>\n		<!-- play video button -->\n		<div class=\"home__play-button\" ng-class=\"{\'home__play-button--hide\':!overlay, \'home__play-button--fallback\': !usingParticles}\">\n			<button class=\"btn btn--outer\" ng-click=\"watchVideo()\">\n				<span class=\"btn btn--small\">\n					<span class=\"btn__icon btn__icon--arrow-solid\"></span>\n				</span>\n				<span class=\"btn__label\" ng-bind=\"block[\'video_play_text\']\"></span>\n			</button>\n		</div>\n	</div>\n\n	<!-- logos -->\n	<div\n		class=\"home__clients-container\"\n		ng-class=\"{ \'home__clients-container--hide\': !overlay }\"\n	>\n		<ul class=\"home__clients\">\n			<li\n				class=\"home__clients__logo\"\n				ng-class=\"{\'home__clients__logo--not-mobile\': $index > 2}\"\n				ng-repeat=\"case in block.logos\"\n			>\n				<a\n					ng-if=\"case.url && case.linkToCase\"\n					ui-sref=\"project({ urlSlug: \'{{case.url}}\' })\"\n				>\n					<img\n						alt=\"{{case.image[\'alt-text\']}}\"\n						class=\"home__clients__logo__image\"\n						ng-src=\"{{case.image.url}}\"\n					/>\n				</a>\n				<a\n					ng-href=\"{{case.url}}\"\n					ng-if=\"case.url && !case.linkToCase\"\n					target=\"{{getTarget(case.url)}}\"\n				>\n					<img\n						alt=\"{{case.image[\'alt-text\']}}\"\n						class=\"home__clients__logo__image\"\n						ng-src=\"{{case.image.url}}\"\n					/>\n				</a>\n				<span ng-if=\"!case.url\">\n					<img\n						alt=\"{{case.image[\'alt-text\']}}\"\n						class=\"home__clients__logo__image\"\n						ng-src=\"{{case.image.url}}\"\n					/>\n				</span>\n			</li>\n		</ul>\n	</div>\n</div>\n");
$templateCache.put("app/page/page.tpl.html","<article class=\"page page--{{stateParams.urlSlug}}\">\n\n	<div ng-repeat=\"(key, block) in page.blocks\" ng-if=\"page\" readstate read-state-tracking=\"block.UUID\">\n\n		<!-- title -->\n		<div ng-if=\"block.type === \'title\'\">\n			<title-block block=\"block\"></title-block>\n		</div>\n\n		<!-- title with image block -->\n		<div ng-if=\"block.type === \'imagetitle\'\">\n			<image-title block=\"block\"></image-title>\n		</div>\n\n		<!-- introduction -->\n		<div ng-if=\"block.type === \'caseintro\'\">\n			<introduction block=\"block\"></introduction>\n		</div>\n\n		<!-- big-image -->\n		<div ng-if=\"block.type === \'aboutclient\'\">\n			<big-image block=\"block\"></big-image>\n		</div>\n\n		<!-- case-overview -->\n		<div ng-if=\"block.type === \'caseoverview\'\">\n			<case-overview block=\"block\"></case-overview>\n		</div>\n\n		<!-- carousel -->\n		<div ng-if=\"block.type === \'carousel\'\">\n			<carousel-block block=\"block\" key=\"key\"></carousel-block>\n		</div>\n\n		<!-- design -->\n		<div ng-if=\"block.type === \'designintro\'\">\n			<design-intro block=\"block\"></design-intro>\n		</div>\n\n		<!-- design video -->\n		<div ng-if=\"block.type === \'designvideo\'\">\n			<design-video block=\"block\"></design-video>\n		</div>\n\n		<!-- imagegrid -->\n		<div ng-if=\"block.type === \'imagegrid\'\">\n			<image-grid block=\"block\"></image-grid>\n		</div>\n\n		<!-- imagelist -->\n		<div ng-if=\"block.type === \'imagelist\'\">\n			<image-list block=\"block\"></image-grid>\n		</div>\n\n		<!-- statictext -->\n		<div ng-if=\"block.type === \'statictext\'\">\n			<static-text block=\"block\"></static-text>\n		</div>\n\n		<!-- tools overview -->\n		<div ng-if=\"block.type === \'tools\'\">\n			<tools-overview block=\"block\"></tools-overview>\n		</div>\n\n		<!-- toolkit list -->\n		<div ng-if=\"block.type === \'toolkit\'\">\n			<toolkit block=\"block\"></toolkit>\n		</div>\n\n		<!-- technology -->\n		<div ng-if=\"block.type === \'technology\'\">\n			<technology block=\"block\"></technology>\n		</div>\n\n		<!-- Publicity block -->\n		<div ng-if=\"block.type === \'casepublicity\'\">\n			<publicity block=\"block\"></publicity>\n		</div>\n\n		<!-- Stats block -->\n		<div ng-if=\"block.type === \'stats\'\">\n			<stats block=\"block\"></stats>\n		</div>\n\n		<!-- Awards block (Case page) -->\n		<div ng-if=\"block.type === \'caseawards\'\">\n			<case-awards block=\"block\"></case-awards>\n		</div>\n\n		<!-- Awards block (Case page) -->\n		<div ng-if=\"block.type === \'caselogos\'\">\n			<case-logos block=\"block\"></case-logos>\n		</div>\n\n		<!-- link -->\n		<div ng-if=\"block.type === \'link\'\">\n			<link-block block=\"block\"></link-block>\n		</div>\n\n		<!-- quote -->\n		<div ng-if=\"block.type === \'quote\'\">\n			<quote-block block=\"block\"></quote-block>\n		</div>\n\n		<!-- footer -->\n		<div ng-if=\"block.type === \'footer\'\">\n			<footer block=\"block\"></footer>\n		</div>\n\n		<!-- checkerboard -->\n		<div ng-if=\"block.type === \'checkerboard\'\">\n			<checkerboard block=\"block\" columns=\"2\"></checkerboard>\n		</div>\n\n		<!-- clients -->\n		<div ng-if=\"block.type === \'clients\'\">\n			<clients block=\"block\"></clients>\n		</div>\n\n		<!-- our values -->\n		<div ng-if=\"block.type === \'values\'\">\n			<our-values block=\"block\"></our-values>\n		</div>\n\n		<!-- awards -->\n		<div ng-if=\"block.type === \'awards\'\">\n			<awards block=\"block\"></awards>\n		</div>\n\n		<!-- juries -->\n		<div ng-if=\"block.type === \'juries\'\">\n			<juries block=\"block\"></juries>\n		</div>\n\n		<!-- media coverage -->\n		<div ng-if=\"block.type === \'media\'\">\n			<media-coverage block=\"block\"></media-coverage>\n		</div>\n\n		<!-- talks -->\n		<div ng-if=\"block.type === \'talks\'\">\n			<talks block=\"block\"></talks>\n		</div>\n\n		<!-- contact person -->\n		<div ng-if=\"block.type === \'contact\'\">\n			<contact-person block=\"block\"></contact-person>\n		</div>\n\n		<!-- contact persons -->\n		<div ng-if=\"block.type === \'contactpersons\'\">\n			<contact-persons block=\"block\"></contact-persons>\n		</div>\n\n		<!-- contact footer -->\n		<div ng-if=\"block.type === \'contactfooter\'\">\n			<contact-footer block=\"block\"></contact-footer>\n		</div>\n\n	</div>\n\n	<page-footer ng-if=\"isProject && page.blocks\" current-case=\"{{ stateParams.urlSlug }}\"></page-footer>\n\n</article>\n");
$templateCache.put("app/work/work.tpl.html","<div class=\"work-overview section section--black\">\n	<div ng-repeat=\"case in cases\">\n		<work-overview-item case=\"case\"></work-overview-item>\n	</div>\n</div>\n");
$templateCache.put("components/carousel/carousel.tpl.html","<div>\n	<ol class=\"carousel__items\">\n		<li\n			class=\"carousel__item\"\n			ng-repeat=\"slide in slides\"\n			ng-class=\"{\n				\'carousel__item--show--no-animation\': $index === current && direction === \'none\',\n				\'carousel__item--show--next\': $index === current && direction === \'next\',\n				\'carousel__item--show--previous\': $index === current && direction === \'previous\',\n				\'carousel__item--hide--next\': $index === last && direction === \'previous\',\n				\'carousel__item--hide--previous\': $index === last && direction === \'next\',\n				\'carousel__item--show\': $index === last || $index === current\n			}\"\n		>\n\n			<!-- Used when the carousel uses the full viewport width -->\n			<img\n				ng-if=\"breakOut() && slide.image[\'scaled-versions\']\"\n				ng-click=\"close()\"\n				class=\"carousel__image\"\n				alt=\"{{slide.image[\'alt-text\']}}\"\n				inview=\"lazyLoading\"\n				breakpoint-image\n				scaled-versions=\"{{ slide.image[\'scaled-versions\'] }}\"\n				sizes=\"(min-width: 1024px) 100vw, (min-width: 769px) calc(100vw + 500px), 100vw\"\n				data-width=\"{{ slide.image[\'scaled-versions\'][0].width }}\"\n				data-height=\"{{ slide.image[\'scaled-versions\'][0].height }}\">\n\n			<!-- Calculate the viewport width minus the sidebar -->\n			<img\n				ng-if=\"!breakOut() && slide.image[\'scaled-versions\']\"\n				ng-click=\"close()\"\n				class=\"carousel__image\"\n				alt=\"{{slide.image[\'alt-text\']}}\"\n				inview=\"lazyLoading\"\n				breakpoint-image\n				scaled-versions=\"{{ slide.image[\'scaled-versions\'] }}\"\n				sizes=\"(min-width: 1024px) calc(100vw - 224px), 100vw\"\n				data-width=\"{{ slide.image[\'scaled-versions\'][0].width }}\"\n				data-height=\"{{ slide.image[\'scaled-versions\'][0].height }}\">\n		</li>\n	</ol>\n\n	<ol class=\"carousel__indicators\" ng-if=\"slides.length > 1\">\n		<li class=\"carousel__indicator__hitbox\" ng-repeat=\"slide in slides\" ng-click=\"goTo($index)\">\n			<div class=\"carousel__indicator\" ng-class=\"{ \'carousel__indicator--active\': $index === current }\"></div>\n		</li>\n	</ol>\n\n	<button\n		ng-show=\"slides.length > 1\"\n		class=\"btn btn--large btn--thin-border btn-absolute btn-absolute--left\"\n		ng-click=\"previous()\">\n		<span class=\"btn__icon btn__icon--arrow btn__icon--left\"></span>\n	</button>\n\n	<button\n		ng-show=\"slides.length > 1\"\n		class=\"btn btn--large btn--thin-border btn-absolute btn-absolute--right\"\n		ng-click=\"next()\">\n		<span class=\"btn__icon btn__icon--arrow\"></span>\n	</button>\n\n</div>\n");
$templateCache.put("components/cf-logo/cf-logo.tpl.html","<div class=\"cf-logo\">\n	<a ui-sref=\"home\" class=\"cf-logo__link\" ng-click=\"triggerClose()\">C&deg;F</a>\n</div>\n");
$templateCache.put("components/flickity-image-list/flickity-image-list.tpl.html","<ul \n	class=\"images__list animation__list\" \n	id=\"{{flickityId}}\"	\n	inview>\n	<li\n		ng-repeat=\"(key, image) in images()\"\n		class=\"images__list-item animation animation--fade-in\"\n		ng-mousedown=\"handleMouseDown($event)\"\n		ng-mouseup=\"lightboxEnabled && openLightbox(key)\"\n		ng-mousemove=\"handleMouseMove($event)\"\n		inview\n	>\n		<!-- It could be an SVG, which doesn\'t have any resized versions -->\n		<img\n			ng-if=\"!image[\'scaled-versions\']\"\n			alt=\"{{ image[\'alt-text\'] }}\"\n			class=\"images__image\"\n			ng-src=\"{{ image.url }}\"\n		/>\n		<img\n			alt=\"{{ image[\'alt-text\'] }}\"\n			ng-if=\"image[\'scaled-versions\']\"			\n			breakpoint-image\n			class=\"images__image\"\n			sizes=\"{{getSizes()}}\"\n			data-height=\"{{ image[\'scaled-versions\'][0].height }}\"\n			data-width=\"{{ image[\'scaled-versions\'][0].width }}\"\n			scaled-versions=\"{{ image[\'scaled-versions\'] }}\"\n		/>\n	</li>\n</ul>\n");
$templateCache.put("components/lightbox/lightbox.tpl.html","<div>\n	<div\n		class=\"lightbox\"\n		id=\"lightbox\"\n		ng-hide=\"!isOpen\"\n	>\n		<div id=\"flickity-lightbox\">\n			<div\n				class=\"image\"\n				data-ng-repeat=\"(key, image) in images\"\n			>\n				<img\n					alt=\"{{ image[\'alt-text\'] }}\"\n					breakpoint-image\n					data-height=\"{{ image[\'scaled-versions\'][0].height }}\"\n					data-width=\"{{ image[\'scaled-versions\'][0].width }}\"\n					ng-src=\"{{ image.url }}\"\n					scaled-versions=\"{{ image[\'scaled-versions\'] }}\"\n					sizes=\"calc(100vw + 17px)\"\n				/>\n			</div>\n		</div>\n		<!-- close button -->\n		<button class=\"lightbox-close nav-toggle nav-toggle--hide\" ng-click=\"handleClose()\">\n			<div class=\"nav-toggle__icon\">\n				<div class=\"nav-toggle__icon__line nav-toggle__icon__line--1\"></div>\n				<div class=\"nav-toggle__icon__line nav-toggle__icon__line--2\"></div>\n			</div>\n			<span class=\"nav-toggle__sr-only\">Close</span>\n		</button>\n	</div>\n</div>\n");
$templateCache.put("components/navigation/navigation.tpl.html","<div class=\"nav-toggle\" ng-click=\"showMenu = !showMenu\" ng-tap=\"showMenu = !showMenu\" ng-class=\"{\'nav-toggle--hide\':showMenu}\">\n\n	<div class=\"nav-toggle__icon\">\n\n		<div class=\"nav-toggle__icon__line nav-toggle__icon__line--1\"></div>\n		<div class=\"nav-toggle__icon__line nav-toggle__icon__line--2\"></div>\n		<div class=\"nav-toggle__icon__line nav-toggle__icon__line--3\"></div>\n\n	</div>\n\n</div>\n\n<div class=\"navigation\" ng-class=\"{\'navigation--show\':showMenu}\">\n\n	<div class=\"nav-menu-wrapper\">\n\n		<div class=\"nav-menu-table\">\n\n			<div class=\"nav-menu-center\">\n\n				<nav class=\"nav-menu nav-menu--pages\">\n					<ul class=\"nav-menu__list\" ng-click=\"showMenu = false\">\n\n						<li\n							ng-repeat=\"item in navigation\"\n							class=\"nav-menu__list-item\"\n							ng-class=\"{\n								\'nav-menu__list-item--active\': isActive(item.slug)\n							}\">\n\n							<a\n								ng-if=\"item.type === \'home\'\"\n								class=\"nav-menu__list-item__link\"\n								ui-sref=\"home\">\n								<span ng-bind=\"item.name\"></span>\n							</a>\n							<a\n								ng-if=\"item.type === \'work\'\"\n								class=\"nav-menu__list-item__link\"\n								ui-sref=\"work\">\n								<span ng-bind=\"item.name\"></span>\n							</a>\n							<!-- Fire a conversion event on the contact link -->\n							<a\n								ng-if=\"item.type === \'page\' && item.name === \'Contact\'\"\n								class=\"nav-menu__list-item__link\"\n								ui-sref=\"page({ urlSlug: item.slug })\"\n								conversion-on-click=\"{ label: \'xtn-CJqo2moQw77m2AM\' }\">\n								<span ng-bind=\"item.name\"></span>\n							</a>\n							<a\n								ng-if=\"item.type === \'page\' && item.name !== \'Contact\'\"\n								class=\"nav-menu__list-item__link\"\n								ui-sref=\"page({ urlSlug: item.slug })\">\n								<span ng-bind=\"item.name\"></span>\n							</a>\n\n							<!-- indent for sub pages -->\n							<navigation-indent\n								projectName=\"projectNames\"\n								name=\"{{ item.slug }}\"\n								indicators=\"indicators\"\n								menu-names=\"menuNames\"\n								current=\"current\"\n								active=\"active\"\n								hides=\"hides\">\n							</navigation-indent>\n\n							<!-- All cases on work overview page -->\n							<div\n								ng-if=\"item.type === \'work\'\"\n								class=\"nav-menu__expand nav-menu--work\"\n								expand=\"isWorkOverviewPage\"\n							>\n\n								<ul class=\"nav-menu__list nav-menu__list--indent\">\n\n									<li\n										ng-repeat=\"case in cases\"\n										class=\"nav-menu__list-item\"\n										ng-class=\"{ \'nav-menu__list-item--active\': case.caseId === _active && isWorkOverviewPage}\"\n									>\n											<a\n												class=\"nav-menu__list-item__link\"\n												du-scrollspy\n												ui-sref=\"project({urlSlug: case.caseId})\"\n												ng-href=\"#{{case.caseId}}\"\n											>\n												<span ng-bind=\"case.shortName\"></span>\n											</a>\n									</li>\n\n\n								</ul>\n\n							</div>\n\n						</li>\n\n					</ul>\n				</nav>\n\n\n			</div>\n\n		</div>\n\n	</div>\n\n	<ul class=\"nav-menu__social-links\">\n		<li class=\"nav-menu__social-links__item\">\n			<a href=\"https://twitter.com/cleverfranke\" target=\"_blank\" rel=\"noopener noreferrer\" social=\"twitter\"><img ng-src=\"images/logos/social-twitter.svg\" alt=\"Twitter\"></a>\n		</li>\n		<li class=\"nav-menu__social-links__item\">\n			<a href=\"https://www.facebook.com/cleverfranke\" target=\"_blank\" rel=\"noopener noreferrer\" social=\"facebook\"><img ng-src=\"images/logos/social-facebook.svg\" alt=\"Facebook\"></a>\n		</li>\n		<li class=\"nav-menu__social-links__item\">\n			<a href=\"https://www.instagram.com/cleverfranke/\" target=\"_blank\" rel=\"noopener noreferrer\" social=\"instagram\"><img ng-src=\"images/logos/social-instagram.svg\" alt=\"Instagram\"></a>\n		</li>\n		<li class=\"nav-menu__social-links__item\">\n			<a href=\"https://www.linkedin.com/company/clever-franke\" target=\"_blank\" rel=\"noopener noreferrer\" social=\"linkedin\"><img ng-src=\"images/logos/social-linkedin.svg\" alt=\"Linkedin\"></a>\n		</li>\n	</ul>\n\n</div>\n");
$templateCache.put("components/navigation-indent/navigation-indent.tpl.html","<div\n	class=\"nav-menu__expand\"\n	expand=\"expand\">\n	<ul class=\"nav-menu__list nav-menu__list--indent\">\n		<!-- heading can be empty so it will provide a top maring -->\n		<li class=\"nav-menu__list-item__heading\" ng-show=\"menuNames[name]\" ng-bind=\"menuNames[name]\"></li>\n\n		<li\n			ng-repeat=\"indicator in indicators[name]\"\n			class=\"nav-menu__list-item\"\n			ng-class=\"{\n				\'nav-menu__list-item--active\': indicator.tracking === active && expand\n			}\">\n					<a\n						class=\"nav-menu__list-item__link\"\n						ng-href=\"#{{indicator.tracking}}\"\n						du-smooth-scroll\n						du-scrollspy\n						tabindex=\"{{tabindex}}\"\n						>\n						<span ng-bind=\"indicator.name\"></span>\n					</a>\n		</li>\n	</ul>\n</div>\n");
$templateCache.put("components/notification/notification.tpl.html","<div\n	ng-if=\"isEnabled\"\n	class=\"notification notification--{{ notification.type }}\"\n	ng-class=\"{\n		\'notification--hide\': hidden\n	}\">\n	<div ng-if=\"notification.type === \'error\'\" class=\"notification__sign\"></div>\n	<span ng-bind=\"notification.message\"></span> ​\n	<span class=\"notification__activate\" ng-click=\"reactivate()\" ng-bind=\"notification.cta\"></span>\n	<div class=\"notification__close\" ng-click=\"hidden = !hidden\"></div>\n</div>\n");
$templateCache.put("components/page-footer/page-footer.tpl.html","<aside class=\"page-footer section section--black\">\n	<a\n		class=\"page-footer__item\"\n		ng-repeat=\"case in nextCases track by $index\"\n		ui-sref=\"project({ urlSlug: case.caseId })\"\n		footer=\"project\"\n	>\n		<img\n			alt=\"{{ case.clientLogo[\'alt-text\'] }}\"\n			breakpoint-image\n			class=\"page-footer__image\"\n			scaled-versions=\"{{ case.image[\'scaled-versions\'] }}\"\n			sizes=\"(min-width: 1024px) calc((100vw / 2) - 14rem), 100vw\"\n		>\n		<div class=\"page-footer__content\">\n			<span class=\"call-to-action\" ng-if=\"$index === 0\">\n				<span class=\"icon-arrow icon-arrow--left\"></span> Previous case\n			</span>\n			<span class=\"call-to-action\" ng-if=\"$index === 1\">\n				Next case <span class=\"icon-arrow icon-arrow--right\"></span>\n			</span>\n			<h2 class=\"title\" ng-bind=\"case.shortName\">\n			</h2>\n		</div>\n	</a>\n</aside>\n");
$templateCache.put("components/particles/particles.tpl.html","<div class=\"particles__container\" inview=\"play\"></div>\n");
$templateCache.put("components/work-overview-item/work-overview-item.tpl.html","<div\n	class=\"work-overview__item\"\n	ng-class=\"{\'work-overview__item--selected\': hover}\"\n	ng-attr-id=\"{{case.UUID}}\"\n	>\n	<!-- background -->\n	<div class=\"work-overview__image-container\">\n		<img\n			class=\"fixed-bg__image-fit\"\n			ng-if=\"case.image[\'scaled-versions\']\"\n			breakpoint-image\n			scaled-versions=\"{{ case.image[\'scaled-versions\'] }}\"\n			sizes=\"(min-width: 769px) 100vw, 100vw\"\n			data-width=\"{{ case.image[\'scaled-versions\'][0].width }}\"\n			data-height=\"{{ case.image[\'scaled-versions\'][0].height }}\"\n		>\n	</div>\n\n	<div class=\"work-overview__item__placeholder\" readstate read-state-tracking=\"case.UUID\"></div>\n\n	<div class=\"work-overview__item__container\" ng-show=\"isActive || isIE\">\n		<div class=\"work-overview__item__inner\">\n			<!-- logo -->\n			<div class=\"work-overview__item__logo-placeholder\" ng-class=\"{\'work-overview__item__logo-placeholder--no-logo\': !case.clientLogo.url}\">\n				<img class=\"work-overview__item__logo\" ng-src=\"{{case.clientLogo.url}}\" alt=\"{{case.clientLogo[\'alt-text\']}}\" ng-if=\"case.clientLogo\">\n			</div>\n\n			<!-- text -->\n			<h2\n				class=\"work-overview__item__text heading\"\n				ng-bind=\"case.introText.fallbackText\"\n				ng-if=\"!usingParticles || isIE\"\n			>\n			</h2>\n\n			<!-- button -->\n			<a\n				ui-sref=\"project({urlSlug: case.caseId})\"\n				ng-mouseover=\"hover = true\"\n				ng-mouseleave=\"hover = false\"\n				class=\"btn js-work-overview-item-button\">\n				<span ng-bind=\"case.buttonText\"></span>\n				<span class=\"btn__icon btn__icon--arrow\"></span>\n			</a>\n		</div>\n	</div>\n</div>\n");
$templateCache.put("components/blocks/awards/awards.tpl.html","<div id=\"{{block().UUID}}\" ng-attr-id=\"{{block().UUID}}\" class=\"section section--awards section--table\" ng-class=\"[\n		\'section--padding-top-{{ block().paddingTop }}\',\n		\'section--padding-bottom-{{ block().paddingBottom }}\',\n		\'section--{{ block().backgroundColor }}\'\n	]\">\n	<div class=\"container\">\n		<div class=\"block\">\n			<h2 class=\"title\">Awards</h2>\n		</div>\n\n		<!-- logos -->\n		<div class=\"block client-logos block--no-gutter\">\n			<div class=\"grid grid--quarter grid--only-images animation__list animation__list--fast\" inview>\n				<div ng-repeat=\"(key, client) in block().logos\" class=\"grid__item grid__item--{{key}} animation animation--fade-in-up\">\n					<div class=\"grid__image\">\n						<a class=\"grid__image--inner\" ng-href=\"{{client.url}}\" target=\"_blank\" rel=\"noopener noreferrer\">\n							<img ng-src=\"{{client.image.url}}\" alt=\"{{client.image[\'alt-text\']}}\" class=\"image--full-width\">\n						</a>\n					</div>\n				</div>\n			</div>\n		</div>\n\n		<div class=\"block block--expand\" expand=\"expand\" expand-start=\".table__row--start\">\n			<table class=\"table\">\n				<thead>\n					<tr>\n						<th></th>\n						<th>Organisation</th>\n						<th>Distinction</th>\n					</tr>\n				</thead>\n				<tbody>\n					<tr ng-repeat=\"award in awards\" ng-class=\"{\'table__row--last\': $last, \'table__row--start\': $index === startRow}\">\n						<td class=\"table__cell table__cell--year\" ng-class=\"{\'table__cell--empty\': award.hideYear, \'table__cell--no-border\': award.hideYear, \'table__cell--year\':!award.hideYear, \'table__cell--year--last\': award.lastOfYear}\">{{award.year}}</td>\n						<td class=\"table__cell\" ng-class=\"{\'table__cell--empty\': award.hideOrganization, \'table__cell--no-border\': award.hideOrganization && !award.lastOfOrganization}\">{{award.organization}}</td>\n						<td class=\"table__cell\">{{award.distinction}}</td>\n					</tr>\n				</tbody>\n			</table>\n		</div>\n\n		<!-- show more button -->\n		<div class=\"block block--show-more\" ng-class=\"{\n				\'block--show-more--hide\':expand\n			}\" expand=\"!expand\">\n\n			<button class=\"btn btn--small\" ng-click=\"expand=!expand\" ng-show=\"!hideButton\">\n				Show more\n				<span class=\"btn__icon btn__icon--arrow btn__icon--down\"></span>\n			</button>\n		</div>\n	</div>\n</div>");
$templateCache.put("components/blocks/big-image/big-image.tpl.html","<div\n	id=\"{{block().UUID}}\" ng-attr-id=\"{{block().UUID}}\"\n	class=\"section section--big-image section--fullscreen\"\n	ng-class=\"[\n		\'section--padding-top-{{ block().paddingTop }}\',\n		\'section--padding-bottom-{{ block().paddingBottom }}\',\n		\'section--{{ block().backgroundColor }}\'\n	]\">\n\n	<!-- background -->\n	<div\n		class=\"fixed-bg__container\" inview>\n\n		<img\n			class=\"fixed-bg__image fixed-bg__image--not-background\"\n			ng-if=\"block().backgroundImage[\'scaled-versions\']\"\n			breakpoint-image\n			breakpoint-image-use-inview\n			scaled-versions=\"{{ block().backgroundImage[\'scaled-versions\'] }}\"\n			sizes=\"(min-width: 1024px) 100vw, 180vw\"\n			data-width=\"{{ block().backgroundImage[\'scaled-versions\'][0].width }}\"\n			data-height=\"{{ block().backgroundImage[\'scaled-versions\'][0].height }}\">\n\n	</div>\n\n	<div class=\"container container\">\n\n		<!-- floating block -->\n		<div class=\"block block--default-white block--vertical-center animation animation--fade-in-up\" inview>\n			<h2 class=\"subtitle\" ng-bind=\"block().title\"></h2>\n			<div class=\"content\" ng-bind-html=\"block().about\"></div>\n		</div>\n	</div>\n</div>\n");
$templateCache.put("components/blocks/carousel-block/carousel-block.tpl.html","<div\n	id=\"{{block().UUID}}\" ng-attr-id=\"{{block().UUID}}\"\n	class=\"section section--carousel section--fullscreen\"\n	ng-class=\"[\n		\'section--padding-top-{{ block().paddingTop }}\',\n		\'section--padding-bottom-{{ block().paddingBottom }}\',\n		{\n			\'section--break-out\': block().fullscreen,\n			\'section--carousel--particles\': block().particles\n		}\n	]\">\n\n	<carousel class=\"carousel carousel--large\" slides=\"block().images\" break-out=\"block().fullscreen\" particle=\"useParticles\"></carousel>\n\n	<!-- scroll more arrow, only when 100% height -->\n	<!-- scroll for more arrow -->\n	<button\n		ng-if=\"useParticles\"\n		ng-click=\"nextScreen()\"\n		inview=\"showArrow\"\n		class=\"btn btn--circle btn--small btn-scroll\"\n		ng-class=\"{\n			\'btn-scroll--hidden\': hideArrow\n		}\">\n		<span class=\"btn__icon btn__icon--arrow btn__icon--down\"></span>\n	</button>\n\n</div>\n");
$templateCache.put("components/blocks/case-awards/case-awards.tpl.html","<div\n	id=\"{{block().UUID}}\" ng-attr-id=\"{{block().UUID}}\"\n	class=\"section case-awards section--slider clearfix\"\n	ng-class=\"[\n		\'section--padding-top-{{ block().paddingTop }}\',\n		\'section--padding-bottom-{{ block().paddingBottom }}\',\n		\'section--{{ block().backgroundColor }}\'\n	]\">\n\n	<div class=\"container\">\n\n		<!-- Awards -->\n		<div class=\"block\">\n			<h2 class=\"subtitle\" ng-bind=\"block().title\"></h2>\n			<div\n				class=\"grid grid--quarter grid--awards grid--only-images\"\n				ng-class=\"{ \'grid--slider\': block().slider }\"\n				grid-slider=\"{{block().slider}}\">\n\n				<div\n					ng-class=\"{ \'grid--slider__inner\': block().slider }\"\n					class=\"animation__list animation__list--fast clearfix\">\n\n					<div\n						ng-repeat=\"(key, award) in block().awards\"\n						class=\"grid__item grid__item--{{key}} animation animation--fade-in-up\"\n						ng-class=\"{ \'grid__item--push-2\': block().awards.length === 2 && $first }\"\n						inview\n					>\n\n						<div class=\"grid__image\">\n							<a\n								ng-if=\"award.url\"\n								class=\"grid__image--inner\"\n								ng-href=\"{{ award.url }}\"\n								target=\"_blank\"\n								rel=\"noopener noreferrer\">\n								<img ng-src=\"{{award.image.url}}\" alt=\"{{award.image[\'alt-text\']}}\" class=\"image--full-width\">\n							</a>\n\n							<span\n								ng-if=\"!award.url\"\n								class=\"grid__image--inner\">\n								<img ng-src=\"{{award.image.url}}\" alt=\"{{award.image[\'alt-text\']}}\" class=\"image--full-width\">\n							</span>\n						</div>\n\n					</div>\n\n				</div>\n\n				<button\n					ng-if=\"block().slider\"\n					class=\"btn btn--large btn--thin-border btn-absolute btn-absolute--left\"\n					ng-class=\"{\n						\'btn--hidden\': isFirst\n					}\"\n					ng-click=\"previous()\">\n					<span class=\"btn__icon btn__icon--arrow btn__icon--left\"></span>\n				</button>\n\n				<button\n					ng-if=\"block().slider\"\n					class=\"btn btn--large btn--thin-border btn-absolute btn-absolute--right\"\n					ng-class=\"{\n						\'btn--hidden\': isLast\n					}\"\n					ng-click=\"next()\">\n					<span class=\"btn__icon btn__icon--arrow\"></span>\n				</button>\n\n			</div>\n\n		</div>\n\n	</div>\n\n</div>\n");
$templateCache.put("components/blocks/case-logos/case-logos.tpl.html","<section\n	id=\"{{block().UUID}}\" ng-attr-id=\"{{block().UUID}}\"\n	class=\"section logos clearfix\"\n	ng-class=\"[\n		\'section--padding-top-{{ block().paddingTop }}\',\n		\'section--padding-bottom-{{ block().paddingBottom }}\',\n		\'section--{{ block().backgroundColor }}\',\n		{\n			\'logos--thirds\': block().logos.length === 5 || block().logos.length === 6\n		}\n	]\">\n	<div class=\"container\">\n		<div class=\"block\">\n\n			<h2 ng-if=\"block().title\" class=\"title\" ng-bind=\"block().title\"></h2>\n			<h3\n				class=\"subtitle\"\n				ng-bind=\"block().subtitle\"\n				ng-if=\"block().subtitle\"\n			>\n			</h4>\n			<div\n				class=\"content description\"\n				ng-bind-html=\"block().description\"\n				ng-if=\"block().description\"\n			>\n			</div>\n\n			<ul class=\"logos__list\">\n				<li ng-repeat=\"(key, logo) in block().logos\">\n					<a ng-if=\"logo.url\" ng-href=\"{{ logo.url }}\" target=\"_blank\" rel=\"noopener noreferrer\">\n						<img ng-src=\"{{logo.image.url}}\" alt=\"{{logo.image[\'alt-text\']}}\">\n					</a>\n					<img ng-if=\"!logo.url\" ng-src=\"{{logo.image.url}}\" alt=\"{{logo.image[\'alt-text\']}}\">\n				</li>\n			</ul>\n		</div>\n	</div>\n</section>\n");
$templateCache.put("components/blocks/case-overview/case-overview.tpl.html","<div\n	rel=\"{{ block().UUID }}\"\n	class=\"section case-overview section--fullscreen\"\n	ng-class=\"[\n		\'section--padding-top-{{ block().paddingTop }}\',\n		\'section--padding-bottom-{{ block().paddingBottom }}\',\n		\'section--{{ block().backgroundColor }}\'\n	]\">\n\n	<!-- background -->\n	<div class=\"fixed-bg__container\" >\n		<img\n			class=\"fixed-bg__image fixed-bg__image--not-background\"\n			ng-if=\"block().backgroundImage[\'scaled-versions\']\"\n			breakpoint-image\n			breakpoint-image-use-inview\n			inview=\"lazyLoading\"\n			scaled-versions=\"{{ block().backgroundImage[\'scaled-versions\'] }}\"\n			sizes=\"(min-width: 1024px) 100vw, 180vw\"\n			data-width=\"{{ block().backgroundImage[\'scaled-versions\'][0].width }}\"\n			data-height=\"{{ block().backgroundImage[\'scaled-versions\'][0].height }}\"\n		>\n	</div>\n\n	<div class=\"container container--no-bg\">\n		<!-- floating block -->\n		<div class=\"block block--default-white block--vertical-center animation animation--fade-in-up\" inview>\n\n			<!-- textsBefore -->\n			<div ng-repeat=\"content in block().textsBefore\" class=\"content grid grid--sidebar\">\n				<!-- first column -->\n				<div class=\"grid__item--first\">\n					<h2 class=\"subtitle\" ng-bind=\"content.title\"></h2>\n				</div>\n\n				<!-- second column -->\n				<div class=\"grid__item--last\">\n					<p class=\"content\" ng-bind-html=\"content.text\"></p>\n				</div>\n			</div>\n\n			<!-- tools -->\n			<div class=\"content grid grid--sidebar\">\n				<!-- first column -->\n				<div class=\"grid__item--first\">\n					<h2 class=\"subtitle\" ng-bind=\"block().toolsTile\"></h2>\n				</div>\n\n				<!-- second column -->\n				<div class=\"grid__item--last\">\n					<ul class=\"inline-list\">\n						<li ng-repeat=\"tool in block().tools\">\n							<a\n								class=\"btn btn--small\"\n								ui-sref=\"page({ urlSlug:tool.url })\"\n								ng-bind=\"tool.name\">\n							</a>\n						</li>\n					</ul>\n				</div>\n			</div>\n\n			<!-- textsAfter -->\n			<div ng-repeat=\"content in block().textsAfter\" class=\"content grid grid--sidebar\">\n				<!-- first column -->\n				<div class=\"grid__item--first\">\n					<h2 class=\"subtitle\" ng-bind=\"content.title\"></h2>\n				</div>\n\n				<!-- second column -->\n				<div class=\"grid__item--last\">\n					<p class=\"content\" ng-bind-html=\"content.text\"></p>\n				</div>\n			</div>\n\n		</div>\n\n	</div>\n\n</div>\n");
$templateCache.put("components/blocks/checkerboard/checkerboard.tpl.html","<div\n  id=\"{{block().UUID}}\" ng-attr-id=\"{{block().UUID}}\"\n  class=\"section section--checkerboard checkerboard\"\n  ng-class=\"[\n    \'section--padding-top-{{ block().paddingTop }}\',\n    \'section--padding-bottom-{{ block().paddingBottom }}\',\n    \'section--{{ block().backgroundColor }}\'\n  ]\">\n\n    <div\n      ng-repeat=\"row in rows\"\n      class=\"checkerboard__row\"\n      ng-class=\"{\n        \'checkerboard__row--first\': $first,\n        \'checkerboard__row--odd\': $odd,\n        \'checkerboard__row--even\': $even\n      }\">\n      <checkerboard-box ng-repeat=\"item in row\" item=\"item\"></checkerboard-box>\n    </div>\n</div>\n");
$templateCache.put("components/blocks/clients/clients.tpl.html","<div class=\"clients--container\">\n	<div\n		id=\"{{block().UUID}}\" ng-attr-id=\"{{block().UUID}}\"\n		class=\"section section--clients\"\n		ng-class=\"[\n			\'section--padding-top-{{ block().paddingTop }}\',\n			\'section--padding-bottom-{{ block().paddingBottom }}\',\n			\'section--{{ block().backgroundColor }}\'\n		]\"\n		inview=\"animateMap\">\n\n			<div class=\"section__map-container\">\n				<!-- Map -->\n			    <div id=\"cf-map-container\" class=\"section__map-container__overlapping-maps\">\n				    <div\n						id=\"cf-map-include\"\n						ng-include=\"\'images/worldmap.svg\'\"\n						onload=\"initMap()\">\n					</div>\n				</div>\n\n				<!-- Map Elements -->\n				<div id=\"cf-map-elements-container\" class=\"section__map-container__overlapping-maps\">\n				</div>\n			</div>\n\n			<div class=\"container container--no-bg container__table\">\n				<div class=\"container__table__cell\">\n					<!-- Floating block -->\n					<div class=\"block block--default-white block--vertical-center\" inview>\n						<h2 class=\"subtitle\" ng-bind=\"block().title\"></h2>\n						<div class=\"content\" ng-bind-html=\"block().aboutClient\"></div>\n					</div>\n				</div>\n			</div>\n	</div>\n</div>\n");
$templateCache.put("components/blocks/contact-footer/contact-footer.tpl.html","<div\n	id=\"{{block().UUID}}\" ng-attr-id=\"{{block().UUID}}\"\n	class=\"section section--contact-footer\"\n	ng-class=\"[\n		\'section--padding-top-{{ block().paddingTop }}\',\n		\'section--padding-bottom-{{ block().paddingBottom }}\',\n		\'section--{{ block().backgroundColor }}\'\n	]\">\n\n	<div class=\"container\">\n\n		<div class=\"block block--split block--no-gutter clearfix\">\n\n			<!-- Newsletter -->\n			<div class=\"block block--left\">\n				<h2 class=\"heading\">Newsletter</h2>\n				<div class=\"content\" ng-bind-html=\"block().newsletter.introText\"></div>\n\n				<form\n					class=\"newsletter__form\"\n					action=\"https://cleverfranke.createsend.com/t/d/s/njdydu/\"\n					method=\"post\"\n					conversion-on-submit=\"{ label: \'vW6mCNyo2moQw77m2AM\' }\"\n				>\n					<label for=\"cmEmailAddress\">E-mail address</label>\n					<input\n						id=\"cmEmailAddress\"\n						name=\"cm-njdydu-njdydu\"\n						placeholder=\"your@emailaddress.com\"\n						required\n						type=\"email\"\n					>\n					<button class=\"btn btn--small\">\n						Send\n						<span class=\"btn__icon btn__icon--arrow\"></span>\n					</button>\n				</form>\n			</div>\n\n			<!-- Address -->\n			<div class=\"block block--right block--address\">\n				<h2 class=\"heading\">Addresses</h2>\n\n				<a\n					class=\"content content__url email\"\n					ng-href=\"mailto:{{ block().email }}\"\n					ng-bind=\"block().email\"\n				>\n				</a>\n\n				<address ng-repeat=\"address in block().addresses\" class=\"content--address\">\n					<div class=\"content\" ng-bind-html=\"address.address\"></div>\n\n					<a\n						ng-if=\"address.routeLink\"\n						ng-href=\"{{ address.routeLink }}\"\n						target=\"_blank\"\n						rel=\"noopener noreferrer\"\n						class=\"btn btn--outer\">\n\n						<span class=\"btn btn--small\">\n							<span class=\"btn__icon btn__icon--arrow\"></span>\n						</span>\n						<span class=\"btn__label\" ng-bind=\"address.routeLinkText\"></span>\n					</a>\n				</address>\n			</div>\n\n		</div>\n	</div>\n</div>\n");
$templateCache.put("components/blocks/contact-person/contact-person.tpl.html","<div\n	id=\"{{block().UUID}}\" ng-attr-id=\"{{block().UUID}}\"\n	class=\"section contact-person\"\n	ng-class=\"[\n		\'section--padding-top-{{ block().paddingTop }}\',\n		\'section--padding-bottom-{{ block().paddingBottom }}\',\n		\'section--{{ block().backgroundColor }}\'\n	]\">\n\n	<!-- Contact person with h-card http://microformats.org/wiki/h-card -->\n	<div class=\"container h-card\">\n		<div class=\"contact-person-container\">\n			<img\n				class=\"contact-person-image u-photo\"\n				ng-src=\"{{person.imageUrl}}\"\n				alt=\"Profile picture {{person.name}}\"\n			/>\n			<div class=\"person-information\">\n				<p class=\"subtitle\" ng-if=\"subtitle\"><strong ng-bind=\"subtitle\"></strong></p>\n				<h2 class=\"title\" ng-bind=\"person.name\"></h2>\n				<p class=\"person-information-text\" ng-bind=\"person.personInfo\"></p>\n			</div>\n		</div>\n\n		<div class=\"contact-information\">\n			<div ng-if=\"person.email\" class=\"email\">\n				<span class=\"type\">E-mail</span>\n				<a class=\"value u-email\" ng-href=\"mailto:{{person.email}}\" ng-bind=\"person.email\"></a>\n			</div>\n			<div ng-if=\"person.tel\" class=\"tel\">\n				<span class=\"type\">Phone</span>\n				<a class=\"value p-tel\" ng-href=\"tel:{{getPhoneNumber(person.tel)}}\" ng-bind=\"person.tel\"></a>\n			</div>\n			<div ng-if=\"person.tel2\" class=\"tel\">\n				<span class=\"type hidden\">Phone</span>\n				<a class=\"value p-tel\" ng-href=\"tel:{{getPhoneNumber(person.tel2)}}\" ng-bind=\"person.tel2\"></a>\n			</div>\n		</div>\n	</div>\n</div>\n");
$templateCache.put("components/blocks/contact-persons/contact-persons.tpl.html","<div\n	id=\"{{block().UUID}}\" ng-attr-id=\"{{block().UUID}}\"\n	class=\"section section--contact-persons\"\n	ng-class=\"[\n		\'section--padding-top-{{ block().paddingTop }}\',\n		\'section--padding-bottom-{{ block().paddingBottom }}\',\n		\'section--{{ block().backgroundColor }}\'\n	]\">\n	<div class=\"container\">\n		<div>\n\n			<!-- Introduction of contact persons -->\n			<div class=\"block block--no-gutter clearfix\">\n				<div class=\"block block--left\">\n					<h2 class=\"title\">Contact</h2>\n				</div>\n			</div>\n\n			<!-- List of contact persons -->\n			<div class=\"block block--split block--no-gutter clearfix\">\n				<div class=\"block block--left\">\n					<div class=\"content\" ng-bind-html=\"block().introText\"></div>\n				</div>\n				<div class=\"block block--right\">\n					<div ng-repeat=\"block in block().contactPersons\" class=\"contact-persons__item clearfix\">\n						<div class=\"contact__photo\">\n							<img\n								ng-if=\"block.image[\'scaled-versions\']\"\n								alt=\"{{block.image[\'alt-text\']}}\"\n								breakpoint-image\n								scaled-versions=\"{{ block.image[\'scaled-versions\'] }}\"\n								sizes=\"(min-width: 1440px) 143px, (min-width: 768px) 107px, (min-width: 480px) 436px, calc( 100vw - 38px )\"\n								data-width=\"{{ block.image[\'scaled-versions\'][0].width }}\"\n								data-height=\"{{ block.image[\'scaled-versions\'][0].height }}\"\n							/>\n						</div>\n\n						<div class=\"contact__details\">\n							<h3 class=\"subtitle\" ng-bind=\"block.contactFor\"></h3>\n							<h4 class=\"contact__name\" ng-bind=\"block.name\"></h4>\n							<a\n								class=\"content content__url email\"\n								ng-href=\"mailto:{{ block.email }}\"\n								ng-bind=\"block.email\">\n							</a>\n							<a class=\"content\" ng-bind=\"block.tel\" ng-href=\"tel:{{ getPhoneNumber(block.tel) }}\"></a>\n							<a class=\"content\" ng-if=\"block.tel2\" ng-bind=\"block.tel2\" ng-href=\"tel:{{ getPhoneNumber(block.tel2) }}\"></a>\n						</div>\n					</div>\n\n					<div class=\"job-portal\">\n						<a\n							ng-if=\"block().jobsPortal.link\"\n							ng-href=\"{{ block().jobsPortal.link }}\"\n							target=\"_blank\"\n							rel=\"noopener noreferrer\">\n							<span ng-bind=\"block().jobsPortal.text\"></span>\n							<span class=\"btn btn--thin-border btn--mini btn--right\">\n								<span class=\"btn__icon btn__icon--arrow\"></span>\n							</span>\n						</a>\n\n						<p class=\"content\" ng-bind=\"block().jobsPortal.disclaimer\"></p>\n					</div>\n				</div>\n			</div>\n\n		</div>\n	</div>\n</div>\n");
$templateCache.put("components/blocks/design-intro/design-intro.tpl.html","<div\n	id=\"{{block().UUID}}\" ng-attr-id=\"{{block().UUID}}\"\n	class=\"section section--design-intro\"\n	ng-class=\"[\n		\'section--padding-top-{{ block().paddingTop }}\',\n		\'section--padding-bottom-{{ block().paddingBottom }}\',\n		\'section--{{ block().backgroundColor }}\'\n	]\">\n\n	<div class=\"container\">\n\n		<div class=\"block\">\n			<h2 class=\"grid__item title\" ng-bind=\"block().title\"></h2>\n		</div>\n\n		<div class=\"block\">\n			<article class=\"content grid grid--half\">\n				<!-- first column -->\n				<div class=\"grid__item\">\n					<div ng-bind-html=\"block().column0\"></div>\n				</div>\n\n				<!-- second column -->\n				<div class=\"grid__item\">\n					<div ng-bind-html=\"block().column1\"></div>\n\n					<!-- quote -->\n					<blockquote class=\"quote\" ng-if=\"block().quote.text\">\n						&#8220;<span ng-bind=\"block().quote.text\"></span>&#8221;\n					</blockquote>\n\n					<p class=\"author\" ng-if=\"block().quote.author\">\n						{{ block().quote.author }}<span ng-if=\"block().quote.authorFunction\">,<br></span>\n						{{ block().quote.authorFunction }}\n					</p>\n				</div>\n			</article>\n		</div>\n	</div>\n</div>\n");
$templateCache.put("components/blocks/design-video/design-video.tpl.html","<div\n	id=\"{{block().UUID}}\" ng-attr-id=\"{{block().UUID}}\"\n	class=\"section design-video\"\n	ng-class=\"[\n		\'section--padding-top-{{ block().paddingTop }}\',\n		\'section--padding-bottom-{{ block().paddingBottom }}\',\n		\'section--{{ block().backgroundColor }}\'\n	]\">\n\n	<div class=\"container\">\n		<div class=\"block\">\n			<h2 ng-if=\"block().title\" class=\"title\" ng-bind=\"block().title\"></h2>\n			<h3\n				ng-if=\"block().subtitle\"\n				class=\"subtitle\"\n				ng-bind=\"block().subtitle\"\n			>\n			</h3>\n			<div\n				ng-if=\"block().description\"\n				class=\"content description\"\n				ng-bind-html=\"block().description\"\n			>\n			</div>\n\n		<div class=\"block-video animation animation--fade-in\" inview>\n				<!-- html5 video -->\n\n				<video\n					ng-if=\"useMP4 && posterImage\"\n					class=\"video-js vjs-sublime-skin\"\n					controls=\"true\"\n					data-setup=\'{ \"aspectRatio\": \"16:9\" }\'\n					preload=\"metadata\"\n					poster=\"{{posterImage}}\"\n					videojs=\"{{block().vimeo_mp4_url}}\"\n				></video>\n\n				<!-- fallback for html5 video -->\n				<div ng-if=\"!useMP4\">\n					<iframe class=\"home__video__embed\" ng-src=\"{{fallback}}\" width=\"100%\" height=\"auto\" frameborder=\"0\" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>\n				</div>\n		</div>\n	</div>\n</div>\n");
$templateCache.put("components/blocks/image-grid/image-grid.tpl.html","<div\n	id=\"{{block().UUID}}\" ng-attr-id=\"{{block().UUID}}\"\n	class=\"section section--image-grid\"\n	ng-class=\"[\n		\'section--padding-top-{{ block().paddingTop }}\',\n		\'section--padding-bottom-{{ block().paddingBottom }}\',\n		\'section--{{ block().backgroundColor }}\'\n	]\">\n\n	<div class=\"container\">\n\n		<div class=\"block\">\n			<h3\n				ng-if=\"block().showTitle\"\n				class=\"subtitle\"\n				ng-bind=\"block().title\">\n			</h3>\n		</div>\n\n		<div\n			ng-if=\"block().column0 || block().column1\"\n			class=\"block\"\n		>\n			<div class=\"content grid grid--half\">\n\n				<!-- first column -->\n				<div class=\"grid__item\">\n					<div ng-bind-html=\"block().column0\"></div>\n				</div>\n\n				<!-- second column -->\n				<div class=\"grid__item\">\n					<div ng-bind-html=\"block().column1\"></div>\n				</div>\n\n			</div>\n		</div>\n\n		<div class=\"block\">\n			<div\n				class=\"animation__list\"\n				ng-class=\"{\'block block--left\': block().sidebarText}\"\n				inview>\n\n				<div\n					ng-repeat=\"(rowKey, row) in block().grid\"\n					class=\"grid animation animation--fade-in-up\"\n					ng-class=\"{\n						\'grid--quarter\': row.length === 4,\n						\'grid--third\': row.length === 3,\n						\'grid--half\': row.length === 2\n					}\">\n\n					<div ng-repeat=\"(columnKey, image) in row\" class=\"grid__item grid__item--{{columnKey}} lightbox-item\" ng-click=\"lightbox(image.url,rowKey,columnKey)\">\n\n						<img\n							ng-if=\"image[\'scaled-versions\']\"\n							alt=\"{{image[\'alt-text\']}}\"\n							class=\"image--full-width\"\n							inview=\"lazyLoading\"\n							breakpoint-image\n							scaled-versions=\"{{ image[\'scaled-versions\'] }}\"\n							sizes=\"getSizes(row)\"\n							data-width=\"{{ image[\'scaled-versions\'][0].width }}\"\n							data-height=\"{{ image[\'scaled-versions\'][0].height }}\">\n\n					</div>\n				</div>\n			</div>\n		</div>\n\n		<div class=\"block block--right\" ng-if=\"block().sidebarText\">\n			<div class=\"content\" ng-bind-html=\"block().sidebarText\"></div>\n		</div>\n\n	</div>\n</div>\n");
$templateCache.put("components/blocks/image-list/image-list.tpl.html","<div\n	id=\"{{block().UUID}}\" ng-attr-id=\"{{block().UUID}}\"\n	class=\"section image-list\"\n	ng-class=\"[\n		\'section--padding-top-{{ block().paddingTop }}\',\n		\'section--padding-bottom-{{ block().paddingBottom }}\',\n		\'section--{{ block().backgroundColor }}\',\n		{\n			\'image-list--{{ block().layout }}\': block().layout,\n			\'image-list--clickable\': block().lightboxEnabled\n		}\n	]\">\n	<div class=\"container\">\n		<div class=\"block\">\n			<h2 ng-if=\"block().title\" class=\"title\" ng-bind=\"block().title\"></h2>\n			<h3\n				ng-if=\"block().subtitle\"\n				class=\"subtitle\"\n				ng-bind=\"block().subtitle\"\n			>\n			</h3>\n			<div\n				ng-if=\"block().description\"\n				class=\"content description\"\n				ng-bind-html=\"block().description\"\n			>\n			</div>\n\n			<!-- vertical-list -->\n			<ul id=\"{{$id}}\" ng-if=\"block().layout === \'vertical-list\'\" class=\"images animation__list\" inview>\n				<li data-ng-repeat=\"(key, image) in block().images\"\n					ng-click=\"block().lightboxEnabled && openLightbox(key)\"\n					class=\"animation animation--fade-in\"\n					inview\n				>\n					<!-- It could be an SVG, which doesn\'t have any resized versions -->\n					<img\n						ng-if=\"!image[\'scaled-versions\']\"\n						alt=\"{{ image[\'alt-text\'] }}\"\n						class=\"images__image\"\n						ng-src=\"{{ image.url }}\"\n					/>\n					<!-- It could also be a bitmap image -->\n					<img\n						ng-if=\"image[\'scaled-versions\']\"\n						alt=\"{{ image[\'alt-text\'] }}\"\n						breakpoint-image\n						class=\"images__image\"\n						data-height=\"{{ image[\'scaled-versions\'][0].height }}\"\n						data-width=\"{{ image[\'scaled-versions\'][0].width }}\"\n						scaled-versions=\"{{ image[\'scaled-versions\'] }}\"\n						sizes=\"(min-width: 1440px) 911px, (min-width: 1024px) 682px, (min-width: 768px) calc(100vw - 2rem), calc(100vw - 1rem)\"\n					/>\n				</li>\n			</ul>\n\n			<!-- horizontal-list -->\n			<div class=\"images\" ng-if=\"block().layout === \'horizontal-list\'\">\n				<flickity-image-list\n					layout=\"{{block().layout}}\"\n					flickity-options=\"flickityOptions[block().layout]\"\n					flickity-id=\"flickity-{{block().layout}}-{{block().UUID}}\"\n					images=\"block().images\"\n					lightbox-enabled=\"block().lightboxEnabled\" />\n			</div>\n\n			<!-- fifty-fifty -->\n			<div class=\"grid grid--fifty-fifty\" ng-if=\"block().layout === \'fifty-fifty\'\">\n				<ul id=\"{{$id}}\" class=\"animation__list\" inview>\n					<li data-ng-repeat=\"(key, image) in block().images\"\n						ng-click=\"block().lightboxEnabled && openLightbox(key)\"\n						class=\"grid__item animation animation--fade-in\"\n					>\n						<!-- It could be an SVG, which doesn\'t have any resized versions -->\n						<img\n							ng-if=\"!image[\'scaled-versions\']\"\n							alt=\"{{ image[\'alt-text\'] }}\"\n							class=\"images__image\"\n							ng-src=\"{{ image.url }}\"\n						/>\n						<!-- It could also be a bitmap image -->\n						<img\n							ng-if=\"image[\'scaled-versions\']\"\n							alt=\"{{ image[\'alt-text\'] }}\"\n							breakpoint-image\n							class=\"images__image\"\n							data-height=\"{{ image[\'scaled-versions\'][0].height }}\"\n							data-width=\"{{ image[\'scaled-versions\'][0].width }}\"\n							scaled-versions=\"{{ image[\'scaled-versions\'] }}\"\n							sizes=\"(min-width: 1440px) 911px, (min-width: 1024px) 682px, (min-width: 768px) calc(100vw - 2rem), calc(100vw - 1rem)\"\n						/>\n					</li>\n				</ul>\n		</div>\n\n			<!-- image-grid (3/2) -->\n			<div class=\"images grid grid--three-two\" ng-if=\"block().layout === \'grid-three-two\'\">\n				<ul class=\"grid__item animation__list\">\n					<li\n						data-ng-repeat=\"(key, image) in block().images\"\n						class=\"images__list-item animation animation--fade-in\"\n						ng-click=\"block().lightboxEnabled && openLightbox(key)\"\n						inview\n					>\n						<!-- It could be an SVG, which doesn\'t have any resized versions -->\n						<img\n							ng-if=\"!image[\'scaled-versions\']\"\n							alt=\"{{ image[\'alt-text\'] }}\"\n							class=\"images__image\"\n							ng-src=\"{{ image.url }}\"\n						/>\n						<img\n							alt=\"{{ image[\'alt-text\'] }}\"\n							ng-if=\"image[\'scaled-versions\']\"\n							class=\"images__image\"\n							breakpoint-image\n							data-height=\"{{ image[\'scaled-versions\'][0].height }}\"\n							data-width=\"{{ image[\'scaled-versions\'][0].width }}\"\n							scaled-versions=\"{{ image[\'scaled-versions\'] }}\"\n							sizes=\"(min-width: 1440px) 370px), (min-width: 1024px) 275px), (min-width: 768px) calc( ( 100vw / 2.5 ) - 2rem ), calc(100vw - 1rem)\"\n						/>\n					</li>\n				</ul>\n			</div>\n\n			<!-- image-grid (1/2) -->\n			<div class=\"images grid grid--one-two\" ng-if=\"block().layout === \'grid-one-two\'\">\n				<ul class=\"grid__item animation__list\">\n					<li\n						data-ng-repeat=\"(key, image) in block().images\"\n						class=\"images__list-item animation animation--fade-in\"\n						ng-click=\"block().lightboxEnabled && openLightbox(key)\"\n						inview\n					>\n						<!-- It could be an SVG, which doesn\'t have any resized versions -->\n						<img\n							ng-if=\"!image[\'scaled-versions\']\"\n							alt=\"{{ image[\'alt-text\'] }}\"\n							class=\"images__image\"\n							ng-src=\"{{ image.url }}\"\n						/>\n						<img\n							alt=\"{{ image[\'alt-text\'] }}\"\n							ng-if=\"image[\'scaled-versions\']\"\n							class=\"images__image\"\n							breakpoint-image\n							data-height=\"{{ image[\'scaled-versions\'][0].height }}\"\n							data-width=\"{{ image[\'scaled-versions\'][0].width }}\"\n							scaled-versions=\"{{ image[\'scaled-versions\'] }}\"\n							sizes=\"(min-width: 1440px) 370px), (min-width: 1024px) 275px), (min-width: 768px) calc( ( 100vw / 2.5 ) - 2rem ), calc(100vw - 1rem)\"\n						/>\n					</li>\n				</ul>\n			</div>\n		</div>\n	</div>\n\n	<!-- edge-to-edge -->\n	<div class=\"images edge-to-edge\" ng-if=\"block().layout === \'edge-to-edge\' && block().images.length > 1\">\n		<flickity-image-list\n			layout=\"{{block().layout}}\"\n			flickity-options=\"flickityOptions[block().layout]\"\n			flickity-id=\"flickity-{{block().layout}}-{{block().UUID}}\"\n			images=\"block().images\"\n			lightbox-enabled=\"block().lightboxEnabled\"\n		/>\n	</div>\n\n	<!-- edge-to-edge single image -->\n	<div\n		class=\"images\"\n		ng-if=\"block().layout === \'edge-to-edge\' && block().images.length === 1\"\n	>\n		<ul>\n			<li data-ng-repeat=\"(key, image) in block().images\" class=\"animation animation--fade-in\" inview>\n				<!-- It could be an SVG, which doesn\'t have any resized versions -->\n				<img\n					ng-if=\"!image[\'scaled-versions\']\"\n					alt=\"{{ image[\'alt-text\'] }}\"\n					class=\"images__image\"\n					ng-src=\"{{ image.url }}\"\n				/>\n				<img\n					alt=\"{{ image[\'alt-text\'] }}\"\n					ng-if=\"image[\'scaled-versions\']\"\n					class=\"images__image\"\n					breakpoint-image\n					scaled-versions=\"{{ image[\'scaled-versions\'] }}\"\n					sizes=\"(min-width: 1024px) calc( 100vw - 14rem ), 100vw\"\n				/>\n			</li>\n		</ul>\n	</div>\n</div>\n");
$templateCache.put("components/blocks/image-title/image-title.tpl.html","<div\n	rel=\"{{ block().UUID }}\"\n	class=\"section image-title\"\n	ng-class=\"[\n		\'section--padding-top-{{ block().paddingTop }}\',\n		\'section--padding-bottom-{{ block().paddingBottom }}\',\n		\'section--{{ block().backgroundColor }}\'\n	]\">\n\n	<div class=\"container\">\n		<div class=\"block\">\n\n			<div class=\"image-title-container\">\n\n				<div class=\"image-title__image-container\" ng-if=\"block().titleImage\">\n					<!-- Icon -->\n					<div\n						ng-if=\"!block().titleImage[\'scaled-versions\']\"\n						class=\"image-title__image image-title__image--icon\">\n						<img ng-src=\"{{ block().titleImage.url }}\" alt=\"{{ block().titleImage[\'alt-text\'] }}\">\n					</div>\n\n					<!-- Image -->\n					<div\n						ng-if=\"block().titleImage[\'scaled-versions\']\"\n						class=\"image-title__image\">\n						<img\n							alt=\"block().titleImage[\'alt-text\']\"\n							breakpoint-image\n							scaled-versions=\"{{ block().titleImage[\'scaled-versions\'] }}\"\n							sizes=\"201px\"\n							data-width=\"{{ block().titleImage[\'scaled-versions\'][0].width }}\"\n							data-height=\"{{ block().titleImage[\'scaled-versions\'][0].height }}\">\n					</div>\n				</div>\n\n				<div class=\"image-title__title-container\">\n					<sub class=\"image-title__subtitle\" ng-bind=\"block().subtitle\"></sub>\n					<h2 class=\"title image-title__title\" ng-bind=\"block().title\"></h2>\n				</div>\n\n			</div>\n		</div>\n	</div>\n</div>\n");
$templateCache.put("components/blocks/introduction/introduction.tpl.html","<div\n	id=\"{{block().UUID}}\" ng-attr-id=\"{{block().UUID}}\"\n	class=\"section introduction\">\n\n	<div class=\"introduction__background\" ec-stickyfill>\n		<!-- fallback background -->\n		<img\n			class=\"introduction__fallback fixed-bg__image-fit\"\n			ng-if=\"block().backgroundImage[\'scaled-versions\']\"\n			breakpoint-image\n			scaled-versions=\"{{ block().backgroundImage[\'scaled-versions\'] }}\"\n			sizes=\"(min-width: 1024px) 100vw, 100vw\"\n			data-width=\"{{ block().backgroundImage[\'scaled-versions\'][0].width }}\"\n			data-height=\"{{ block().backgroundImage[\'scaled-versions\'][0].height }}\"\n		/>\n\n		<!-- video -->\n		<div class=\"introduction__video\">\n			<div\n        ng-if=\"useMP4 && useFixedVideo && block().backgroundVideo.vimeo_mp4_url\"\n        class=\"introduction__video-overlay\">\n	    </div>\n			<video\n				ng-if=\"useMP4 && useFixedVideo && block().backgroundVideo.vimeo_mp4_url\"\n				id=\"introduction-video-{{block().UUID}}\"\n				class=\"video--intro video-js vjs-sublime-skin home__video\"\n				preload=\"auto\"\n				loop\n				muted=true\n				play-on-load=\"{{playOnLoad}}\"\n				videojs=\"{{block().backgroundVideo.vimeo_mp4_url}}\"\n				ng-attr-poster=\"{{ isTouchDevice && block().backgroundImage[\'scaled-versions\'][block().backgroundImage[\'scaled-versions\'].length - 1].url || \'\' }}\"\n			></video>\n		</div>\n	</div>\n\n	<header class=\"introduction__header\">\n		<div class=\"container--particles__fallback\" ng-if=\"!usingParticles\">\n			<h1 class=\"heading\" ng-bind=\"block().introText.fallbackText\"></h1>\n		</div>\n\n		<!-- scroll for more arrow -->\n		<button\n			class=\"btn btn--circle btn--small btn-scroll\"\n			ng-click=\"scrollToCase()\"\n			ng-class=\"{\n				\'btn-scroll--hidden\': hideArrow\n			}\"\n			inview>\n			<span class=\"btn__icon btn__icon--arrow btn__icon--down\"></span>\n		</button>\n	</header>\n\n	<section class=\"container introduction__case\">\n		<div id=\"introduction-{{block().UUID}}\" class=\"project-result block animation animation--fade-in\" ng-if=\"block().resultImage[\'scaled-versions\']\" inview>\n			<img\n				ng-if=\"block().resultImage[\'scaled-versions\']\"\n				alt=\"{{block().resultImage[\'alt-text\']}}\"\n				breakpoint-image\n				scaled-versions=\"{{ block().resultImage[\'scaled-versions\'] }}\"\n				sizes=\"(min-width: 1440px) 911px, (min-width: 768px) 682px, calc( 100vw - 2rem )\"\n			/>\n		</div>\n\n		<!-- project goals block  -->\n		<div class=\"project-introduction block\" ng-if=\"block().introduction\">\n			<h2 class=\"subtitle\" ng-bind=\"block().introductionTitle\"></h2>\n			<div class=\"quote\" ng-bind-html=\"block().introduction\"></div>\n		</div>\n\n		<!-- project data -->\n		<div class=\"project-information\">\n			<div class=\"block block--split\">\n\n				<!-- project background -->\n				<div class=\"block block--left project-background\">\n					<h2 class=\"subtitle\" ng-bind=\"block().backgroundTitle\"></h2>\n					<div class=\"content\" ng-bind-html=\"block().background\"></div>\n				</div>\n\n				<!-- client -->\n				<div class=\"block block--right\">\n					<div class=\"project-metadata\" ng-if=\"block().client.image\">\n						<h2 class=\"subtitle\" ng-bind=\"block().clientTitle\"></h2>\n						<div class=\"client-logo\">\n							<img ng-src=\"{{block().client.image.url}}\" alt=\"{{block().client.image[\'alt-text\']}}\">\n						</div>\n					</div>\n\n					<div class=\"project-metadata\" ng-if=\"block().targetAudience\">\n						<h2 class=\"subtitle\" ng-bind=\"block().targetAudienceTitle\"></h2>\n						<p class=\"content\" ng-bind=\"block().targetAudience\"></p>\n					</div>\n\n					<div class=\"project-metadata\" ng-if=\"block().solution\">\n						<h2 class=\"subtitle\" ng-bind=\"block().solutionTitle\"></h2>\n						<p class=\"content\" ng-bind=\"block().solution\"></p>\n					</div>\n\n					<div class=\"project-metadata\" ng-if=\"block().result\">\n						<h2 class=\"subtitle\" ng-bind=\"block().resultTitle\"></h2>\n						<div class=\"content\" ng-bind-html=\"block().result\"></div>\n					</div>\n				</div>\n			</div>\n		</div>\n	</section>\n</div>\n");
$templateCache.put("components/blocks/juries/juries.tpl.html","<div\n	id=\"{{block().UUID}}\" ng-attr-id=\"{{block().UUID}}\"\n	class=\"section section--juries section--slider\"\n	ng-class=\"[\n		\'section--padding-top-{{ block().paddingTop }}\',\n		\'section--padding-bottom-{{ block().paddingBottom }}\',\n		\'section--{{ block().backgroundColor }}\'\n	]\">\n\n	<div class=\"container\">\n\n		<div class=\"block\">\n			<h2 class=\"title\" ng-bind=\"block().title\"></h2>\n		</div>\n\n		<div\n			class=\"block block--no-gutter grid grid--third\"\n			ng-class=\"{ \'grid--slider\': block().slider }\"\n			grid-slider=\"{{ block().slider }}\">\n\n			<div\n				ng-class=\"{ \'grid--slider__inner\': block().slider }\"\n				class=\"animation__list clearfix\">\n\n				<div ng-repeat=\"jury in block().juries\" class=\"grid__item animation animation--fade-in-up\" inview>\n					<a\n						ng-if=\"jury.url\"\n						class=\"grid__item__inner\"\n						ng-href=\"{{jury.url}}\"\n						target=\"_blank\"\n						rel=\"noopener noreferrer\"\n					>\n						<div class=\"jury__center\">\n							<div class=\"jury__image__container\">\n								<img ng-src=\"{{jury.image.url}}\" alt=\"{{jury.image[\'alt-text\']}}\" class=\"jury__image\">\n							</div>\n							<div class=\"jury__name\" ng-bind=\"jury.name\"></div>\n							<div class=\"jury__type\" ng-bind=\"jury.type\"></div>\n						</div>\n					</a>\n\n					<span\n						ng-if=\"!jury.url\"\n						class=\"grid__item__inner\"\n					>\n						<div class=\"jury__center\">\n							<div class=\"jury__image__container\">\n								<img ng-src=\"{{jury.image.url}}\" alt=\"{{jury.image[\'alt-text\']}}\" class=\"jury__image\">\n							</div>\n							<div class=\"jury__name\" ng-bind=\"jury.name\"></div>\n							<div class=\"jury__type\" ng-bind=\"jury.type\"></div>\n						</div>\n					</span>\n				</div>\n			</div>\n\n			<button\n				ng-if=\"block().slider\"\n				class=\"btn btn--large btn--thin-border btn-absolute btn-absolute--left\"\n				ng-class=\"{\n					\'btn--hidden\': isFirst\n				}\"\n				ng-click=\"previous()\">\n				<span class=\"btn__icon btn__icon--arrow btn__icon--left\"></span>\n			</button>\n\n			<button\n				ng-if=\"block().slider\"\n				class=\"btn btn--large btn--thin-border btn-absolute btn-absolute--right\"\n				ng-class=\"{\n					\'btn--hidden\': isLast\n				}\"\n				ng-click=\"next()\">\n				<span class=\"btn__icon btn__icon--arrow\"></span>\n			</button>\n\n		</div>\n\n	</div>\n\n</div>\n");
$templateCache.put("components/blocks/link-block/link-block.tpl.html","<div\n	class=\"section link-block\"\n	id=\"{{block().UUID}}\" ng-attr-id=\"{{block().UUID}}\"\n	ng-class=\"getClasses()\"\n	ng-style=\"backgroundStyle\">\n\n	<div class=\"container\">\n		<div class=\"block block--visit-link\">\n			<a\n				ng-repeat=\"link in block().links\"\n				href=\"{{ link.url }}\"\n				ng-attr-target=\"{{ getLinkTarget(link.externalLink) }}\"\n				class=\"btn btn--large\">\n				<span ng-bind=\"link.buttonText\"></span>\n				<span class=\"btn__icon btn__icon--arrow\"></span>\n			</a>\n		</div>\n	</div>\n</div>\n");
$templateCache.put("components/blocks/media-coverage/media-coverage.tpl.html","<div\n	id=\"{{block().UUID}}\" ng-attr-id=\"{{block().UUID}}\"\n	class=\"section section--media-coverage\"\n	ng-class=\"[\n		\'section--padding-top-{{ block().paddingTop }}\',\n		\'section--padding-bottom-{{ block().paddingBottom }}\',\n		\'section--{{ block().backgroundColor }}\'\n	]\">\n\n	<div class=\"container\">\n\n		<div class=\"block\">\n			<h2 class=\"title\" ng-bind=\"block().title\"></h2>\n		</div>\n\n		<!-- logos -->\n		<div class=\"block block--no-gutter\">\n\n			<div class=\"grid grid--quarter grid--only-images\">\n\n				<div ng-repeat=\"(key, source) in sources\" class=\"grid__item grid__item--{{key}}\">\n\n					<div class=\"grid__image\">\n\n						<a\n							class=\"grid__image--inner animation animation--fade-in-up\"\n							ng-href=\"{{source.url}}\"\n							target=\"_blank\"\n							rel=\"noopener noreferrer\"\n							inview>\n\n							<img ng-src=\"{{source.image.url}}\" alt=\"{{source.image[\'alt-text\']}}\" class=\"image--full-width image--greyscale\">\n							<img ng-src=\"{{source.image.url}}\" alt=\"{{source.image[\'alt-text\']}}\" class=\"image--full-width image--color\">\n\n						</a>\n\n					</div>\n\n				</div>\n\n			</div>\n\n		</div>\n\n\n	</div>\n\n</div>\n");
$templateCache.put("components/blocks/our-values/our-values.tpl.html","<div\n	id=\"{{block().UUID}}\" ng-attr-id=\"{{block().UUID}}\"\n	class=\"section section--our-values section--image-bg\"\n	ng-class=\"[\n		\'section--padding-top-{{ block().paddingTop }}\',\n		\'section--padding-bottom-{{ block().paddingBottom }}\',\n		\'section--{{ block().backgroundColor }}\'\n	]\">\n\n	<!-- background -->\n	<div\n		class=\"fixed-bg__container our-values__background\"\n		ng-repeat=\"value in values\"\n		ng-class=\"{ \'our-values__background--hide\': $index !== current }\"\n		ng-if=\"$index === current || $index === prev || $index - 1 === current\">\n\n		<img\n			ng-if=\"value.image[\'scaled-versions\']\"\n			class=\"fixed-bg__image fixed-bg__image--not-background\"\n			ng-src=\"{{ value.image[\'scaled-versions\'][0].url }}\"\n			data-width=\"{{ value.image[\'scaled-versions\'][0].width }}\"\n			data-height=\"{{ value.image[\'scaled-versions\'][0].height }}\">\n	</div>\n\n	<div class=\"container\">\n		<div class=\"block block__byline__container\">\n			<h2 class=\"title\" ng-bind=\"block().title\"></h2>\n			<h3 class=\"subtitle subtitle--byline\" ng-class=\"{\'subtitle--hide\': switch.byline !== \'a\'}\" ng-bind=\"byline.a\"></h3>\n			<h3 class=\"subtitle subtitle--byline\" ng-class=\"{\'subtitle--hide\': switch.byline !== \'b\'}\" ng-bind=\"byline.b\"></h3>\n		</div>\n	</div>\n\n	<div class=\"block block--no-gutter our-values__parent\">\n		<div class=\"our-values__container\">\n			<div class=\"our-values__inside\" ng-style=\"{width: values.length * 400, \'transform\': \'translateX(\' + -left + \'px)\',\'-webkit-transform\': \'translateX(\' + -left + \'px)\'}\">\n				<div\n					class=\"our-values__block our-values__block--key-{{$index}} animation animation--fade-in-up\"\n					ng-repeat=\"(key, value) in values\"\n					ng-class=\"{\'our-values__block--inactive\':current!==key}\"\n					ng-click=\"goTo(key)\"\n					inview>\n\n					<div class=\"our-values__line\">\n						<div class=\"our-values__bullit content\" ng-bind=\"key+1\"></div>\n					</div>\n\n					<h4 class=\"title\" ng-bind=\"value.heading\"></h4>\n\n					<div class=\"content our-values__block__content\" ng-bind-html=\"value.content\"></div>\n				</div>\n			</div>\n		</div>\n\n		<button\n			class=\"btn btn--large btn--thin-border btn-absolute btn-absolute--left\"\n			ng-class=\"{\n				\'btn--hidden\': isFirst\n			}\"\n			ng-click=\"previous()\">\n			<span class=\"btn__icon btn__icon--arrow btn__icon--left\"></span>\n		</button>\n\n		<button\n			class=\"btn btn--large btn--thin-border btn-absolute btn-absolute--right\"\n			ng-class=\"{\n				\'btn--hidden\': isLast\n			}\"\n			ng-click=\"next()\">\n			<span class=\"btn__icon btn__icon--arrow\"></span>\n		</button>\n\n	</div>\n\n</div>\n");
$templateCache.put("components/blocks/process/process.tpl.html","<section\n	rel=\"{{block().UUID}}\"\n	class=\"section section--process section--image-bg\"\n	ng-class=\"[\n		\'section--padding-top-{{ block().paddingTop }}\',\n		\'section--padding-bottom-{{ block().paddingBottom }}\'\n	]\">\n\n	<!-- background -->\n	<div class=\"fixed-bg__container\">\n\n		<img\n			ng-if=\"block().backgroundImage[\'scaled-versions\']\"\n			class=\"fixed-bg__image fixed-bg__image--not-background\"\n			inview=\"lazyLoading\"\n			inview-offset-top=\"-150%\"\n			inview-offset-bottom=\"150%\"\n			breakpoint-image\n			breakpoint-image-use-inview\n			scaled-versions=\"{{ block().backgroundImage[\'scaled-versions\'] }}\"\n			sizes=\"\n				(min-width: 1024px) 100vw,\n				180vw\n			\"\n			image-fit=\"window\"\n			data-width=\"{{ block().backgroundImage[\'scaled-versions\'][0].width }}\"\n			data-height=\"{{ block().backgroundImage[\'scaled-versions\'][0].height }}\">\n\n	</div>\n\n	<div class=\"container container--no-bg clearfix\">\n\n		<!-- heading -->\n		<div class=\"tools__menu clearfix\">\n\n			<h2 class=\"heading heading--large\" ng-bind=\"block().title\"></h2>\n\n			<nav class=\"nav-menu\">\n				<ul class=\"nav-menu__list\" ng-click=\"showMenu = false\">\n\n					<li\n						ng-repeat=\"tool in tools\"\n						class=\"nav-menu__list-item\"\n						ng-class=\"{\'nav-menu__list-item--active\': current === $index}\"\n					>\n						<a class=\"nav-menu__list-item__link nav-menu__list-item__link--right\" ng-click=\"show($index)\">\n							<span class=\"nav-menu__list-item__copy\" ng-bind=\"tool.name\"></span>\n						</a>\n					</li>\n\n				</ul>\n			</nav>\n\n		</div>\n\n		<!-- tools -->\n		<div\n			class=\"tools__items tools__items--case-page tools__items--desktop clearfix\"\n			inview\n			inview-class=\"true\"\n			inview-offset-top=\"200px\">\n\n			<process-item\n				data=\"tool.a\"\n				class=\"tools__item\"\n				ng-class=\"{\n					\'tools__item--hide\':switch===\'b\',\n					\'tools__item--hide--next\':direction===\'next\',\n					\'tools__item--hide--previous\':direction===\'previous\'\n				}\">\n			</process-item>\n			<process-item\n				data=\"tool.b\"\n				class=\"tools__item\"\n				ng-class=\"{\n					\'tools__item--hide\':switch===\'a\',\n					\'tools__item--hide--next\':direction===\'next\',\n					\'tools__item--hide--previous\':direction===\'previous\'\n				}\">\n				</process-item>\n\n		</div>\n\n		<div class=\"tools__items tools__items--case-page tools__items--mobile clearfix\">\n\n			<!-- TODO: create directive for this? -->\n			<div ng-repeat=\"tool in tools\">\n				<process-item data=\"tool\" class=\"tools__item\" expandable></process-item>\n			</div>\n\n		</div>\n\n	</div>\n\n</section>\n");
$templateCache.put("components/blocks/publicity/publicity.tpl.html","<div\n	id=\"{{block().UUID}}\" ng-attr-id=\"{{block().UUID}}\"\n	class=\"section publicity\"\n	ng-class=\"[\n		\'section--padding-top-{{ block().paddingTop }}\',\n		\'section--padding-bottom-{{ block().paddingBottom }}\',\n		\'section--{{ block().backgroundColor }}\'\n	]\">\n	<div class=\"container\">\n		<div class=\"block\">\n\n			<h2 ng-if=\"block().title\" class=\"title\" ng-bind=\"block().title\"></h2>\n			<h3\n				ng-if=\"block().subtitle\"\n				class=\"subtitle\"\n				ng-bind=\"block().subtitle\"\n			>\n			</h4>\n			<div\n				ng-if=\"block().description\"\n				class=\"content description\"\n				ng-bind-html=\"block().description\"\n			>\n			</div>\n\n			<aside\n				ng-if=\"block().publicity\"\n				ng-class=\"{\n					\'flickity-enable-on-mobile\': block().publicity.length > 1,\n					\'flickity-enable-on-desktop\': block().publicity.length > 3\n				}\"\n			>\n				<ul\n					bc-flickity-id=\"flickity-case-publicity-{{block().UUID}}\"\n					bc-flickity=\"{{ flickityOptions }}\"\n					class=\"publicity-list animation__list\"\n					inview\n				>\n					<li\n						class=\"publicity-list__item animation animation--fade-in-up\"\n						data-ng-repeat=\"(key, item) in block().publicity\"\n					>\n						<a\n							ng-href=\"{{item.url}}\"\n							target=\"_blank\"\n							rel=\"noopener noreferrer\"\n						>\n							<div class=\"publicity-list__item__image-wrapper\">\n								<img\n									alt=\"{{ item.image[\'alt-text\'] }}\"\n									breakpoint-image\n									class=\"publicity-list__item__image\"\n									data-height=\"{{ item.image[\'scaled-versions\'][0].height }}\"\n									data-width=\"{{ item.image[\'scaled-versions\'][0].width }}\"\n									scaled-versions=\"{{ item.image[\'scaled-versions\'] }}\"\n									sizes=\"(min-width: 1440px) 242px, (min-width: 768px) 177px, calc(( 100% / 1.33 ) - 1rem)\"\n								/>\n								<span class=\"link-icon\"></span>\n								<span class=\"link-text\" ng-bind=\"item.linkText\"></span>\n							</div>\n							<div class=\"publicity-list__item__caption\">\n								<h4 class=\"publicity-list__item__title\" ng-bind=\"item.title\"></h4>\n								<div class=\"publicity-list__item__description\" ng-bind=\"item.description\"></div>\n							</div>\n						</a>\n					</li>\n				</ul>\n			</aside>\n\n		</div>\n	</div>\n</div>\n");
$templateCache.put("components/blocks/quote-block/quote-block.tpl.html","<div\n	id=\"{{block().UUID}}\" ng-attr-id=\"{{block().UUID}}\"\n	class=\"section section--quote\"\n	ng-class=\"[\n		\'section--padding-top-{{ block().paddingTop }}\',\n		\'section--padding-bottom-{{ block().paddingBottom }}\',\n		\'section--{{ block().backgroundColor }}\'\n	]\">\n\n	<div class=\"container\">\n		<div class=\"block\">\n			<h2 ng-if=\"block().title\" class=\"title\" ng-bind=\"block().title\"></h2>\n\n			<blockquote ng-attr-cite=\"{{ \'#\' + formatCite(block().author) }}\">\n				<p ng-bind=\"block().text\"></p>\n			</blockquote>\n\n			<cite ng-if=\"block().author\" ng-attr-id=\"{{ formatCite(block().author) }}\" class=\"content content--author\">\n				<span ng-if=\"block().author\" ng-bind=\"block().author\"></span><span ng-if=\"block().author && block().authorFunction\"> / </span><span ng-if=\"block().authorFunction\" ng-bind=\"block().authorFunction\"></span>\n			</cite>\n		</div>\n	</div>\n</div>\n");
$templateCache.put("components/blocks/static-text/static-text.tpl.html","<div\n	id=\"{{block().UUID}}\" ng-attr-id=\"{{block().UUID}}\"\n	class=\"section static-text\"\n	ng-class=\"[\n		\'section--padding-top-{{ block().paddingTop }}\',\n		\'section--padding-bottom-{{ block().paddingBottom }}\',\n		\'section--{{ block().backgroundColor }}\'\n	]\">\n\n	<div class=\"container\">\n		<div class=\"block block--no-gutter\">\n			<div\n				ng-if=\"block().titleColumn0 || block().titleColumn1\"\n				class=\"grid grid--half static-text--hidden-smallscreen\">\n\n				<!-- first column -->\n				<div class=\"grid__item\">\n					<h3 class=\"subtitle\" ng-bind=\"block().titleColumn0\"></h3>\n				</div>\n\n				<!-- second column -->\n				<div class=\"grid__item\">\n					<h3 class=\"subtitle\" ng-bind=\"block().titleColumn1\"></h3>\n				</div>\n			</div>\n\n			<div\n				class=\"content content--{{ block().contentStyle }} grid grid--half\"\n				ng-class=\"{ \'content--has-title\': block().titleColumn0 || block().titleColumn1 }\">\n\n				<!-- first column -->\n				<div class=\"grid__item\">\n					<h3\n						ng-if=\"block().titleColumn0\"\n						class=\"subtitle static-text--hidden-largescreen\"\n						ng-bind=\"block().titleColumn0\">\n					</h3>\n					<div ng-bind-html=\"block().column0\"></div>\n				</div>\n\n				<!-- second column -->\n				<div class=\"grid__item\">\n					<h3\n						ng-if=\"block().titleColumn1\"\n						class=\"subtitle static-text--hidden-largescreen\"\n						ng-bind=\"block().titleColumn1\">\n					</h3>\n					<div ng-bind-html=\"block().column1\"></div>\n				</div>\n			</div>\n		</div>\n	</div>\n</div>\n");
$templateCache.put("components/blocks/stats/stats.tpl.html","<div\n	class=\"section statistics clearfix\"\n	ng-class=\"[\n		\'section--padding-top-{{ block().paddingTop }}\',\n		\'section--padding-bottom-{{ block().paddingBottom }}\',\n		\'section--{{ block().backgroundColor }}\'\n	]\">\n	<div class=\"container\">\n		<div class=\"block\">\n			<h3 ng-if=\"block().title\" class=\"subtitle\" ng-bind=\"block().title\"></h3>\n\n			<div class=\"statistics__row\">\n				<div class=\"statistics__stat\" ng-repeat=\"stat in stats\">\n					<span\n						class=\"statistics__number\"\n						count-up-numbers=\"{{stat.value}}\"\n						inview=\"count\"\n						duration=\"{{$index * 300 + 1000}}\"\n						ng-bind=\"stat.value\">\n					</span>\n					<p class=\"statistics__metric\" ng-bind=\"stat.metric\"></p>\n				</div>\n			</div>\n\n		</div>\n	</div>\n</div>\n");
$templateCache.put("components/blocks/talks/talks.tpl.html","<div\n	id=\"{{block().UUID}}\" ng-attr-id=\"{{block().UUID}}\"\n	class=\"section section--talks section--table\"\n	ng-class=\"[\n		\'section--padding-top-{{ block().paddingTop }}\',\n		\'section--padding-bottom-{{ block().paddingBottom }}\',\n		\'section--{{ block().backgroundColor }}\'\n	]\">\n\n	<div class=\"container\">\n\n		<div class=\"block\">\n			<h2 class=\"title\" ng-bind=\"block().title\"></h2>\n		</div>\n\n		<div class=\"block block--expand\" expand=\"expand\" expand-start=\".table__row--start\">\n\n			<table class=\"table\">\n\n				<thead>\n					<tr>\n						<th></th>\n						<th>Event name</th>\n						<th>Location</th>\n					</tr>\n				</thead>\n				<tbody>\n					<tr\n						ng-repeat=\"talk in talks\"\n						class=\"table__row\"\n						ng-class=\"{\n							\'table__row--no-border-mobile\': $first,\n							\'table__row--start\': $index === startRow,\n							\'table__row--spacer\': talk.firstFutureEvent,\n							\'table__row--inactive\': talk.past,\n							\'table__row--last\': $last\n						}\">\n						<td class=\"table__cell table__cell--date\" ng-bind=\"talk.formattedDate\"></td>\n\n						<!-- With urls -->\n						<td class=\"table__cell\" ng-if=\"talk.url\">\n							<a ng-href=\"{{talk.url}}\" target=\"_blank\" rel=\"noopener noreferrer\" ng-bind=\"talk.event\"></a>\n						</td>\n						<td class=\"table__cell\" ng-if=\"talk.url\">\n							<a ng-href=\"{{talk.url}}\" target=\"_blank\" rel=\"noopener noreferrer\" ng-bind=\"talk.location\"></a>\n						</td>\n\n						<!-- Without urls -->\n						<td class=\"table__cell\" ng-if=\"!talk.url\">\n							<span ng-bind=\"talk.event\"></span>\n						</td>\n						<td class=\"table__cell\" ng-if=\"!talk.url\">\n							<span ng-bind=\"talk.location\"></span>\n						</td>\n					</tr>\n				</tbody>\n\n			</table>\n\n		</div>\n\n		<!-- show more button -->\n		<div\n			class=\"block block--show-more\"\n			ng-class=\"{\n				\'block--show-more--hide\': expand\n			}\"\n			expand=\"!expand\">\n\n			<button\n				class=\"btn btn--small\"\n				ng-click=\"expand=!expand\"\n				ng-show=\"!hideButton\">\n				Show more\n				<span class=\"btn__icon btn__icon--arrow btn__icon--down\"></span>\n			</button>\n\n		</div>\n\n	</div>\n\n</div>\n");
$templateCache.put("components/blocks/technology/technology.tpl.html","<div\n	id=\"{{block().UUID}}\" ng-attr-id=\"{{block().UUID}}\"\n	class=\"section section--technology section--slider\"\n	ng-class=\"[\n		\'section--padding-top-{{ block().paddingTop }}\',\n		\'section--padding-bottom-{{ block().paddingBottom }}\',\n		\'section--{{ block().backgroundColor }}\'\n	]\">\n\n	<div class=\"container\">\n\n		<!--heading block  -->\n		<div class=\"block\">\n\n			<h2\n				class=\"heading animation animation--header-bar-in\"\n				ng-bind=\"block().title\"\n				inview>\n			</h2>\n\n		</div>\n\n		<!-- technology block (dynamically loaded) -->\n		<div\n			class=\"block block--no-gutter grid grid--third\"\n			ng-class=\"{ \'grid--slider\': block().slider }\"\n			grid-slider=\"{{block().slider}}\">\n\n			<div\n				ng-class=\"{ \'grid--slider__inner\': block().slider }\"\n				class=\"animation__list clearfix\"\n				inview>\n\n				<div ng-repeat=\"(key, technology) in block().technology\"\n					class=\"grid__item grid__item--{{key}} animation animation--fade-in\">\n\n					<div\n						ng-if=\"technology.image[\'scaled-versions\'] !== null || technology.image.url !== \'\'\"\n						class=\"grid__image\"\n						ng-class=\"{ \'grid__image--{{ block().backgroundColor }}\': block().backgroundColor }\"\n						>\n\n						<!-- jpg/pngs images -->\n						<img\n							ng-if=\"technology.image[\'scaled-versions\'] !== null\"\n							alt=\"{{ technology.image[\'alt-text\'] }}\"\n							breakpoint-image\n							scaled-versions=\"{{ technology.image[\'scaled-versions\'] }}\"\n							sizes=\"(min-width: 1440px) 400px, (min-width: 768px) 300px, (min-width: 480px) 557px, (min-width: 420px) 482px, calc( 100vw + 17px )\"\n							data-width=\"{{ technology.image[\'scaled-versions\'][0].width }}\"\n							data-height=\"{{ technology.image[\'scaled-versions\'][0].height }}\">\n\n						<!-- SVG images -->\n						<div\n							ng-if=\"technology.image[\'scaled-versions\'] === null\"\n							class=\"grid__image__wrapper\">\n\n							<img\n								ng-if=\"technology.image.url\"\n								ng-src=\"{{ technology.image.url }}\"\n								alt=\"{{technology.image[\'alt-text\']}}\" />\n\n						</div>\n					</div>\n\n					<h3 class=\"subtitle\" ng-bind=\"technology.name\"></h3>\n					<div class=\"content\" ng-bind-html=\"technology.description\"></div>\n				</div>\n\n			</div>\n\n			<button\n				ng-if=\"block().slider\"\n				class=\"btn btn--large btn-absolute btn-absolute--left\"\n				ng-class=\"{\n					\'btn--hidden\': isFirst\n				}\"\n				ng-click=\"previous()\">\n				<span class=\"btn__icon btn__icon--arrow btn__icon--left\"></span>\n			</button>\n\n			<button\n				ng-if=\"block().slider\"\n				class=\"btn btn--large btn-absolute btn-absolute--right\"\n				ng-class=\"{\n					\'btn--hidden\': isLast\n				}\"\n				ng-click=\"next()\">\n				<span class=\"btn__icon btn__icon--arrow\"></span>\n			</button>\n\n		</div>\n\n	</div>\n\n</div>\n");
$templateCache.put("components/blocks/title-block/title-block.tpl.html","<div\n	id=\"{{block().UUID}}\" ng-attr-id=\"{{block().UUID}}\"\n	class=\"section title-block\"\n	ng-class=\"[\n		\'section--padding-top-{{ block().paddingTop }}\',\n		\'section--padding-bottom-{{ block().paddingBottom }}\',\n		\'section--{{ block().backgroundColor }}\'\n	]\">\n	<div class=\"container\">\n		<div class=\"block block--no-gutter\">\n			<h2 class=\"title\" ng-bind=\"block().title\"></h2>\n		</div>\n	</div>\n</div>\n");
$templateCache.put("components/blocks/toolkit/toolkit.tpl.html","<section\n	class=\"section toolkit\"\n	id=\"{{block().UUID}}\" ng-attr-id=\"{{block().UUID}}\"\n	ng-class=\"[\n		\'section--padding-top-{{ block().paddingTop }}\',\n		\'section--padding-bottom-{{ block().paddingBottom }}\',\n		\'section--{{ block().backgroundColor }}\'\n	]\">\n	<div class=\"container\">\n		<div class=\"block\">\n\n			<h2 ng-if=\"block().title\" class=\"title\" ng-bind=\"block().title\"></h2>\n			<h3\n				ng-if=\"block().subtitle\"\n				class=\"subtitle\"\n				ng-bind=\"block().subtitle\"\n			>\n			</h3>\n			<div\n				ng-if=\"block().description\"\n				class=\"content description\"\n				ng-bind-html=\"block().description\"\n			>\n			</div>\n\n			<aside\n				ng-if=\"block().tools\"\n				ng-class=\"{\n					\'flickity-enable-on-mobile\': block().tools.length > 2,\n					\'flickity-enable-on-tablet\': block().tools.length > 3,\n					\'flickity-enable-on-desktop\': block().tools.length > 4\n				}\"\n			>\n				<h5 class=\"subtitle\"><span ng-bind=\"block().tools.length\"></span> toolkit items used</h5>\n\n				<ul\n					bc-flickity-id=\"flickity-toolkit-{{block().UUID}}\"\n					bc-flickity=\"{{ flickityOptions }}\"\n					class=\"toolkit__list animation__list\"\n					inview>\n					<li\n						data-ng-repeat=\"tool in block().tools\"\n						class=\"toolkit__tool animation animation--fade-in\"\n					>\n						<a ui-sref=\"page({ urlSlug:tool.pageSlug })\">\n\n							<img\n								ng-if=\"tool.icon[\'scaled-versions\']\"\n								class=\"toolkit__image\"\n								alt=\"{{ tool.icon[\'alt-text\'] }}\"\n								breakpoint-image\n								ng-src=\"{{ tool.icon.url }}\"\n								ng-attr-data-height=\"{{tool.icon[\'scaled-versions\'][0].height}}\"\n								ng-attr-data-width=\"{{tool.icon[\'scaled-versions\'][0].width}}\"\n								ng-attr-scaled-versions=\"{{tool.icon[\'scaled-versions\']}}\"\n							/>\n							<div class=\"img-container\">\n								<img\n									ng-if=\"!tool.icon[\'scaled-versions\']\"\n									class=\"toolkit__image\"\n									alt=\"{{ tool.icon[\'alt-text\'] }}\"\n									width=\"100%\"\n									height=\"100%\"\n									ng-src=\"{{ tool.icon.url }}\"\n								/>\n							</div>\n							<div class=\"toolkit__name-container\">\n								<div class=\"toolkit__name\">\n									<span class=\"toolkit__name__text\" ng-bind=\"removeLastWord(tool)\"></span>\n									<span class=\"toolkit__name__last-word\" ng-bind=\"getLastWord(tool)\"></span>\n								</div>\n							</div>\n						</a>\n					</li>\n				</ul>\n			</aside>\n		</div>\n	</div>\n</section>\n");
$templateCache.put("components/blocks/tools-overview/tools-overview.tpl.html","<div\n	id=\"{{block().UUID}}\" ng-attr-id=\"{{block().UUID}}\"\n	class=\"section tools-overview\"\n	ng-class=\"[\n		\'section--padding-top-{{ block().paddingTop }}\',\n		\'section--padding-bottom-{{ block().paddingBottom }}\',\n		\'section--{{ block().backgroundColor }}\'\n	]\">\n\n	<div class=\"container\">\n\n		<!-- heading block  -->\n		<div class=\"block\">\n			<h2\n				class=\"subtitle animation animation--header-bar-in\"\n				ng-bind=\"block().title\"\n				inview>\n			</h2>\n		</div>\n\n		<!-- overview of selected tools -->\n		<div\n			class=\"block block--no-gutter\">\n\n			<div class=\"tools-grid\">\n				<a\n					ng-repeat=\"tool in block().tools\"\n					ui-sref=\"page({ urlSlug:tool.url })\"\n					class=\"tools-grid__item\">\n\n					<!-- Icon -->\n					<div\n						ng-if=\"!tool.icon[\'scaled-versions\']\"\n						class=\"tools-grid__item__image tools-grid__item__image--icon\">\n						<img ng-src=\"{{ tool.icon.url }}\" alt=\"tool.icon[\'alt-text\']\">\n					</div>\n\n					<!-- Image -->\n					<div\n						ng-if=\"tool.icon[\'scaled-versions\']\"\n						class=\"tools-grid__item__image\">\n						<img\n							alt=\"tool.icon[\'alt-text\']\"\n							breakpoint-image\n							scaled-versions=\"{{ tool.icon[\'scaled-versions\'] }}\"\n							sizes=\"(min-width: 1440px) 216px, (min-width: 768px) 154px, (min-width: 480px) 310px, calc( 50vw - 100px )\"\n							data-width=\"{{ tool.icon[\'scaled-versions\'][0].width }}\"\n							data-height=\"{{ tool.icon[\'scaled-versions\'][0].height }}\">\n					</div>\n\n					<div class=\"tools-grid__item__title\" ng-bind=\"tool.name\"></div>\n\n				</a>\n			</div>\n		</div>\n\n	</div>\n</div>\n");
$templateCache.put("components/blocks/checkerboard/checkerboard-box/checkerboard-box.tpl.html","<div class=\"checkerboard__box\">\n	<img\n		ng-if=\"item().type === \'image\' && item().image[\'scaled-versions\']\"\n		alt=\"{{ item().image[\'alt-text\'] }}\"\n		breakpoint-image\n		scaled-versions=\"{{ item().image[\'scaled-versions\'] }}\"\n		sizes=\"(min-width: 1024px) calc( ( ( 100vw - 224px ) / 2 ) * 2 ), (min-width: 768px) calc( 50vw * 2.5 ), 100vw\">\n\n	<div class=\"checkerboard__content\"\n		ng-if=\"item().type === \'text\' || item().type === \'title\'\">\n		<h2\n			ng-if=\"item().title\"\n			class=\"lg-title\"\n			ng-bind=\"item().title\">\n		</h2>\n\n		<div ng-if=\"item().text\" class=\"content\" ng-bind-html=\"item().text\"></div>\n	</div>\n</div>\n");}]);
/* global ga */

(function() {
  'use strict';
  /**
	 * @ngdoc function
	 * @name cf-website.directive:work-overview-item
	 * @description Item in the work overview page
	 */
  angular
    .module('cf-website')
    .directive('workOverviewItem', ["$rootScope", "$document", "$timeout", "particleManager", "supportTest", "offset", function(
      $rootScope,
      $document,
      $timeout,
      particleManager,
      supportTest,
      offset
    ) {
      return {
        restrict: 'E',
        scope: {
          case: '&'
        },
        replace: true,
        templateUrl:
          'components/work-overview-item/work-overview-item.tpl.html',
        link: function postLink(scope, element) {
          scope.case = scope.case();
          scope.case.UUID = scope.case.caseId;
          scope.usingParticles = particleManager.isSupported;
          scope.isIE = supportTest.isIE();

          $timeout(function() {
            scope.observer = $rootScope.createObserver(0.5);
            scope.observer.observe(element[0]);
          });

          function onvisible(evt, data) {
            if (angular.equals(element, angular.element(data.target))) {
              $rootScope.lastActiveCase = scope.case.caseId;
              // Check if the scope is inactive before triggering
              if (!scope.isActive) {
                scope.isActive = true;
                scope.$apply();

                $timeout(function() {
                  var logo = element[0]
                    .querySelector('.work-overview__item__logo-placeholder')
                    .getBoundingClientRect();

                  var button = element[0]
                    .querySelector('.js-work-overview-item-button')
                    .getBoundingClientRect();

                  var top = logo.top + logo.height + 48;
                  var text = '';

                  if (scope.case.introText.particleTexts.length > 0) {
                    text = scope.case.introText.particleTexts[0].join('|');
                  } else {
                    return scope.$emit('error', {
                      place: 'work-overview-item',
                      name: 'missingData',
                      message: 'Work block contains invalid or missing data',
                      error: scope.case
                    });
                  }

                  particleManager
                    .reset()
                    .fixed()
                    .update({
                      type: 'text',
                      text: text,
                      color: [255, 255, 255],
                      scale: 0.65,
                      origin: {
                        x: 64,
                        y: top
                      },
                      offset: {
                        bottom:
                          window.innerHeight - button.top - top + button.height
                      },
                      center: false,
                      settings: {
                        drag: 0.7,
                        maxSpeed: 6.4,
                        medianSpeed: 2.4,
                        turbulence: 0.5,
                        pathLength: 0.04,
                        size: 4,
                        colorIntensity: 0.9,

                        // speed up transitions
                        transition: {
                          attractorSpeed: 3.5,
                          attractorForce: 2.5,
                          destinationForce: 5
                        },
                        mouseOver: {
                          range: 60,
                          multiplier: 1
                        },
                        brush: {
                          size: 1.9,
                          intensity: 0.22,
                          multiplier: 1
                        }
                      }
                    });

                  // ie
                  if (scope.isIE) {
                    particleManager.stop();
                  }
                }, 100);

                //send to GA
                if (window.ga) {
                  ga('send', 'event', 'Cases', 'show', scope.case.caseId, {
                    nonInteraction: true
                  });
                }
              }
            } else {
              scope.isActive = false;
            }
          }

          scope.$on('intersectionChange', onvisible);

          scope.$on('lowFPS', function() {
            scope.usingParticles = false;
          });

          scope.$on('$destroy', function() {
            if (scope.observer) {
              scope.observer.unobserve(element[0]);
              delete scope.observer;
            }
          });

          // was previously in view
          if ($rootScope.lastActiveCase === scope.case.caseId) {
            $timeout(function() {
              var px = offset.get(element).top;
              $document.scrollTopAnimated(px);
            });
          }
        }
      };
    }]);
})();

(function() {
	'use strict';

	/**
	 * @ngdoc function
	 * @name cf-website.controller:HomeCtrl
	 * @description Controller for the home page
	 */
	angular.module('cf-website')
		.controller('WorkCtrl', ["$scope", "$rootScope", "$timeout", "JSONdata", function ($scope, $rootScope, $timeout, JSONdata) {

			// Once we receive the resolved data from the router send a pageChange
			// event so we can update the meta data of the page.
			$rootScope.$broadcast('pageChange', JSONdata.data);

			// Retrieve data from route promise
			var data = JSONdata.data.blocks[0];

			// Add metadata to data object. This page behaves different than others.
			data.metadata = JSONdata.data.metadata;
			$scope.cases = data.cases;
		}]);
})();

(function() {
	'use strict';

	/**
	 * @ngdoc function
	 * @name cf-website.directive:videojs
	 * @description Loads videojs for an mp4 url
	 */
	angular.module('cf-website')
		.directive('videojs', function() {
			return {
				restrict: 'A',
				link: function postLink(scope, element, attr) {

					var url = attr.videojs;

					// Since this is a breaking change I'm defaulting to false here
					// Right now only the introduction block overrides this value
					var playOnLoad = (attr.playOnLoad === 'true') || false;

					element[0].setAttribute('src', url);
					element[0].setAttribute('poster', attr.poster);

					// Initialize the player and when needed automatically start it
					var player = videojs(element[0], {}, function onPlayerReady() {

						// In this context, `this` is the player that was
						// created by Video.js
						// Start playing automatically if we passed the playOnLoad attribute
						// from the parent directive, such as in the introduction block
						if (playOnLoad) {
							this.play();
						}
					});

					// Mute video when mute attribute is defined VideoJS does not check
					// what the value of this attribute is.
					player.muted(attr.muted ? true : false);

					// mute?
					scope.$on('mute', function(evt, mute) {
						player.muted(mute);
					});

					// loop?
					scope.$on('loop', function(evt, loop) {
						player.loop(loop || true);
					});

					// current time
					scope.$on('currentTime', function(evt, time) {
						player.currentTime(time || 0);
					});

					scope.$on('pause', function() {
						player.pause();
					});

					// play
					scope.$on('play', function() {
						player.play();
					});

					// toggle fullscreen
					scope.$on('toggle-fullscreen', function() {
						player.requestFullscreen();
					});

					player.ready(function() {

						// manual detection of ended evt.
						player.on('timeupdate', function() {
							var duration = element[0].duration;
							var current = element[0].currentTime;

							if (Math.abs(duration - current) < 0.1) {
								scope.$emit('ended', element);
							}
						});

						//send ended event
						player.on('play', function(evt) {
							scope.$emit('play', evt, element);
						});
					});

					//fullscreen ended on iOS...
					var exitFullscreen = function() {
						scope.$emit('exitFullscreen');
					};

					player.on('fullscreenchange', function(evt) {

						if (!player.isFullscreen()) {
							scope.$emit('exitFullscreen');
						}

						scope.$emit('fullscreen', evt);
					});

					//go back to normal view when fullscreen is closed (iOS)
					element[0].addEventListener('webkitendfullscreen', exitFullscreen, false);

					scope.$on('$destroy', function() {

						//remove fullscreen evt listener
						element[0].removeEventListener('webkitendfullscreen', exitFullscreen, false);

						//event listener for video player
						player.off('ended');
						player.off('play');
						player.off('pause');
						player.dispose();

						//remove videojs
						player = undefined;
					});

				}
			};
		});
})();

(function() {
	'use strict';

	/**
	 * @ngdoc function
	 * @name cf-website.service:uuid
	 * @description generates unique identification
	 */
	angular.module('cf-website')
		.service('UUID', function() {

			this.get = function() {
				function _p8(s) {
					var p = (Math.random().toString(16) + '000000000').substr(2, 8);
					return s ? '-' + p.substr(0, 4) + '-' + p.substr(4, 4) : p ;
				}
				return _p8() + _p8(true) + _p8(true) + _p8();
			};

		});

}());

(function() {
	'use strict';

	/**
	 * @ngdoc function
	 * @name cf-website.service:supportTest
	 * @description Test support for features
	 */
	angular.module('cf-website')
			.service('supportTest', function() {

			//save values to cache
			var cache = {};

			/**
			 * Detect support for mp4 videos
			 * @returns {boolean}
			 */
			this.mp4 = function() {

				if (cache.mp4 !== undefined) {
					return cache.mp4;
				}

				var support = false;
				var video = document.createElement('video');

				if (video && video.canPlayType && video.canPlayType('video/mp4') !== '') {
					support = true;
				}

				//save to cache
				cache.mp4 = support;

				return support;
			};

			//todo when needed for particles
			this.webgl = function() {

				if (!this.localStorage() || localStorage.performance === '0') {
					return false;
				}

				if (cache.webgl !== undefined) {
					return cache.webgl;
				}

				var check = function() {

					try {
						var canvas = document.createElement( 'canvas' );

						return !!(
							window.WebGLRenderingContext &&
							( canvas.getContext( 'webgl' ) || canvas.getContext( 'experimental-webgl' )
						) );
					}

					catch ( e ) {
						return false;
					}

				};

				cache.webgl = check();
				return cache.webgl;

			};

			this.isIE = function() {

				var getIEVersion = function() {
					var rv = -1;
					var ua;
					var re;
					if (navigator.appName === 'Microsoft Internet Explorer') {
						ua = navigator.userAgent;
						re  = new RegExp('MSIE ([0-9]{1,}[\.0-9]{0,})');
						if (re.exec(ua) !== null) {
							rv = parseFloat( RegExp.$1 );
							return rv;
						}
					} else if (navigator.appName === 'Netscape') {
						ua = navigator.userAgent;
						if (ua.indexOf('Trident') > -1) {
							rv = 11;
							return rv;
						} else if (ua.indexOf('Edge') > -1) {
							rv = 12;
							return rv;
						}
					}
					return rv;
				};

				if (getIEVersion() !== -1) {
					return true;
				} else {
					return false;
				}
			};

			this.isSafari8 = function() {

				if (cache.isSafari8 !== undefined) {
					return cache.isSafari8;
				}

				var isSafari = navigator.userAgent.indexOf('Safari') > -1;
				var element = document.createElement('div');
				var support = element.style.animationName === undefined && element.style.WebkitAnimationName !== undefined && isSafari;

				cache.isSafari8 = support;
				return support;

			};

			this.localStorage = function() {

				var support = function() {

					var test = 'test';
					try {
						localStorage.setItem(test, test);
						localStorage.removeItem(test);
						return true;
					} catch (e) {
						return false;
					}

				};

				if (cache.localStorage !== undefined) {
					return cache.webgl;
				} else {
					cache.localStorage = support();
					return cache.localStorage;
				}

			};

			this.srcSet = function() {

				if (cache.srcSet !== undefined) {
					return cache.srcSet;
				} else {

					var temp = document.createElement('img');
					var supported = false;

					if (temp.srcset) {
						supported = true;
					}

					cache.srcSet = supported;
					return supported;
				}
			};

		});

}());

(function() {
	'use strict';

	/**
	 * @ngdoc function
	 * @name cf-website.directive:particles
	 * @description Manages particles
	 */
	angular.module('cf-website')
		.directive('particles', ["$q", "$rootScope", "supportTest", "particleManager", function($q, $rootScope, supportTest, particleManager) {
			return {
				restrict: 'E',
				scope: {},
				templateUrl: 'components/particles/particles.tpl.html',
				link: function postLink(scope, element) {

					//check for WebGL compatability
					if ( !supportTest.webgl() ) {
						return false;
					}

					//create grid
					var canvas = element[0].querySelector('.particles__container');
					particleManager.create(canvas);

					//resize evt.
					window.addEventListener('resize', particleManager.resize.bind(particleManager));

					//stop rendering when element is out of view
					scope.play = function(play) {

							if (play) {
								particleManager.start();
							} else {
								if (!particleManager.isFixed()) {
									particleManager.stop();
								}
							}

					};

				}
			};
		}]);

})();

/* global dat, ga */

(function() {
	'use strict';

	/**
	 * @ngdoc function
	 * @name cf-website.service:particleManager
	 * @description Manages particles viz
	 */
	angular.module('cf-website')
		.service('particleManager', ["$q", "$rootScope", "$state", "supportTest", "breakpoints", function($q, $rootScope, $state, supportTest, breakpoints) {

			var canvas, _canvas, world, font, FPS, isFixed;
			var hasControls = false;

			//create promise for later use
			var defer = $q.defer();
			var promise = defer.promise;

			//offset for drawing origin of font
			var offset = {};

			//mobile detection
			var isMobile = breakpoints.oneOf('xs', 's', 'm');

			//check if particles should be run
			this.isSupported = !isMobile && supportTest.webgl();

			//defaults for noise field
			var noiseDefault = {
				amount: 90,
				factor: 100,
				multiply: 0.4
			};

			/**
			 * Create instance of a particle grid
			 * @param {domElement} element - Container element for new canvas
			 */
			this.create = function(element) {

				//only with webgl
				if ( !this.isSupported ) {
					return false;
				}

				//create grid
				canvas = element;
				_canvas = angular.element(canvas);
				world = new particles.World(canvas);

				//create font
				font = new particles.Font(world);
				font.loadUrl('data/font.svg', function() {

					//indicate font is loaded
					defer.resolve();

				});

				//use fps stats
				var self = this;
				FPS = new particles.Stats(world, function(failed, avg) {

					// check Google Analytics support
					if (localStorage.performance !== '1') {

						//boolean value indication threshold
						if (failed) {

							if (window.ga) {
								ga('send', 'event', 'Particles', 'hide', 'lowFPS', avg, {
									nonInteraction: true
								});
							}

							//mark as low performant
							localStorage.performance = 0;
							self.isSupported = false;

							//send event
							$rootScope.$broadcast('lowFPS', avg);

						}

						//send average FPS
						if (window.ga) {
							ga('send', 'event', 'Particles', 'play', 'FPS', avg, {
								nonInteraction: true
							});
						}

					}

				});

			};

			/**
			* Creates text out of particles
			* @param {string} text - Text to display
			* @param {Array} color - Color for the particles
			* @param {number} scale - Scale of font, default 1
			* @private
			*/
			var createText = function(text, color, scale, offsets, center) {

				//settings
				world.brush.size = 3 * scale;

				//create text
				font
					.reset()
					.origin(offset.x, offset.y)
					.scale(1.3 * scale)
					.fitInBoundingBox(text, undefined, offsets, center);

				//coloring
				world.color = color;

				//more custom options
				world.drag = 0.7;

			};

			/**
			* Create wind simulation for work overview page
			* @private
			*/
			var createOverview = function(amount, factor, multiply) {

				//create random noise
				var overview = new particles.Overview(world, amount);

				overview.factor = factor;
				overview.multiply = multiply;

				overview.generate();

			};

			var readColors = function() {

				var image = this;

				var width = world.width;
				var height = world.height;

				var canvasImage = document.createElement('canvas');
				canvasImage.width = width;
				canvasImage.height = height;
				var context = canvasImage.getContext('2d');

				var hRatio = width  / image.width;
				var vRatio =  height / image.height;
				var ratio  = Math.max ( hRatio, vRatio );

				//shift ratio to create some pixel offsets
				ratio *= 1.2;

				var left = ( width - image.width * ratio ) / 2;
				var top = ( height - image.height * ratio ) / 2;
				context.drawImage(image, 0, 0, image.width, image.height, left, top, image.width * ratio, image.height * ratio);

				var pixels = context.getImageData(0, 0, width, height).data;

				world.customColor = function(x, y) {

					x = Math.floor(width * (x / world.width));
					y = Math.floor(height * (y / world.height));

					if (x >= width || y >= height) {
						return [0, 0, 0];
					}

					var index = ((y * width) + x) * 4;
					var pixel = [
						pixels[index],
						pixels[index + 1],
						pixels[index + 2],
						pixels[index + 3]
					];

					return [pixel[0] / 255, pixel[1] / 255, pixel[2] / 255];

				};

			};

			/**
			 * Stop rendering
			 * @returns {this} - Chainable
			 */
			this.stop = function() {

				//only with webgl
				if ( !supportTest.webgl() ) {
					return this;
				}

				if (world) {
					world.stop();
				}

				return this;
			};

			/**
			 * Starts rendering
			 * @returns {this} - Chainable
			 */
			this.start = function() {

				//only with webgl
				if ( !this.isSupported ) {
					return this;
				}

				world.start();
				return this;
			};

			/**
			* Toggles visibility
			* @param {boolean} show - Indicate whether to show or hide
			* @returns {this} - Chainable
			*/
			this.visibility = function(show) {

				//only with webgl
				if ( !this.isSupported || !world ) {
					return this;
				}

				if (show) {
					_canvas.removeClass('particles__container--hide');
				} else {
					_canvas.addClass('particles__container--hide');
				}

				//chainable
				return this;

			};

			var lastUpdate;

			/**
			* Create/update/refresh particles viz
			* @param {Object} update - Optional, when used save new preset
			* @returns {this} - chainable
			*/
			this.update = function(update) {

				//check for WebGL compatability
				if ( !this.isSupported || localStorage.performance === '0' ) {
					this.destroy();
					return this;
				}

				//use last preset or new?
				update = update || lastUpdate;

				//valid update?
				if (!update || !update.type) {
					return this;
				}

				//world created?
				if (!world || !canvas) {
					return this;
				}

				//positioning settings
				offset = update.origin || { x: 80, y: 80 };

				var offsets = { top: 0, bottom: 0, left: 0, right: 0 };
				if (update.offset) {
					offsets.bottom = update.offset.bottom || 0;
					offsets.top = update.offset.top || 0;
					offsets.left = update.offset.left || 0;
					offsets.right = update.offset.right || 0;
				}

				//only override settings when controls aren't added, this wil conflict otherwise
				if (!hasControls) {

					//settings - categories
					update.settings = update.settings || {};
					update.settings.transition = update.settings.transition || {};
					update.settings.mouseOver = update.settings.mouseOver || {};
					update.settings.brush = update.settings.brush || {};
					update.settings.color = update.settings.color || {};
					update.settings.blur = update.settings.blur || {};

					//override default settings
					world.drag = update.settings.drag || 0.7;
					world.maxAge = update.settings.maxAge || 100;
					world.maxSpeed = update.settings.maxSpeed || 12;
					world.medianSpeed = update.settings.medianSpeed || 3.2;
					world.turbulence = update.settings.turbulence || 0.6;
					world.webgl.tracing.uniforms.pathLength.value = update.settings.pathLength || 0.035;
					world.webgl.material.size = update.settings.size || 3.5;
					world.colorIntensity = update.settings.colorIntensity || 0.97;

					world.transition.attractorSpeed = update.settings.transition.attractorSpeed || 2.5;
					world.transition.attractorForce = update.settings.transition.attractorForce || 2.5;
					world.transition.destinationForce = update.settings.transition.destinationForce || 3.5;
					world.transition.limitSpeed = update.settings.transition.limitSpeed || false;

					world.mouseOver.range = update.settings.mouseOver.range || 75;
					world.mouseOver.multiplier = update.settings.mouseOver.multiplier || 2.2;

					world.brush.size = update.settings.brush.size || 1.9;
					world.brush.intensity = update.settings.brush.intensity || 0.34;
					world.brush.multiplier = update.settings.brush.multiplier || 1;

					world.useColorOffset  = update.settings.color.useColorOffset || false;
					world.colorOffset  = update.settings.color.colorOffset || 3;
					world.colorMix  = update.settings.color.colorMix || 0.1;

					world.webgl.tiltH.uniforms.h.value = update.settings.blur.h || 0.001;
					world.webgl.tiltV.uniforms.v.value = update.settings.blur.v || 0.001;
					world.webgl.tiltH.uniforms.spread.value = update.settings.blur.spread || 1.4;
					world.webgl.tiltV.uniforms.spread.value = update.settings.blur.spread || 1.4;
					world.webgl.tiltV.process.active = update.settings.blur.on || false;
					world.webgl.tiltH.process.active = update.settings.blur.on || false;

				}

				switch (update.type){

					case 'text':

						promise.then(function() {

							createText(
								update.text,
								update.color || [0, 0, 0],
								update.scale || 1,
								offsets,
								update.center === false ? false : true
							);

							//reset coloring
							world.customColor = undefined;

							//hide element when needed
							if (update.callback instanceof Function) {
								update.callback();
							}

						});

					break;

					case 'overview':

						promise.then(function() {

							var amount = noiseDefault.amount;
							var factor = noiseDefault.factor;
							var multiply = noiseDefault.multiply;
							createOverview(amount, factor, multiply);

							//custom coloring
							var img = new Image();
							img.src = update.imageSrc;

							//coloring
							img.addEventListener('load', readColors.bind(img));

							//hide element when needed
							if (update.callback instanceof Function) {
								update.callback();
							}

						});

					break;

				}

				//save for refresh
				lastUpdate = update;

				//chainable
				return this;

			};

			/**
			 * Shorthand for making sure particles are in normal visible state again
			 * @returns {this} - Chainable
			 */
			this.reset = function() {

				//don't reset when on mobile
				if (isMobile || !_canvas) {
					return this;
				}

				//reset fixed state to absolute positioning
				if (isFixed) {
					_canvas.removeClass('fixed');
					isFixed = false;
				}

				//make sure is visible and working
				this.visibility(true);
				this.start();

				//chainable
				return this;
			};

			/**
			 * Clears all forces from the grid
			 * @returns {this} - Chainable
			 */
			this.clearGrid = function() {
				if (world) {
					world.clearGrid();
				}

				//chainable
				return this;
			};

			/**
			 * Set position of particles to fixed
			 * @returns {this} - Chainable
			 */
			this.fixed = function() {

				//prevent errors
				if (!_canvas) {
					return this;
				}

				_canvas.addClass('fixed');
				isFixed = true;

				//chainable
				return this;

			};

			/**
			 * See if particles are currently in a fixed (CSS) state
			 * @returns {boolean}
			 */
			this.isFixed = function() {
				return isFixed;
			};

			/**
			 * Triggers a resize for the particles
			 */
			var lastResizeEvt;
			this.resize = function() {

				//debounce generation of new font
				clearTimeout(lastResizeEvt);
				lastResizeEvt = setTimeout(function() {

					if (world) {
						world.resize();
					}

					this.update();

				}.bind(this), 250);
			};

			this.destroy = function() {

				if (world) {
					world.stop();
				}

				if (_canvas) {
					_canvas.addClass('particles__container--hide');
				}

			};

			this.reactivate = function() {
				localStorage.performance = '1';
				location.reload();
			};

			/**
			 * Add DATGUI settings pannel
			 */
			var addControls = function() {

				//prevent adding double instances of controls
				if (hasControls) {
					return false;
				}

				var gui = new dat.GUI();
				var f0 = gui.addFolder('Settings');
				var f1 = gui.addFolder('Transitions');
				var f2 = gui.addFolder('Mouse');
				var f3 = gui.addFolder('Brush');
				var f4 = gui.addFolder('Colors');
				var f6 = gui.addFolder('Blur');

				// var f5 = gui.addFolder('Force field');

				f0.add(world, 'drag', 0, 0.99);
				f0.add(world, 'maxAge', 0, 1000).name('max age');
				f0.add(world, 'maxSpeed', 0, 20).name('max speed');
				f0.add(world, 'medianSpeed', 0, 9.99).name('median speed');
				f0.add(world, 'turbulence', 0, 3.5);
				f0.add(world.webgl.tracing.uniforms.pathLength, 'value', 0.001, 0.5).name('tracing');
				f0.add(world.webgl.material, 'size', 0.5, 25).name('particle size');
				f0.add(world, 'colorIntensity', 0.01, 0.99).name('color intensity');

				//Transitions
				f1.add(world.transition, 'attractorSpeed', 0.50, 4.99).name('attractor speed').onFinishChange( this.update );
				f1.add(world.transition, 'attractorForce', 0.50, 4.99).name('attractor force').onFinishChange( this.update );
				f1.add(world.transition, 'destinationForce', 0.50, 5.99).name('target force').onFinishChange( this.update );
				f1.add(world.transition, 'limitSpeed').name('limit speed').onFinishChange( this.update );

				//Mouse
				f2.add(world.mouseOver, 'range', 20, 500);
				f2.add(world.mouseOver, 'multiplier', 0.1, 5.0);

				//Brush
				f3.add(world.brush, 'size', 0.1, 5.0);
				f3.add(world.brush, 'intensity', 0.01, 1);
				f3.add(world.brush, 'multiplier', 1, 10);

				//colors
				f4.add(world, 'colorMix', 0.001, 0.999).name('color mix');
				f4.add(world, 'colorOffset', 0.5, 3.5).name('color offset');
				f4.add(world, 'useColorOffset').name('use offset');
				f4.add(world, 'invertColor').name('invert color');

				//fx
				f6.add(world.webgl.tiltH.uniforms.h, 'value', 0.0001, 0.01).name('tilt shift');
				f6.add(world.webgl.tiltV.uniforms.v, 'value', 0.0001, 0.01).name('tilt shift');

				f6.add(world.webgl.tiltH.uniforms.r, 'value', 0.001, 0.999).name('tilt shift pos h');
				f6.add(world.webgl.tiltV.uniforms.r, 'value', 0.001, 0.999).name('tilt shift pos v');

				f6.add(world.webgl.tiltH.uniforms.spread, 'value', 0.5, 3.1).name('spread h');
				f6.add(world.webgl.tiltV.uniforms.spread, 'value', 0.5, 3.1).name('spread v');

				f6.add(world.webgl.tiltV.process, 'active').name('blur v on');
				f6.add(world.webgl.tiltH.process, 'active').name('blur h on');

				hasControls = true;

			}.bind(this);

			var self = this;

			//listen for key combos
			window.addEventListener('keydown', function(evt) {
				if (evt.keyCode === 49 && evt.ctrlKey) {
					addControls();
				}
				if (evt.keyCode === 50 && evt.ctrlKey) {
					self.reactivate();
				}
			});

			//listen for changes in breakpoints
			$rootScope.$on('breakpoint', function() {

				isMobile = breakpoints.oneOf('xs', 's', 'm');
				self.isSupported = !isMobile && supportTest.webgl();

				//disable rendering on mobile
				if (isMobile && _canvas) {

					//hide canvas
					_canvas.addClass('particles__container--hide');
					world.stop();

					//trigger reload because something may now be invalid
					$state.go( $state.current, { }, { reload: true } );

				}

				//when world isn't defined at start, webgl isn't supported until a refresh
				if (!world) {
					self.isSupported = false;
				}

			});

		}]);

}());

(function() {
	'use strict';

	/**
	 * @ngdoc function
	 * @name cf-website.directive:pageFooter
	 * @description Footer section for case pages
	 */
	angular.module('cf-website')
		.directive('pageFooter', ["API", function(API) {
			return {
				restrict: 'E',
				scope: {
					'currentCase': '@'
				},
				replace: true,
				templateUrl: 'components/page-footer/page-footer.tpl.html',
				link: function postLink(scope) {

					scope.nextCases = [];

					/**
					 * Get the index of a object key inside an array.
					 * @param  {Array} casesArray Array with cases
					 * @return {number}           Number representing the index of the case
					 */
					var getCurrentCaseIndex = function(casesArray) {
						for (var i = 0; i < casesArray.length; i++) {
							var caseId = casesArray[i].caseId;

							if (caseId === scope.currentCase) {
								return i;
							}
						}
					};

					/**
					 * Check based on the index of the current case which next two cases
					 * should be displayed at the footer.
					 * @param {Array} casesArray Array with cases
					 */
					var setNextCases = function(casesArray) {
						var currentIndex = getCurrentCaseIndex(casesArray);
						var previousIndex = currentIndex - 1 < 0 ? casesArray.length - 1 : currentIndex - 1;
						var nextIndex = currentIndex >= casesArray.length - 1 ? 0 : currentIndex + 1;

						scope.nextCases = [scope.cases[previousIndex], scope.cases[nextIndex]];
					};

					//load projects from API
					API
						.retrieve('work.json')
						.then(function(result) {

							if (!result.data.blocks || result.data.blocks.length !== 1) {

								scope.$emit({
									place: 'work-overview',
									name: 'invalidData',
									message: 'Work overview contains invalid data',
									data: result,
									error: {}
								});

							}

							scope.cases = result.data.blocks[0].cases;

							// Create array with next cases
							setNextCases(scope.cases);

						});

				}
			};
		}]);

})();

(function() {
	'use strict';

	/**
	 * @ngdoc function
	 * @name cf-website.controller:PageCtrl
	 * @description Controller for the dynamic pages
	 */
	angular.module('cf-website')
		.controller('PageCtrl', ["$rootScope", "$scope", "$state", "$stateParams", "particleManager", "JSONdata", function ($rootScope, $scope, $state, $stateParams, particleManager, JSONdata) {

				// Once we receive the resolved data from the router send a pageChange
				// event so we can update the meta data of the page.
				$rootScope.$broadcast('pageChange', JSONdata.data);

				// Retrieve data from route promise
				$scope.page = JSONdata.data;

				$scope.stateParams = $stateParams;
				$scope.isProject = $state.current.name === 'project' ? true : false;

				// track if block has introduction, needed for particles
				var hasParticles = false;
				if (JSONdata && JSONdata.data && JSONdata.data.blocks && JSONdata.data.blocks.length > 0) {

					// add UUID's to blocks
					JSONdata.data.blocks.forEach(function(block) {
						if (block.title) {
							if (block.type === 'caseintro') {
								hasParticles = true;
							} else if (block.type === 'carousel' && block.particles) {
								hasParticles = true;
							}
						}
					});
				}

				// save current case to return to this scroll position when going back to work overview page
				if ($state.current.name === 'project') {
					$rootScope.lastActiveCase = $scope.page.slug;
				}

				// hide particles on pages
				if ($state.current.name === 'page' || !hasParticles) {

					particleManager
						.reset()
						.clearGrid()
						.visibility(false)
						.stop();
				}

		}]);
})();

(function() {
	'use strict';

	/**
	 * @ngdoc function
	 * @name cf-website.service:uuid
	 * @description generates unique identification
	 */
	angular.module('cf-website')
			.service('offset', function() {

			//jquery offset top to vanilla js
			var isWindow = function( obj ) {
					return obj !== null && obj === obj.window;
			};
			var getWindow = function( elem ) {
					return isWindow( elem ) ? elem : elem.nodeType === 9 && elem.defaultView;
			};
			var offset = function( elem ) {

					var docElem, win,
							box = { top: 0, left: 0 },
							doc = elem && elem.ownerDocument;

					docElem = doc.documentElement;

					if ( typeof elem.getBoundingClientRect !== typeof undefined ) {
							box = elem.getBoundingClientRect();
					}
					win = getWindow( doc );
					return {
							top: box.top + win.pageYOffset - docElem.clientTop,
							left: box.left + win.pageXOffset - docElem.clientLeft
					};

			};

			/**
			 * Retrieve offset of an element
			 * @param {DOMNode|jQlite} element
			 * @returns {Object} - object with top, left key
			 */
			this.get = function(element) {

				if (typeof element.innerHTML === 'string') {
					return offset(element);
				} else {
					return offset(element[0]);
				}

			};

		});

}());

(function() {
	'use strict';

	/**
	 * @ngdoc function
	 * @name cf-website.directive:notification
	 * @description Show notification when warnings or errors occurs.
	 */
	angular.module('cf-website')
		.directive('notification', ["supportTest", "particleManager", "$rootScope", "$window", function(supportTest, particleManager, $rootScope, $window) {
			return {
				restrict: 'E',
				scope: {},
				templateUrl: 'components/notification/notification.tpl.html',
				link: function postLink(scope) {

					var messages = {
						'default': {
							'message': 'We’re sorry, something went wrong. Either your Internet connection is down, or our server is having issues.',
							'cta': 'Try again?',
							'type': 'error'
						},
						'datafail': {
							'message': 'Not all site content could be loaded. Either your internet connection is down, or our server is having issues.',
							'cta': 'Try again?',
							'type': 'error'
						},
						'particles': {
							'message': 'We’ve disabled the interactive font because it seems to perform poorly on your device.',
							'cta': 'Enable it anyway!',
							'type': 'info'
						}
					};

					$rootScope.$on('error', function(event, error) {

						// If we have a 404 error, we're going to the 404 page.
						// We don't have to show an extra message here.
						if (error.error.status === 404) {
							return;
						}

						if (error.name === 'noData' || error.name === 'invalidData') {
							scope.notification = messages.datafail;
						} else {
							scope.notification = messages.default;
						}

						scope.errorName = error.name;
						scope.isEnabled = true; // Activate notification
					});

					// user needs localStorage support to show fallback message
					if ( supportTest.localStorage ) {

						// show fallback when test fails
						scope.$on('lowFPS', function() {
							scope.notification = messages.particles;
							scope.errorName = 'particles';
							scope.isEnabled = true;
						});
					}

					scope.reactivate = function() {

						// When low performance notification is activated, reload the
						// particles. Otherwise reload the page.
						if (scope.errorName === 'particles') {
							particleManager.reactivate();
						} else {
							$window.location.reload();
						}
					};

					// Hide particle message
					scope.$on('hide-particle-message', function() {
						scope.hidden = true;
					});
				}
			};
		}]);

})();

(function() {
	'use strict';

	/**
	 * @ngdoc function
	 * @name cf-website.directive:ng-tap
	 * @description Remove  300ms click delay on ios
	 * @see https://gist.github.com/mhuneke/4026406
	 */
	angular.module('cf-website')
		.directive('ngTap', function() {
			return {
				restrict: 'A',
				link: function postLink(scope, element, attrs) {

					var tapping = false;
					var tapped = false;

					element.bind('touchstart', function() {
						element.addClass('active');
						tapping = true;
					});
					element.bind('touchmove', function() {
						element.removeClass('active');
						tapping = false;
					});
					element.bind('touchend', function(event) {
						element.removeClass('active');
						if (tapping) {
							tapped = true;
							scope.$apply(attrs.ngTap, element);

							//make sure ng-click isn't also clicked
							event.stopPropagation();
							event.preventDefault();
						}
					});
				}
			};
		});
})();

(function() {
	'use strict';

	/**
	 * @ngdoc function
	 * @name cf-website.directive:navigation
	 * @description Sidebar used for navigation of the website and indication of current progress in case page.
	 */
	angular.module('cf-website')
		.directive('navigationIndent', ["$stateParams", "$state", function($stateParams, $state) {
			return {
				restrict: 'E',
				scope: {
					name: '@',
					projectName: '=',
					indicators: '=',
					menuNames: '=',
					active: '=',
					hides: '=',
					current: '='
				},
				templateUrl: 'components/navigation-indent/navigation-indent.tpl.html',
				link: function postLink(scope) {

					//current project
					scope.expand = false;

					// check if needed to expand
					var checkExpand = function() {
						var nroIndicators = scope.indicators[scope.name] ? scope.indicators[scope.name].length : 0;
						var wasExpanded = scope.expand;
						scope.expand = scope.current === scope.name && nroIndicators > 0 && !scope.hides[scope.name];
						scope.tabindex = !scope.expand ? '-1' : '';

						scope.currentProject = $stateParams.urlSlug;

						if (wasExpanded) {
							scope.$broadcast('update-expand');
						}
					};

					scope.generateUrl = function() {
						var route = $state.current.name;
						return $state.href(route, {
							urlSlug: scope.currentProject
						}, { absolute: true });
					};

					scope.$watch('current', function() {
						scope.$on('navigation-change', checkExpand);
					});
				}
			};
		}]);

})();

(function() {
	'use strict';

	/* global ga */

	/**
	 * @ngdoc function
	 * @name cf-website.directive:navigation
	 * @description Sidebar used for navigation of the website and indication of current progress in case page.
	 */
	angular.module('cf-website')
		.directive('navigation', ["$rootScope", "$state", "$stateParams", "$http", "$timeout", "UUID", function($rootScope, $state, $stateParams, $http, $timeout, UUID) {

			return {
				restrict: 'E',
				scope: {},
				templateUrl: 'components/navigation/navigation.tpl.html',
				link: function postLink(scope) {

					// default
					scope.current = $stateParams.urlSlug || $state.current.urlSlug; // Current route
					scope.indicators = {}; // Sub navigation elements collected by looping over blocks
					scope.menuNames = {}; // Heading of submenu (for cases only)
					scope.hides = {}; // ?
					scope.showMenu = false;// Hide or show menu (only on mobile)
					scope.submenu = false; // show submenu
					scope.isWorkOverviewPage = false;
					scope.UUIDmapping = {}; // mapping for menu navigation with inview service
					var previousVisibleBlock = null;

					//retrieve root navigation structure via JSON call
					$http
						.get('data/navigation.json')
						.success(function(data) {
							scope.navigation = data.navigation;
						}).error(function(err) {
							$rootScope.$broadcast('error', {
								place: 'navigation',
								name: 'noData',
								message: 'Error during loading of navigation',
								error: err
							});
						});

					//retrieve list of project via JSON call
					$http
						.get('api/work.json')
						.success(function(result) {
							scope.cases = result.blocks[0].cases;
						}).error(function(err) {
							$rootScope.$broadcast('error', {
								place: 'navigation',
								name: 'noData',
								message: 'Error during loading of navigation',
								error: err
							});
						});

					//listen to updates coming from projects
					$rootScope.$on('pageChange', function(evt, project) {
						var slug =  project.slug;
						scope.current = slug;

						// project (case) and work routes needs different behaviour
						if (project.route === 'project' || project.route === 'work') {
							slug = 'work';
							scope.current = 'work';
						}

						//is work overview page?
						scope.isWorkOverviewPage = project.route === 'work';

						//reset menu for this state
						scope.UUIDmapping = {};
						var lastUUID;
						var subItems; // submenu items based on blocks on a page

						//keep submenu on work page
						if (project.route !== 'work') {
							scope.indicators[slug] = [];
							scope.menuNames[slug] = project.menuName;
							scope.hides[slug] = false;
							subItems = project.blocks;

						} else {
							scope.hides[slug] = true;
							subItems = project.cases;
						}

						if (subItems && subItems.length > 0) {

							//loop through each block
							angular.forEach(subItems, function(block, key) {

								if (block.title) {

									/*jshint sub:true*/
									var indicatorSlug = block['name_in_menu'] || block.title;
									indicatorSlug = indicatorSlug.replace(/\s/g, '-').toLowerCase();
									block.UUID = encodeURI(indicatorSlug + '-' + key);

								} else {
									block.UUID = UUID.get();
								}

								// Only add blocks with the show_in_menu boolean on true in menu
								/*jshint sub:true*/
								if (block['show_in_menu']) {

									//show submenu
									scope.submenu = true;

									//add to list
									/*jshint sub:true*/
									scope.indicators[slug].push({
										id: block.type,
										name: block['name_in_menu'] || block.title,
										tracking: block.UUID
									});

									//Save UUID in mapping
									scope.UUIDmapping[block.UUID] = block.UUID;
									lastUUID = block.UUID;

									if (key === 0) {
										scope.active = block.UUID;
										scope._active = block.UUID;
									}

								} else if (!block['show_in_menu'] && key > 0 ) {

									//map UUID to last used UUID to create sections
									scope.UUIDmapping[block.UUID] = lastUUID;
									return false;
								}
							});
						}

						$timeout(function() {
							scope.$broadcast('navigation-change');
						});

					});

					/**
					 * Check if top level nav item is same as current active item
					 * @param  {string}  currentItemSlug Slug of menu item
					 * @return {boolean}                 If current item is active
					 */
					scope.isActive = function(currentItemSlug) {
						if (currentItemSlug === scope.current && $state.current.name !== 'project') {
							return true;
						} else {
							return false;
						}
					};

					/**
					 * Determines if a nested navigation item should be visible
					 * @param  {string}  currentItemSlug The slug of the item
					 * @return {boolean}                 True or false
					 */
					scope.isIndentActive = function(currentItemSlug) {
						if (currentItemSlug === scope.current) {
							return true;
						} else {
							return false;
						}
					};

					//listen to state changes
					$rootScope.$on('$stateChangeSuccess', scope.updateMenuState);

					//Hide menu when rerouting (mobile only)
					$rootScope.$on('$stateChangeStart', function() {
						scope.showMenu = false;
					});

					// Listen to reading element updates
					$rootScope.$on('readline', function(evt, element) {

						// Get UUID that needs triggering from mapping
						scope.active = scope.UUIDmapping[element.tracking];
						scope._active = element.tracking;

						if (window.ga && previousVisibleBlock !== scope.active) {
							var activeBlock = scope.active ? scope.active : scope._active;
							ga('send', 'event', 'Blocks', 'show', location.pathname + '/' + activeBlock, {
								nonInteraction: true
							});

							// Update visible block
							previousVisibleBlock = scope.active;
						}

						//trigger digest cycle
						scope.$apply();

					});

					//listen for changes in menu visibility state
					scope.$watch('showMenu', function() {
						var $body = angular.element(document.body);

						if (scope.showMenu) {
							$body.addClass('no-scroll');
						} else {
							$body.removeClass('no-scroll');
						}

						//close fullscreen videos
						$rootScope.$broadcast('exitFullscreen');

					});

				}

			};
		}]);

})();

(function() {
	'use strict';

	/* global ga */

	/**
	 * @ngdoc function
	 * @name cf-website.directive:lightbox
	 * @description Show images in a lightbox refactor
	 */
	angular.module('cf-website')
		.directive('lightbox', ["$rootScope", "$timeout", "FlickityService", function($rootScope, $timeout, FlickityService) {
			return {
				restrict: 'E',
				scope: {},
				replace: true,
				templateUrl: 'components/lightbox/lightbox.tpl.html',
				link: function postLink(scope) {

					var domBody = angular.element(document.body);
					var hasMultipleImages = false;
					var defaultOptions = {
						cellSelector: '.image',
						imagesLoaded: true,
						initialIndex: 0,
						pageDots: true,
						prevNextButtons: true,
						setGallerySize: false,
						wrapAround: true,
						arrowShape: {
							x0: 15,
							x1: 60,
							y1: 45,
							x2: 65,
							y2: 40,
							x3: 25
						}
					};
					scope.images = [];
					scope.isOpen = false;

					// Get the element that should hold the slider
					var sliderElement = angular.element(
						document.getElementById('flickity-lightbox')
					);

					// Show lightbox when $broadcast event is caught.
					$rootScope.$on('lightbox', function(evt, options) {
						scope.isOpen = true;
						scope.images = options.images || null;
						hasMultipleImages = options.images.length > 1;

						// Copy options based on default.
						var flickityOptions = Object.assign(defaultOptions, {});
						flickityOptions.initialIndex = options.initialIndex || 0;
						flickityOptions.pageDots =  hasMultipleImages;

						// Lock scrolling when lightbox is open
						domBody.addClass('no-scroll');

						/**
						 * Manually create a Flickity instance based om the images in the
						 * scope. This is wrapped around in a $timeout because it's
						 * important the images are available on scope when we call
						 * create().
						 */
						$timeout(function() {
							FlickityService.get(sliderElement[0].id)
								.then(function() {
									FlickityService.destroy(sliderElement[0].id);
								})

								// Do not handle the catch, because the error means that the
								// slider isn't found. So we can safely create a new Flickity
								// instance.
								.catch(function() {})
								.then(function() {
									FlickityService.create(
										sliderElement[0],
										sliderElement[0].id,
										flickityOptions
									);
									sliderElement[0].focus();
								});
						}, 0);

						// Track GA event
						if (window.ga) {
							ga(
								'send',
								'event',
								'Lightbox',
								'show',
								scope.images[options.initialIndex].url,
								options.initialIndex
							);
						}

						// Hide particle message
						$rootScope.$broadcast('hide-particle-message');

						// Start keydown even listener
						window.addEventListener('keydown', handleKeydown, false);
					});

					var removeListeners = function() {
						window.removeEventListener('keydown', handleKeydown, false);
					};

					/**
					 * Close lightbox
					 */
					scope.handleClose = function() {
						scope.isOpen = false;
						hasMultipleImages = false;
						domBody.removeClass('no-scroll');
						removeListeners();

						// Trigger the closing animation
						scope.$digest();

						// Make sure we select the right image to be selected after an apply
						FlickityService.select(
							sliderElement[0].id,
							FlickityService.selectedIndex(sliderElement[0].id),
							false,
							true
						);

						// Remove images from scope so we can load a new array of images on
						// a new digest.
						scope.images = [];
					};

					// Close lightbox when page route will change
					$rootScope.$on('$stateChangeStart', function() {
						if (scope.isOpen) {
							scope.handleClose();
						}
					});

					/**
					 * Handle keydown event. When ESC key is pressed close lightbox.
					 * @param  {Object} evt Keydown event
					 */
					var handleKeydown = function(evt) {
						switch (evt.keyCode){
							case 27:
								scope.handleClose();
							break;
						}
					};

					// Destroy event listeners
					scope.$on('$destroy', function() {
						removeListeners();
					});
				}
			};
		}]);
})();

(function() {
  'use strict';

  /**
	 * @ngdoc function
	 * @name cf-website.directive:inview
	 * @description The inview attribute added on elements does one of two things:
   * 1. It adds the class '.has-been-inview' if it has no callback specified
   * 2. It calls the specified callback from the element's scope (eg. inview="lazyLoading")
	 */
  angular.module('cf-website').directive('inview', ["$rootScope", "$timeout", "$parse", function($rootScope, $timeout, $parse) {
    return {
      restrict: 'A',
      scope: false,
      link: function postLink(scope, element, attributes) {
        var fn;
        var hasBeenInview = false;

        function onvisible(evt, data) {
          if (angular.equals(element, angular.element(data.target))) {
            if (!hasBeenInview) {
              hasBeenInview = true;

              var handle = fn(scope);
              if (handle) { return handle(); }

              return element.addClass('has-been-inview');
            }
          }
        }

        function ondestroy() {
          if (scope.observer) {
            scope.observer.unobserve(element[0]);
            delete scope.observer;
          }
        }

        $timeout(function() {
            scope.observer = $rootScope.createObserver(0.3);
						scope.observer.observe(element[0]);
            fn = $parse(attributes.inview);
        });

        scope.$on('intersectionChange', onvisible);
        scope.$on('$destroy', ondestroy);
      }
    };
  }]);
}());

(function() {
	'use strict';

	/* global ga */

	/**
	 * @ngdoc function
	 * @name cf-website.controller:HomeCtrl
	 * @description Controller for the home page
	 */
	angular.module('cf-website')
		.controller('HomeCtrl', ["$scope", "$rootScope", "$sce", "JSONdata", "particleManager", "supportTest", "breakpoints", "$timeout", function ($scope, $rootScope, $sce, JSONdata, particleManager, supportTest, breakpoints, $timeout) {

				// Once we receive the resolved data from the router send a pageChange
				// event so we can update the meta data of the page.
				$rootScope.$broadcast('pageChange', JSONdata.data);

				// Retrieve data from route promise
				$scope.block = JSONdata.data.blocks[0];

				//starting values
				$scope.overlay = true;
				$scope.usingParticles = particleManager.isSupported;

				//check for mp4 support
				$scope.useMP4 = supportTest.mp4();

				// Flag to check if video is currently playing
				var videoIsPlaying = false;

				// create presets
				var pointer = 0;
				var presetTimeout;
				var presets = [];

				var nextPreset = function() {
					// load preset
					var preset = presets[pointer];

					// update pointer
					pointer = pointer < presets.length - 1 ? pointer + 1 : 0;

					// update slider
					$timeout(function() {
						$scope.currentSlide = pointer;
					});

					// check if webgl and performant is supported
					if (!supportTest.webgl() || presets.length === 0) {
							// schedule next update
						presetTimeout = setTimeout(nextPreset, 5000);
						return;
					}

					// only do particle related stuff if WebGL and performant

					// get bottom offset
					if (preset.offset) {
						var height = document.querySelector('.home__play-button').getBoundingClientRect().top;
						preset.offset.bottom = window.innerHeight - height - window.pageYOffset;
					}

					// update with preset
					particleManager
						.reset()
						.update(preset);

					// schedule next update
					presetTimeout = setTimeout(nextPreset, 5000);
				};

				$scope.images = [];

				// add to html slider
				$scope.block.carousel.forEach(function(image) {
					$scope.images.push(image.image);
				});

				// load particle presets
				$scope.block.introText.particleTexts = $scope.block.introText.particleTexts || [];
				$scope.block.introText.particleTexts.forEach(function(txt) {
					presets.push({
						type: 'text',
						text: txt.join('|'),
						color: [255, 255, 255],
						scale: 1.75,
						offset: { bottom: 0 }
					});
				});

				//start particles
				nextPreset();

				//mute video
				$timeout(function() {
					$scope.$broadcast('mute', true);
				});

				//embed url as fallback
				/*jshint camelcase: false */
				$scope.embedUrl = $sce.trustAsResourceUrl('https://player.vimeo.com/video/' + $scope.block.vimeo_id + '?autoplay=1&loop=1&title=0&byline=0&portrait=0');

				/**
				 * Show video in fullscreen
				 */
				$scope.watchVideo = function() {

					// Mark video as playing
					videoIsPlaying = true;

					//hide particles
					clearTimeout(presetTimeout);
					particleManager.visibility(false);

					//reset video
					$scope.$broadcast('currentTime', 0);

					//don't mute any longer
					$scope.$broadcast('mute', false);
					$scope.$broadcast('play', true);

					//hide overlay
					$timeout(function() {
						$scope.overlay = false;
					}, 200);

					//track in GA
					if (window.ga) {
						ga('send', 'event', 'Video', 'play', 'showreel');
					}

					//hide particle message
					$rootScope.$broadcast('hide-particle-message');

					if ( breakpoints.oneOf('xs', 's') ) {
						$scope.overlay = false;
						$scope.$broadcast('toggle-fullscreen');
					}
				};

				/**
				* Close video in fullscreen
				*/
				$scope.hideVideo = function() {

					//show particles
					particleManager.visibility(true);
					nextPreset();

					//mute again
					$scope.$broadcast('mute', true);
					$scope.$broadcast('pause', false);

					//show overlay
					$scope.overlay = true;

					// Reset boolean to default value
					videoIsPlaying = false;
				};

				/**
				 * Determine target for URLs, when external open in other window
				 * @param {string} url
				 */
				$scope.getTarget = function(url) {
					return url && url.indexOf('cleverfranke.com') > -1 ? '_self' : '_blank';
				};

				//hide when done
				$scope.$on('ended', function() {

					if (!$scope.overlay) {
						$scope.hideVideo();
					}

					$scope.$apply();

				});

				$scope.$on('exitFullscreen', function() {
					if (videoIsPlaying) {
						$scope.hideVideo();
					}
				});

				$scope.$on('$destroy', function() {

					//stop particles
					clearTimeout(presetTimeout);
				});

				// listen for the close event to close the video by clicking on the CºF logo
				$rootScope.$on('hideVideoByLogo', function () {
					if (videoIsPlaying) {
						$scope.hideVideo();
					}
				});

		}]);

})();

(function() {
	'use strict';

	/**
	 * @ngdoc function
	 * @name cf-website.directive:grid-slider
	 * @description Slider for grid items
	 */
	angular.module('cf-website')
		.directive('gridSlider', ["$timeout", function($timeout) {
			return {
				restrict: 'A',
				link: function postLink(scope, element, attributes) {

					scope.isFirst = true;
					scope.isLast = false;
					scope.current = 0;

					var width = 0;
					var gridSize = 1;
					var container, items;

					if (attributes.gridSlider !== 'true') {
						return false;
					}

					var calculate = function() {

						//select all grid items
						container = angular.element(element[0].querySelector('.grid--slider__inner'));
						var _items = element[0].querySelectorAll('.grid__item');
						var noItems = _items.length;
						items = angular.element(_items);

						//convert relative values to absolute pixel values
						var itemWidth = Math.ceil(_items[0].getBoundingClientRect().width);
						var style = window.getComputedStyle(items[0]);
						var marginLeft = parseInt(style.marginLeft);
						var marginRight = parseInt(style.marginRight);
						var itemSpacing = marginLeft + marginRight;
						var containerWidth = (itemWidth + itemSpacing) * noItems;
						width = itemWidth + itemSpacing;

						//detect grid size
						var elementWidth = element[0].getBoundingClientRect().width;
						gridSize = Math.floor(elementWidth / width);

						//determine max position
						scope.max = noItems - gridSize;
						scope.max = scope.max < 0 ? 0 : scope.max;

						//change css
						container.css('width', containerWidth + 'px');
						items.css('width', itemWidth + 'px');
						items.css('margin-left', marginLeft + 'px');
						items.css('margin-right', marginRight + 'px');

						//prevent showing navigation when grid has less items
						if (noItems <= gridSize) {
							scope.isFirst = true;
							scope.isLast = true;
						}

					};

					var forceRecalculate = function() {
						container.css('width', '');
						items.css('width', '');
						items.css('margin-left', '');
						items.css('margin-right', '');

						$timeout(function() {
							calculate();
							scope.goTo(scope.current);
						});
					};

					scope.goTo = function(nr) {

						scope.isFirst = false;
						scope.isLast = false;

						//bounds - left
						if (nr <= 0 ) {
							nr = 0;
							scope.isFirst = true;
						}

						//bounds - right
						if (nr >= scope.max ) {
							nr = scope.max;
							scope.isLast = true;
						}

						//animate position
						var position = nr * width * -1;
						container.css('transform', 'translate(' + position + 'px)');

						//save current position
						scope.current = nr;

					};

					scope.next = function() {
						scope.goTo(scope.current + 1);
					};

					scope.previous = function() {
						scope.goTo(scope.current - 1);
					};

					$timeout(calculate);

					//watch for window resize
					window.addEventListener('resize', forceRecalculate, false);

					//destroy
					scope.$on('$destroy', function() {
						window.removeEventListener('resize', forceRecalculate, false);
					});

				}
			};
		}]);

})();

(function() {
	'use strict';

	angular.module('cf-website')
		.directive('flickityImageList', ["$rootScope", "$document", "FlickityService", function($rootScope, $document, FlickityService) {
			return {
				restrict: 'E',
				scope: {
					layout: '@',
					flickityId: '@',
					flickityOptions: '&',
					images: '&',
					lightboxEnabled: '@'
				},
				replace: false,
				templateUrl: 'components/flickity-image-list/flickity-image-list.tpl.html',
				link: function postLink(scope, el) {
					var ul = el.find('ul')[0];
					var isDragging = false;
					var isMouseDown = false;
					var previousMouseX = null;
					var previousMouseY = null;

					// Make sure we give hints to the srcset indicating how big our images
					// will be roughly. This doesnt need to be pixel precise, as long as it
					// can make an educated guess we're fine here.
					scope.getSizes = function() {
						var sizesArray = [];
						switch (scope.layout) {
							case 'horizontal-list':
								sizesArray.push('(min-width: 768px) calc( ( 100vw / 3.5 ) - 1rem)');
								sizesArray.push('calc( ( 100vw / 2.33 ) - 1rem )');
								break;
							case 'edge-to-edge':
								sizesArray.push('(min-width: 768px) calc( 100vw - 14rem )');
								sizesArray.push('100vw');
								break;
							default:
								sizesArray.push('100vw');
								break;
						}
						return sizesArray.join(', ');
					};

					// document.ready example
					angular.element($document[0]).ready(function() {
						FlickityService.create(ul, scope.flickityId, scope.flickityOptions());

						// Resize flickity slider when the srcset of one of the children images has loaded.
						scope.$on('srcset-images-loaded', function() {
							FlickityService.resize(scope.flickityId);
						});
					});

					scope.$watch(
						function() { return scope.flickityOptions().draggable; },
						function(newValue, oldValue) {
							if ((newValue !== oldValue) && !!document.getElementById(scope.flickityId)) {
								FlickityService.destroy(scope.flickityId).then(function() {
									if (newValue) {
										FlickityService.create(ul, scope.flickityId, scope.flickityOptions());
									}
								}).catch(function() {
									if (newValue) {
										FlickityService.create(ul, scope.flickityId, scope.flickityOptions());
									}
								});
							}
						}
					);

					scope.$on('$destroy', function() {
						FlickityService.destroy(scope.flickityId);
					});

					/**
					 * On mouse down store the position of the cursor in order to
					 * calculate if a user is dragging or clicking.
					 * @param  {Object} event Mouse event
					 */
					scope.handleMouseDown = function(event) {
						isMouseDown = true;
						previousMouseX = event.pageX;
						previousMouseY = event.pageY;
					};

					/**
					 * Check if the user is dragging. Set isDragging when the user moves
					 * it cursor more than 20 pixels away from the start position.
					 * @param  {Object} event Mouse event
					 */
					scope.handleMouseMove = function(event) {
						if (isMouseDown && !isDragging) {
							var a = previousMouseX - event.pageX;
							var b = previousMouseY - event.pageY;
							var distance = Math.sqrt((a * a) + (b * b));

							if (distance > 20) {
								isDragging = true;
							}
						}
					};

					/**
					 * Open lightbox by broadcast event.
					 * @param  {number} initialIndex Index of the image that needs to be active within the Flickity carousel
					 */
					scope.openLightbox = function(initialIndex) {
						if (scope.lightboxEnabled && !isDragging) {
							$rootScope.$broadcast('lightbox', {
								images: scope.images(),
								initialIndex: initialIndex
							});
						}

						// Reset values
						isMouseDown = false;
						isDragging = false;
						previousMouseX = null;
						previousMouseY = null;
					};
				}
			};
		}]);
})();

(function() {
	'use strict';

	/**
	 * @ngdoc function
	 * @name cf-website.directive:expand
	 * @description Expand/collapse content
	 */
	angular.module('cf-website')
		.directive('expand', ["$timeout", "offset", function($timeout, offset) {
			return {
				restrict: 'A',
				scope: { 'expand': '=' },
				link: function postLink(scope, element, attributes) {

					var start = 0;

					var setHeight = function() {
						$timeout(function() {
								element.css('height', scope.expand ? element.children()[0].offsetHeight + 'px' : start + 'px');
						}, 200);
					};

					var resize = function() {
						if (attributes.expandStart) {
							var startElement = element[0].querySelector(attributes.expandStart);

							// check if element exists
							if (startElement) {
								start = offset.get(startElement).top - offset.get(element).top;
							} else {
								start = 0;
							}
						}

						// set correct height for element
						setHeight();
					};

					// initial resize - do timeout because of ng-class in digest cycles...
					$timeout(resize, 0);

					// wait for changes
					scope.$watch('expand', setHeight);
					scope.$on('update-expand', setHeight);
					window.addEventListener('resize', resize, false);

					scope.$on('$destroy', function() {
						window.removeEventListener('resize', resize, false);
					});
				}
			};
		}]);
})();

(function() {
  'use strict';

  /**
	 * @ngdoc function
	 * @name cf-website.directive:count-up-numbers
	 * @description Animation to count up numbers when element is inview.
	 */
  angular.module('cf-website').directive('countUpNumbers', function() {
    return {
      restrict: 'A',
      link: function postLink(scope, element, attributes) {
        var value = attributes.countUpNumbers;
        var start = 0;
        var end = parseInt(value.replace(',000', '000'));
        var anim;
        var duration = attributes.duration || 1000;

        // formatting
        var useDotCommas = value.search(',000') > -1;

        var replaceValue = function(input) {
          if (useDotCommas) {
            input = input.toString().replace(/./g, function(c, i, a) {
              return i && c !== '.' && (a.length - i) % 3 === 0 ? ',' + c : c;
            });
          }

          element[0].textContent = value
            .replace(',000', '000')
            .replace(/([0-9])+/g, input);
        };

        // start position
        replaceValue(0);

        scope.count = function() {
          // create a new Tweenable on call to count to prevent a bug in Safari
          anim = new Tweenable();

          anim.tween({
            from: { val: start },
            to: { val: end },
            duration: parseInt(duration),
            delay: 250,
            easing: 'easeOutQuint',
            step: function(state) {
              replaceValue(Math.round(state.val));
            },
            finish: function() {
              replaceValue(end);

              // remove all traces
              if (anim) {
                anim.dispose();
                anim = null;
              }
            }
          });
        };

        scope.$on('$destroy', function() {
          anim = null;
        });
      }
    };
  });
})();

(function() {
	'use strict';

	/**
	 * @ngdoc function
	 * @name cf-website.directive:conversion-on-submit
	 * @description 	Send conversion event to Google Adwords.
	 *
	 * @example
	 * <a
	 * 	class="content content__url email"
	 * 	ng-href="mailto:{{ block().email }}"
	 * 	ng-bind="block().email"
	 * 	conversion-on-submit="{ label: 'nWygCMjM1WoQw77m2AM' }"
	 * >
	 * </a>
	 * */
	angular.module('cf-website')
		.directive('conversionOnSubmit', ["$window", "$log", function($window, $log) {
			return {
				restrict: 'A',
				scope: {
					data: '=conversionOnSubmit'
				},
				link: function postLink(scope, element) {

					/**
					 * Handle errors.
					 */
					if (!scope.data.label) {
						$log.error('Label is not defined for the conversionOnSubmit directive!');
					}

					/**
					 * Bind submit event to element.
					 */
					element.bind('submit', function() {
						fireConversion();
					});

					/**
					 * Send conversion event.
					 * @param  {number} id    Unique conversion number
					 * @param  {string} label Conversion label
					 */
					var fireConversion = function() {
						/*jshint camelcase: false */
						if (typeof $window.google_trackConversion === 'function') {
							$window.google_trackConversion({
								google_conversion_id: scope.data.id || 991534915,
								google_conversion_language: scope.data.language || 'en',
								google_conversion_format: scope.data.format || '3',
								google_conversion_color: scope.data.color || 'ffffff',
								google_conversion_label: scope.data.label,
								google_remarketing_only: scope.data.remarketing_only || false
							});
						}
						/*jshint camelcase: true */
					};

					/**
					 * Unbind event on destroy.
					 */
					scope.$on('$destroy', function() {
						element.unbind('submit');
					});
				}
			};
		}]);

})();

(function() {
	'use strict';

	/**
	 * @ngdoc function
	 * @name cf-website.directive:conversion-on-click
	 * @description 	Send conversion event to Google Adwords.
	 *
	 * @example
	 * <a
	 * 	class="content content__url email"
	 * 	ng-href="mailto:{{ block().email }}"
	 * 	ng-bind="block().email"
	 * 	conversion-on-click="{ label: 'nWygCMjM1WoQw77m2AM' }"
	 * >
	 * </a>
	 * */
	angular.module('cf-website')
		.directive('conversionOnClick', ["$window", "$log", function($window, $log) {
			return {
				restrict: 'A',
				scope: {
					data: '=conversionOnClick'
				},
				link: function postLink(scope, element) {

					/**
					 * Handle errors.
					 */
					if (!scope.data.label) {
						$log.error('Label is not defined for the conversionOnClick directive!');
					}

					/**
					 * Bind click event to element.
					 */
					element.bind('click', function() {
						fireConversion();
					});

					/**
					 * Send conversion event.
					 * @param  {number} id    Unique conversion number
					 * @param  {string} label Conversion label
					 */
					var fireConversion = function() {
						/*jshint camelcase: false */
						if (typeof $window.google_trackConversion === 'function') {
							$window.google_trackConversion({
								google_conversion_id: scope.data.id || 991534915,
								google_conversion_language: scope.data.language || 'en',
								google_conversion_format: scope.data.format || '3',
								google_conversion_color: scope.data.color || 'ffffff',
								google_conversion_label: scope.data.label,
								google_remarketing_only: scope.data.remarketing_only || false
							});
						}
						/*jshint camelcase: true */
					};

					/**
					 * Unbind event on destroy.
					 */
					scope.$on('$destroy', function() {
						element.unbind('click');
					});
				}
			};
		}]);

})();

(function() {
	'use strict';

	/* global ga */

	/**
	 * @ngdoc function
	 * @name cf-website.click-tracker
	 * @description Track outgoing links and send those to GA
	 */
	angular.module('cf-website')
		.run(["$timeout", "$window", function($timeout, $window) {

			//dont run on karma or dev and staging evironment
			if (!$window.delegateEventListener || !$window.ga) {
				return false;
			}

			/**
			 * Send conversion event.
			 * @param  {number} id    Unique conversion number
			 * @param  {string} label Conversion label
			 */
			var fireConversion = function() {
				/*jshint camelcase: false */
				if (typeof $window.google_trackConversion === 'function') {
					$window.google_trackConversion({
						google_conversion_id: 991534915,
						google_conversion_language: 'en',
						google_conversion_format: '3',
						google_conversion_color: 'ffffff',
						google_conversion_label: 'nWygCMjM1WoQw77m2AM',
						google_remarketing_only: false
					});
				}
				/*jshint camelcase: true */
			};

			/**
			 * Delay the location change in order to give the Google Analytics event
			 * some time to send the event.
			 * @param  {string} url Target URL to navigate to
			 */
			var delayAndRoute = function(url) {
				$timeout(function() {
					$window.location.href = url;
				}, 250);
			};

			//track external links
			$window.delegateEventListener('click', 'a', function(event) {
				var target = this;

				if (target.tagName === 'A') {
					var to = target.href;
					var social = target.getAttribute('social');
					var footer = target.getAttribute('footer');

					if (to.indexOf('mailto') > -1) {
						event.preventDefault();

						//mail
						ga('send', 'event', 'External', 'click', to.replace('mailto:', ''));
						ga('send', 'event', 'Mailto link', 'click', to.replace('mailto:', ''));

						// To track click on mail conversions
						fireConversion();

						delayAndRoute(target.href);
					} else if (social) {
						event.preventDefault();

						//social urls
						ga('send', 'event', 'External', 'click', to, {
							nonInteraction: false
						});
						ga('send', 'event', 'External social', 'click', social, {
							nonInteraction: false
						});
						delayAndRoute(target.href);
					} else if (footer) {

						//track if user clicks on footer
						ga('send', 'event', 'Footer', 'click', footer);
					} else if (to.indexOf(location.host) === -1) {
						event.preventDefault();

						//external url
						ga('send', 'event', 'External', 'click', to, {
							nonInteraction: false
						});
						delayAndRoute(target.href);
					}
				}

			});

		}]);

}());

(function() {
	'use strict';

	/**
	 * @ngdoc function
	 * @name cf-website.directive:drctv
	 * @description [Your description here]
	 */
	angular.module('cf-website')
		.directive('cfLogo', ["$rootScope", "$state", function($rootScope, $state) {
			return {
				restrict: 'E',
				scope: {},
				replace: true,
				templateUrl: 'components/cf-logo/cf-logo.tpl.html',
				link: function postLink(scope) {

					// Trigger the close event by clicking the CºF logo
					scope.triggerClose = function() {
						// Send event when current route is home
						if ($state.current.name === 'home') {
							$rootScope.$emit('hideVideoByLogo', true);
						}
					};
				}
			};
		}]);

})();

(function() {
	'use strict';

	/* global ga */

	/**
	 * @ngdoc function
	 * @name cf-website.directive:carousel
	 * @description Carousel for images
	 */
	angular.module('cf-website')
		.directive('carousel', ["$state", "particleManager", function($state, particleManager) {
			return {
				restrict: 'E',
				scope: {
					slides: '=',
					active: '=',
					breakOut: '&',
					particle: '=',
					fit: '@'
				},
				replace: true,
				templateUrl: 'components/carousel/carousel.tpl.html',
				link: function postLink(scope) {

					scope.imageFit = scope.fit || 'cover';

					var updateGA = function(interactive) {

						//track with GA
						if (window.ga) {

							//get active image url
							var active = scope.slides[scope.current].image.url;

							// Triggered by click event (next and previous buttons)
							if (interactive) {
								ga('send', 'event', 'Carousel', 'click', active);
							}

							//always send current image visible in carousel
							ga('send', 'event', 'Carousel', 'show', active, {
								nonInteraction: true
							});

						}

					};

					var load = function() {

						if ( !scope.slides || !scope.slides.length ) {
							return false;
						}

						//formatting
						scope.slides.map(function(img) {

							if (img.url) {
								var copy = angular.copy(img);
								img.image = copy;
							}

							return img;

						});

						//begin at start
						scope.current = scope.active || 0;
						scope.last = null;
						scope.direction = 'none';

						//total nr. of slides
						scope.total = scope.slides.length;

						scope.imageFit = scope.fit || 'cover';

						//track initial load on GA
						updateGA(false);

						//particles
						updateParticles();

					};

					var updateParticles = function() {

						//only when need to update particles
						if (!scope.particle) {
							return false;
						}

						var imageUrl = scope.slides[scope.current].image.url;

						particleManager
							.reset()
							.update({
								type: 'overview',
								imageSrc: imageUrl,

								settings: {
									size: 7,
									maxAge: 730,
									pathLength: 0.5,
									turbulence: 0.10,
									drag: 0.7,

									mouseOver: {
										range: 175,
										multiplier: 2
									},

									color: {
										useColorOffset: true
									},

									blur:{
										h: 1 / window.innerWidth * 10,
										v: 1 / window.innerHeight * 10,
										spread: 0.9,
										on: true
									}
								}
							});

					};

					scope.previous = function() {
						scope.last = scope.current;
						scope.direction = 'previous';
						scope.current = scope.current > 0 ? scope.current - 1 : scope.total - 1;

						updateGA(true);
						updateParticles();
					};

					scope.next = function() {
						scope.last = scope.current;
						scope.direction = 'next';
						scope.current = scope.current < scope.total - 1 ? scope.current + 1 : 0;

						updateGA(true);
						updateParticles();
					};

					scope.goTo = function(index) {
						if (index >= 0 && index < scope.slides.length && index !== scope.current) {
							scope.last = scope.current;
							scope.direction = index < scope.current ? 'previous' : 'next';
							scope.current = index;

							updateGA(true);
						}
					};

					scope.$watch('slides', load);

					//keep track if this is inview
					scope.inview = function(inview) {
						scope.isInview = inview;
					};

					scope.close = function() {
						scope.$emit('carousel-close');
					};

					//listen for key input
					var keydown = function(evt) {

						//only listen to key events when inview
						if (scope.isInview && scope.total > 1) {

							switch (evt.keyCode){
								case 37: scope.previous(); break;
								case 39: scope.next(); break;
							}

							//trigger angular magic
							scope.$apply();

						}

					};

					window.addEventListener('keydown', keydown, false);
					scope.$on('$destroy', function() {
						window.removeEventListener('keydown', keydown, false);
					});

				}
			};
		}]);

})();

(function() {
	'use strict';

	/**
	 * @ngdoc function
	 * @name cf-website.service:breakpoints
	 * @description Retrieve all breakpoints, or current breakpoint
	 * the back-end.
	 */
	angular.module('cf-website')
		.service('breakpoints', ["$rootScope", function API($rootScope) {

			this.currentBreakpoint = null;

			//see breakpoints.scss
			this.breakpoints = {
				'xs': 320,
				's': 480,
				'm': 768,
				'l': 1024,
				'xl': 1200,
				'xxl': 1440
			};

			var getCurrentBreakpoint = function() {
				var biggestKey;
				var width = window.innerWidth;
				for ( var breakpoint in this.breakpoints ) {
					if ( !biggestKey || this.breakpoints[breakpoint] <= width ) {
						biggestKey = breakpoint;
					}
				}
				return biggestKey;
			}.bind(this);

			var resize = function() {

				var hasChanged = false;

				//get new one
				var newBreakpoint = getCurrentBreakpoint();

				//breakpoint changed?
				if (newBreakpoint !== this.current) {
					hasChanged = true;
				}

				//save current breakpoint
				this.current = newBreakpoint;
				this.width = this.breakpoints[newBreakpoint];

				if (hasChanged) {

					$rootScope.$broadcast('breakpoint', {
						name: this.current,
						width: this.width
					});

				}

			}.bind(this);

			//initial sizing
			resize();

			/**
			 * Check if current breakpoint is one of breakpoints provided
			 * @param {...number} - List of breakpoints to test for
			 * @return {boolean}
			 */
			this.oneOf = function() {

				for ( var i = 0 ; i < arguments.length ; i++ ) {
					if (arguments[i] === this.current) {
						return true;
					}
				}

				return false;

			};

			//listen to resizes
			window.addEventListener('resize', resize, false);

		}]);
})();

/* global picturefill */

(function() {
  'use strict';

  /**
	 * @ngdoc function
	 * @name cf-website.directive:breakpointImage
	 * @description This directive creates a source list of images, which we can
	 * use to load different images based on the viewport. It's necessary that all
	 * the images exists according to the defined breakpoints.
	 *
	 * @see Inside your template you need to add the directive attribute
	 * `breakpoint-image` in combination with an attribute containing an array of
	 * scaled images. Also the the ngSrc directive from Angular needs to be
	 * defined.

	 * @TODO? Explain why?! WHy do we need to define the ngSrc directive?
	 *
	 * @see To determine the image size which should be loaded you need to add
	 * the sizes attribute containing media queries. The sizes should be ordered
	 * from highest media query to lowest values.
	 *
	 * @example
	 * 	<img
	 *		breakpoint-image
	 *		scaled-versions="[
	 *			{
	 *				src: 'image1.jpg',
	 *				width: 2560,
	 *				height: 1400
	 *			},
	 *			{
	 *				src: 'image2.jpg',
	 *				width: 1600,
	 *				height: 875
	 *			},
	 *			{
	 *				src: 'image3.jpg',
	 *				width: 1200,
	 *				height: 656
	 *			}
	 *			...
	 *		]"
	 *		sizes="
	 *			(min-width: 1440px) 600px,
	 *			(min-width: 1200px) 500px,
	 *			(min-width: 1024px) 400px,
	 *			(min-width: 768px) 400px,
	 *			(min-width: 480px) 300px,
	 *			calc( 100vw + 17px )
	 *   	"
	 *		alt="">
	 *
	 * You can use 100vw, 80vw, etc when a image is fluid.
	 * To calculate the size of an image when you have left and/or right padding
	 * you can use calc() to calculate the size of the image.
	 *
	 * @see  It's possible to lazy load those images in combination with the
	 * inview directive. Call the lazyLoading() function through the inview
	 * directive. The object on which you call this function needs to be within
	 * the same scope as the breakpoint image. Also add an attribute to the image,
	 * so this breakpointImage directive knows that it needs to wait creating the
	 * sourceset.
	 *
	 * @example
	 * 	<img
	 * 		inview="lazyLoading"
	 * 		inview-offset-top="-150%"
	 *		breakpoint-image
	 *		breakpoint-image-use-inview
	 *		scaled-versions="[
	 *			{...},
	 *			{...}
	 *			...
	 *		]"
	 *		sizes="
	 *			(min-width: 769px) 100vw,
	 *			180vw
	 *		"
	 *		alt="">
	 */
	angular.module('cf-website')
		.directive('breakpointImage', ["$timeout", function($timeout) {
			return {
				restrict: 'A',
				link: function postLink(scope, element, attr) {

					var isRendered = false; //set to true when image is rendered
					var isPhantomJS = window.navigator.userAgent.indexOf('PhantomJS') !== -1;

					/**
					 * Loops over scaledVersions and determine which file source needs to
					 * be added to the srcset.
					 */
					var createSourceSet = function(scaledVersions) {
						var largestSource = scaledVersions[scaledVersions.length - 1].url;

            /**
						 * Loop over all given source files and add it to the srcset.
						 */
						var srcset = scaledVersions.map(function(image) {
							return image.url + ' ' + image.width + 'w';
						}).reverse().join(', ');

						// When isPhantomJS, escape the timeout
						if (isPhantomJS) {
							element.attr('srcset', srcset); // Add srcset to image
							element.attr('src', largestSource); // Set the fallback source
						} else {
							$timeout(function() {
								element.attr('srcset', srcset); // Add srcset to image
								picturefill({ elements: element[0] }); // reevaluate the polyfill to update this image

								// Fire event to Flickity when an images loads in order to resize the slider
								element[0].onload = function() {
									scope.$emit('srcset-images-loaded');
								};

								if (window && window.objectFitImages) {
									window.objectFitImages(element[0], { watchMQ: true });
								}
							});
						}

						isRendered = true;
					};

					/**
					 * Calculate image sizes for non image-fit images.
					 */
          var setImgSize = function() {
            var width = Math.ceil(element[0].getBoundingClientRect().width);
            var height = Math.ceil(width * attr.height / attr.width);

            element.attr('height', height);
          };

          /**
					 * The observer function will be invoked once during the next $digest
					 * following compilation. The observer is then invoked whenever the
					 * interpolated value changes.
					 */
          var observer = attr.$observe('scaledVersions', function() {
            // wait for next observed change if scaledVersions is still invalid
            if (!attr.scaledVersions) {
              return false;
            }

            var useInview = attr.breakpointImageUseInview !== undefined;
            var scaledVersions = JSON.parse(attr.scaledVersions);

            // invalid data
            if (!scaledVersions.length || scaledVersions.length === 0) {
              return false;
            }

            // when not lazy loading or using phantomJS, inmediatly add src-set attributes
            if (!useInview || isPhantomJS) {
              createSourceSet(scaledVersions);
            } else {
              if (!attr.imageFit) { // placeholder (don't do when imageFit is used)
                element[0].src =
                  'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';

                // load event for firefox DOM-readyness
                element[0].addEventListener('load', function() { // $timeout for webkit/chrome DOM-readyness
                  $timeout(setImgSize);
                });
              }

              //wait for image to be inview

              var inviewObserver = scope.$on('intersectionChange', function(evt, data) {
                if (angular.equals(element, angular.element(data.target))) {
                  element.src = ''; // remove placeholder
                  createSourceSet(scaledVersions);
                }

                // remove self
                inviewObserver();
              });
            }

            //remove observer
            observer();
          });

          var resizeTimer;

          // On resize, run the function and reset the timeout
          // 250 is the delay in milliseconds. Change as you see fit.
          window.addEventListener(
            'resize',
            function() {
              clearTimeout(resizeTimer);
              resizeTimer = setTimeout(setImgSize, 250);
            },
            false
          );

          //destroy
          scope.$on('$destroy', function() {
            window.removeEventListener('resize', setImgSize, false);
          });
        }
      };
    }]);
})();

(function() {
	'use strict';

	/**
	 * @ngdoc function
	 * @name cf-website.directive:tools-overview
	 * @description Tools overview block which can show created tools inside a page.
	 */
	angular.module('cf-website')
		.directive('toolsOverview', function() {
			return {
				restrict: 'E',
				scope: {
					block: '&'
				},
				replace: true,
				templateUrl: 'components/blocks/tools-overview/tools-overview.tpl.html',
				link: function postLink() {
				}
			};
		});

})();

(function() {
	'use strict';

	/**
	 * @ngdoc function
	 * @name cf-website.directive:toolkit
	 * @description Tools overview block which can show created tools inside a page.
	 */
	angular.module('cf-website')
		.directive('toolkit', function() {
			return {
				restrict: 'E',
				scope: { block: '&' },
				replace: true,
				templateUrl: 'components/blocks/toolkit/toolkit.tpl.html',
				link: function postLink(scope) {

					scope.flickityOptions = {
						contain: true,
						groupCells: '100%',
						pageDots: false,
						watchCSS: true,
						imagesLoaded: true
					};

					scope.removeLastWord = function(tool) {
						var splittedWord = tool.name.split(' ');
						splittedWord.pop();
						splittedWord = splittedWord.join(' ');
						return splittedWord;
					};

					scope.getLastWord = function(tool) {
						var splittedWord = tool.name.split(' ');
						return splittedWord[splittedWord.length - 1];
					};

				}
			};
		});
})();

(function() {
	'use strict';

	/**
	 * @ngdoc function
	 * @name cf-website.directive:title-block
	 * @description Title block
	 */
	angular.module('cf-website')
		.directive('titleBlock', function() {
			return {
				restrict: 'E',
				scope: { block: '&' },
				replace: true,
				templateUrl: 'components/blocks/title-block/title-block.tpl.html',
				link: function postLink() {

				}
			};
		});

})();

(function() {
	'use strict';

	/**
	 * @ngdoc function
	 * @name cf-website.directive:technology
	 * @description Technology block in case page
	 */
	angular.module('cf-website')
		.directive('technology', function() {
			return {
				restrict: 'E',
				scope: { block: '&' },
				replace: true,
				templateUrl: 'components/blocks/technology/technology.tpl.html',
				link: function postLink() {}
			};
		});

})();

(function() {
	'use strict';

	/* global ga */

	/**
	 * @ngdoc function
	 * @name cf-website.directive:aboutTalks
	 * @description Talks section of about page
	 */
	angular.module('cf-website')
		.directive('talks', function() {
			return {
				restrict: 'E',
				scope: { block: '&' },
				replace: true,
				templateUrl: 'components/blocks/talks/talks.tpl.html',
				link: function postLink(scope) {

					var now = +Date.now();

					scope.talks = scope.block().talks;
					scope.startRow = null;
					scope.expand = false;

					//nr of past events to show
					var pastEvents = 3;

					//make sure timestamps are integers
					scope.talks.map(function(talk) {
						talk.timestamp = parseInt(talk.timestamp);
						return talk;
					});

					//sort on date
					scope.talks.sort(function(a, b) {
						return b.timestamp - a.timestamp;
					});

					//add
					scope.talks.map(function(talk, key, all) {

						var time = new Date(talk.timestamp * 1000);
						time.setDate(time.getDate() + 1);

						//in the past?
						if (now > time) {
							talk.past = true;

							//Most recent event?
							if (scope.startRow === null) {
								talk.mostRecent = true;
								scope.startRow = key + pastEvents;

								//first future event
								if (key > 0) {
									all[key - 1].firstFutureEvent = true;
								}
							}
						}

						return talk;

					});

					//prevent errors when an empty list
					if (scope.startRow === null || scope.startRow > scope.talks.length - 1 || scope.talks.length === 1) {
						scope.startRow = scope.talks.length - 1;
						scope.hideButton = true;
						scope.expand = true;
					}

					//track if users expands table
					scope.$watch('expand', function() {

						if (window.ga && scope.expand === true) {
							ga('send', 'event', 'Tables', 'expand', 'talks', {
								nonInteraction: true
							});
						}

					});

				}
			};
		});

})();

(function() {
	'use strict';

	/**
	 * @ngdoc function
	 * @name cf-website.directive:stats
	 * @description Stats block on case page
	 */
	angular.module('cf-website')
		.directive('stats', function() {
			return {
				restrict: 'E',
				scope: { block: '&' },
				replace: true,
				templateUrl: 'components/blocks/stats/stats.tpl.html',
				link: function postLink(scope) {
					scope.stats = scope.block().stats;
				}
			};
		});

})();

(function() {
	'use strict';

	/**
	 * @ngdoc function
	 * @name cf-website.directive:static-text
	 * @description Block to add static text to a two column view.
	 */
	angular.module('cf-website')
		.directive('staticText', function() {
			return {
				restrict: 'E',
				scope: {
					block: '&'
				},
				replace: true,
				templateUrl: 'components/blocks/static-text/static-text.tpl.html',
				link: function postLink() {

				}
			};
		});

})();

(function() {
	'use strict';

	/**
	 * @ngdoc function
	 * @name cf-website.directive:quote-block
	 * @description Quote block (without heading)
	 */
	angular.module('cf-website')
		.directive('quoteBlock', function() {
			return {
				restrict: 'E',
				scope: { block: '&' },
				replace: true,
				templateUrl: 'components/blocks/quote-block/quote-block.tpl.html',
				link: function postLink(scope) {
					scope.formatCite = function(author) {
						return author.replace(/ /g, '').toLowerCase();
					};
				}
			};
		});
})();

(function() {
	'use strict';

	/**
	 * @ngdoc function
	 * @name cf-website.directive:publicity
	 * @description Publicity block on case page
	 */
	angular.module('cf-website')
		.directive('publicity', function() {
			return {
				restrict: 'E',
				scope: { block: '&' },
				replace: true,
				templateUrl: 'components/blocks/publicity/publicity.tpl.html',
				link: function postLink(scope) {
					scope.flickityOptions = {
						contain: true,
						groupCells: '100%',
						pageDots: false,
						watchCSS: true
					};
				}
			};
		});
})();

(function() {
	'use strict';

	/* global ga */

	/**
	 * @ngdoc function
	 * @name cf-website.directive:ourValues
	 * @description Our values section of about page
	 */
	angular.module('cf-website')
		.directive('ourValues', ["$timeout", function($timeout) {
			return {
				restrict: 'E',
				scope: { block: '&' },
				replace: true,
				templateUrl: 'components/blocks/our-values/our-values.tpl.html',
				link: function postLink(scope, element) {

					/**
					 * @private
					 */
					var center;

					scope.values = scope.block().values;

					//defaults
					scope.left = 0;
					scope.current = 0;
					scope.isFirst = true;
					scope.isLast = false;
					scope.max = scope.values.length - 1;

					scope.byline = {};
					scope.switch = {
						byline: 'a'
					};

					var nextImg = new Image();
					var prevImg = new Image();

					/**
					 * Go to a slide
					 * @param {number} nr - Slide to show
					 */
					scope.goTo = function(nr) {

						scope.isFirst = false;
						scope.isLast = false;

						//get element size
						var box = element[0].querySelector('.our-values__block');
						var elementWidth = box.offsetWidth;
						elementWidth += parseInt(getComputedStyle(box).marginRight);

						//bounds - left
						if (nr <= 0 ) {
							nr = 0;
							scope.isFirst = true;
						}

						//bounds - right
						if (nr >= scope.max ) {
							nr = scope.max;
							scope.isLast = true;
						}

						scope.prev = scope.current;
						scope.current = nr;
						scope.left = elementWidth * scope.current - (center - box.offsetWidth / 2);
						scope.left = Math.round(scope.left);

						//determine next/prev image for preloading
						var next = scope.current + 1;
						var prev = scope.current - 1;
						next = next >= scope.max ? scope.max : next;
						prev = prev < 0 ? 0 : prev;

						//preload
						// We use the largest scaled image because we don't want to preload
						// the whole sourceset.
						nextImg.src = scope.values[next].image['scaled-versions'][0].url;
						prevImg.src = scope.values[prev].image['scaled-versions'][0].url;

						//change byline when needed
						if ( scope.byline[scope.switch.byline] !== scope.values[scope.current].byline ) {
							scope.switch.byline = scope.switch.byline === 'a' ? 'b' : 'a';
							scope.byline[scope.switch.byline] = scope.values[scope.current].byline;
						}

						if (window.ga) {
							ga('send', 'event', 'Our values', 'click', scope.values[scope.current].heading);
						}

					};

					/**
					 * Go to next slide
					 */
					scope.next = function() {
						scope.goTo(scope.current + 1);
					};

					/**
					 * Go to previous slide
					 */
					scope.previous = function() {
						scope.goTo(scope.current - 1);
					};

					//start
					$timeout(function() {
						scope.goTo(0);
					});

					//resize
					var resize = function(type) {

						center = element[0].offsetWidth / 2;

						if (type !== 'initial') {
							scope.goTo(scope.current);
						}
					};

					resize('initial');

					//watch for window resize
					window.addEventListener('resize', resize, false);

					//destroy
					scope.$on('$destroy', function() {
						window.removeEventListener('resize', resize, false);
						scope.values = undefined;

						nextImg = undefined;
						prevImg = undefined;
					});

				}

			};
		}]);

})();

(function() {
	'use strict';

	/**
	 * @ngdoc function
	 * @name cf-website.directive:mediaCoverage
	 * @description Media coverage section of about page
	 */
	angular.module('cf-website')
		.directive('mediaCoverage', function() {
			return {
				restrict: 'E',
				scope: { block: '&' },
				replace: true,
				templateUrl: 'components/blocks/media-coverage/media-coverage.tpl.html',
				link: function postLink(scope) {

					//make sure every image has margin attributes
					scope.sources = scope.block().media;

				}
			};
		});

})();

(function() {
	'use strict';

	/**
	 * @ngdoc function
	 * @name cf-website.directive:link-block
	 * @description Link block, with one single button
	 */
	angular.module('cf-website')
		.directive('linkBlock', function() {
			return {
				restrict: 'E',
				scope: { block: '&' },
				replace: true,
				templateUrl: 'components/blocks/link-block/link-block.tpl.html',
				link: function postLink(scope) {
					scope.getLinkTarget = function(isExternal) {
						return isExternal ? '_blank' : '_self';
					};

					function getColor(block) {
						if (block.startColor === block.endColor) {
							return 'link-block--' + block.startColor;
						}

						return 'link-block--' + block.startColor + '-' + block.endColor;
					}

					scope.getClasses = function() {
						return [
							'section--padding-' + scope.block().padding,
							getColor(scope.block())
						];
					};
				}
			};
		});
})();

(function() {
	'use strict';

	/**
	 * @ngdoc function
	 * @name cf-website.directive:juries
	 * @description Juries section of about page
	 */
	angular.module('cf-website')
		.directive('juries', function() {
			return {
				restrict: 'E',
				scope: { block: '&' },
				replace: true,
				templateUrl: 'components/blocks/juries/juries.tpl.html',
				link: function postLink() {

				}
			};
		});

})();

(function() {
  'use strict';

  /**
	 * @ngdoc function
	 * @name cf-website.directive:introduction
	 * @description First (introduction) block on case page
	 */
  angular
    .module('cf-website')
    .directive('introduction', ["$rootScope", "$timeout", "$document", "offset", "supportTest", "particleManager", "breakpoints", function(
      $rootScope,
			$timeout,
			$document,
      offset,
      supportTest,
      particleManager,
      breakpoints
    ) {
      return {
        restrict: 'E',
        scope: {
          block: '&'
        },
        replace: true,
        templateUrl: 'components/blocks/introduction/introduction.tpl.html',
        link: function postLink(scope) {
          var presets = [];
          var presetTimeout;
          var pointer = 0;

          scope.usingParticles = particleManager.isSupported;
          scope.useFixedVideo = breakpoints.oneOf('l', 'xl', 'xxl');
          scope.useMP4 = supportTest.mp4();

          // we can safely set this to true, since it's a optional value and
          // the ng-if will limit the video to bigger breakpoints!
          scope.playOnLoad = true;

          var nextPreset = function() {
            var preset = presets[pointer]; // load preset

            // update with preset
            particleManager.reset().update(preset);

            // update pointer
            pointer = pointer < presets.length - 1 ? pointer + 1 : 0;

            // schedule next update
            if (presets.length > 1) {
              presetTimeout = setTimeout(nextPreset, 8500);
            }
          };

          // check if correct scope is provided
          if (scope.block() === undefined) {
            $rootScope.$broadcast('error', {
              place: 'case-page-introduction',
              name: 'noData',
              message: 'No data for introduction section',
              error: {}
            });

            return false;
          }

          // scroll arrow

          scope.showArrow = function(inview) {
            scope.hideArrow = !inview;
            scope.$apply();
          };

          // particles
          if (supportTest.webgl()) {
            scope.block().introText.particleTexts.forEach(function(txt) {
              presets.push({
                type: 'text',
                text: txt.join('|'),
                color: [255, 255, 255],
                scale: 1,
                callback: function() {
                  scope.usingParticles = true;
                },

                settings: {
                  drag: 0.7,
                  maxSpeed: 5.5,
                  medianSpeed: 1.2,
                  turbulence: 0.66,
                  pathLength: 0.019,
                  size: 4,
                  colorIntensity: 0.89,
                  transition: { // speed up transitions
                    attractorSpeed: 2.5,
                    attractorForce: 2.5,
                    destinationForce: 3.5
                  },
                  mouseOver: {
                    range: 175,
                    multiplier: 2.4
                  },
                  brush: {
                    size: 1.9,
                    intensity: 0.14,
                    multiplier: 1
                  }
                }
              });
            });
          }

          // bottom or top start position
          $timeout(function() {
            scope.$broadcast('mute', true);
            nextPreset();
          });

          // breakpoints change
          scope.$on('breakpoint', function() {
            scope.$apply(function() {
              scope.useFixedVideo = breakpoints.oneOf('l', 'xl', 'xxl');
            });
          });

					// scrollTo service to scope
          scope.scrollToCase = function() {
						var element = document.querySelector('.introduction .introduction__case');
						$document.scrollToElementAnimated(element);
          };

          // removal of block
          scope.$on('$destroy', function() {
            window.clearTimeout(presetTimeout);
          });
        }
      };
    }]);
})();

(function() {
	'use strict';

	/**
	 * @ngdoc function
	 * @name cf-website.directive:imageTitle
	 * @description Tool title block, same block as title block, but with an icon
	 * and subtitle.
	 */
	angular.module('cf-website')
		.directive('imageTitle', function() {
			return {
				restrict: 'E',
				scope: {
					block: '&'
				},
				replace: true,
				templateUrl: 'components/blocks/image-title/image-title.tpl.html',
				link: function postLink() {

				}
			};
		});

})();

(function() {
	'use strict';

	/**
	 * @ngdoc function
	 * @name cf-website.directive:image-list
	 * @description List of images which can be displayed in different types of
	 * layouts.
	 */
	angular.module('cf-website')
		.directive('imageList', ["$rootScope", "supportTest", "breakpoints", function($rootScope, supportTest, breakpoints) {
			return {
				restrict: 'E',
				scope: {
					block: '&'
				},
				replace: true,
				templateUrl: 'components/blocks/image-list/image-list.tpl.html',
				link: function postLink(scope) {
					scope.flickityOptions = {
						'horizontal-list': {
							accessibility: true,
							adaptiveHeight: true,
							cellSelector: '.images__list-item',
							cellAlign: 'left',
							resize: true,
							contain: true,
							groupCells: '100%',
							imagesLoaded: true,
							pageDots: false,
							draggable: (scope.block().images.length > 2 && breakpoints.oneOf('xs', 's')) || scope.block().images.length > 3,
							arrowShape: 'M 15,50 L 60,95 L 65,90 L 25,50  L 65,10 L 60,5 Z'
						},
						'edge-to-edge': {
							accessibility: true,
							adaptiveHeight: true,
							cellSelector: '.images__image',
							dragThreshold: 10,
							draggable: !supportTest.isIE(),
							imagesLoaded: true,
							pageDots: true,
							resize: true,
							contain: true,
							arrowShape: 'M 15,50 L 60,95 L 65,90 L 25,50  L 65,10 L 60,5 Z'
						}
					};

					/**
					 * Open lightbox by broadcast event.
					 * @param  {number} initialIndex Index of the image that needs to be active within the Flickity carousel
					 */
					scope.openLightbox = function(initialIndex) {
						if (scope.block().lightboxEnabled) {
							var images = scope.block().images;
							$rootScope.$broadcast('lightbox', {
								images: images,
								initialIndex: initialIndex
							});
						}
					};

					// breakpoints change
					scope.$on('breakpoint', function() {
						scope.$apply(function() {
							scope.flickityOptions['horizontal-list'].draggable = (scope.block().images.length > 2 && breakpoints.oneOf('xs', 's')) || scope.block().images.length > 3;
						});
					});
				}
			};
		}]);
})();

(function() {
	'use strict';

	/**
	 * @ngdoc function
	 * @name cf-website.directive:image-grid
	 * @description Image grid on case page
	 */
	angular.module('cf-website')
		.directive('imageGrid', ["$rootScope", function($rootScope) {
			return {
				restrict: 'E',
				scope: {
					block: '&'
				},
				replace: true,
				templateUrl: 'components/blocks/image-grid/image-grid.tpl.html',
				link: function postLink(scope) {

					scope.grid = scope.block().grid;

					//flatten array
					scope.images = scope.block().grid.reduce(function(prev, current) {
						prev = prev || [];
						return prev.concat(current);
					}, []);

					scope.getSizes = function(row) {

						var mobile = '(min-width: 480px) 436px, calc( 100vw + 17px )';

						switch (row.length){

							case 1:
								return '(min-width: 1441px) 996px, (min-width: 769px) 747px, ' + mobile;
							case 2:
								return '(min-width: 1441px) 484px, (min-width: 769px) 363px, ' + mobile;
							case 3:
								return '(min-width: 1441px) 313px, (min-width: 769px) 235px, ' + mobile;
							case 4:
								return '(min-width: 1441px) 228px, (min-width: 769px) 171px, ' + mobile;
							default:
								return mobile;

						}

					};

					scope.lightbox = function(url, row, column) {

						var key = 0;

						for ( var i = 0 ; i < row ; i++ ) {
							key += scope.grid[i].length;
						}

						key += column;

						//show lightbox
						$rootScope.$broadcast('lightbox', {
							images: scope.images,
							initialIndex: key
						});

					};

				}
			};
		}]);

})();

(function() {
	'use strict';

	/* global ga */

	/**
	 * @ngdoc function
	 * @name cf-website.directive:design-video
	 * @description Video in design section of case page
	 */
	angular.module('cf-website')
		.directive('designVideo', ["$http", "$sce", "$timeout", "supportTest", function($http, $sce, $timeout, supportTest) {
			return {
				restrict: 'E',
				scope: {
					block: '&'
				},
				replace: true,
				templateUrl: 'components/blocks/design-video/design-video.tpl.html',
				link: function postLink(scope, element) {

					//check for mp4 support
					scope.useMP4 = supportTest.mp4();

					//start paused
					scope.$broadcast('play', false);

					//aspect ratio
					var blockEl = element[0].querySelector('.block-video');

					var ratio = function() {
						scope.width = blockEl.offsetWidth;
						scope.height = Math.round(scope.width / (16 / 9));
					};
					ratio();

					/*jshint sub:true*/
					var id = scope.block()['vimeo_id'];
					var url = 'https://vimeo.com/api/v2/video/' + id + '.json';
					scope.fallback = $sce.trustAsResourceUrl('https://player.vimeo.com/video/' + id + '?autoplay=1&loop=1&title=0&byline=0&portrait=0');

					//fetch vimeo thumbnail
					$http
						.get(url)
						.then(function(data) {

							/*jshint sub:true*/
							scope.posterImage = data.data[0]['thumbnail_large'];
						})
						.catch(function(error) {
							scope.$emit({
								place: 'design-video',
								name: 'noData',
								message: 'Could not retrieve json data from Vimeo',
								data: null,
								error: error
							});

							//make sure video is visible when poster image couldn't be retrieved
							scope.posterImage = '';
						});

					//send GA event
					if (window.ga) {

						//user starts playing video
						scope.$on('play', function() {
							ga('send', 'event', 'Video', 'play', id);
						});

						//when user shows video fullscreen
						var once = false;
						scope.$on('fullscreen', function() {
							if (!once) {
								ga('send', 'event', 'Video', 'fullscreen', id);
								once = true; //prevent sending twice
							}
						});

						//when video has ended
						scope.$on('ended', function() {
							ga('send', 'event', 'Video', 'ended', id, {
								nonInteraction: true
							});
						});
					}

					//trigger resizing when needed
					window.addEventListener('resize', ratio, false);

					scope.$on('$destroy', function() {
						window.addEventListener('resize', ratio, false);
					});
				}
			};
		}]);
})();

(function() {
	'use strict';

	/**
	 * @ngdoc function
	 * @name cf-website.directive:design-intro
	 * @description Design intro block
	 */
	angular.module('cf-website')
		.directive('designIntro', function() {
			return {
				restrict: 'E',
				scope: { block: '&' },
				replace: true,
				templateUrl: 'components/blocks/design-intro/design-intro.tpl.html',
				link: function postLink() {}
			};
		});

})();

(function() {
	'use strict';

	/**
	 * @ngdoc function
	 * @name cf-website.directive:contactContactPersons
	 * @description Contact person section of contact page
	 */
	angular.module('cf-website')
		.directive('contactPersons', function() {
			return {
				restrict: 'E',
				scope: { block: '&' },
				replace: true,
				templateUrl: 'components/blocks/contact-persons/contact-persons.tpl.html',
				link: function postLink(scope) {
					scope.getPhoneNumber = function(phoneNumber) {
						return phoneNumber.replace(/\s/g, '');
					};
				}
			};
		});

})();

(function() {
	'use strict';

	/**
	 * @ngdoc function
	 * @name cf-website.directive:contactPerson
	 * @description Contact person block used on multiple pages
	 */
	angular.module('cf-website')
		.directive('contactPerson', function() {
			return {
				restrict: 'E',
				scope: { block: '&' },
				replace: true,
				templateUrl: 'components/blocks/contact-person/contact-person.tpl.html',
				link: function postLink(scope) {

					var contactPersons = {
						'thomas-clever': {
							name: 'Thomas Clever',
							email: 'thomas@cleverfranke.com',
							tel: '+31 (0)6 19 55 29 81',
							tel2: '+1 312 380 0166',
							imageUrl: '/images/contacts/thomas-clever.jpg',
							personInfo: 'Contact co-founder Thomas Clever if you would like to learn how we can use data to add value to your business.'
						},
						'gert-franke': {
							name: 'Gert Franke',
							email: 'gert@cleverfranke.com',
							tel: '+31 (0)6 41 01 00 36',
							imageUrl: '/images/contacts/gert-franke.jpg',
							personInfo: 'Contact co-founder Gert Franke if you would like to learn how we can use data to add value to your business.'
						}
					};

					var block = scope.block();

					// On default pick 'thomas-clever' as default contact person
					var personId = block.contactPerson || 'thomas-clever';
					scope.subtitle = block.subtitle;
					scope.person = contactPersons[personId];
					scope.personInfo = block.personInfo || contactPersons[personId].personInfo;

					scope.getPhoneNumber = function(phoneNumber) {
						return phoneNumber.replace(/\s/g, '');
					};
				}
			};
		});
})();

(function() {
	'use strict';

	/**
	 * @ngdoc function
	 * @name cf-website.directive:contactContactPersons
	 * @description Contact person section of contact page
	 */
	angular.module('cf-website')
		.directive('contactFooter', function() {
			return {
				restrict: 'E',
				scope: { block: '&' },
				replace: true,
				templateUrl: 'components/blocks/contact-footer/contact-footer.tpl.html',
				link: function postLink() {}
			};
		});

})();

(function() {
	'use strict';

	/**
	 * @ngdoc function
	 * @name cf-website.directive:aboutClients
	 * @description Client section of about page
	 * The map is scrollable on all browsers except IE and Edge, where it is fixed.
	 */
	angular.module('cf-website')
		.directive('clients', ["$timeout", "supportTest", function($timeout, supportTest) {
			return {
				restrict: 'E',
				scope: {
					block: '&'
				},
				replace: true,
				templateUrl: 'components/blocks/clients/clients.tpl.html',
				link: function postLink(scope, element) {

					scope.isIE = supportTest.isIE();
					var data = scope.block().mapData,
						section = element[0],
						resizeTimeout,
						panTimeout1,
						panTimeout2,
						isDoneAnimating = false,	/* Captures if the map
						animation has been triggered once */
						sourceIconSize = 16,
						widthMap = 2320;	/* Map width.
						This number has been chosen so that the map fits even on
						a large screen of 2560 x 1440. All the map proportion's
						and parameters are suited for this specific width. */

					/* Create SVG */
					var svg = d3.select('#cf-map-elements-container').append('svg');

					/* Create containers */
					var linesContainer = svg.append('g').attr('class', 'linesContainer'),
						pointsContainer = svg.append('g').attr('class', 'pointsContainer'),
						sourceContainer = svg.append('g').attr('class', 'sourceContainer');

					/* Prepare data arrays */
					var sources = [];
					var targets = [];
					var sourcesProjected = [];
					var linkCoordinates = [];

					/*	Define projection parameters
					*	The goal is to align the SVG map (worldmap.svg) with the
					*	geomap projection so that the cities locations, which
					*	are computed with the projection, correspond to their
					*	theoritical location on the SVG map. The SVG map has a
					*	fixed width (widthMap). We need to find the right scale
					*	and translate paramateres to apply to the geomap so it
					*	aligns with the SVG map, for this given width of 2320.
					*	Scale : define the projection scale. The scale controls
					*	the size of the geomap. If you apply a scale of 2.074,
					*	and compare the SVG map and the geomap, they have the
					*	same proportions.
					*	Translate : If you apply a translate of 0.678, with that
					*	scale and compare the SVG map and the geomap, they have
					*	the same alignement and are right on top of each other
					*	along the width.
					*	Mercator aspect ratio : for a width of 2320 with this
					*	scale factor, the corresponding height of the map is
					*	widthMap * aspect ratio, where aspect ratio = 0.66...
					*	Those numbers were been found by trial.
					*/
					var projectionParameters = {
						scale: 2.074,
						translate: 0.678,
						heightMap: widthMap * 0.6652499
					};

					/* Define projection */
					var projection = d3.geo.mercator()
									.scale( widthMap / projectionParameters.scale / Math.PI )
									.translate([
										widthMap / 2,
										projectionParameters.translate * projectionParameters.heightMap
									]);

					/* Return the projected coordinates of a given longitude and
					latitude */
					function getProjectedCoordinates(lon, lat) {
						return {
							'lon': projection([lon, lat])[0],
							'lat': projection([ lon, lat ])[1]
						};
					}

					/* Define path */
					var path = d3.geo.path()
										.projection(projection);

					/* For given source coordinates, and a city, pushes a New
					LineString coordinates to linkCoordinates */
					function addLinkCoordinates(sourceCoords, city) {
						var cityCoordinates = [ city.lon, city.lat ];
						linkCoordinates.push({
							type: 'LineString',
							coordinates: [sourceCoords, cityCoordinates]
						});
					}

					/* For each source-cities group, concatenate the source to
					the sources array, concatenate the city to the targets arrays
					and calculate the LineString coordinates between the source
					and the city */
					data.forEach( function(group) {
						var cities = group.cities;
						var currentSource = {
							'city': group.originCityName,
							'lat': group.originCityLat,
							'lon': group.originCityLon
						};

						/* Fill up the targets and sources array */
						targets = targets.concat(cities);
						sources = sources.concat(currentSource);

						/* Calculate and fill up with source coordinates projected */
						sourcesProjected = sourcesProjected.concat(getProjectedCoordinates(currentSource.lon, currentSource.lat));

						/* Fill up the linkCoordinates array with the LineString
						coordinates (path between source and city)*/
						var sourceCoordinates = [currentSource.lon, currentSource.lat];
						cities.forEach(function(city) {
							addLinkCoordinates(sourceCoordinates, city);
						});
					});

					/* DATA BINDING - Draw city points */
					var cities = pointsContainer.selectAll('.gCity')
							.data(targets);

					/* Enter : cities */
					var gCityEnter = cities.enter()
								.append('g')
								.attr('class', 'gCity')
								.attr('transform', function(d) {
									var projCoord = projection([d.lon, d.lat]);
									return 'translate(' + projCoord[0] + ',' + projCoord[1] + ')';
								});

					/* Pulsing circle around */
					gCityEnter.append('circle')
							.attr('class', 'city pulseCircle')
							.attr('fill', 'none')
							.attr('stroke', '#DADFE1')
							.attr('stroke-width', 0)
							.attr('r', 0);

					/* Static circle in the center */
					gCityEnter.append('circle')
							.attr('class', 'city staticCircle')
							.attr('r', 0)
							.attr('stroke-width', 0);

					/* DATA BINDING - Draw links between cities */
					var links = linesContainer.selectAll('path')
							.data(linkCoordinates);

					/* Enter : Links */
					links.enter()
						.append('path')
						.attr('fill', 'none')
						.attr('stroke', '#727473')
						.attr('stroke-width', 2)
						.attr('class', 'link')
						.attr('d', path)
						.attr('stroke-dashoffset', function() {
							var totalLength = d3.select(this).node().getTotalLength();
							return totalLength;
						})
						.attr('stroke-dasharray', function() {
							var totalLength = d3.select(this).node().getTotalLength();
							return totalLength + ' ' + totalLength;
						});

					/* DATA BINDING - source icon on source cities */
					var sourceIconContainers = sourceContainer.selectAll('sourceIconContainer')
												.data(sources);

					/* Position source point source icon */
					var sourceIconContainersEnter = sourceIconContainers.enter()
													.append('g')
													.attr('class', 'sourceIconContainer')
													.attr('transform', function(d) {
														var sourceProjected = getProjectedCoordinates(d.lon, d.lat);
														var translateX = sourceProjected.lon - sourceIconSize / 2;
														var translateY = sourceProjected.lat - sourceIconSize / 2;
														return 'translate(' + translateX + ',' + translateY + ')';
													});

					/* Append source icon on the source location */
					sourceIconContainersEnter.append('svg:image')
						.attr('class', 'sourceIcon')
						.attr('xlink:href', 'styles/images/close_white.svg')
						.attr('opacity', 0)
						.style('transform-origin', sourceIconSize / 2 + 'px ' + sourceIconSize / 2 + 'px') // Firefox does not support % as the other browser
						.attr('width', sourceIconSize)
						.attr('height', sourceIconSize);

					/* Append source name on the source location */
					sourceIconContainersEnter.append('text')
						.text(function(d) { return d.city; })
						.attr('class', 'sourceName subtitle')
						.attr('fill', '#fff')
						.attr('text-anchor', 'middle')
						.attr('opacity', 0)
						.attr('transform', 'translate(' + sourceIconSize / 2 + ', -10)');

					/* Puts the source city at the center of the available width
					and available height, so the map is always centered. */
					function centerMap() {
						var centerLon;
						var	centerLat = sourcesProjected[0].lat;

						/* If map width is big enough, center on utrecht (source 0)
						Or if it's small enough (mobile), center on utrecht as well
						730px = width where both utrecht and chicago don't fit in
						the screen anymore */
						if (section.offsetWidth > 1440 || section.offsetWidth < 730) {
							centerLon = sourcesProjected[0].lon;
						} else {
							/* If map width is between tablet and small screen
							Center in the middle between chicago and utrecht */
							centerLon = (sourcesProjected[1].lon - sourcesProjected[0].lon) / 2 + sourcesProjected[0].lon;
						}

						var leftOffset = -(centerLon - sourceIconSize / 2 - section.offsetWidth / 2);
						var topOffset = -(centerLat - section.offsetHeight / 2);

						/* Offset the map layers to center on (centerLon,centerLat) */
						d3.selectAll('.section__map-container__overlapping-maps')
							.style('transform', 'translate3d(' + leftOffset + 'px,' + topOffset + 'px, 0)');
					}

					/* Pulse animation on the city circles */
					function pulse(circle) {

						circle = circle.transition()
						/* First state : Small radius and large stroke */
									.duration(800)
									.delay(1550)
									.attr('stroke-width', 1)
									.attr('r', 0)
						/* Second state : Large radius and no stroke. */
									.transition()
									.attr('stroke-width', 0)
									.attr('r', 15)
									.ease('sin');
					}

					/* Translate the two map layers with a given x and y translate
					values */
					function translateMapContainers(x, y) {
						d3.selectAll('.section__map-container__overlapping-maps')
							.style('transform', 'translate3d(' + x + 'px,' + y + 'px, 0)');
					}

					/* Pans the map horizontally from the map center (defined in
					centerMap()), moves to Chicago and moves back to Utrecht if
					screen size is < 730, moves back to the middle between utrecht
					and Chicago is screen size is < 769 (tablet)
					730px = width where both utrecht and chicago don't fit in
					the screen anymore */
					function panMap() {

						var leftOffset = sourceIconSize / 2 + section.offsetWidth / 2;
						var topOffset = -(sourcesProjected[0].lat - section.offsetHeight / 2);

						/* Add class with transition animation */
						d3.selectAll('.section__map-container__overlapping-maps')
							.attr('class', 'section__map-container__overlapping-maps section__map-container__overlapping-maps--animated');

						/* Pan to second source */
						translateMapContainers(-(sourcesProjected[1].lon - leftOffset), topOffset);

						/* Pan back to first source */
						panTimeout1 = setTimeout(function() {
							translateMapContainers(-(sourcesProjected[0].lon - leftOffset), topOffset);
						}, 6500);

						/* Stay on first source or pan to middle between sources */
						panTimeout2 = setTimeout(function() {
							if (section.offsetWidth < 730) {
								translateMapContainers(-(sourcesProjected[0].lon - leftOffset), topOffset); // Stay in utrecht
							} else if (section.offsetWidth < 769) {
								var midBetweenSource = (sourcesProjected[1].lon - sourcesProjected[0].lon) / 2;
								translateMapContainers(-(midBetweenSource + sourcesProjected[0].lon - leftOffset), topOffset); // Go to middle between chicago and utrecht
							}

							/* Remove the transition animation to prevent the
							transition on centerMap() when a resize event is
							triggered */
							d3.selectAll('.section__map-container__overlapping-maps')
								.transition()
								.delay(6500)
								.style('transition', 'none');

						}, 13000);
					}

					/* initMap : position and size the SVG map first with the
					projectionParameters. Triggered on load of the SVG. */
					scope.initMap = function() {

						/* Map container sizing and positioning */
						d3.select('#cf-map-include svg')
							.attr('width', widthMap)
							.attr('height', projectionParameters.heightMap);

						/* Element container sizing and positioning */
						svg.attr('width', widthMap)
							.attr('height', projectionParameters.heightMap);

						/* Center the map */
						centerMap();
					};

					/* animateMap : Draws the chart elements (cities and linesContainer).
					Triggered inview.
					isDoneAnimating prevents animating more than once. */
					scope.animateMap = function() {

						if (isDoneAnimating) {
							return;
						}

						/* Animate source icon */
						sourceIconContainers.selectAll('.sourceIcon')
							.attr('class', 'sourceIcon sourceIcon--animated');

						sourceIconContainers.select('.sourceName')
							.transition()
							.duration(1500)
							.delay(function(d, i) { return i * 250; })
							.attr('opacity', 1)
							.attr('transform', 'translate(' + sourceIconSize / 2 + ', -20)');

						/* Animate links */
						links.transition()
							.delay(750)
							.duration(1500)
							.ease('in-out')
							.attr('stroke-dashoffset', 0);

						/* Pulsing circles */
						pointsContainer.selectAll('.pulseCircle')
									.each(function() {
										return pulse(d3.select(this));
									});

						/* Update : static circles radius */
						pointsContainer.selectAll('.staticCircle')
									.transition()
									.duration(1500)
									.delay(1550)
									.attr('fill', '#727473')
									.attr('r', 6);

						if (section.offsetWidth < 769) {
							panMap();
						}

						isDoneAnimating = true;

						/* Exit */
						cities.exit().remove();
						links.exit().remove();

					};

					/* Ignore resize events as long as an actualResizeHandler
					execution is in the queue. On resize, center the map.*/
					function resizeThrottler() {

						if ( !resizeTimeout ) {
							resizeTimeout = setTimeout(function() {
								resizeTimeout = null;
								centerMap();
							}, 250);
						}
					}

					/* Resize event handler */
					window.addEventListener('resize', resizeThrottler, false);

					/* Destroy */
					scope.$on('$destroy', function() {
						if (resizeTimeout) {
							window.clearTimeout(resizeTimeout);
						}
						if (panTimeout1) {
							window.clearTimeout(panTimeout1);
						}
						if (panTimeout2) {
							window.clearTimeout(panTimeout2);
						}
						window.removeEventListener('resize', resizeThrottler, false);
					});
				}
			};
		}]);

})();

(function() {
	'use strict';

	/**
	 * @ngdoc function
	 * @name cf-website.directive:checkerboard-box
	 * @description Checker box directive containing images and text. They can
	 * contain images and text.
	 */
	angular.module('cf-website')
		.directive('checkerboardBox', function() {
			return {
				restrict: 'E',
				scope: {
					item: '&'
				},
				replace: true,
				templateUrl: 'components/blocks/checkerboard/checkerboard-box/checkerboard-box.tpl.html',
				link: function postLink() {
				}
			};
		});

})();

(function() {
	'use strict';

	/**
	 * @ngdoc function
	 * @name cf-website.directive:checkerboard
	 * @description Checker box directive containing images and text. Odd childs
	 * conains images and even childs text.
	 */
	angular.module('cf-website')
		.directive('checkerboard', function() {
			return {
				restrict: 'E',
				scope: {
					block: '&',
					columns: '@'
				},
				replace: true,
				templateUrl: 'components/blocks/checkerboard/checkerboard.tpl.html',
				link: function postLink(scope) {
					var cells = scope.block().elements;
					var columns = parseInt(scope.columns, 10) || 2;
					var reverse = scope.block().reverse;
					scope.rows = [];

					//add type information
					cells.map(function(item) {

						item.type = item.title ? 'title' : 'text';
						return item;

					});

					//create groups for rows
					for ( var i = 0 ; i < cells.length ; i++ ) {

						//multiply by 2 because every item is an image block and a text block combined
						var row = Math.floor( (i * 2) / columns);

						//create row when needed
						if (!scope.rows[row]) {
							scope.rows[row] = [];
						}

						//add text cell to row
						scope.rows[row].push(cells[i]);

						//create image cell
						var image = {
							type: 'image',
							image: cells[i].image
						};

						//add image cell to correct position in row
						if (!reverse) {
							scope.rows[row].push(image);
						} else {
							var last = scope.rows[row].length - 1;
							scope.rows[row].splice(last, 0,  image);
						}

					}

				}
			};
		});

})();

(function() {
	'use strict';

	/**
	 * @ngdoc function
	 * @name cf-website.directive:case-overview
	 * @description Case overview with integrated toolkit selection.
	 */
	angular.module('cf-website')
		.directive('caseOverview', ["$timeout", function($timeout) {
			return {
				restrict: 'E',
				replace: true,
				scope: {
					block: '&'
				},
				templateUrl: 'components/blocks/case-overview/case-overview.tpl.html',
				link: function postLink(scope, element) {

					var calculate = function() {

						var block = element[0].querySelector('.block--vertical-center');
						var height = {
							container: element[0].offsetHeight,
							block: block.offsetHeight
						};

						var top = (height.container - height.block) / 2 - 64;
						top = top > 0 ? top : 0;

						var topMargin = (height.container - height.block) / 2 - 64;

						angular
							.element(block)
							.css('margin-top', ( (topMargin > 0) ? topMargin : 0 ) + 'px' );

					};

					//initial load
					$timeout(calculate);

					//resize
					window.addEventListener('resize', calculate, false);

					//destroy
					scope.$on('$destroy', function() {
						window.removeEventListener('resize', calculate, false);
					});

				}
			};
		}]);

})();

(function() {
	'use strict';

	/**
	 * @ngdoc function
	 * @name cf-website.directive:case-logos
	 * @description Logos block on case page
	 */
	angular.module('cf-website')
		.directive('caseLogos', function() {
			return {
				restrict: 'E',
				scope: { block: '&' },
				replace: true,
				templateUrl: 'components/blocks/case-logos/case-logos.tpl.html'
			};
		});
})();

(function() {
	'use strict';

	/**
	 * @ngdoc function
	 * @name cf-website.directive:case-awards
	 * @description Awards block on case page
	 */
	angular.module('cf-website')
		.directive('caseAwards', function() {
			return {
				restrict: 'E',
				scope: { block: '&' },
				replace: true,
				templateUrl: 'components/blocks/case-awards/case-awards.tpl.html',
				link: function postLink() {}
			};
		});

})();

(function() {
	'use strict';

	/**
	 * @ngdoc function
	 * @name cf-website.directive:carouselBlock
	 * @description Carousel block, uses the carousel directive internally
	 */
	angular.module('cf-website')
		.directive('carouselBlock', ["$document", function($document) {
			return {
				restrict: 'E',
				scope: { block: '&', key: '=' },
				replace: true,
				templateUrl: 'components/blocks/carousel-block/carousel-block.tpl.html',
				link: function postLink(scope) {

					scope.useParticles = scope.key === 0 && scope.block().particles === true;

					scope.showArrow = function(inview) {
						scope.hideArrow = !inview;
						scope.$apply();
					};

					scope.nextScreen = function() {
						$document.scrollTopAnimated(window.innerHeight);
					};

				}
			};
		}]);

})();

(function() {
	'use strict';

	/**
	 * @ngdoc function
	 * @name cf-website.directive:bigImage
	 * @description Big image section
	 */
	angular.module('cf-website')
		.directive('bigImage', ["$timeout", function($timeout) {
			return {
				restrict: 'E',
				replace: true,
				scope: { block: '&' },
				templateUrl: 'components/blocks/big-image/big-image.tpl.html',
				link: function postLink(scope, element) {

					var calculate = function() {

						var block = element[0].querySelector('.block--vertical-center');
						var height = {
							container: element[0].offsetHeight,
							block: block.offsetHeight
						};

						var top = (height.container - height.block) / 2 - 64;
						top = top > 0 ? top : 0;

						var topMargin = (height.container - height.block) / 2 - 64;

						angular
							.element(block)
							.css('margin-top', ( (topMargin > 0) ? topMargin : 0 ) + 'px' );

					};

					//initial load
					$timeout(calculate);

					//resize
					window.addEventListener('resize', calculate, false);

					//destroy
					scope.$on('$destroy', function() {
						window.removeEventListener('resize', calculate, false);
					});

				}
			};
		}]);

})();

(function() {
	'use strict';

	/* global ga */

	/**
	 * @ngdoc function
	 * @name cf-website.directive:awards
	 * @description Award section of about page
	 */
	angular.module('cf-website')
		.directive('awards', function() {
			return {
				restrict: 'E',
				scope: { block: '&' },
				replace: true,
				templateUrl: 'components/blocks/awards/awards.tpl.html',
				link: function postLink(scope) {

					scope.expand = false;
					scope.awards = scope.block().awards;
					scope.startRow = scope.block().visibleAwardCount;

					if (scope.startRow > scope.awards.length || scope.awards.length === 1) {
						scope.startRow = scope.awards.length - 1;
						scope.hideButton = true;
						scope.expand = true;
					}

					scope.awards.map(function(award, key, all) {

						var previous = all[ key - 1 ];
						var next = all[ key + 1 ];

						if (previous) {

							if (previous.year === award.year) {
								award.hideYear = true;
							}

							if (previous.organization === award.organization && award.hideYear) {
								award.hideOrganization = true;
							}

							if (previous.distinction === award.distinction) {
								award.hideDistinction = true;
							}

						}

						if (next) {

							if (next.year !== award.year) {
								award.lastOfYear = true;
							}

							if (next.organization !== award.organization) {
								award.lastOfOrganization = true;
							}

						}

						return award;

					});

					//track if users expands table
					scope.$watch('expand', function() {

						if (window.ga && scope.expand === true) {
							ga('send', 'event', 'Tables', 'expand', 'awards', {
								nonInteraction: true
							});
						}

					});

				}
			};
		});

})();

(function() {
	'use strict';

	/**
	 * @ngdoc function
	 * @name cf-website.controller:AppCtrl
	 * @description Controller for the global app state, used to manage the SEO
	 * tags of the application. And check for support like IE browsers.
	 */
	angular.module('cf-website')
		.controller('AppCtrl', ["$scope", "$state", "supportTest", "$timeout", function ($scope, $state, supportTest, $timeout) {

			//check if IE
			$scope.isIE = supportTest.isIE();

			//check if Safari 8
			$scope.isSafari8 = supportTest.isSafari8();

			/**
			 * We have a delay on the content, in this case we show the content after the
			 * navigation animation is finished.
			 * The content inside the ui-view is animated through an transition by
			 * removing the css class `initial-load`.
			 */
			$scope.isInitialLoad = true;
			$timeout(function() {
				$scope.isInitialLoad = false;
			}, 1000);

			// Define some default values we can use to build up the default metadata object
			var defaultTitle = 'CLEVER°FRANKE';
			var defaultDescription = 'An interactive design agency focused on information and data visualization. We create innovative design solutions for data driven clients inspired by their brand values';
			var defaultImage = 'https://www.cleverfranke.com/images/CLEVER-FRANKE-Data-Visualization.jpg';
			var defaultTwitterHandle = '@cleverfranke';

			// Use this object on every route to extend the SEO settings
			var defaultMetadata = {
				'title': defaultTitle,
				'description': defaultDescription,
				'ogLocale': 'en_EN',
				'ogType': 'website',
				'ogTitle': defaultTitle,
				'ogDescription': defaultDescription,
				'ogUrl': 'https://www.cleverfranke.com',
				'ogSiteName': defaultTitle,
				'ogImage': defaultImage,
				'twitterSite': defaultTwitterHandle,
				'twitterCreator': defaultTwitterHandle,
				'twitterCard': 'summary_large_image',
				'twitterTitle': defaultTitle,
				'twitterDescription': defaultDescription,
				'twitterImage': defaultImage
			};

			// First time we load the controller we need the absolute default settings
			$scope.metadata = angular.copy(defaultMetadata);

			// Whenever a controller emits the pageChange event, we update the app's metadata based on the JSON response from the API. This way we can update SEO tag values per page/route
			$scope.$on('pageChange', function(event, pagedata) {

				// Copy the default dataset so we don't work from an already edited state on a pageChange event
				$scope.metadata = angular.copy(defaultMetadata);

				// Get the URL of the current route
				$scope.metadata.ogUrl = $state.href($state.current.name, $state.params, { absolute: true });

				// Remove the trailing slash from the absolute route so we can append the image path in a later point in the script
				var rootUrl = $state.href('home', null, { absolute: true }).replace(/\/$/, '');

				// When we find page-specific SEO information overwrite the default settings for title, descriptions and images.
				if (pagedata.metadata && pagedata.metadata.title !== null) {
					$scope.metadata.title = pagedata.metadata.title;
					$scope.metadata.ogTitle = pagedata.metadata.title;
					$scope.metadata.twitterTitle = pagedata.metadata.title;
				}
				if (pagedata.metadata && pagedata.metadata.description !== null) {
					$scope.metadata.description = pagedata.metadata.description;
					$scope.metadata.ogDescription = pagedata.metadata.description;
					$scope.metadata.twitterDescription = pagedata.metadata.description;
				}
				if (pagedata.metadata && pagedata.metadata.image !== null) {
					$scope.metadata.ogImage = rootUrl + pagedata.metadata.image;
					$scope.metadata.twitterImage = rootUrl + pagedata.metadata.image;
				}
			});

		}]);
})();

(function() {
	'use strict';

	/**
	 * @ngdoc function
	 * @name cf-website.service:API
	 * @description This is the API service to make calls and retrieve data from
	 * the back-end.
	 */
	angular.module('cf-website')
		.service('API', ["$rootScope", "$http", "$q", "$log", function API($rootScope, $http, $q, $log) {

			/*
			 * Rough check if data is valid
			 * @private
			 * @param {Object} project - JSON file
			 * @returns {Boolean}
			 */
			var isValidData = function(data) {
				return typeof data === 'object' && (angular.isArray(data.blocks) || angular.isArray(data.cases));
			};

			/**
			 * Make the GET call to the api with a given endpoint.
			 * @param  {string} endPoint The requested endpoint like a json file.
			 * @return {Promise}         A promise containing the requested data.
			 */
			this.retrieve = function(endPoint) {
				var deferred = $q.defer();
				var callUrl = '/api/' + endPoint;

				// Make the http call
				$http({
					method: 'GET',
					url: callUrl,
					cache: true
				})
				.success(function(data, status, headers, config, statusText) {
					var value = {
						data: data,
						status: status,
						headers: headers,
						config: config,
						statusText: statusText
					};

					/**
					 * Check for valid data
					 */
					if (isValidData(data)) {

						deferred.resolve(value);

					} else {
						var reason = {
							place: 'page',
							name: 'invalidData',
							message: 'Page contains invalid data',
							data: data,
							error: {}
						};

						// Broadcast error
						$rootScope.$broadcast('error', reason);
						deferred.reject(reason);
					}
				})
				.error(function(data, status, headers, config, statusText) {

					$log.error(data, status, headers(), config, statusText);

					var reason = {
						place: 'page',
						name: 'noData',
						message: 'Error during loading of page data',
						data: data,
						error: {
							status: status,
							headers: headers,
							config: config,
							statusText: statusText
						}
					};

					// Broadcast error.
					$rootScope.$broadcast('error', reason);
					deferred.reject(reason);
				});

				return deferred.promise;
			};

		}]);
})();
