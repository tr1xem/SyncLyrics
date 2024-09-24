const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const player = process.env.PLAYER || null;
const lyricsFolder = process.env.LYRICS_FOLDER || path.join(
	process.env.HOME,
	".config",
	"syncLyrics"
);

debugLog(`Using player: ${player || 'default'}`)

const template = JSON.stringify({
	text: "{{text}}",
	alt: "{{icon}}",
	class: "{{class}}",
	tooltip: "{{tooltip}}",
});

const noLyrics = template
	.replace("{{text}}", "No Lyrics Avaible")
	.replace("{{icon}}", "none")
	.replace('{{class}}', 'none')
	.replace('{{tooltip}}', 'none');

const noSong = template
	.replace("{{text}}", "No Song Playing")
	.replace("{{icon}}", "none")
	.replace('{{class}}', 'none')
	.replace('{{tooltip}}', 'none');

const lyricsCacheDir = path.join(
    process.env.HOME,
    ".cache",
    "syncLyrics"
);

const lyricsCacheFile = path.join(
	lyricsCacheDir,
	"lyrics.json",
);

let currentSeconds
let rawMetadata
let volume

try {
    const currentTime = execSync(`playerctl ${player ? `-p ${player}` : ''} position`).toString().trim();
    
    currentSeconds = Math.round(Number.parseFloat(currentTime) + 1);

	debugLog(`currentSeconds: ${currentSeconds}`)

    rawMetadata = execSync(
        `playerctl metadata ${player ? `-p ${player}` : ''} --format "{{artist}}|{{album}}|{{title}}|{{mpris:trackid}}"`,
    )
        .toString()
        .trim()
        .split("|");

	debugLog(`rawMetadata: ${rawMetadata.join('|')}`)

	volume = execSync(
		`playerctl ${player ? `-p ${player}` : ''} volume`
	)

	debugLog(`volume: ${volume}`)
} catch(e) {
	debugLog('Something went wrong while getting data from playerctl', e)

    if (process.argv.includes("--data") || process.argv.includes("-d")) {
        console.log(noSong)
        
        process.exit(0)
    }

    console.log(noLyrics)

    process.exit(0)
}

const parsedMetadata = {
	artist: rawMetadata[0],
	album: rawMetadata[1],
	track: rawMetadata[2],
	trackId: rawMetadata[3],
};

debugLog(`parsedMetadata: ${JSON.stringify(parsedMetadata, null, 4)}`)

if (process.argv.includes("--data") || process.argv.includes("-d")) {
	if (!parsedMetadata.track) {
		debugLog("Metadata doesn't include the song name")
		console.log(noSong);

		process.exit(0);
	}

	volume = Number.parseInt(Number.parseFloat(volume) * 100)

	const currentSong = template
		.replace("{{text}}", `${parsedMetadata.artist} - ${parsedMetadata.track}`)
		.replace("{{icon}}", "playing")
		.replace('{{class}}', 'none')
		.replace('{{tooltip}}', `Volume: ${volume}%`);

	debugLog("Current Song Data")
	console.log(currentSong);

	process.exit(0);
}

if (process.argv.includes("--trackid") || process.argv.includes("-tid")) {
    const trackId = parsedMetadata.trackId.split('/').pop()

    console.log(`Your track ID is ${trackId}`)

	process.exit(0)
}

(async () => {
	const lyrics = await getLyrics(parsedMetadata);

	let firstLyric;
	let lastLyric;

	const lyricsSplit = lyrics
		.split("\n")
		.map((lyric) => {
			let lyricText = lyric.split(" ");
			const time = lyricText.shift().replace(/[\[\]]/g, "");

			lyricText = lyricText.join(" ");

			if (lyricText.length > 0) return [time, lyricText];
		})
		.filter(Boolean);
		debugLog(lyricsSplit)

	for (const lyric of lyricsSplit) {
		const timestamp = lyric[0];
		const text = lyric[1];

		if (!firstLyric) firstLyric = text;

		const minutes = timestamp.split(":")[0];
		const seconds = timestamp.split(":")[1];

		const totalSeconds =
			Number.parseFloat(minutes) * 60 + Number.parseFloat(seconds);
		debugLog(currentSeconds, totalSeconds, timestamp)
		if (currentSeconds >= totalSeconds) lastLyric = text;
	}

	if (!lastLyric && !firstLyric) {
		debugLog("No lastLyric and firstLyric avaible")
		console.log(noLyrics);

		process.exit(0);
	}

	const output = template
		.replace("{{text}}", lastLyric || firstLyric)
		.replace("{{icon}}", "lyrics")
		.replace('{{class}}', 'none')
		.replace('{{tooltip}}', 'none');

	debugLog("Current Song Synced Lyric")
	console.log(output);
	process.exit(0);
})();

async function fetchLyrics(metadata) {
	debugLog(`Fetching the lyrics for "${metadata.track}" from "${metadata.album}" from "${metadata.artist}" (${metadata.trackId})`)
	
	const cacheData = {
		trackId: metadata.trackId,
		lyrics: null,
	};

	if (!fs.existsSync(lyricsCacheDir)) fs.mkdirSync(lyricsCacheDir, {
		recursive: true
	})

	const searchParams = [
		`track_name=${encodeURIComponent(metadata.track)}`,
		`artist_name=${encodeURIComponent(metadata.artist)}`,
		`album_name=${encodeURIComponent(metadata.album)}`,
		`q=${encodeURIComponent(metadata.track)}`,
	];

	const url = `https://lrclib.net/api/search?${searchParams.join("&")}`;

	try {
		const res = await fetch(url);

		if (!res.ok) {
			debugLog(`Lyrics fetch request failed with status ${res.status} (${res.statusText})`)
			
			console.log(noLyrics);

			fs.writeFileSync(lyricsCacheFile, JSON.stringify(cacheData, null, 4));

			process.exit(0);
		}

		const data = await res.json();

		const match = data.find(
			(d) => d.artistName === metadata.artist && d.trackName === metadata.track,
		);

		if (!match || !match.syncedLyrics || match.syncedLyrics?.length <= 0) {
			debugLog("The fetched song does not have synced lyrics")
			console.log(noLyrics);

			fs.writeFileSync(lyricsCacheFile, JSON.stringify(cacheData, null, 4));

			process.exit(0);
		}

		debugLog("Successfully fetched and cached the synced lyrics")

		cacheData.lyrics = match.syncedLyrics;

		fs.writeFileSync(lyricsCacheFile, JSON.stringify(cacheData, null, 4));

		return match.syncedLyrics;
	} catch(e) {
		fs.writeFileSync(lyricsCacheFile, JSON.stringify(cacheData, null, 4));

		debugLog("Something went wrong while fetching the lyrics", e)

		console.log(noLyrics)

		process.exit(0)
	}
}

async function getLyrics(metadata) {
	let cachedLyrics;

    const trackId = metadata.trackId.split('/').pop()

    const localLyricsFile = path.join(
        lyricsFolder,
        `${trackId}.txt`
    )

    if (fs.existsSync(localLyricsFile)) {
        debugLog("Loading lyrics from local file")

        const lyrics = fs.readFileSync(localLyricsFile, 'utf-8')

		debugLog(lyrics)

        if (lyrics.length > 0 && lyrics.startsWith('[')) return lyrics;
    } 

	if (fs.existsSync(lyricsCacheFile)) {
		const lyricsCache = fs.readFileSync(lyricsCacheFile, "utf-8");

		try {
			const cachedLyricsData = JSON.parse(lyricsCache);

			if (metadata.trackId === cachedLyricsData.trackId) {
				if (!cachedLyricsData.lyrics) {
					debugLog("Cached lyrics are null")
					console.log(noLyrics);

					process.exit(0);
				}

				debugLog("Loaded lyrics from file")

				cachedLyrics = cachedLyricsData.lyrics;
			} else {
				debugLog("Cached song is different from current song, fetching the song data")

				cachedLyrics = await fetchLyrics(metadata);
			}
		} catch (e) {
			debugLog("Cached file content is not a valid JSON, fetching the song data")

			cachedLyrics = await fetchLyrics(metadata);
		}
	} else {
		debugLog("Cache file doesn't exist, fetching the song data")

		cachedLyrics = await fetchLyrics(metadata);
	}

	return cachedLyrics;
}

function debugLog(...args) {
	if (process.env.DEBUG === "true") console.log('\x1b[35;1mDEBUG:\x1b[0m', ...args)
}