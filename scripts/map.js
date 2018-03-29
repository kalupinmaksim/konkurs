$('.nav-toggle').click(function() {
    document.getElementsById("navmenu").classList.add("navigation--show");
});
var map;

function initMap() {
    var styledMapType = new google.maps.StyledMapType(
        [{
            "elementType": "geometry",
            "stylers": [{
                "color": "#212121"
            }]
        }, {
            "elementType": "labels.icon",
            "stylers": [{
                "visibility": "off"
            }]
        }, {
            "elementType": "labels.text.fill",
            "stylers": [{
                "color": "#757575"
            }]
        }, {
            "elementType": "labels.text.stroke",
            "stylers": [{
                "color": "#212121"
            }]
        }, {
            "featureType": "administrative",
            "elementType": "geometry",
            "stylers": [{
                "color": "#757575"
            }]
        }, {
            "featureType": "administrative.country",
            "elementType": "labels.text.fill",
            "stylers": [{
                "color": "#9e9e9e"
            }]
        }, {
            "featureType": "administrative.land_parcel",
            "stylers": [{
                "visibility": "off"
            }]
        }, {
            "featureType": "administrative.locality",
            "elementType": "labels.text.fill",
            "stylers": [{
                "color": "#bdbdbd"
            }]
        }, {
            "featureType": "poi",
            "elementType": "labels.text.fill",
            "stylers": [{
                "color": "#757575"
            }]
        }, {
            "featureType": "poi.park",
            "elementType": "geometry",
            "stylers": [{
                "color": "#181818"
            }]
        }, {
            "featureType": "poi.park",
            "elementType": "labels.text.fill",
            "stylers": [{
                "color": "#616161"
            }]
        }, {
            "featureType": "poi.park",
            "elementType": "labels.text.stroke",
            "stylers": [{
                "color": "#1b1b1b"
            }]
        }, {
            "featureType": "road",
            "elementType": "geometry.fill",
            "stylers": [{
                "color": "#2c2c2c"
            }]
        }, {
            "featureType": "road",
            "elementType": "labels.text.fill",
            "stylers": [{
                "color": "#8a8a8a"
            }]
        }, {
            "featureType": "road.arterial",
            "elementType": "geometry",
            "stylers": [{
                "color": "#373737"
            }]
        }, {
            "featureType": "road.highway",
            "elementType": "geometry",
            "stylers": [{
                "color": "#3c3c3c"
            }]
        }, {
            "featureType": "road.highway.controlled_access",
            "elementType": "geometry",
            "stylers": [{
                "color": "#4e4e4e"
            }]
        }, {
            "featureType": "road.local",
            "elementType": "labels.text.fill",
            "stylers": [{
                "color": "#616161"
            }]
        }, {
            "featureType": "transit",
            "elementType": "labels.text.fill",
            "stylers": [{
                "color": "#757575"
            }]
        }, {
            "featureType": "water",
            "elementType": "geometry",
            "stylers": [{
                "color": "#000000"
            }]
        }, {
            "featureType": "water",
            "elementType": "labels.text.fill",
            "stylers": [{
                "color": "#3d3d3d"
            }]
        }], {
            name: 'Styled Map'
        });


    var contentString = '<div id="content">' +
        '<div style="backgroung-color:#f6f3f0" id="siteNotice">' +
        '</div>' +
        '<div id="bodyContent">';
    var finalString = '.  <a href="https://en.wikipedia.org/w/index.php?title=Uluru&oldid=297882194">' +
        'Подробнее..</a> </p>' +
        '</div>' +
        '</div>';
    var body1 = 'ООО "Индустриальный парк "Ворсино';
    var body2 = 'Корпорация развития Калужской области АО';
    var body3 = 'ООО "Сибирский элемент Рента-К"';
    var body4 = 'ООО “СТГ-Эко“';
    var body5 = 'ООО “БАШ-РТС“';
    var body6 = 'ООО “ГИПЕРГЛОБУС“';
    var infowindow1 = new google.maps.InfoWindow({
        content: contentString + body1 + finalString
    });
    var infowindow2 = new google.maps.InfoWindow({
        content: contentString + body2 + finalString
    });
    var infowindow3 = new google.maps.InfoWindow({
        content: contentString + body3 + finalString
    });
    var infowindow4 = new google.maps.InfoWindow({
        content: contentString + body4 + finalString
    });
    var infowindow5 = new google.maps.InfoWindow({
        content: contentString + body5 + finalString
    });
    var infowindow6 = new google.maps.InfoWindow({
        content: contentString + body6 + finalString
    });
    var icons = {
        mark: {
            icon: 'images/marker.png'
        },
    };

    var features = [{
        position: new google.maps.LatLng(55.128892, 36.635889), //ворсино
        type: 'mark'
    }, {
        position: new google.maps.LatLng(54.522300, 36.251133), //корп разв
        type: 'mark'
    }, {
        position: new google.maps.LatLng(54.543511, 36.041069), //рента к
        type: 'mark'
    }, {
        position: new google.maps.LatLng(54.747523, 55.980179), //стгэко
        type: 'mark'
    }, {
        position: new google.maps.LatLng(54.826482, 56.083387), //башрст
        type: 'mark'
    }, {
        position: new google.maps.LatLng(54.489374, 36.223679), //гиперглобус
        type: 'mark'
    }];

    map = new google.maps.Map(document.getElementById('map'), {
        center: {
            lat: 53.906869,
            lng: 41.854830
        },
        zoom: 5
    });
    map.mapTypes.set('styled_map', styledMapType);
    map.setMapTypeId('styled_map');

    var marker1 = new google.maps.Marker({
        position: features[0].position,
        icon: icons[features[0].type].icon,
        map: map
    });
    marker1.addListener('click', function() {
        infowindow1.open(map, marker1);
    });


    var marker2 = new google.maps.Marker({
        position: features[1].position,
        icon: icons[features[1].type].icon,
        map: map
    });
    marker2.addListener('click', function() {
        infowindow2.open(map, marker2);
    });

    var marker3 = new google.maps.Marker({
        position: features[2].position,
        icon: icons[features[2].type].icon,
        map: map
    });
    marker3.addListener('click', function() {
        infowindow3.open(map, marker3);
    });


    var marker4 = new google.maps.Marker({
        position: features[3].position,
        icon: icons[features[3].type].icon,
        map: map
    });
    marker4.addListener('click', function() {
        infowindow4.open(map, marker4);
    });


    var marker5 = new google.maps.Marker({
        position: features[4].position,
        icon: icons[features[4].type].icon,
        map: map
    });
    marker5.addListener('click', function() {
        infowindow5.open(map, marker5);
    });


    var marker6 = new google.maps.Marker({
        position: features[5].position,
        icon: icons[features[5].type].icon,
        map: map
    });
    marker6.addListener('click', function() {
        infowindow6.open(map, marker6);
    });

}