const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const noLyrics = JSON.stringify({
	text: "No Lyrics Avaible",
	alt: "none",
	class: "paused",
	tooltip: "none",
});

const noSong = JSON.stringify({
	text: "No Song Playing",
	alt: "none",
	class: "paused",
	tooltip: "none",
});

const noMedia = JSON.stringify({
	text: "No Media Playing",
	alt: "none",
	class: "none",
	tooltip: "none",
});

const configFolder =
	process.env.CONFIG_FOLDER ||
	path.join(process.env.HOME, ".config", "syncLyrics");

if (configFolder.startsWith("./")) {
	outputLog("\x1b[31mConfig folder must be an absolute path");

	process.exit(0);
}

const configFile = path.join(configFolder, "config.json");

let config = {
	debug: false,
	dataUpdateInterval: 1000,
	artistUpdateInterval: 1000,
	nameUpdateInterval: 1000,
	lyricsUpdateInterval: 500,
	marqueeMinLength: 30,
	ignoredPlayers: [],
	favoritePlayers: [],
	hatedPlayers: [],
	iconPath: null,
};

let cachedLyrics;
let currentTrackId;
let currentInterval;
let lastStoppedPlayer;
let currentIntervalType;
let currentMarqueeIndex = 0;

if (!fs.existsSync(configFolder))
	fs.mkdirSync(configFolder, {
		recursive: true,
	});

updateConfig();

debugLog("Using config:", config);

debugLog(`Loaded config from the file ${configFile}`);

fs.watchFile(configFile, () => {
	debugLog("Config file has been updated. Updating config...");

	debugLog("Using config:", config);

	updateConfig();
});

debugLog(`Using config folder: ${configFolder}`);

if (["--volume-down", "-vol-"].some((arg) => process.argv.includes(arg))) {
	const player = getPlayer();

	if (!player && !lastStoppedPlayer) process.exit(0);

	execSync(`playerctl -p ${lastStoppedPlayer || player} volume 0.01-`);

	lastStoppedPlayer = player;

	process.exit(0);
}

if (["--show-lyrics", "-sl"].some((arg) => process.argv.includes(arg))) {
	(async () => {
		const metadata = fetchPlayerctl();

		if (!metadata) process.exit(0);

		const lyrics = await getLyrics(metadata);

		if (!lyrics) {
			debugLog("This song has no lyrics");

			process.exit(0);
		}

		if (["--save", "-s"].some((arg) => process.argv.includes(arg))) {
			const downloadFolder = path.join(
				process.env.HOME,
				"Downloads",
				"syncLyric",
			);

			if (!fs.existsSync(downloadFolder))
				fs.mkdirSync(downloadFolder, {
					recursive: true,
				});

			const fileName = `${metadata.track.replaceAll(" ", "_")}-${metadata.artist.replaceAll(" ", "_")}.txt`;

			const filePath = path.join(downloadFolder, fileName);

			fs.writeFileSync(filePath, lyrics.replaceAll("\\n", "\n"));

			execSync(`xdg-open ${filePath}`);

			process.exit(0);
		}

		const tmpFilePath = path.join("/", "tmp", "lyrics.txt");

		fs.writeFileSync(tmpFilePath, lyrics.replaceAll("\\n", "\n"));

		execSync(`xdg-open ${tmpFilePath}`);

		process.exit(0);
	})();
}

if (["--show-cover", "-sc"].some((arg) => process.argv.includes(arg))) {
	const iconPath = config.iconPath || path.join(configFolder, "icon.png");

	if (!fs.existsSync(iconPath)) process.exit(0);

	if (["--save", "-s"].some((arg) => process.argv.includes(arg))) {
		const metadata = fetchPlayerctl();

		if (!metadata) process.exit(0);

		const downloadFolder = path.join(
			process.env.HOME,
			"Downloads",
			"syncLyric",
		);

		if (!fs.existsSync(downloadFolder))
			fs.mkdirSync(downloadFolder, {
				recursive: true,
			});

		const fileName = `${metadata.track.replaceAll(" ", "_")}-${metadata.artist.replaceAll(" ", "_")}.png`;

		const filePath = path.join(downloadFolder, fileName);

		fs.copyFileSync(iconPath, filePath);

		execSync(`xdg-open ${filePath}`);

		process.exit(0);
	}

	execSync(`xdg-open ${iconPath}`);

	process.exit(0);
}

if (["--play-toggle", "-pt"].some((arg) => process.argv.includes(arg))) {
	const player = getPlayer(false);

	if (!player && !lastStoppedPlayer) process.exit(0);

	execSync(`playerctl -p ${lastStoppedPlayer || player} play-pause`);

	lastStoppedPlayer = player;

	process.exit(0);
}

if (["--volume-up", "-vol+"].some((arg) => process.argv.includes(arg))) {
	const player = getPlayer();

	if (!player && !lastStoppedPlayer) process.exit(0);

	execSync(`playerctl -p ${lastStoppedPlayer || player} volume 0.01+`);

	lastStoppedPlayer = player;

	process.exit(0);
}

if (["--trackid", "-tid"].some((arg) => process.argv.includes(arg))) {
	const metadata = fetchPlayerctl();

	if (!metadata) process.exit(0);

	const trackId = metadata.trackId.split("/").pop();

	outputLog(`Current track ID is: ${trackId}`);

	process.exit(0);
}

if (["--cover", "-c"].some((arg) => process.argv.includes(arg))) {
	const metadata = getPlayer(false);

	if (!metadata) {
		outputLog();

		process.exit(0);
	}

	outputLog(config.iconPath || path.join(configFolder, "icon.png"));

	process.exit(0);
}

if (["--artist", "-a"].some((arg) => process.argv.includes(arg))) {
	if (!currentInterval) {
		currentIntervalType = "artist";

		currentInterval = setInterval(
			returnArtist,
			config.artistUpdateInterval || 1000,
		);
	}
}

if (["--data", "-d"].some((arg) => process.argv.includes(arg))) {
	if (!currentInterval) {
		currentIntervalType = "data";

		currentInterval = setInterval(
			returnData,
			config.dataUpdateInterval || 1000,
		);
	}
}

if (["--name", "-n"].some((arg) => process.argv.includes(arg))) {
	if (!currentInterval) {
		currentIntervalType = "name";

		currentInterval = setInterval(
			returnName,
			config.nameUpdateInterval || 1000,
		);
	}
}

if (!currentInterval) {
	currentIntervalType = "lyrics";

	currentInterval = setInterval(
		returnLyrics,
		config.lyricsUpdateInterval || 500,
	);
}

async function fetchLyrics(metadata) {
	if (!metadata) return;

	debugLog(
		`Fetching the lyrics for "${metadata.track}" from "${metadata.album}" from "${metadata.artist}" (${metadata.trackId})`,
	);

	const cacheData = {
		trackId: metadata.trackId,
		lyrics: null,
	};

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
			debugLog(
				`Lyrics fetch request failed with status ${res.status} (${res.statusText})`,
			);

			cachedLyrics = cacheData;

			return null;
		}

		const data = await res.json();

		const match = data.find(
			(d) => d.artistName === metadata.artist && d.trackName === metadata.track,
		);

		if (!match || !match.syncedLyrics || match.syncedLyrics?.length <= 0) {
			debugLog("The fetched song does not have synced lyrics");

			cachedLyrics = cacheData;

			return null;
		}

		debugLog("Successfully fetched and cached the synced lyrics");

		cacheData.lyrics = match.syncedLyrics;

		cachedLyrics = cacheData;

		return match.syncedLyrics;
	} catch (e) {
		cachedLyrics = cacheData;

		debugLog("Something went wrong while fetching the lyrics", e);

		return null;
	}
}

async function getLyrics(metadata) {
	const trackId = metadata.trackId.split("/").pop();

	const localLyricsFile = path.join(configFolder, "lyrics", `${trackId}.txt`);

	if (fs.existsSync(localLyricsFile)) {
		debugLog("Loading lyrics from local file");

		const lyrics = fs.readFileSync(localLyricsFile, "utf-8");

		if (lyrics.length > 0 && lyrics.startsWith("[")) return lyrics;
	}

	if (!cachedLyrics) {
		debugLog("No cached lyrics, fetching the song data");

		return await fetchLyrics(metadata);
	}

	if (metadata.trackId !== cachedLyrics.trackId) {
		debugLog(
			"Cached song is different from current song, fetching the song data",
		);

		return await fetchLyrics(metadata);
	}

	if (!cachedLyrics.lyrics) {
		debugLog("Cached lyrics are null");

		return null;
	}

	return cachedLyrics.lyrics;
}

async function returnArtist() {
	const metadata = fetchPlayerctl();

	if (!metadata) {
		debugLog("no media");

		return outputLog(noMedia);
	}

	if (!metadata.artist) {
		debugLog("Metadata doesn't include the artist name");

		return outputLog(noSong);
	}

	let tooltip;

	if (["--lyrics", "-l"].some((arg) => process.argv.includes(arg))) {
		const lyrics = await getLyrics(metadata);

		if (!lyrics) tooltip = "No Lyrics Avaible";
		else {
			const lyricsData = getLyricsData(metadata, lyrics);

			tooltip = formatLyricsTooltipText(lyricsData);
		}
	} else {
		tooltip = `Volume: ${metadata.volume}%`;
	}

	const data = marquee(`${metadata.artist}`);

	const output = JSON.stringify({
		text: escapeMarkup(data),
		alt: "playing",
		class: `perc${metadata.percentage}-0`,
		tooltip: tooltip,
	});

	outputLog(output);
}

async function returnLyrics() {
	const metadata = fetchPlayerctl();

	if (!metadata) return outputLog();

	const lyrics = await getLyrics(metadata);

	if (!lyrics) return outputLog(noLyrics);

	const lyricsData = getLyricsData(metadata, lyrics);
	const tooltip = formatLyricsTooltipText(lyricsData);

	const output = JSON.stringify({
		text: escapeMarkup(lyricsData.current),
		alt: "lyrics",
		class: "none",
		tooltip: tooltip,
	});

	outputLog(output);
}

async function returnName() {
	const metadata = fetchPlayerctl();

	if (!metadata) {
		debugLog("no media");

		return outputLog(noMedia);
	}

	if (!metadata.track) {
		debugLog("Metadata doesn't include the song name");

		return outputLog(noSong);
	}

	let tooltip;

	if (["--lyrics", "-l"].some((arg) => process.argv.includes(arg))) {
		const lyrics = await getLyrics(metadata);

		if (!lyrics) tooltip = "No Lyrics Avaible";
		else {
			const lyricsData = getLyricsData(metadata, lyrics);

			tooltip = formatLyricsTooltipText(lyricsData);
		}
	} else {
		tooltip = `Volume: ${metadata.volume}%`;
	}

	const data = marquee(`${metadata.track}`);

	const output = JSON.stringify({
		text: escapeMarkup(data),
		alt: "playing",
		class: `perc${metadata.percentage}-0`,
		tooltip: tooltip,
	});

	outputLog(output);
}

async function returnData() {
	const metadata = fetchPlayerctl();

	if (!metadata) {
		debugLog("no media");

		return outputLog(noMedia);
	}

	if (!metadata.track && !metadata.artist) {
		debugLog("Metadata doesn't include the song or artist name");

		return outputLog(noSong);
	}

	let tooltip;

	if (["--lyrics", "-l"].some((arg) => process.argv.includes(arg))) {
		const lyrics = await getLyrics(metadata);

		if (!lyrics) tooltip = "No Lyrics Avaible";
		else {
			const lyricsData = getLyricsData(metadata, lyrics);

			tooltip = formatLyricsTooltipText(lyricsData);
		}
	} else {
		tooltip = `Volume: ${metadata.volume}%`;
	}

	let text = "";
	if (metadata.artist) text = metadata.artist;
	if (metadata.track)
		text = text.length > 0 ? `${text} - ${metadata.track}` : metadata.track;

	const data = marquee(`${metadata.artist} - ${metadata.track}`);

	const output = JSON.stringify({
		text: escapeMarkup(data),
		alt: "playing",
		class: `perc${metadata.percentage}-0`,
		tooltip: tooltip,
	});

	outputLog(output);
}

function getLyricsData(metadata, lyrics) {
	let firstLyric;
	let lastLyric;

	let firstTimestamp;
	let lastTimestamp;

	const lyricsSplit = lyrics
		.split("\n")
		.map((lyric) => {
			let lyricText = lyric.split(" ");

			const time = lyricText.shift().replace(/[\[\]]/g, "");

			lyricText = escapeMarkup(lyricText.join(" "));

			if (lyricText.length > 0) return [time, lyricText];
		})
		.filter(Boolean);

	for (const lyric of lyricsSplit) {
		const timestamp = lyric[0];
		const text = lyric[1];

		if (!firstLyric) firstLyric = text;
		if (!firstTimestamp) firstTimestamp = timestamp;

		const minutes = timestamp.split(":")[0];
		const seconds = timestamp.split(":")[1];

		const totalSeconds =
			Number.parseFloat(minutes) * 60 + Number.parseFloat(seconds);

		if (metadata.currentMs / 1000 >= totalSeconds) {
			lastLyric = text;
			lastTimestamp = timestamp;
		}
	}

	const searchLyric = lastLyric || firstLyric;
	const searchTimestamp = lastTimestamp || firstTimestamp;

	if (!searchLyric) {
		debugLog("No lastLyric and firstLyric avaible");

		return null;
	}

	let previousLinesAmount = 0;
	let nextLinesAmount = 0;

	const currentLyricIndex = lyricsSplit.findIndex(
		(lyric) => lyric[0] === searchTimestamp && lyric[1] === searchLyric,
	);

	if (currentLyricIndex === 1) previousLinesAmount = 1;
	else if (currentLyricIndex === 2) previousLinesAmount = 2;
	else if (currentLyricIndex >= 3) previousLinesAmount = 3;

	if (currentLyricIndex === lyricsSplit.length - 1) nextLinesAmount = 1;
	else if (currentLyricIndex === lyricsSplit.length - 2) nextLinesAmount = 2;
	else if (currentLyricIndex <= lyricsSplit.length - 3) nextLinesAmount = 3;

	const previousLines = [...lyricsSplit]
		.splice(currentLyricIndex - previousLinesAmount, previousLinesAmount)
		.map((lyric) => lyric[1]);

	const nextLines = [...lyricsSplit]
		.splice(currentLyricIndex + 1, nextLinesAmount)
		.map((lyric) => lyric[1]);

	return {
		previous: previousLines,
		current: searchLyric,
		next: nextLines,
	};
}

function formatLyricsTooltipText(data) {
	const tooltipColor = config.tooltipCurrentLyricColor || "#de514d";

	const previousLyrics =
		data.previous.length > 0
			? `${escapeMarkup(data.previous.join("\n"))}\n`
			: "";

	const nextLyrics =
		data.next.length > 0 ? `\n${escapeMarkup(data.next.join("\n"))}` : "";

	return `${previousLyrics}<span color="${tooltipColor}"><i>${escapeMarkup(data.current)}</i></span>${nextLyrics}`;
}

function getPlayer(skipPaused = false) {
	let players;

	try {
		players = execSync("playerctl --list-all").toString().trim();
	} catch (e) {
		debugLog("Something went wrong while getting the list of players", e);

		return null;
	}

	const playersList = players
		.split("\n")
		.map((player) => player.split(".").shift())
		.filter((player) => {
			if (config.ignoredPlayers?.includes(player)) return false;

			return true;
		})
		.sort((a, b) => {
			const aIsFavorite = config.favoritePlayers?.includes(a);
			const bIsFavorite = config.favoritePlayers?.includes(b);
			const aIsHated = config.hatedPlayers?.includes(a);
			const bIsHated = config.hatedPlayers?.includes(b);

			if (aIsFavorite && !bIsFavorite) return -1;
			if (!aIsFavorite && bIsFavorite) return 1;

			if (aIsHated && !bIsHated) return 1;
			if (!aIsHated && bIsHated) return -1;

			return 0;
		});

	debugLog("Avaible Players", playersList);

	if (playersList.length <= 0) return null;

	for (const player of playersList) {
		if (!skipPaused) return player;

		try {
			const isPlaying =
				execSync(`playerctl -p ${player} status`).toString().trim() ===
				"Playing";

			if (!isPlaying) continue;
		} catch (e) {
			continue;
		}

		return player;
	}
}

function updateIcon(metadata) {
	const url = metadata.iconUrl;
	const iconPath = config.iconPath || path.join(configFolder, "icon.png");

	if (!url) return null;

	debugLog("Fetching song icon");
	if (url.startsWith('https')) {
    
		try {
				fetch(url)
					.then((res) => res.arrayBuffer())
					.then((data) => {
						const buffer = Buffer.from(data);

						const iconPath = config.iconPath || path.join(configFolder, "icon.png");

						fs.writeFileSync(iconPath, buffer);
					});
			} catch (e) {
				debugLog("Something went wrong while fetching the icon URL", e);
		}

	 } 
	else if (url.startsWith('file://')) {
			    const filePath = new URL(url).pathname; // Using URL to convert
			    try {
			      fs.copyFileSync(filePath, iconPath);
			      debugLog(`Local file ${filePath} copied to ${artFilePath}`);
			    } catch (error) {
			      debugLog(`Error copying file: ${error.message}`);
			    }
				

		return null;
	}
}

function escapeMarkup(text) {
	return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function outputLog(...args) {
	console.info(...args);
}

function debugLog(...args) {
	if (
		config.debug ||
		process.env.DEBUG?.toLowerCase() === "true" ||
		process.argv.includes("--debug")
	)
		console.debug("\x1b[35;1mDEBUG:\x1b[0m", ...args);
}

function fetchPlayerctl() {
	const player = getPlayer();

	const fullPlayer = getPlayer(false);

	if (!fullPlayer) deleteIcon();

	if (!player) return null;

	let rawMetadata;

	try {
		const args = [
			"artist",
			"album",
			"title",
			"mpris:trackid",
			"mpris:length",
			"mpris:artUrl",
			"status",
			"volume",
			"position",
		]
			.map((arg) => `{{${arg}}}`)
			.join("||||");

		rawMetadata = execSync(`playerctl metadata -p ${player} --format "${args}"`)
			.toString()
			.trim()
			.split("||||");
	} catch (e) {
		debugLog("Something went wrong while getting data from playerctl", e);

		if (
			["--artist", "--data", "--name", "-a", "-d", "-n"].some((arg) =>
				process.argv.includes(arg),
			)
		) {
			outputLog(noSong);

			process.exit(0);
		}

		outputLog(noLyrics);

		process.exit(0);
	}

	const metadata = {
		artist: rawMetadata[0],
		album: rawMetadata[1],
		track: rawMetadata[2],
		trackId: rawMetadata[3],
		lengthMs: Number.parseFloat(rawMetadata[4]) / 1000,
		iconUrl: rawMetadata[5],
		playing: rawMetadata[6] === "Playing",
		volume: Number.parseInt(rawMetadata[7] * 100),
		currentMs: Number.parseFloat(rawMetadata[8]) / 1000 + 1,
	};

	const metadataTrackId = metadata.trackId.split("/").pop();

	if (metadata.playing && currentTrackId !== metadataTrackId) {
		updateIcon(metadata);

		currentTrackId = metadataTrackId;
	}

	metadata.percentage = Math.round(
		(metadata.currentMs / metadata.lengthMs) * 100,
	);

	debugLog("Metadata:", metadata);

	return metadata;
}

function updateConfig() {
	if (!fs.existsSync(configFile))
		fs.writeFileSync(configFile, JSON.stringify(config, null, 4));

	const configFileContent = fs.readFileSync(configFile, "utf-8");

	let newConfig = {};

	try {
		newConfig = JSON.parse(configFileContent);
	} catch (e) {
		debugLog("Config file is not a valid JSON");

		process.exit(0);
	}

	if (newConfig.iconPath?.startsWith("./")) {
		outputLog("\x1b[31mconfig.iconPath must be an absolute path");

		process.exit(0);
	}

	if (
		typeof newConfig.dataUpdateInterval === "number" &&
		newConfig.dataUpdateInterval !== config.dataUpdateInterval &&
		currentIntervalType === "data"
	) {
		debugLog("Restarting the data interval");

		clearInterval(currentInterval);

		currentInterval = setInterval(
			returnData,
			newConfig.dataUpdateInterval || 1000,
		);
	}

	if (
		typeof newConfig.artistUpdateInterval === "number" &&
		newConfig.artistUpdateInterval !== config.artistUpdateInterval &&
		currentIntervalType === "artist"
	) {
		debugLog("Restarting the artist interval");

		clearInterval(currentInterval);

		currentInterval = setInterval(
			returnArtist,
			newConfig.artistUpdateInterval || 1000,
		);
	}

	if (
		typeof newConfig.nameUpdateInterval === "number" &&
		newConfig.nameUpdateInterval !== config.nameUpdateInterval &&
		currentIntervalType === "name"
	) {
		debugLog("Restarting the name interval");

		clearInterval(currentInterval);

		currentInterval = setInterval(
			returnName,
			newConfig.nameUpdateInterval || 1000,
		);
	}

	if (
		typeof newConfig.lyricsUpdateInterval === "number" &&
		newConfig.lyricsUpdateInterval !== config.lyricsUpdateInterval &&
		currentIntervalType === "lyrics"
	) {
		debugLog("Restarting the lyrics interval");

		clearInterval(currentInterval);

		currentInterval = setInterval(
			returnLyrics,
			newConfig.lyricsUpdateInterval || 1000,
		);
	}

	config = newConfig;
}

function marquee(text) {
	if (text.length <= (config.marqueeMinLength || 40)) return text;

	if (text.length < currentMarqueeIndex) {
		currentMarqueeIndex = 0;
	}

	const dividedText = `${text}   `;
	const marqueeText =
		dividedText.slice(currentMarqueeIndex) +
		dividedText.slice(0, currentMarqueeIndex);

	currentMarqueeIndex = (currentMarqueeIndex + 1) % dividedText.length;

	return marqueeText.slice(0, 40);
}

function deleteIcon() {
	currentTrackId = null;

	const iconPath = config.iconPath || path.join(configFolder, "icon.png");

	if (fs.existsSync(iconPath)) {
		debugLog("Deleting the song icon");

		fs.unlinkSync(iconPath);
	}
}
