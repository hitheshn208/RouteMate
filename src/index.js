import L from "leaflet";
import "leaflet/dist/leaflet.css";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
import "./style.css";
import "./loader.css";
import navURL from "./assets/navPngIcon.png";
import 'leaflet-rotatedmarker';

let DefaultIcon = L.icon({
    iconUrl: iconUrl,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 33],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

let navLeafletIcon = L.icon({
    iconUrl: navURL,
    iconSize: [40, 40],   
    iconAnchor: [20, 20], 
});


let navIcon = L.marker([12.9716, 77.5946], { 
    icon: navLeafletIcon,
    rotationAngle: 0,   
    rotationOrigin: 'center center'
})

L.Marker.prototype.options.icon = DefaultIcon;

const destinationBtn = document.querySelector('#destination');
const find = document.querySelector('#find');
const loadLive = document.querySelector("#loadLocation");
const drive = document.querySelector('#drive');
const dialog = document.querySelector('dialog');
const cancel = document.querySelector('#cancel');
const carLoader = document.querySelector(".carloader");
const source = document.querySelector('#source');
const stop = document.querySelector('#stop');
const navButtons = document.querySelector('.nav-buttons');


let  start = null;
let currentCor;
let yourmarker = null, destmarker = null;
let route = null;
let watchId = null;
let reverseGeoCodingresult;

const normal = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'})

let map = L.map('map', {
    center: [12.9716, 77.5946],
    zoom: 5,
    rotate: true,       
    touchRotate: true   
}); 

normal.addTo(map);

// window.addEventListener("load", ()=>{
//     dialog.showModal();
//     getCurrentLoc();
// })

loadLive.addEventListener("click", ()=>{
    dialog.showModal();
    getCurrentLoc();
})

drive.addEventListener("click", ()=>{
    yourmarker.remove();
    navIcon.addTo(map);
    navigation();
});

stop.addEventListener("click", ()=>{
    if (watchId) {
    navIcon.remove();
    yourmarker.addTo(map);
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
    
  }
});

find.addEventListener("click", async ()=>{

    
    if(!start && source.value != "")
    {
        start = await getGeoCode(source.value);
    }

    const address = destinationBtn.value;

    if(!address)
    {
        alert("Enter a destination");
        carLoader.close();
        return;
    }
    geoRoute(address);
    cancel.style.display = "inline";
    navButtons.style.display = "flex";
});

cancel.addEventListener("click", ()=>{

    if(route){
        route.remove();
        route = null;
    }

    if(destmarker)
        destmarker.remove();
    if(yourmarker)
        yourmarker.remove();

    navButtons.style.display = "none";
})

document.addEventListener("keydown", (e)=>{
    if(destinationBtn.value && e.key === "Enter") find.dispatchEvent(new Event("click"));
});

window.addEventListener("deviceorientationabsolute", handleOrientation);

function handleOrientation(e) {
  let heading = e.alpha; 
  rotateMap(heading);
}

function rotateMap(angle) {
      navIcon.setRotationAngle(360 - angle);
}

function getCurrentLoc()
{
    if (!navigator.geolocation) {
        console.log("Geolocation not supported");
        if (dialog && typeof dialog.close === "function") dialog.close();
        return;
    }

    navigator.geolocation.getCurrentPosition(async (position)=>{
    try{
        const url = `https://nominatim.openstreetmap.org/reverse?lat=${position.coords.latitude}&lon=${position.coords.longitude}&format=json`
        
        const response = await fetch(url);
        reverseGeoCodingresult = await response.json();

        source.value = reverseGeoCodingresult.display_name;
    }
    catch{
        console.log("Error in Reverse geocoding");
    }

        start = [position.coords.latitude, position.coords.longitude];

        if(!yourmarker)
            yourmarker = L.marker([position.coords.latitude, position.coords.longitude]);
        else
            yourmarker.setLatLng([position.coords.latitude, position.coords.longitude]);

        yourmarker.addTo(map);

        map.flyTo([position.coords.latitude, position.coords.longitude],18, {duration : 1.5});

        yourmarker.bindPopup("<b>Your Location</b>").openPopup();

        console.log("Start initialised " +position.coords.latitude + " " +position.coords.longitude);
        
        if (dialog && typeof dialog.close === "function") dialog.close();

    }, 
    (error) => {
        console.log("Error getting location:", error);
        if (dialog && typeof dialog.close === "function") dialog.close();
    });
}


async function geoRoute(address) {
    try {

        carLoader.showModal();
    const nominatimURL = `https://nominatim.openstreetmap.org/search?format=json&q=${address}`;
    const geoCoderes = await fetch(nominatimURL);
    const geoCode = await geoCoderes.json();

    if (!geoCode || geoCode.length === 0) {
            carLoader.close();
            alert("No results found for the given address.");
            return;
    }

    if(destmarker) destmarker.remove();

    destmarker = L.marker([geoCode[0].lat, geoCode[0].lon]).bindPopup(`<b>${address}</b>`);

    console.log("Recieved geo code of " + address + " lat " + geoCode[0].lat + " lon " + geoCode[0].lon );

    const orsmURL = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${geoCode[0].lon},${geoCode[0].lat}?overview=full&geometries=geojson`;

    const orsmres = await fetch(orsmURL);
    let geoJson = await orsmres.json();

    if (!geoJson.routes) {
        console.log("No route found");
        carLoader.close();
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
    carLoader.close();

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

function navigation()
{
     if (!watchId){
        watchId = navigator.geolocation.watchPosition((position)=>{
            let accuracy = position.coords.accuracy;

            if(accuracy > 60)
            {
                console.log("Low accuracy ignoring " + accuracy);
                return;
            }
            navIcon.setLatLng([position.coords.latitude, position.coords.longitude]);
            currentCor = [position.coords.latitude, position.coords.longitude];
            map.flyTo([currentCor[0], currentCor[1]], 18, {duration: 1.5});

    }, 
    (err) => console.log(err),
    {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout:10000
    });
  }
}

async function getGeoCode(address)
{
    const nominatimURL = `https://nominatim.openstreetmap.org/search?format=json&q=${address}`;
    const geoCoderes = await fetch(nominatimURL);
    const geoCode = await geoCoderes.json();

    if (!geoCode || geoCode.length === 0) {
            carLoader.close();
            alert("No results found for the given address.");
            return;
    }
    if(!yourmarker)
        yourmarker = L.marker([geoCode[0].lat, geoCode[0].lon]);
    else
        yourmarker.setLatLng([geoCode[0].lat, geoCode[0].lon]);

    yourmarker.addTo(map)
    return [geoCode[0].lat, geoCode[0].lon];
}
