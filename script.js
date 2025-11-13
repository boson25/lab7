mapboxgl.accessToken = 'pk.eyJ1IjoiYnNvbjkzODkiLCJhIjoiY21odm1kczNoMGM3bjJrb3FpczNqenRvYSJ9.b5puBKi_URLc8e-8b8wUDw';

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [-71.0589, 42.3601],
    zoom: 12,
    minZoom: 10,
    maxZoom: 16
});

map.addControl(new mapboxgl.NavigationControl(), 'top-right');

map.on('load', async () => {
    console.log('Map loaded successfully!');
    
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
        stations = await d3.json(jsonUrl);
        console.log('Loaded stations:', stations.length);
    } catch (error) {
        console.error('Error loading station data:', error);
        return;
    }
    
    const svg = d3.select(map.getCanvasContainer())
        .append('svg')
        .style('position', 'absolute')
        .style('top', 0)
        .style('left', 0)
        .style('width', '100%')
        .style('height', '100%')
        .style('pointer-events', 'none');
    
    const circles = svg.append('g')
        .attr('class', 'station-markers');
    
    console.log('SVG overlay created!');
    
    circles.selectAll('circle')
        .data(stations)
        .join('circle')
        .attr('class', 'station-circle')
        .attr('r', 5)
        .attr('fill', 'steelblue')
        .attr('fill-opacity', 0.7)
        .attr('stroke', 'white')
        .attr('stroke-width', 1)
        .style('pointer-events', 'auto');
    
    console.log('Station circles created!');
    
    function updatePositions() {
        circles.selectAll('circle')
            .attr('cx', d => {
                const point = map.project([d.Long, d.Lat]);
                return point.x;
            })
            .attr('cy', d => {
                const point = map.project([d.Long, d.Lat]);
                return point.y;
            });
    }
    
    updatePositions();
    console.log('Circles positioned!');
    
    map.on('move', updatePositions);
    map.on('zoom', updatePositions);
    map.on('resize', updatePositions);
    map.on('moveend', updatePositions);
    
    console.log('Map event listeners added!');
});
