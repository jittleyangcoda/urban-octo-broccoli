const mangayomiSources = [
  {
    "name": "AllManga",
    "lang": "en",
    "id": 846372901,
    "baseUrl": "https://allmanga.to",
    "apiUrl": "",
    "iconUrl":
      "https://www.google.com/s2/favicons?sz=256&domain=https://allmanga.to/",
    "typeSource": "multi",
    "itemType": 1,
    "version": "1.0.0",
    "pkgPath": "anime/src/en/allmanga.js",
  },
];

// Authors: - Your Name

class DefaultExtension extends MProvider {
  constructor() {
    super();
    this.client = new Client();
  }

  getPreference(key) {
    return new SharedPreferences().get(key);
  }

  getHeaders() {
    return {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "referer": this.source.baseUrl,
    };
  }

  getBaseUrl() {
    return this.getPreference("allmanga_base_url");
  }

  async request(slug) {
    var url = slug;
    var baseUrl = this.getBaseUrl();
    if (!slug.includes(baseUrl)) url = baseUrl + slug;
    var res = await this.client.get(url, this.getHeaders());
    return res.body;
  }

  async getPage(slug) {
    var res = await this.request(slug);
    return new Document(res);
  }

  async searchPage({
    query = "",
    type = "",
    country = "",
    page = 1,
  } = {}) {
    var slug = "";
    
    if (query.length > 0) {
      slug = `/search?keyword=${encodeURIComponent(query)}`;
    } else {
      slug = `/anime`;
    }
    
    // Add filters
    if (type) slug += `&tr=${type}`;
    if (country) slug += `&cty=${country}`;
    if (page > 1) slug += `&page=${page}`;
    
    var list = [];
    var body = await this.getPage(slug);

    var titlePref = this.getPreference("allmanga_title_lang");
    
    // Find all anime cards - allmanga uses links with /bangumi/
    var animeCards = body.select('a[href*="/bangumi/"]');
    
    var seen = new Set();
    animeCards.forEach((anime) => {
      var link = anime.getHref;
      
      // Avoid duplicates
      if (seen.has(link)) return;
      seen.add(link);
      
      // Get title from img alt or title attribute
      var imgEl = anime.selectFirst("img");
      var name = "";
      
      if (imgEl) {
        name = imgEl.attr(titlePref == "title" ? "alt" : "title");
        if (!name || name.trim() == "") {
          name = imgEl.attr("alt") || imgEl.attr("title") || "";
        }
      }
      
      // Fallback to link text
      if (!name || name.trim() == "") {
        name = anime.text.trim();
      }
      
      // Skip if no name
      if (!name || name.trim() == "") return;
      
      var imageUrl = "";
      if (imgEl) {
        imageUrl = imgEl.attr("src") || imgEl.attr("data-src") || "";
        if (imageUrl && !imageUrl.startsWith("http")) {
          imageUrl = imageUrl.startsWith("//") ? "https:" + imageUrl : this.source.baseUrl + imageUrl;
        }
      }
      
      list.push({ 
        name: name.trim(), 
        link: link, 
        imageUrl: imageUrl 
      });
    });

    // Check for next page - allmanga typically shows 20-30 items per page
    var hasNextPage = list.length >= 20;

    return { list, hasNextPage };
  }

  async getPopular(page) {
    var types = this.getPreference("allmanga_popular_latest_type");
    return await this.searchPage({ 
      type: types.length > 0 ? types[0] : "sub",
      page: page 
    });
  }

  async getLatestUpdates(page) {
    var types = this.getPreference("allmanga_popular_latest_type");
    var slug = `/search-anime?page=${page}`;
    if (types.length > 0 && types[0]) {
      slug += `&tr=${types[0]}`;
    }
    
    var list = [];
    var body = await this.getPage(slug);
    
    var titlePref = this.getPreference("allmanga_title_lang");
    var animeCards = body.select('a[href*="/bangumi/"]');
    
    var seen = new Set();
    animeCards.forEach((anime) => {
      var link = anime.getHref;
      if (seen.has(link)) return;
      seen.add(link);
      
      var imgEl = anime.selectFirst("img");
      var name = "";
      
      if (imgEl) {
        name = imgEl.attr(titlePref == "title" ? "alt" : "title");
        if (!name || name.trim() == "") {
          name = imgEl.attr("alt") || imgEl.attr("title") || "";
        }
      }
      
      if (!name || name.trim() == "") {
        name = anime.text.trim();
      }
      
      if (!name || name.trim() == "") return;
      
      var imageUrl = "";
      if (imgEl) {
        imageUrl = imgEl.attr("src") || imgEl.attr("data-src") || "";
        if (imageUrl && !imageUrl.startsWith("http")) {
          imageUrl = imageUrl.startsWith("//") ? "https:" + imageUrl : this.source.baseUrl + imageUrl;
        }
      }
      
      list.push({ name: name.trim(), link: link, imageUrl: imageUrl });
    });

    var hasNextPage = list.length >= 20;
    return { list, hasNextPage };
  }

  async search(query, page, filters) {
    var isFiltersAvailable = !filters || filters.length != 0;
    var type = isFiltersAvailable && filters[0]
      ? filters[0].values[filters[0].state].value
      : "";
    var country = isFiltersAvailable && filters[1]
      ? filters[1].values[filters[1].state].value
      : "";
    
    return await this.searchPage({
      query,
      type,
      country,
      page,
    });
  }

  async getDetail(url) {
    function statusCode(status) {
      status = status.toLowerCase();
      return (
        {
          "ongoing": 0,
          "airing": 0,
          "releasing": 0,
          "completed": 1,
          "finished": 1,
          "not yet aired": 4,
        }[status] ?? 5
      );
    }
    
    var baseUrl = this.getBaseUrl();
    var slug = url;
    if (url.includes(baseUrl)) {
      slug = url.replace(baseUrl, "");
    }
    var link = `${baseUrl}${slug}`;
    var body = await this.getPage(slug);

    var namePref = this.getPreference("allmanga_title_lang");
    
    // Get title
    var name = "";
    var titleEl = body.selectFirst("h1");
    if (titleEl) {
      name = namePref == "title" 
        ? titleEl.text.trim() 
        : (titleEl.attr("data-jp") || titleEl.text.trim());
    }

    // Get image
    var imageUrl = "";
    var imgEl = body.selectFirst("img.cover, .anime-cover img, .poster img, img[class*='cover']");
    if (imgEl) {
      imageUrl = imgEl.getSrc;
      if (imageUrl && !imageUrl.startsWith("http")) {
        imageUrl = imageUrl.startsWith("//") ? "https:" + imageUrl : this.source.baseUrl + imageUrl;
      }
    }

    // Get description
    var description = "";
    var descEl = body.selectFirst(".description, .synopsis, .summary, [class*='desc'], [class*='synopsis']");
    if (descEl) {
      description = descEl.text.trim();
    }

    // Get status
    var status = 5;
    var statusEl = body.selectFirst(".status, [class*='status']");
    if (statusEl) {
      var statusText = statusEl.text.trim();
      status = statusCode(statusText);
    }

    // Get genres
    var genre = [];
    body.select(".genre a, .genres a, [class*='genre'] a").forEach((g) => {
      var genreText = g.text.trim();
      if (genreText) genre.push(genreText);
    });

    // Get episodes
    var chapters = [];
    var showEpThumbnail = this.getPreference("allmanga_pref_ep_thumbnail");
    var showEpDescription = this.getPreference("allmanga_pref_ep_description");
    
    // Find episode links - allmanga might use different selectors
    var episodeLinks = body.select(
      'a[href*="/episode/"], ' +
      'a.episode-link, ' + 
      '.episode-list a, ' +
      '[class*="episode"] a[href*="/watch/"], ' +
      '[class*="ep-"] a'
    );
    
    episodeLinks.forEach((ep, index) => {
      var epUrl = ep.getHref;
      if (!epUrl || epUrl == "#") return;
      
      var epName = ep.text.trim();
      var epNum = index + 1;
      
      // Try to extract episode number from URL or text
      var epNumMatch = epUrl.match(/episode[-_]?(\d+)/i) || 
                       epName.match(/episode\s*(\d+)/i) ||
                       epName.match(/ep\s*(\d+)/i);
      
      if (epNumMatch) {
        epNum = parseInt(epNumMatch[1]);
      }
      
      // Format episode name
      if (!epName || epName == "" || epName == "Watch") {
        epName = `Episode ${epNum}`;
      } else if (!epName.toLowerCase().includes("episode")) {
        epName = `Episode ${epNum}: ${epName}`;
      }
      
      // Get episode thumbnail if preference is enabled
      var thumbnailUrl = null;
      if (showEpThumbnail) {
        var epImg = ep.selectFirst("img");
        if (epImg) {
          thumbnailUrl = epImg.attr("src") || epImg.attr("data-src");
          if (thumbnailUrl && !thumbnailUrl.startsWith("http")) {
            thumbnailUrl = thumbnailUrl.startsWith("//") ? "https:" + thumbnailUrl : null;
          }
        }
      }
      
      chapters.push({
        name: epName,
        url: epUrl,
        thumbnailUrl: thumbnailUrl,
      });
    });

    // Reverse to show latest first
    chapters.reverse();

    return { 
      name, 
      imageUrl, 
      link, 
      description, 
      genre, 
      status, 
      chapters 
    };
  }

  async getVideoList(url) {
    var streams = [];
    
    try {
      var body = await this.getPage(url);
      
      // Look for iframes (most common on allmanga.to)
      var iframes = body.select("iframe[src]");
      
      iframes.forEach((iframe) => {
        var src = iframe.attr("src");
        if (!src || src == "") return;
        
        // Make URL absolute
        if (!src.startsWith("http")) {
          src = src.startsWith("//") ? "https:" + src : this.source.baseUrl + src;
        }
        
        // Determine server name from iframe class or src
        var serverName = "Default";
        if (src.includes("gogoanime")) serverName = "GoGoAnime";
        else if (src.includes("vidstreaming")) serverName = "VidStreaming";
        else if (src.includes("streamwish")) serverName = "StreamWish";
        else if (src.includes("filemoon")) serverName = "FileMoon";
        else if (src.includes("doodstream")) serverName = "DoodStream";
        
        streams.push({
          url: src,
          originalUrl: src,
          quality: serverName,
          headers: this.getHeaders(),
        });
      });
      
      // Look for direct video sources
      var videoSources = body.select("video source[src]");
      videoSources.forEach((source) => {
        var src = source.attr("src");
        if (!src || src == "") return;
        
        if (!src.startsWith("http")) {
          src = src.startsWith("//") ? "https:" + src : this.source.baseUrl + src;
        }
        
        var quality = source.attr("label") || source.attr("data-quality") || "Direct";
        
        streams.push({
          url: src,
          originalUrl: src,
          quality: quality,
          headers: this.getHeaders(),
        });
      });
      
      // Look for video URLs in script tags
      var scripts = body.select("script");
      scripts.forEach((script) => {
        var content = script.html();
        
        // Look for m3u8 URLs
        var m3u8Regex = /https?:\/\/[^\s"']+\.m3u8[^\s"']*/g;
        var m3u8Matches = content.match(m3u8Regex);
        if (m3u8Matches) {
          m3u8Matches.forEach((m3u8Url) => {
            m3u8Url = m3u8Url.replace(/['"\\]/g, '');
            streams.push({
              url: m3u8Url,
              originalUrl: m3u8Url,
              quality: "HLS",
              headers: this.getHeaders(),
            });
          });
        }
        
        // Look for mp4 URLs
        var mp4Regex = /https?:\/\/[^\s"']+\.mp4[^\s"']*/g;
        var mp4Matches = content.match(mp4Regex);
        if (mp4Matches) {
          mp4Matches.forEach((mp4Url) => {
            mp4Url = mp4Url.replace(/['"\\]/g, '');
            streams.push({
              url: mp4Url,
              originalUrl: mp4Url,
              quality: "MP4",
              headers: this.getHeaders(),
            });
          });
        }
      });
      
    } catch (e) {
      throw new Error("Failed to extract video sources: " + e.message);
    }
    
    // Remove duplicates
    var uniqueStreams = [];
    var urlSet = new Set();
    streams.forEach((stream) => {
      if (!urlSet.has(stream.url)) {
        urlSet.add(stream.url);
        uniqueStreams.push(stream);
      }
    });
    
    return uniqueStreams;
  }

  getFilterList() {
    function formateState(type_name, items, values) {
      var state = [];
      for (var i = 0; i < items.length; i++) {
        state.push({ type_name: type_name, name: items[i], value: values[i] });
      }
      return state;
    }

    var filters = [];

    // Type (Sub/Dub)
    var items = ["All", "Sub", "Dub"];
    var values = ["", "sub", "dub"];
    filters.push({
      type_name: "SelectFilter",
      name: "Type",
      state: 0,
      values: formateState("SelectOption", items, values),
    });

    // Country
    items = ["All", "Japan", "China", "Korea"];
    values = ["ALL", "Japan", "China", "Korea"];
    filters.push({
      type_name: "SelectFilter",
      name: "Country",
      state: 0,
      values: formateState("SelectOption", items, values),
    });

    return filters;
  }

  getSourcePreferences() {
    return [
      {
        key: "allmanga_base_url",
        editTextPreference: {
          title: "Override base url",
          summary: "",
          value: "https://allmanga.to",
          dialogTitle: "Override base url",
          dialogMessage: "",
        },
      },
      {
        key: "allmanga_popular_latest_type",
        multiSelectListPreference: {
          title: "Preferred type for popular & latest",
          summary: "Choose which type of anime to show in popular & latest",
          values: ["sub"],
          entries: ["Sub", "Dub"],
          entryValues: ["sub", "dub"],
        },
      },
      {
        key: "allmanga_title_lang",
        listPreference: {
          title: "Preferred title language",
          summary: "Choose which title to display",
          valueIndex: 0,
          entries: ["Default", "Japanese"],
          entryValues: ["title", "data-jp"],
        },
      },
      {
        key: "allmanga_pref_ep_thumbnail",
        switchPreferenceCompat: {
          title: "Episode thumbnail",
          summary: "Show episode thumbnails if available",
          value: true,
        },
      },
      {
        key: "allmanga_pref_ep_description",
        switchPreferenceCompat: {
          title: "Episode description",
          summary: "Show episode descriptions if available",
          value: false,
        },
      },
    ];
  }
}
