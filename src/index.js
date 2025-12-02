import L from "leaflet";
import "leaflet/dist/leaflet.css";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
import "./style.css";

let DefaultIcon = L.icon({
    iconUrl: iconUrl,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 33],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

  const inpaddress = document.querySelector('#address');
    const find = document.querySelector('#find');

    const normal = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'})

    

let map = null;
let start;
let yourmarker, destmarker = null;
let route = null;
    
navigator.geolocation.getCurrentPosition((position)=>{

    map = L.map('map').setView([position.coords.latitude, position.coords.longitude], 13);
    normal.addTo(map);

    start = [position.coords.latitude, position.coords.longitude];

    yourmarker = L.marker([position.coords.latitude, position.coords.longitude]);
    yourmarker.addTo(map);

    map.flyTo([position.coords.latitude, position.coords.longitude],18, {duration : 1.5});

    yourmarker.bindPopup("<b>Your Location</b>").openPopup();

    console.log("Start initialised " +position.coords.latitude + " " +position.coords.longitude);

});


find.addEventListener("click", ()=>{
    const address = inpaddress.value;
    if(!address)
    {
        alert("Enter a valid place name");
        return;
    }

    geoRouteFromSearch(address);

    inpaddress.value = "";
})

document.addEventListener("keydown", (e)=>{
    if(inpaddress.value && e.key === "Enter") find.dispatchEvent(new Event("click"));
    
});

async function geoRouteFromSearch(address) {
    try {

    const nominatimURL = `https://nominatim.openstreetmap.org/search?format=json&q=${address}`;

    const geoCoderes = await fetch(nominatimURL);
    const geoCode = await geoCoderes.json();

    if (!geoCode || geoCode.length === 0) {
            alert("No results found for the given address.");
            return;
    }

    if(destmarker)
    {
        destmarker.remove();
    }

    destmarker = L.marker([geoCode[0].lat, geoCode[0].lon]).bindPopup(`<b>${address}</b>`);

    console.log("Recieved geo code of " + address + " lat " + geoCode[0].lat + " lon " + geoCode[0].lon );

    const orsmURL = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${geoCode[0].lon},${geoCode[0].lat}?overview=full&geometries=geojson`;

    const orsmres = await fetch(orsmURL);
    let geoJson = await orsmres.json();

    if (!geoJson.routes) {
        console.log("No route found");
        return;
    }


    if(route)
    {
        map.removeLayer(route);
        console.log("Previous old geoJson layer")
    }

    console.log("ORSM done!!");

    route = L.geoJSON(geoJson.routes[0].geometry, {
        style : {
            color : "rgba(0, 100, 208, 1)",
            weight : 10
        }
    }).addTo(map);

    console.log("GeoJSON added");

    destmarker.addTo(map); //Adding the marker

    console.log("Added marker to " + address);

    const markersGroup = L.featureGroup([yourmarker, destmarker]);

    console.log("Created Markers group");

    map.flyToBounds(markersGroup, {
        padding: [50,50],
        animate: true,
        duration: 1.5
    });

    }

    catch{
        console.log("Error brooo");
    }


}