const redirect_uri = "http://127.0.0.1:5500/test2.html";
const AUTHORIZE = "https://accounts.spotify.com/authorize";
const TOKEN = "https://accounts.spotify.com/api/token"; 
const searchEndpoint = 'https://api.spotify.com/v1/search?';

let client_id = "";
let client_secret = "";

var access_token = null;
var refresh_token = null;

function convertFile() {
  const fileInput = document.getElementById('fileInput');
  const file = fileInput.files[0];

  if (!file) {
      alert('Please select a file.');
      return;
  }

  const reader = new FileReader();
  reader.onload = function(event) {
      const content = event.target.result;
      const jsonData = parseCSV(content); 
  };

  reader.readAsText(file);
}

const years = [];
let songlist = [];

function parseCSV(content) {
  const lines = content.split('\n');
  const headers = lines[0].split(',');
  const jsonData = [];

  for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const entry = {};
      for (let j = 0; j < headers.length; j++) {
          entry[headers[j]] = values[j];
      }
      jsonData.push(entry);
  }

  localStorage.setItem("jsonData", JSON.stringify(jsonData));
  console.log(jsonData);
  return playlistNames(jsonData);
  
}

function playlistNames(data) {

  for (let i = 0; i < data.length; i++) {
  const year = data[i]['Year'].trim(); 
  if (!years.includes(year)) {
      years.push(year);
  }
}

  years2 = years.filter(item => item.trim() !== '');
  localStorage.setItem("years2", JSON.stringify(years));
  return years2;
}

//ignore above for now

function onPageLoad() {
    client_id = localStorage.getItem("client_id");
    client_secret = localStorage.getItem("client_secret");

    if (window.location.search.length > 0) {
        handleRedirect();
    }
    else{
      access_token = localStorage.getItem("access_token");
      if ( access_token == null ){
          document.getElementById("tokenSection").style.display = 'block';  
      }
  }
}

function handleRedirect(){
  let code = getCode();
  fetchAccessToken( code );
  window.history.pushState("", "", redirect_uri); //returns to redirect_url 
}

function getCode(){
  let code = null;
  const queryString = window.location.search; 
  if ( queryString.length > 0 ){
      const urlParams = new URLSearchParams(queryString); 
      code = urlParams.get('code')
  }
  return code;
  //this is the authorization code that will be passed for a token or whatever
}

function requestAuthorization(){
  //this i will leave alone as is no promises or anything
  client_id = document.getElementById("clientId").value;
  client_secret = document.getElementById("clientSecret").value;
  localStorage.setItem("client_id", client_id);
  localStorage.setItem("client_secret", client_secret);

  let url = AUTHORIZE;
  url += "?client_id=" + client_id;
  url += "&response_type=code";
  url += "&redirect_uri=" + encodeURI(redirect_uri);
  url += "&show_dialog=true";
  url += "&scope=user-read-private user-read-email user-modify-playback-state user-read-playback-position user-library-read streaming user-read-playback-state user-read-recently-played playlist-read-private playlist-modify-public playlist-modify-private";
  window.location.href = url; // shows Spotify's authorization screen innit
}

function callApi(method, url, body) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    const access_token = localStorage.getItem("access_token"); 
  
    if (access_token !== "null") {
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Authorization', 'Bearer ' + access_token);
      xhr.send(body);
    } else {
      xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
      xhr.setRequestHeader('Authorization', 'Basic ' + btoa(client_id + ":" + client_secret));
      xhr.send(body);
    }

    xhr.onload = () => {
      const resStat = xhr.status;
      const resText = xhr.responseText;
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ resStat: resStat, resText: resText});
      } else {
        reject("Failed with status code " + xhr.status);
      }
    };

    xhr.onerror = () => {
      reject('Request failed');
    };
  });
}

async function fetchAccessToken(code) {
  let body = "grant_type=authorization_code";
  body += "&code=" + code; 
  body += "&redirect_uri=" + encodeURI(redirect_uri);
  body += "&client_id=" + client_id;
  body += "&client_secret=" + client_secret;

  try {
    localStorage.setItem("access_token", null);
    callApi("POST", TOKEN, body)
      .then(({ resText }) => {
        var data = JSON.parse(resText);
        console.log(data);
    
        if (data.access_token != undefined) {
          access_token = data.access_token;
          localStorage.setItem("access_token", access_token);
        }
        if (data.refresh_token != undefined) {
          refresh_token = data.refresh_token;
          localStorage.setItem("refresh_token", refresh_token);
        }
      })
 
  } catch (error) {
    console.error("Failed to fetch access token:", error);
    alert("Failed to fetch access token. Please try again.");
  }
}

function refreshAccessToken(){
  refresh_token = localStorage.getItem("refresh_token");
  let body = "grant_type=refresh_token";
  body += "&refresh_token=" + refresh_token;
  body += "&client_id=" + client_id;
  callApi("POST", TOKEN, body);
}

//now we start going to spotstify

let songs = {};
let playlist_id;
let playlistjson = {
  "playlists": [
    {
      "name": "",
      "songs": []
    },
    {
      "name": "",
      "songs": []
    }
  ]
};

async function searchTrack() {

  let unresolvedSongs = [];
  let jsonData = localStorage.getItem("jsonData");
  jsonData = JSON.parse(jsonData);

  for (let i = 0; i < jsonData.length; i++) {
    try {
      const searchQuery = jsonData[i].Songs;
    
      callApi("GET", `${searchEndpoint}q=${encodeURIComponent(searchQuery)}&type=track`, null)
        .then(({ resStat, resText }) => {
          try {
            if (resStat == 200) {
              var data = JSON.parse(resText);
              let track_id = data.tracks.items[0].uri;
        
              let song = {
                "track_id": track_id,
                "name": jsonData[i].Songs
              };
              
              playlistjson.playlists.forEach(playlist => {
                if (playlist.name == jsonData[i].Year) {
                  playlist.songs.push(song);
                }
              });
  
            } else if (resStat == 401) {
              refreshAccessToken();
            } else {
              console.log('Response status:', resStat);
            }
          } catch (error) {
            //playlist.songs.push("");
            unresolvedSongs.push(jsonData[i].Songs);
          }  
        });
    } catch (error) {
      console.log(error);
    } 
  }
  console.log(playlistjson);
  console.log(unresolvedSongs);
}

async function createPlaylist() {
  for (let i = 0; i < years2.length; i++) {
    try {
      let body = {
        name: years2[i],
        description: "Spotify API Generated Playlist :)",
        public: true 
      };

      callApi( "POST", 'https://api.spotify.com/v1/users/31eky7jmzhq54ikwqmsnkf6ntg44/playlists', JSON.stringify(body), null)
        .then(({ resStat, resText }) => {
          if (resStat == 201) {
            var playlistData = JSON.parse(resText);
            var playlist_id = playlistData.id;
    
            let playlist = {
              "name": years2[i],
              "id": playlist_id,
              "songs": [] //array!!
            };

            playlistjson.playlists.push(playlist);

          } else if (resStat == 401) {
            refreshAccessToken()
          } else {
            console.log('Response status:', response.statusCode);
          }
        });

      } catch (error) {
      console.log("u suck");
    }
  }

  console.log("next");
}


async function addTracks2Playlist() {
  for (let i = 0; i < playlistjson.playlists.length; i++) {
    try {
      if (playlistjson.playlists[i].name != "") {
        let idPLAYLIST = playlistjson.playlists[i].id;
        let songs = playlistjson.playlists[i].songs;
        for (let j = 0; j < songs.length; j++) {
          let idTRACKArray = [];
          let idTRACK = songs[j].track_id;
          idTRACKArray.push(idTRACK);
          console.log(idTRACKArray);

          callApi("POST", `https://api.spotify.com/v1/playlists/${idPLAYLIST}/tracks`, JSON.stringify({ uris: idTRACKArray }))
            .then(({ resStat }) => {
              if (resStat == 401) {
                refreshAccessToken();
              } else {
                console.log('Reponse status:', resStat);
              }
            })
        }
      }
    } catch (error) {
      console.log("stinky");
    }
  }
}
