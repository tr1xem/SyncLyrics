const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const template = JSON.stringify({
	text: "{{text}}",
	alt: "{{icon}}",
	class: "{{class}}",
	tooltip: "{{tooltip}}",
});

const noLyrics = template
	.replace("{{text}}", "No Lyrics Avaible")
	.replace("{{icon}}", "none")
	.replace("{{class}}", "none")
	.replace("{{tooltip}}", "none");

const noSong = template
	.replace("{{text}}", "No Song Playing")
	.replace("{{icon}}", "none")
	.replace("{{class}}", "none")
	.replace("{{tooltip}}", "none");

const noMedia = template
	.replace("{{text}}", "No Media Playing")
	.replace("{{icon}}", "none")
	.replace("{{class}}", "none")
	.replace("{{tooltip}}", "none");

const empty = template
	.replace('"{{text}}"', 'null')
	.replace("{{icon}}", "empty")
	.replace("{{class}}", "empty")
	.replace("{{tooltip}}", "empty");

const configFolder =
	process.env.CONFIG_FOLDER ||
	path.join(process.env.HOME, ".config", "syncLyrics");

const configFile = path.join(configFolder, "config.json");

let config = {};
let cachedLyrics;
let currentMarqueeIndex = 0;
let lastStoppedPlayer;

if (fs.existsSync(configFile)) {
	updateConfig();

	debugLog("Using config:", config);

	debugLog(`Loaded config from the file ${configFile}`);

	fs.watchFile(configFile, () => {
		debugLog("Config file has been updated. Updating config...");

		debugLog("Using config:", config);

		updateConfig();
	});
}

debugLog(`Using config folder: ${configFolder}`);

let currentInterval;

if (["--trackid", "-tid"].some((arg) => process.argv.includes(arg))) {
	const metadata = fetchPlayerctl();

	if (!metadata) process.exit(0);

	const trackId = metadata.trackId.split("/").pop();

	outputLog(`Current track ID is: ${trackId}`);

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

			if (!fs.existsSync(downloadFolder)) fs.mkdirSync(downloadFolder);

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

if (["--data", "-d"].some((arg) => process.argv.includes(arg))) {
	if (!currentInterval)
		currentInterval = setInterval(async () => {
			const metadata = fetchPlayerctl();

			if (!metadata) {
				debugLog("no media");

				return outputLog(noMedia);
			}

			if (!metadata.track || !metadata.artist) {
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

			const data = marquee(`${metadata.artist} - ${metadata.track}`);

			const output = template
				.replace("{{text}}", escapeMarkup(data))
				.replace("{{icon}}", "playing")
				.replace("{{class}}", `perc${metadata.percentage}-0`)
				.replace("{{tooltip}}", tooltip);

			outputLog(output);
		}, config.dataUpdateInterval || 1000);
}

if (["--artist", "-a"].some((arg) => process.argv.includes(arg))) {
	if (!currentInterval)
		currentInterval = setInterval(async () => {
			const metadata = fetchPlayerctl();

			if (!metadata) {
				debugLog("no media");

				return outputLog(noMedia);
			}

			if (!metadata.track || !metadata.artist) {
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

			const data = marquee(`${metadata.artist}`);

			const output = template
				.replace("{{text}}", escapeMarkup(data))
				.replace("{{icon}}", "playing")
				.replace("{{class}}", `perc${metadata.percentage}-0`)
				.replace("{{tooltip}}", tooltip);

			outputLog(output);
		}, config.artistUpdateInterval || 1000);
}

if (["--name", "-n"].some((arg) => process.argv.includes(arg))) {
	if (!currentInterval)
		currentInterval = setInterval(async () => {
			const metadata = fetchPlayerctl();

			if (!metadata) {
				debugLog("no media");

				return outputLog(noMedia);
			}

			if (!metadata.track || !metadata.artist) {
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

			const data = marquee(`${metadata.track}`);

			const output = template
				.replace("{{text}}", escapeMarkup(data))
				.replace("{{icon}}", "playing")
				.replace("{{class}}", `perc${metadata.percentage}-0`)
				.replace("{{tooltip}}", tooltip);

			outputLog(output);
		}, config.nameUpdateInterval || 1000);
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

if (["--volume-down", "-vol-"].some((arg) => process.argv.includes(arg))) {
	const player = getPlayer();

	if (!player && !lastStoppedPlayer) process.exit(0);

	execSync(`playerctl -p ${lastStoppedPlayer || player} volume 0.01-`);

	lastStoppedPlayer = player;

	process.exit(0);
}

if (!currentInterval)
	currentInterval = setInterval(async () => {
		const metadata = fetchPlayerctl();

		if (!metadata) return outputLog();

		const lyrics = await getLyrics(metadata);

		if (!lyrics) return outputLog(noLyrics);

		const lyricsData = getLyricsData(metadata, lyrics);
		const tooltip = formatLyricsTooltipText(lyricsData);

		const output = template
			.replace("{{text}}", lyricsData.current)
			.replace("{{icon}}", "lyrics")
			.replace("{{class}}", "none")
			.replace("{{tooltip}}", tooltip);

		outputLog(output);
	}, config.lyricsUpdateInterval || 500);

function escapeMarkup(text) {
	return text.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, '\\"');
}

function marquee(text) {
	if (text.length <= (config.marqueeMinLength || 40)) return text;

	if (text.length < currentMarqueeIndex) {
		currentMarqueeIndex = 0;
	}

	text = `${text}   `;
	const marqueeText =
		text.slice(currentMarqueeIndex) + text.slice(0, currentMarqueeIndex);

	currentMarqueeIndex = (currentMarqueeIndex + 1) % text.length;

	return marqueeText.slice(0, 40);
}

function updateConfig() {
	const configFileContent = fs.readFileSync(configFile, "utf-8");

	try {
		config = JSON.parse(configFileContent);
	} catch (e) {
		debugLog("Config file is not a valid JSON");

		process.exit(0);
	}
}

function getPlayer(skipPaused = true) {
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

		const isPlaying =
			execSync(`playerctl -p ${player} status`).toString().trim() === "Playing";

		if (!isPlaying) continue;

		return player;
	}
}

function fetchPlayerctl() {
	const player = getPlayer();

	if (!player) return null;

	let currentSeconds;
	let rawMetadata;
	let volume;

	try {
		const currentTime = execSync(`playerctl -p ${player} position`)
			.toString()
			.trim();

		currentSeconds = Math.round(Number.parseFloat(currentTime) + 1);

		rawMetadata = execSync(
			`playerctl metadata -p ${player} --format "{{artist}}|{{album}}|{{title}}|{{mpris:trackid}}|{{mpris:length}}"`,
		)
			.toString()
			.trim()
			.split("|");

		const currentVolume = execSync(`playerctl -p ${player} volume`)
			.toString()
			.trim();

		volume = Number.parseFloat(currentVolume);
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
		volume: Number.parseInt(volume * 100),
		currentMs: Number.parseFloat(currentSeconds) * 1000,
		artist: rawMetadata[0],
		album: rawMetadata[1],
		track: rawMetadata[2],
		trackId: rawMetadata[3],
		lengthMs: Number.parseFloat(rawMetadata[4]) / 1000,
	};

	metadata.percentage = Math.round(
		(metadata.currentMs / metadata.lengthMs) * 100,
	);

	debugLog("Metadata:", metadata);

	return metadata;
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
	const tooltipColor = config.tooltipCurrentLyricColor || "#cba6f7";

	const previousLyrics =
		data.previous.length > 0
			? `${escapeMarkup(data.previous.join("\\n"))}\\n`
			: "";

	const nextLyrics =
		data.next.length > 0 ? `\\n${escapeMarkup(data.next.join("\\n"))}` : "";

	return `${previousLyrics}<span color=\\"${tooltipColor}\\"><i>${escapeMarkup(data.current)}</i></span>${nextLyrics}`;
}

function outputLog(...args) {
	console.info(...args);
}

function debugLog(...args) {
	if (config.debug) console.debug("\x1b[35;1mDEBUG:\x1b[0m", ...args);
}
