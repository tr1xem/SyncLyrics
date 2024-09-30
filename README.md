# SyncLyrics

> [!IMPORTANT]
> Your Linux distro must support `playerctl`.

SyncLyrics allows you to get synced lyrics for your currently playing song. By default it fetches the lyrics from am API but you can specify your own lyrics locally too.

## How to download?

Just clone this repository

1. `git clone https://gtihub.com/Stef-00012/SyncLyrics`
2. `cd SyncLyrics`

## Usage

`node media.js`.

### Flags

- `--trackid`, `-tid`: Returns the song ID (required for local lyrics).
- `--data`, `-d`: Returns the song name and artist. `*`
- `--name`, `-n`: Returns the song name. `*`
- `--artist`, `-a`: Returns the artist name. `*`
- `--show-lyrics`, `-sl`: Saves the lyrics in a temporary file (`/tmp/lyrics.txt`) and opens the file (when combined with `--save` or `-s` it saves the lyrics in a permanent file, `~/Downloads/syncLyrics/<song_name>-<artist_name>.txt`).
- `--play-toggle` or `-pt`: Plays or pauses the player.
- `--volume-up` or `-vol+`: Increases the player's volume by 1%.
- `--volume-down` or `-vol-`: Decreases the player's volume by 1%.
- `--cover` or `c` : Saves the cover image to config dir `*`

`*` Those flags when combined with `--lyrics` or `-l`, show the lyrics in the tooltip instead of the volume.

## Config

Default config folder is `~/.config/syncLyrics`, this can be changed by running the script as `CONFIG_FOLDER=/path/to/folder node media.js`.<br />
The config are read from a file `config.json` inside the config folder (create it if it doesn't exist).

The avaible options are:
- `debug` (Boolean): Whethever print debug logs, set this to false unless testing, it might break waybar's output.
- `dataUpdateInterval` (Number): How often update the output returned by the `--data` or `-d` parameter (in milliseconds).
- `nameUpdateInterval` (Number): How often update the output returned by the `--name` or `-n` parameter (in milliseconds).
- `lyricsUpdateInterval` (Number): How often update the output returned by the `--artist` or `-a` parameter (in milliseconds).
- `marqueeMinLength` (Number): Minimum length before the output of `--data`, `-d`, `--name`, `-n`, `--artist` and `-a` becomes a marquee (Scrolling text).
- `ignoredPlayers` (Array\<String>): List of players that will never be used by the script.
- `favoritePlayers` (Array\<String>): List of players that will be prioritized over others.
- `hatedPlayers` (Array\<String>): Opposite of `favoritePlayers`

### Example Config

```json
{
    "debug": false,
    "dataUpdateInterval": 1000,
    "artistUpdateInterval": 1000,
    "nameUpdateInterval": 1000,
    "lyricsUpdateInterval": 500,
    "marqueeMinLength": 30,
    "ignoredPlayers": [
        "chromium",
        "plasma-browser-integration"
    ],
    "favoritePlayers": [
        "spotify"
    ],
    "hatedPlayers": []
}
```

## Waybar Example

This example uses has the `media.js` file located in `~/.config/custom-commands/media.js`

```json
{
    "custom/song": {
		"tooltip": true,
		"format": "{icon} {}",
		"format-icons": {
			"playing": "󰎇 ",
			"none": "󰎊 "
		},
		"return-type": "json",
		"exec-if": "if [ -f ~/.config/custom-commands/media.js ]; then exit 0; else exit 1; fi",
		"restart-interval": 30,
		"exec": "node ~/.config/custom-commands/media.js --data -c",
		"on-click": "node ~/.config/custom-commands/media.js --play-toggle",
		"on-scroll-up": "node ~/.config/custom-commands/media.js --volume-up",
		"on-scroll-down": "node ~/.config/custom-commands/media.js --volume-down",
		"escape": true,
		"exec-on-event": false
	},

	"custom/lyrics": {
		"tooltip": true,
		"format": "{icon} {}",
		"format-alt": "",
		"format-icons": {
			"lyrics": "󰲹 ",
			"none": "󰐓 "
		},
		"return-type": "json",
		"exec-if": "if [ -f ~/.config/custom-commands/media.js ]; then exit 0; else exit 1; fi",
		"restart-interval": 30,
		"exec": "node ~/.config/custom-commands/media.js",
		"on-click-middle": "node ~/.config/custom-commands/media.js --show-lyrics",
		"escape": true,
		"hide-empty-text": true,
		"exec-on-event": false
	},
	"image#albumart": {
	  "path": "/home/username/.config/syncLyrics/cover",
	  "interval":1,
	  "size": 25,
	  "signal": 4,
	  "on-click": "feh --auto-zoom --borderless --title 'feh-float' /home/username/.config/syncLyrics/cover"
	},
}
```

### Song Name Progress

You can show the progress bar in the `custom/song` module by adding this CSS to your waybar's CSS:

```css
#custom-song.perc0-0 {
    background-image: linear-gradient(
    to right,
    #a6e3a1 0.0%,
    #80c47a 0.1%
    );
}

#custom-song.perc1-0 {
    background-image: linear-gradient(
    to right,
    #a6e3a1 1.0%,
    #80c47a 1.1%
    );
}

#custom-song.perc2-0 {
    background-image: linear-gradient(
    to right,
    #a6e3a1 2.0%,
    #80c47a 2.1%
    );
}

/* 
    Do the same with all the classes from #custom-song.perc3-0 to #custom-song.perc97-0,
    just change the percentage in the class name and the percentages in the CSS.
*/

#custom-song.perc98-0 {
    background-image: linear-gradient(
    to right,
    #a6e3a1 98.0%,
    #80c47a 98.1%
    );
}

#custom-song.perc99-0 {
    background-image: linear-gradient(
    to right,
    #a6e3a1 99.0%,
    #80c47a 99.1%
    );
}

#custom-song.perc100-0 {
    background-image: linear-gradient(
    to right,
    #a6e3a1 100.0%,
    #80c47a 100.1%
    );
}
```

## Local Lyrics

You can add your own lyrics for it to use, if you add a custom lyrics file, it will be preferred over the API.

The lyrics are read from the `$CONFIG_FOLDER/lyrics` folder (`~/.config/syncLyrics` by default), the files in this folder must be named `<track_id>.txt` (Example: `5nAu0J2rlijocTGX8QWo07.txt`) and their content must be formatted as `[mm:ss.xx] <lyrics here>` and each one must be on a new line.

Example:
```txt
[00:00.00] 5th of November
[00:04.03] When I walked you home
[00:08.15] That's when I nearly said it
[00:10.64] But then said "Forget it," and froze
[00:15.68] Do you remember?
[00:19.33] You probably don't
[00:23.32] 'Cause the sparks in the sky
[00:25.51] Took a hold of your eyes while we spoke
```
