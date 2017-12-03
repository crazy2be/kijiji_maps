var express = require('express');
var fs = require('fs');
var request = require('request');
var cheerio = require('cheerio');
var DEFAULT_LAT = 43.461277;
var DEFAULT_LON = -80.521149;
let requestingUrls = {};
function cached_requester(url) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync("html")) {
            fs.mkdirSync("html");
        }
        var fname = 'html/' + encodeURIComponent(url);
        const exists = fs.existsSync(fname);
        const stats = exists && fs.statSync(fname);
        let isStale = stats && ((+stats.mtime + 1000 * 60 * 60 * 24) < +new Date());
        if (isStale) {
            console.log("stale", stats.mtime);
        }
        if ((!exists || isStale) && !(url in requestingUrls)) {
            requestingUrls[url] = true;
            console.log("Downloading", url);
            request(url, (err, response, html) => {
                delete requestingUrls[url];
                if (!err)
                    fs.writeFileSync(fname, html);
                if (!exists) {
                    resolve({ err, url, html });
                }
            });
        }
        if (exists) {
            resolve({ err: null, url, html: fs.readFileSync(fname) });
        }
    });
}
async function search_page(url, global_beaches) {
    if (!url) {
        return;
    }
    var { err, url, html } = await cached_requester(url);
    if (err) {
        console.log("ERROR FIRST PAGE:", err);
        return;
    }
    //console.log('URL ===>', url);
    var $ = cheerio.load(html);
    var href2url = href => href && ("http://www.kijiji.ca" + href) || href;
    var urls = [].map.call($('a.title'), url => href2url(url.attribs.href));
    var url_next = href2url($(".pagination > a[title='Next']").attr('href'));
    //console.log('url_next ===>', url_next);
	//console.log('urls =>', urls);
	console.log("Urls: " + urls.length);
    await add_page(urls, global_beaches);
    await search_page(url_next, global_beaches);
}
async function add_page(urls, global_beaches) {
    if (urls[0] === undefined) {
        //console.log("Onto the next page...")
        return;
    }
    let { err, url, html } = await cached_requester(urls[0]);
    //console.log('url_page =>', url);
    if (err) {
        console.log("ERROR:", err);
        return;
    }
    var $ = cheerio.load(html, { normalizeWhitespace: true });
    var clean = s => (s || '').replace(/\"/g, '').replace("/\\/g", '').replace(/(\n|\r)/gm, '').replace(/    /g, '');
    var address = clean($('span[class^="address-"]').text());
    var price = clean($('span[class^="currentPrice-"]').text());
    var title = clean($('h1').text());
    var lat = $('meta[property="og:latitude"]').attr('content') * 1;
    var lon = $('meta[property="og:longitude"]').attr('content') * 1;
    var description = $('#ViewItemPage').html();
    if (!description || description.length < 5) {
        console.log("[This is probably a parse error]");
        await add_page(urls.slice(1), global_beaches);
        return;
    }
    var ad = { address: address, price: price, url: url, title: title,
        lat: lat, lon: lon, description: description };
	//console.log('json ===>',ad);
    global_beaches.push(ad);
    await add_page(urls.slice(1), global_beaches);
}
var app = express();
app.get('/', async (req, res, next) => {
	var debug = req.url.includes("debug=1");
    let global_beaches = await doSearch();
    res.render("index.ejs", {
        layout: false, lat: DEFAULT_LAT, lon: DEFAULT_LON,
        zoom: 12, beaches: Buffer.from(JSON.stringify(debug ? global_beaches.slice(0, 20) : global_beaches)).toString("base64")
    });
    next();
});
app.use("/", express.static("./"));
app.listen('8081');
console.log('Magic happens on port 8081');
exports = module.exports = app;
doSearch();
async function doSearch() {
    var global_beaches = [];
    await search_page("https://www.kijiji.ca/b-house-rental/kitchener-waterloo/c43l1700212r5.0?address=155+King+St+S%2C+Waterloo%2C+ON&ll=43.461277,-80.521149", global_beaches);
    return global_beaches;
}
//# sourceMappingURL=server.js.map