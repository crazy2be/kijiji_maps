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

var test_next = function(req, res, next) {
	index_site = index_site + 1;
	if (sites[index_site] === undefined) {
		var info = '{"info":['+address+']}';
		req.body.url = url;
		first_page(req, res, next);
		next();
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
		var title_ad  = clean($('h1').text());
		var latitude  = $('meta[property="og:latitude"]').attr('content')*1;
		var longitude = $('meta[property="og:longitude"]').attr('content')*1;
		var description = $('#ViewItemPage').text();
		// console.log('AD =>', ad);
		if (description.length < 5) {
			console.log("[Empty ad]");
			console.log("[This is probably a parse error]");
			return test_next(req, res, next);
		}

		ad = {address: address, price: price, url: url, title_ad: title_ad,
			latitude: latitude, longitude: longitude, description: description};
		console.log('json ===>',ad);
		beaches.push(ad);

		test_next(req, res, next);
	});
};


app.get('/maps', function(req, res, next){
	res.render("index.ejs", {layout: false, lat:46.8357689, lon:-71.220735, zoom:12, beaches:JSON.stringify(beaches)});
	next();
});

// app.use(test_next);

app.post('/add', urlencodedParser, function(req, res, next) {
	counter = 0;
	first_page(req, res, next);
	console.log('beaches =>', beaches);
	res.render("index.ejs", { layout: false, lat:46.8357689, lon:-71.220735, zoom:12, beaches:JSON.stringify(beaches)});

});

app.post('/refresh', function(req, res, next) {
	// first_page(req, res, next);
		res.render("index.ejs", { layout: false, lat:46.8357689, lon:-71.220735, zoom:12, beaches:JSON.stringify(beaches)});
});

var first_page = function(req, res, next) {
	console.log('req.body.url ======>', req.body.url);
	if (req.body.url == '') return;
	url = req.body.url;
	index_site = -1;
	sites = [];
	urls = [];
	++counter;
	console.log('counter =>', counter);
	if (10 <= counter) return;
	// url = 'http://www.kijiji.ca/b-appartement-condo/ville-de-quebec/c37l1700124r2.0?ad=offering';
	if (url === "") return;
	cached_requester(url, function(error, response, html){
		if (error) {
			console.log("ERROR FIRST PAGE:", error);
			return;
		}
		console.log('URL ===>', url);
		var $ = cheerio.load(html);
		// $('.container-results').filter(function(){
		urls = [].map.call($('a.title'), function(link) {
			return link;
		});
		url_next = $(".pagination > a[title='Suivante']").attr('href');
		url = " http://www.kijiji.ca"+url_next;
		console.log('url_next ===>', url);
		Object.keys(urls).forEach(function(trait) {
			sites.push(urls[trait].attribs.href);
		});
		req.sites = sites;
		test_next(req, res, next);
	});
};

app.listen('8081');
console.log('Magic happens on port 8081');
exports = module.exports = app;
