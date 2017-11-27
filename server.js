var express = require('express');
var fs = require('fs');
var request = require('request');
var cheerio = require('cheerio');

var DEFAULT_LAT = 43.461277;
var DEFAULT_LON = -80.521149;

function cached_requester(url, cb) {
	var fname = 'html/' + encodeURIComponent(url);
	if (fs.existsSync(fname)) {
		cb(null, url, fs.readFileSync(fname));
	} else {
		console.log("Downlaoding", url);
		request(url, (err, response, html1) => {
			if (!err) fs.writeFileSync(fname, html1);
			cb(err, url, html1);
		});
	}
}

var global_beaches = [];

var search_page = function(url) {
	console.log('url ======>', url);
	if (url == '') return;
	cached_requester(url, function(error, url, html) {
		if (error) {
			console.log("ERROR FIRST PAGE:", error);
			return;
		}
		console.log('URL ===>', url);
		var $ = cheerio.load(html);
		var href2url = href => "http://www.kijiji.ca" + href;
		var urls = [].map.call($('a.title'), url => href2url(url.attribs.href));
		var url_next = href2url($(".pagination > a[title='Next']").attr('href'));
		console.log('url_next ===>', url_next);
		console.log('urls =>', urls);
		ad_page(urls, () => {
			search_page(url_next);
		});
	});
};

var ad_page = function(urls, cb) {
	if (urls[0] === undefined) {
		console.log("Onto the next page...")
		cb();
		return;
    }
	cached_requester(urls[0], (error, url, html) => {
		console.log('url_page =>', url);
		if (error) {
			console.log("ERROR:", error);
			return;
		}
		var $ = cheerio.load(html, {normalizeWhitespace: true});
		var clean = s => (s||'').replace(/\"/g,'').replace("/\\/g",'').replace(/(\n|\r)/gm,'').replace(/    /g, '');

		var address   = clean($('span[class^="address-"]').text());
		var price     = clean($('span[class^="currentPrice-"]').text());
		var title  = clean($('h1').text());
		var lat  = $('meta[property="og:latitude"]').attr('content')*1;
		var lon = $('meta[property="og:longitude"]').attr('content')*1;
		var description = $('#ViewItemPage').text();

		if (description.length < 5) {
			console.log("[Empty ad]");
			console.log("[This is probably a parse error]");
			return ad_page(urls.slice(1), cb);
		}

		ad = {address: address, price: price, url: url, title: title,
			lat: lat, lon: lon, description: description};
		//console.log('json ===>',ad);
		global_beaches.push(ad);

		ad_page(urls.slice(1), cb);
	});
};

var app = express();
app.get('/', (req, res, next) => {
	res.render("index.ejs", {
		layout: false, lat: DEFAULT_LAT, lon: DEFAULT_LON,
		zoom: 12, beaches: JSON.stringify(global_beaches)});
	next();
});

app.listen('8081');
console.log('Magic happens on port 8081');
exports = module.exports = app;

search_page("https://www.kijiji.ca/b-house-rental/kitchener-waterloo/c43l1700212r5.0?address=155+King+St+S%2C+Waterloo%2C+ON&ll=43.461277,-80.521149");