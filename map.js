
console.log('Mapbox GL JS Loaded:', typeof mapboxgl !== 'undefined');
console.log('D3 Loaded:', typeof d3 !== 'undefined');

mapboxgl.accessToken = 'pk.eyJ1IjoiYnNvbjkzODkiLCJhIjoiY21odm1kczNoMGM3bjJrb3FpczNqenRvYSJ9.b5puBKi_URLc8e-8b8wUDw';


const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [-71.09415, 42.36027],
    zoom: 12,
    minZoom: 5,
    maxZoom: 18
});


map.addControl(new mapboxgl.NavigationControl(), 'top-right');


function getCoords(station) {
    const point = new mapboxgl.LngLat(+station.lon, +station.lat);
    const { x, y } = map.project(point);
    return { cx: x, cy: y };
}

function formatTime(minutes) {
    const date = new Date(0, 0, 0, 0, minutes);
    return date.toLocaleString('en-US', { timeStyle: 'short' });
}

function minutesSinceMidnight(date) {
    return date.getHours() * 60 + date.getMinutes();
}

function filterTripsbyTime(trips, timeFilter) {
    return timeFilter === -1
        ? trips  
        : trips.filter((trip) => {
            const startedMinutes = minutesSinceMidnight(trip.started_at);
            const endedMinutes = minutesSinceMidnight(trip.ended_at);
            
            return (
                Math.abs(startedMinutes - timeFilter) <= 60 ||
                Math.abs(endedMinutes - timeFilter) <= 60
            );
        });
}

function computeStationTraffic(stations, trips) {
    const departures = d3.rollup(
        trips,
        (v) => v.length,
        (d) => d.start_station_id
    );
    
    const arrivals = d3.rollup(
        trips,
        (v) => v.length,
        (d) => d.end_station_id
    );
    
    return stations.map((station) => {
        let id = station.short_name;
        station.arrivals = arrivals.get(id) ?? 0;
        station.departures = departures.get(id) ?? 0;
        station.totalTraffic = station.arrivals + station.departures;
        return station;
    });
}

map.on('load', async () => {
    console.log('Map loaded!');
    
    map.addSource('boston_route', {
        type: 'geojson',
        data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson'
    });
    
    map.addLayer({
        id: 'bike-lanes',
        type: 'line',
        source: 'boston_route',
        paint: {
            'line-color': 'green',
            'line-width': 3,
            'line-opacity': 0.4
        }
    });
    
    console.log('Bike lanes added!');
    
    let stations;
    try {
        const jsonUrl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
        const jsonData = await d3.json(jsonUrl);
        console.log('Loaded JSON Data:', jsonData);
        
        stations = jsonData.data.stations;
        console.log('Stations Array:', stations);
        console.log('First station:', stations[0]);
    } catch (error) {
        console.error('Error loading JSON:', error);
        return;
    }
    
    let trips;
    try {
        console.log('Loading trip data... (21 MB, will take a moment)');
        trips = await d3.csv(
            'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv',
            (trip) => {
                trip.started_at = new Date(trip.started_at);
                trip.ended_at = new Date(trip.ended_at);
                return trip;
            }
        );
        console.log('Loaded trips:', trips.length);
    } catch (error) {
        console.error('Error loading trip data:', error);
        return;
    }
    
    stations = computeStationTraffic(stations, trips);
    console.log('Initial traffic computed!');
    
    const radiusScale = d3.scaleSqrt()
        .domain([0, d3.max(stations, d => d.totalTraffic)])
        .range([0, 25]);
    
    console.log('Max traffic:', d3.max(stations, d => d.totalTraffic));
    
    let stationFlow = d3.scaleQuantize()
        .domain([0, 1])
        .range([0, 0.5, 1]);
    
    const svg = d3.select('#map')
        .append('svg')
        .style('position', 'absolute')
        .style('top', 0)
        .style('left', 0)
        .style('width', '100%')
        .style('height', '100%')
        .style('pointer-events', 'none')
        .style('z-index', 1);
    
    console.log('SVG overlay created!');
    
    const circles = svg
        .selectAll('circle')
        .data(stations, d => d.short_name)
        .enter()
        .append('circle')
        .attr('r', d => radiusScale(d.totalTraffic))
        .attr('fill', 'steelblue')
        .attr('fill-opacity', 0.6)
        .attr('stroke', 'white')
        .attr('stroke-width', 1)
        .style('--departure-ratio', d => 
            stationFlow(d.departures / d.totalTraffic)
        )
        .each(function(d) {
            d3.select(this)
                .append('title')
                .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
        });
    
    console.log('Circles created with traffic-based sizing and flow colors!');
    
    function updatePositions() {
        circles
            .attr('cx', (d) => getCoords(d).cx)
            .attr('cy', (d) => getCoords(d).cy);
    }
    
    updatePositions();
    
    map.on('move', updatePositions);
    map.on('zoom', updatePositions);
    map.on('resize', updatePositions);
    map.on('moveend', updatePositions);
    
    console.log('Map positioning complete!');
    
    const timeSlider = document.getElementById('time-slider');
    const selectedTime = document.getElementById('selected-time');
    const anyTimeLabel = document.getElementById('any-time');
    
    function updateScatterPlot(timeFilter) {
        const filteredTrips = filterTripsbyTime(trips, timeFilter);
        
        const filteredStations = computeStationTraffic(stations, filteredTrips);
        
        timeFilter === -1 
            ? radiusScale.range([0, 25]) 
            : radiusScale.range([3, 50]);
        
        circles
            .data(filteredStations, d => d.short_name)
            .join('circle')
            .transition()
            .duration(300)
            .attr('r', d => radiusScale(d.totalTraffic))
            .style('--departure-ratio', d => 
                stationFlow(d.departures / d.totalTraffic)
            );
    }
    
    function updateTimeDisplay() {
        let timeFilter = Number(timeSlider.value);
        
        if (timeFilter === -1) {
            selectedTime.textContent = '';
            anyTimeLabel.style.display = 'block';
        } else {
            selectedTime.textContent = formatTime(timeFilter);
            anyTimeLabel.style.display = 'none';
        }
        
        updateScatterPlot(timeFilter);
    }
    
    
    timeSlider.addEventListener('input', updateTimeDisplay);
    
    
    updateTimeDisplay();
    
    ;
});