import L from "leaflet";
import "leaflet/dist/leaflet.css";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
import "./style.css";
import "./loader.css";
import navURL from "./assets/navPngIcon.png";

let DefaultIcon = L.icon({
    iconUrl: iconUrl,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 33],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const navLeafletIcon = L.icon({
    iconUrl: navURL,
    iconSize: [40, 40],   
    iconAnchor: [20, 20], 
});

L.RotatedMarker = L.Marker.extend({
    options: {
        rotationAngle: 0,
        rotationOrigin: "center center"
    },

    _setPos: function (pos) {
        L.Marker.prototype._setPos.call(this, pos);

        if (this._icon) {
            this._icon.style.transformOrigin = this.options.rotationOrigin;

            if (this.options.rotationAngle) {
                this._icon.style.transform =
                    `rotate(${this.options.rotationAngle}deg)`;
            }
        }
    },

    setRotationAngle: function (angle) {
        this.options.rotationAngle = angle;

        if (this._icon) {
            this._icon.style.transform =
                `rotate(${angle}deg)`;
        }
    }
});

let navIcon = new L.RotatedMarker([12.9767936, 77.5900820], {
    icon: navLeafletIcon,
    rotationAngle: 0
});

L.Marker.prototype.options.icon = DefaultIcon;

const destinationBtn = document.querySelector('#destination');
const find = document.querySelector('#find');
const loadLive = document.querySelector("#loadLocation");
const drive = document.querySelector('#drive');
const dialog = document.querySelector('dialog');
const carLoader = document.querySelector(".carloader");
const source = document.querySelector('#source');
const stop = document.querySelector('#stop');
const mapContainer = document.getElementById("map");

let  start;
let yourmarker, destmarker = null;
let route = null;
let watchId = null;

const normal = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'})

let map = L.map("map").setView([12.9767936, 77.5900820], 5); //Default set to Bangalore
normal.addTo(map);

window.addEventListener("load", ()=>{
    dialog.showModal();
    getCurrentLoc();
})

loadLive.addEventListener("click", ()=>{
    dialog.showModal();
    getCurrentLoc();
})

drive.addEventListener("click", ()=>{
    navigation();
    yourmarker.remove();
    navIcon.setLatLng([start[0], start[1]]);
    navIcon.addTo(map);
    map.flyTo([start[0], start[1]], 18, {duration: 1.5});
});

stop.addEventListener("click", ()=>{
    if (watchId) {
    yourmarker.setIcon(DefaultIcon);
     navigator.geolocation.clearWatch(watchId);
     watchId = null;
  }
})

find.addEventListener("click", ()=>{
    const address = destinationBtn.value;
    if(!address)
    {
        alert("Enter a valid place name");
        return;
    }
    geoRoute(address);
});

document.addEventListener("keydown", (e)=>{
    if(destinationBtn.value && e.key === "Enter") find.dispatchEvent(new Event("click"));
    
});

window.addEventListener("deviceorientationabsolute", handleOrientation);

function handleOrientation(e) {
  let heading = e.alpha; 
  rotateMap(heading);
}

function rotateMap(angle) {
  mapContainer.style.transform = `rotate(${-angle}deg)`; 
  navIcon.setRotationAngle(angle);
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
        const result = await response.json();

        source.value = result.display_name;
    }
    catch{
        console.log("Error in Reverse geocoding");
    }

        start = [position.coords.latitude, position.coords.longitude];

        yourmarker = L.marker([position.coords.latitude, position.coords.longitude]);
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
        navIcon.setLatLng([position.coords.latitude, position.coords.longitude]);
    })
  }
}