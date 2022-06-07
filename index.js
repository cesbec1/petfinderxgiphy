/*
Cesar Becerril
23189943
*/

const http = require('http');
const https = require('https');
const fs = require("fs");
const port = 3000;
const server = http.createServer();
const querystring = require('querystring')
const [{client_id,client_secret} , giphy_key] = require('./credentials/creds.json')

server.on("request", connection_handler);
function connection_handler(req, res){
	console.log(`New Request for ${req.url} from ${req.socket.remoteAddress}`);
	if(req.url === `/`){
		let search = "animals";
		giphy_request(res,search);

	} else if(req.url === `/favicon.ico`){
		
        const favicon = fs.createReadStream('images/petbowl.png');
	    res.writeHead(200,{'Content-Type' : 'image/x-icon'});
	    favicon.pipe(res);

	}else if(req.url.toString().startsWith("search",1)){
		let user_search = new URL(req.url, `https://${req.headers.host}`);
		user_input = user_search.searchParams.get('animalsearch');
		user_zip = user_search.searchParams.get('zip')
		animal_request(user_input,user_zip,res);
		
	}else{
        let fourohfour = `<html> <img src="https://media2.giphy.com/media/Qxkf4LQ1xIbXpH8z0I/giphy.gif?cid=36a7be02oiu7a0n4q5pmx5czk6ka9ou0vzv51kp4t5tmn2wp&rid=giphy.gif&ct=g">
        <h1>  <a href="http://localhost:3000/">Go Back Home</a> </h1> <html>`;
		res.writeHead(404);
        res.write(fourohfour);
		res.end();
	}
}

function animal_request(user_input,user_zip,res){
    
	let token_cache_file = './credentials/authentication-res.json';
    let is_cache_valid = false;
    if(fs.existsSync(token_cache_file)){
        cached_token_obj = require(token_cache_file);
        if(new Date(cached_token_obj.expiration) > Date.now()){
            is_cache_valid = true;
        }
    }    
    if(is_cache_valid){
        let access_token = cached_token_obj.access_token;
        console.log("cache exists and is valid");
        create_search_request(access_token,user_input,user_zip,res);
    }else{
        request_access_token(user_input,user_zip,res);
    }
}

function request_access_token(user_input,user_zip,res){
    const client = client_id;
    const secret = client_secret;
    
    const headers = {
        "Content-Type": "application/x-www-form-urlencoded",
    }

    let post_data = {
    	"grant_type": "client_credentials",
		"client_id": client,
		"client_secret":secret
    }

    post_data = querystring.stringify(post_data);
    
    const options = { 
	    "method":"POST",
	    "headers":headers
    }
    const token_endpoint = "https://api.petfinder.com/v2/oauth2/token";
    const token_request_time = new Date();
    let token_req = https.request(token_endpoint,options);
    token_req.once("error", (err) => {throw err})

    token_req.once('response', (token_stream) => process_stream(token_stream, received_token,user_input,user_zip,token_request_time,res));
    token_req.end(post_data);
}

function received_token(string_token_object,user_input,user_zip,token_request_time,res){
	let token_object = JSON.parse(string_token_object);
    let access_token = token_object.access_token;
    create_access_token_cache(token_object,token_request_time);
    create_search_request(access_token,user_input,user_zip,res)
}

function create_access_token_cache(token_object,token_request_time){
    token_object.expiration = new Date(token_request_time.getTime() + (token_object.expires_in *1000));
    fs.writeFile('./credentials/authentication-res.json', JSON.stringify(token_object), () => console.log("access token cached"));
}

function create_search_request(access_token,user_input,user_zip,res){
    console.log("Making petfinder API call");
    const headers = {
        "Authorization": `Bearer ${access_token}`,
    }

    const options = {
        "method":"GET",
        "headers":headers
    }
    let request_object = { 
        "type" : user_input,
        "location" : user_zip,
		"limit": 20,
    }

    let search_endpoint =  "https://api.petfinder.com/v2/animals/?" + querystring.stringify(request_object);

    const search_request = https.request(search_endpoint,options);
    search_request.on("error", err => {throw err});
    search_request.on("response", (result_stream)=> process_stream(result_stream,received_animal_result,user_input,res));
    setTimeout( () => search_request.end(), 5000);
    //search_request.end();
}

function received_animal_result(string_search_object,user_input,res){
    let rand = Math.floor(Math.random() * 21);
    let animal_result = JSON.parse(string_search_object);  
    if(animal_result.status == 400){
       const stream = fs.createReadStream('./html/type.html');
       stream.pipe(res);
    }else{
        while(animal_result.animals[rand].photos == null){
            rand = Math.floor(Math.random() * 21);
        }
        let animal_object ={
            "url": animal_result.animals[rand].url,   
            "description":animal_result.animals[rand].description,
            "name":animal_result.animals[rand].name,
            "photos_url":[]
        }
        if(animal_object.description == null ) animal_object.description = "No words can describe " + animal_object.name;
        for(let i = 0; i< animal_result.animals[rand].photos.length; i++){
            animal_object.photos_url.push(animal_result.animals[rand].photos[i].medium);
        }
        giphy_request(res,user_input,animal_object)
    }
}


function giphy_request(res,search,animal_object){
    console.log("Making giphy API request");
	if(animal_object != null ) search = "cute " + search;
    const headers = {
        "Content-Type": `application/x-www-form-urlencoded`,
    }

    const options = {
        "method":"GET",
        "headers":headers
    }
    let body = { 
		"api_key": giphy_key.api_key,
        "q" : search,
		"limit": 20,
		"offset":0,
		"rating":"g",
		"lang":"en"
    }

    let search_endpoint =  "https://api.giphy.com/v1/gifs/search?" + querystring.stringify(body);

   
    const search_request = https.request(search_endpoint,options);
    search_request.on("error", err => {throw err});
    search_request.on("response", (result_stream)=> process_stream(result_stream,receive_giphy_results,res,animal_object));
    search_request.end();
}

function process_stream (stream, callback , ...args){
	let body = "";
	stream.on("data", chunk => body += chunk);
	stream.on("end", () => callback(body, ...args));
}

function receive_giphy_results(body,res,animal_object){
	const giphy_object = JSON.parse(body);
	//console.log(giphy_object.data[0].images)
    if(animal_object == null){
        let gif_url = giphy_object.data[Math.floor(Math.random() * 20)].images.original.url;
        const html_stream = fs.createReadStream('html/home.html');
        process_stream(html_stream,generate_homepage,gif_url,res)
    }else{
        let gif_url = []
        gif_url.push(giphy_object.data[Math.floor(Math.random() * 20)].images.original.url);
        gif_url.push(giphy_object.data[Math.floor(Math.random() * 20)].images.original.url);
        gif_url.push(giphy_object.data[Math.floor(Math.random() * 20)].images.original.url);
        gen_search_result_page(res,gif_url,animal_object);
    }

	//generate_webpage(gif_url,res)
}
//`<img src="${image_url}" href="${animal_object.url}"/>`).join("");
function gen_search_result_page(res,gif_url,animal_object){
    let name = `<h1> ${animal_object.name}  </h1>`
    let images = animal_object.photos_url.map(image_url => `<a href="${animal_object.url}"><img src="${image_url}" alt="photo" "></a>`).join("");
    let description = `<h3> ${animal_object.description} </h3>`
    let gif_display = gif_url.map(image_url => `<img src="${image_url}" />`).join("");
    save_search(name,animal_object.photos_url[0]);    
    res.end(`<html> ${name} <h1> <a href="http://localhost:3000/">Make A New Search</a></h1> <br> ${images}  ${description} <br>${gif_display}</html>`)

}

function save_search(name,image){
    let simple_info = {
        "name":name,
        "image":`<img src="${image}" alt="photo">`,
    }
    let search_history ='./cache/past_searches.json'
    if(fs.existsSync(search_history)){
        fs.readFile(search_history,{encoding:"utf-8"},(err,data) => {
            if(err) console.log("error reading past searches");
            if(data){
                append_to_file(data,simple_info,search_history);
            }
        });
    }else{
        let starter = "["+JSON.stringify(simple_info)+"]"; 
        fs.writeFile('./cache/past_searches.json', starter, () => console.log("saved search"));
    }
}

function append_to_file(data,simple_info,search_history){
    let data_obj = JSON.parse(data);
    data_obj.push(simple_info);
    fs.writeFile(search_history,JSON.stringify(data_obj), (err)=>{
        if (err){
            console.log("error");
        }
    }); 
}



function generate_homepage(...arg){
	const hmtl = arg[0];
	const gif_url = arg[1];
	const res = arg[2];
    let gif_display =`<center> <img src="${gif_url} href=" /> </center>`
    let search_history = './cache/past_searches.json';
    if(fs.existsSync(search_history)){
        fs.readFile(search_history,{encoding:"utf-8"},(err,data)=>{
            if(err){ 
                console.log("err");
            }else{
                let all_past = JSON.parse(data).map(entry => entry.name + entry.image).join("");
                res.writeHead(200);
                res.end(`<html> ${hmtl} ${gif_display} <br> 
                    <div class="center"> <h4> Past Searches </h4>${all_past}</div>  </hmtl`);
            }
        });
    }else{
        res.writeHead(200);  
	    res.end(`<html> ${hmtl} ${gif_display} </hmtl`);
    }
}

server.on("listening", listening_handler);
function listening_handler(){
	console.log(`Now Listening on Port ${port}`);
}

server.listen(port);
