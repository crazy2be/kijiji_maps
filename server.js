var express = require('express');
var fs = require('fs');
var request = require('request');
var cheerio = require('cheerio');
var app     = express();

var bodyParser = require('body-parser');
var urlencodedParser = bodyParser.urlencoded({ extended: false });


var url        = "";
var url_next   = "";
var urls       = [];
var sites      = [];
var address    = [];
var index_site = -1;
var counter = 0;
var DEFAULT_LAT = 43.461277;
var DEFAULT_LON = -80.521149;

function cached_requester(url, cb) {
	var fname = 'html/' + encodeURIComponent(url);
	console.log("Caching to ", fname);
	if (fs.existsSync(fname)) {
		cb(null, url, fs.readFileSync(fname));
	} else {
		request(url, (err, response, html1) => {
			if (!err) fs.writeFileSync(fname, html1);
			cb(err, url, html1);
		});
	}
}

var beaches = [];

var first_page = function(url) {
	console.log('url ======>', url);
	if (url == '') return;
	index_site = -1;
	sites = [];
	urls = [];
	++counter;
	console.log('counter =>', counter);
	if (10 <= counter) return;
	if (url === "") return;
	cached_requester(url, function(error, response, html){
		if (error) {
			console.log("ERROR FIRST PAGE:", error);
			return;
		}
		console.log('URL ===>', url);
		var $ = cheerio.load(html);
		urls = [].map.call($('a.title'), url => url.attribs.href);
// 		console.log(Object.keys(urls).length, urls.length);
// 		urls = $('a.title').slice();
// 		console.log(Object.keys(urls).length, urls.length);
// 		return
		url_next = $(".pagination > a[title='Next']").attr('href');
		url = " http://www.kijiji.ca"+url_next;
		console.log('url_next ===>', url);
		console.log('urls =>', urls);
		sites = sites.concat(urls);
		test_next();
	});
};

var test_next = function() {
	index_site = index_site + 1;
	if (sites[index_site] === undefined) {
		console.log("No site for index", index_site, sites);
		return;
    }
	var url_page = 'http://www.kijiji.ca'+sites[index_site];
	cached_requester(url_page, function(error, url, html1){
		console.log('search page');
		console.log('url_page =>', url);
		if (error) {
			console.log("ERROR:", error);
			return;
		}
		var $ = cheerio.load(html1, {normalizeWhitespace: true});
		var clean = s => (console.log("s:", s), (s||'').replace(/\"/g,'').replace("/\\/g",'').replace(/(\n|\r)/gm,'').replace(/    /g, ''));

		var address   = clean($('span[class^="address-"]').text());
		var price     = clean($('span[class^="currentPrice-"]').text());
		var title  = clean($('h1').text());
		var lat  = $('meta[property="og:latitude"]').attr('content')*1;
		var lon = $('meta[property="og:longitude"]').attr('content')*1;
		var description = $('#ViewItemPage').text();

		if (description.length < 5) {
			console.log("[Empty ad]");
			console.log("[This is probably a parse error]");
			return test_next();
		}

		ad = {address: address, price: price, url: url, title: title,
			lat: lat, lon: lon, description: description};
		console.log('json ===>',ad);
		beaches.push(ad);

		test_next();
	});
};


app.get('/maps', function(req, res, next){
	res.render("index.ejs", {layout: false, lat: DEFAULT_LAT, lon: DEFAULT_LON, zoom:12, beaches:JSON.stringify(beaches)});
	next();
});

app.post('/add', urlencodedParser, function(req, res, next) {
	counter = 0;
	first_page(req, res, next);
	console.log('beaches =>', beaches);
	res.render("index.ejs", { layout: false, lat: DEFAULT_LAT, lon: DEFAULT_LON, zoom:12, beaches:JSON.stringify(beaches)});
	next();
});

app.post('/refresh', function(req, res, next) {
	res.render("index.ejs", { layout: false, lat: DEFAULT_LAT, lon: DEFAULT_LON, zoom:12, beaches:JSON.stringify(beaches)});
});

app.listen('8081');
console.log('Magic happens on port 8081');
exports = module.exports = app;

first_page("https://www.kijiji.ca/b-real-estate/kitchener-waterloo/c34l1700212?ll=43.461277,-80.521149");