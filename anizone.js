/**
 * AnymeX Extension - AniZone Provider
 * 
 * This is an example provider that combines:
 * 1. Jikan API for anime metadata
 * 2. AniZone for video streams
 * 
 * Integration approach:
 * - Use the userscript OR Node.js extractor to get stream URLs
 * - This provider formats the data for AnymeX
 */

// ============================================
// Provider Configuration
// ============================================

const PROVIDER_CONFIG = {
    name: 'AniZone',
    id: 'anizone',
    version: '1.0.0',
    baseUrl: 'https://anizone.to',
    metadataSource: 'Jikan (MyAnimeList)',
    supportedQualities: ['auto', '1080p', '720p', '480p', '360p'],
    features: {
        search: true,
        episodes: true,
        streaming: true,
        download: false // We don't support downloads, only streaming
    }
};

// ============================================
// Jikan API Integration (Metadata)
// ============================================

/**
 * Search for anime using Jikan API
 * @param {string} query - Search query
 * @returns {Promise<Array>} Array of anime results
 */
async function searchAnime(query) {
    try {
        const response = await fetch(
            `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=20`
        );
        
        if (!response.ok) {
            throw new Error(`Jikan API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        return data.data.map(anime => ({
            id: anime.mal_id,
            title: anime.title,
            titleEnglish: anime.title_english,
            titleJapanese: anime.title_japanese,
            synopsis: anime.synopsis,
            episodes: anime.episodes,
            status: anime.status,
            score: anime.score,
            year: anime.year,
            imageUrl: anime.images.jpg.large_image_url,
            type: anime.type,
            source: PROVIDER_CONFIG.metadataSource
        }));
        
    } catch (error) {
        console.error('Error searching anime:', error);
        return [];
    }
}

/**
 * Get detailed anime information
 * @param {number} malId - MyAnimeList ID
 * @returns {Promise<Object>} Detailed anime info
 */
async function getAnimeDetails(malId) {
    try {
        const response = await fetch(`https://api.jikan.moe/v4/anime/${malId}/full`);
        
        if (!response.ok) {
            throw new Error(`Jikan API error: ${response.status}`);
        }
        
        const data = await response.json();
        const anime = data.data;
        
        return {
            id: anime.mal_id,
            title: anime.title,
            titleEnglish: anime.title_english,
            titleJapanese: anime.title_japanese,
            synopsis: anime.synopsis,
            episodes: anime.episodes,
            status: anime.status,
            score: anime.score,
            year: anime.year,
            season: anime.season,
            imageUrl: anime.images.jpg.large_image_url,
            trailerUrl: anime.trailer?.url,
            genres: anime.genres.map(g => g.name),
            studios: anime.studios.map(s => s.name),
            type: anime.type,
            rating: anime.rating,
            duration: anime.duration,
            source: PROVIDER_CONFIG.metadataSource
        };
        
    } catch (error) {
        console.error('Error getting anime details:', error);
        return null;
    }
}

/**
 * Get episode list for an anime
 * @param {number} malId - MyAnimeList ID
 * @returns {Promise<Array>} Array of episodes
 */
async function getEpisodeList(malId) {
    try {
        const response = await fetch(`https://api.jikan.moe/v4/anime/${malId}/episodes`);
        
        if (!response.ok) {
            throw new Error(`Jikan API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        return data.data.map(episode => ({
            number: episode.mal_id,
            title: episode.title,
            titleJapanese: episode.title_japanese,
            titleRomanji: episode.title_romanji,
            aired: episode.aired,
            score: episode.score,
            filler: episode.filler,
            recap: episode.recap
        }));
        
    } catch (error) {
        console.error('Error getting episodes:', error);
        return [];
    }
}

// ============================================
// AniZone Integration (Video Streams)
// ============================================

/**
 * Convert anime title to AniZone slug
 * @param {string} title - Anime title
 * @returns {string} URL-friendly slug
 */
function titleToAniZoneSlug(title) {
    return title
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
}

/**
 * Get stream URL for a specific episode
 * 
 * NOTE: In production, you would either:
 * 1. Use the userscript to extract URLs and store them
 * 2. Use the Node.js extractor server-side
 * 3. Integrate with a backend that does the extraction
 * 
 * This is a PLACEHOLDER that shows the expected format
 * 
 * @param {string} animeTitle - Anime title
 * @param {number} episodeNumber - Episode number
 * @returns {Promise<Object>} Stream information
 */
async function getStreamUrl(animeTitle, episodeNumber) {
    // In a real implementation, you would:
    // 1. Call your backend API that uses the Node.js extractor
    // 2. Or use stored URLs from the userscript
    // 3. Or embed the userscript logic directly
    
    // Example of what your backend would return:
    const slug = titleToAniZoneSlug(animeTitle);
    
    // PLACEHOLDER - Replace with actual extraction
    const exampleStream = {
        source: PROVIDER_CONFIG.name,
        slug: slug,
        episodeNumber: episodeNumber,
        episodeUrl: `${PROVIDER_CONFIG.baseUrl}/anime/${slug}/episode-${episodeNumber}`,
        
        // These would be extracted by your userscript/backend
        streams: {
            auto: null, // Will be set after extraction
            '1080p': null,
            '720p': null,
            '480p': null,
            '360p': null
        },
        
        // Required headers for playback
        headers: {
            'Referer': PROVIDER_CONFIG.baseUrl + '/',
            'Origin': PROVIDER_CONFIG.baseUrl,
            'User-Agent': navigator.userAgent
        },
        
        // Metadata
        extracted: false,
        extractedAt: null,
        expiresAt: null // Streams typically expire after 6-24 hours
    };
    
    return exampleStream;
}

/**
 * Parse M3U8 playlist to get quality variants
 * @param {string} m3u8Url - Master playlist URL
 * @returns {Promise<Object>} Quality variants
 */
async function parseM3U8Playlist(m3u8Url) {
    try {
        const response = await fetch(m3u8Url);
        const playlist = await response.text();
        
        const variants = {};
        const lines = playlist.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            if (line.startsWith('#EXT-X-STREAM-INF')) {
                // Extract resolution
                const resolutionMatch = line.match(/RESOLUTION=(\d+)x(\d+)/);
                const bandwidthMatch = line.match(/BANDWIDTH=(\d+)/);
                
                if (resolutionMatch && lines[i + 1]) {
                    const height = resolutionMatch[2];
                    const quality = `${height}p`;
                    const url = lines[i + 1].trim();
                    
                    // Resolve relative URLs
                    const fullUrl = url.startsWith('http') 
                        ? url 
                        : new URL(url, m3u8Url).href;
                    
                    variants[quality] = {
                        url: fullUrl,
                        resolution: `${resolutionMatch[1]}x${resolutionMatch[2]}`,
                        bandwidth: bandwidthMatch ? parseInt(bandwidthMatch[1]) : null
                    };
                }
            }
        }
        
        // Add auto as the highest quality
        const qualities = Object.keys(variants).sort((a, b) => {
            return parseInt(b) - parseInt(a);
        });
        
        if (qualities.length > 0) {
            variants.auto = variants[qualities[0]];
        }
        
        return variants;
        
    } catch (error) {
        console.error('Error parsing M3U8 playlist:', error);
        return { auto: { url: m3u8Url, resolution: 'unknown', bandwidth: null } };
    }
}

// ============================================
// AnymeX Provider Interface
// ============================================

/**
 * Main provider class for AnymeX
 */
class AniZoneProvider {
    constructor() {
        this.config = PROVIDER_CONFIG;
    }
    
    /**
     * Search for anime
     */
    async search(query) {
        return await searchAnime(query);
    }
    
    /**
     * Get anime details
     */
    async getDetails(malId) {
        return await getAnimeDetails(malId);
    }
    
    /**
     * Get episode list
     */
    async getEpisodes(malId) {
        return await getEpisodeList(malId);
    }
    
    /**
     * Get video source for an episode
     * 
     * IMPORTANT: This requires integration with your extraction method
     */
    async getVideoSource(animeTitle, episodeNumber) {
        // Step 1: Get the stream URL structure
        const streamInfo = await getStreamUrl(animeTitle, episodeNumber);
        
        // Step 2: In production, you would call your extraction backend here
        // For example:
        // const extractedUrl = await fetch('/api/extract', {
        //     method: 'POST',
        //     body: JSON.stringify({ url: streamInfo.episodeUrl })
        // });
        
        // Step 3: If it's an M3U8, parse quality variants
        // if (extractedUrl.includes('.m3u8')) {
        //     streamInfo.streams = await parseM3U8Playlist(extractedUrl);
        // }
        
        return streamInfo;
    }
    
    /**
     * Complete workflow: Search → Select → Get Episode → Stream
     */
    async getEpisodeData(query, episodeNumber) {
        // 1. Search for the anime
        const searchResults = await this.search(query);
        
        if (searchResults.length === 0) {
            throw new Error('No anime found for query: ' + query);
        }
        
        // 2. Get the first result (most relevant)
        const anime = searchResults[0];
        
        // 3. Get detailed info
        const details = await this.getDetails(anime.id);
        
        // 4. Get video source
        const videoSource = await this.getVideoSource(anime.title, episodeNumber);
        
        // 5. Return combined data
        return {
            anime: details,
            episode: episodeNumber,
            videoSource: videoSource,
            provider: this.config.name
        };
    }
}

// ============================================
// Example Usage
// ============================================

// Example 1: Search
async function exampleSearch() {
    const provider = new AniZoneProvider();
    const results = await provider.search('Attack on Titan');
    
    console.log('Search Results:');
    results.forEach(anime => {
        console.log(`- ${anime.title} (${anime.year}) - ${anime.episodes} episodes`);
    });
}

// Example 2: Get Episode
async function exampleGetEpisode() {
    const provider = new AniZoneProvider();
    const data = await provider.getEpisodeData('Attack on Titan', 1);
    
    console.log('Episode Data:');
    console.log(`Title: ${data.anime.title}`);
    console.log(`Episode: ${data.episode}`);
    console.log(`Stream URL: ${data.videoSource.episodeUrl}`);
}

// Example 3: Full Integration with Video Player
async function examplePlayVideo(query, episodeNumber) {
    const provider = new AniZoneProvider();
    
    try {
        // Get episode data
        const episodeData = await provider.getEpisodeData(query, episodeNumber);
        
        // IMPORTANT: In production, you need to extract the actual stream URL
        // This would be done by your backend or userscript
        
        // For now, this is a placeholder showing the structure
        console.log('Ready to play:');
        console.log(`Anime: ${episodeData.anime.title}`);
        console.log(`Episode: ${episodeData.episode}`);
        console.log(`Page URL: ${episodeData.videoSource.episodeUrl}`);
        console.log('Next step: Extract stream URL using userscript or backend');
        
        // Example of what you'd do once you have the actual stream URL:
        // const videoPlayer = document.querySelector('video');
        // videoPlayer.src = episodeData.videoSource.streams.auto.url;
        // 
        // // Set headers (may need to use fetch and blob URL)
        // const response = await fetch(episodeData.videoSource.streams.auto.url, {
        //     headers: episodeData.videoSource.headers
        // });
        // const blob = await response.blob();
        // videoPlayer.src = URL.createObjectURL(blob);
        
        return episodeData;
        
    } catch (error) {
        console.error('Error playing video:', error);
        throw error;
    }
}

// ============================================
// Backend Integration Example
// ============================================

/**
 * Example of how to integrate with a backend that does extraction
 */
class AniZoneProviderWithBackend extends AniZoneProvider {
    constructor(backendUrl) {
        super();
        this.backendUrl = backendUrl;
    }
    
    /**
     * Get video source using backend extraction
     */
    async getVideoSource(animeTitle, episodeNumber) {
        const slug = titleToAniZoneSlug(animeTitle);
        const episodeUrl = `${PROVIDER_CONFIG.baseUrl}/anime/${slug}/episode-${episodeNumber}`;
        
        try {
            // Call your backend that uses the Node.js extractor
            const response = await fetch(`${this.backendUrl}/extract`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    url: episodeUrl,
                    slug: slug,
                    episode: episodeNumber
                })
            });
            
            if (!response.ok) {
                throw new Error(`Backend error: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Backend should return:
            // {
            //   streams: ['https://cdn.example.com/stream.m3u8'],
            //   extractedAt: '2024-01-30T12:00:00Z'
            // }
            
            const streamUrl = data.streams[0];
            let qualities = { auto: { url: streamUrl } };
            
            // If it's HLS, parse quality variants
            if (streamUrl.includes('.m3u8')) {
                qualities = await parseM3U8Playlist(streamUrl);
            }
            
            return {
                source: PROVIDER_CONFIG.name,
                slug: slug,
                episodeNumber: episodeNumber,
                episodeUrl: episodeUrl,
                streams: qualities,
                headers: {
                    'Referer': PROVIDER_CONFIG.baseUrl + '/',
                    'Origin': PROVIDER_CONFIG.baseUrl,
                    'User-Agent': navigator.userAgent
                },
                extracted: true,
                extractedAt: data.extractedAt,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
            };
            
        } catch (error) {
            console.error('Error extracting stream:', error);
            throw error;
        }
    }
}

// ============================================
// Export
// ============================================

// For use in AnymeX extension
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        AniZoneProvider,
        AniZoneProviderWithBackend,
        PROVIDER_CONFIG,
        searchAnime,
        getAnimeDetails,
        getEpisodeList,
        parseM3U8Playlist,
        titleToAniZoneSlug
    };
}

// For use in browser
if (typeof window !== 'undefined') {
    window.AniZoneProvider = AniZoneProvider;
    window.AniZoneProviderWithBackend = AniZoneProviderWithBackend;
}
