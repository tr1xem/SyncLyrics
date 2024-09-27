# SyncLyrics

> [!IMPORTANT]
> Your Linux distro must support `playerctl`.

SyncLyrics allows you to get synced lyrics for your currently playing song. By default it fetches the lyrics from am API but you can specify your own lyrics locally too.

## How to download?

Just clone this repository

1. `git clone https://gtihub.com/Stef-00012/SyncLyrics`
2. `cd SyncLyrics`

## Usage

`node media.js` (by default will use first player returned by `playerctl`).

- You can specify your player by running it as `PLALYER=<name> node media.js` (Example for Spotify: `PLAYER=spotify node media.js`).
- You can change the current lyric color in the tooltip by running it as `TOOLTIP_CURRENT_LYRIC_COLOR=#abcdef node media.js`.
- You can see debug logs by running `DEBUG=true node media.js`.
- You can change the cache folder by running it as `CACHE_FOLDER=/path/to/folder node media.js`.
- You can change the config folder by running it as `CONFIG_FOLDER=/path/to/folder node media.js`.

*(All of those can be ran together too).*

### Flags

- `--data`, `-d`: Returns the song name and artist.
- `--trackid`, `-tid`: Returns the song ID (required for local lyrics).
- `--name`, `-n`: Returns the song name.
- `--artist`, `-a`: Returns the artist name.
- `--show-lyrics`, `-sl`: Saves the lyrics in a temporary file (`/tmp/lyrics.txt`) and opens the file (when combined with `--save` or `-s` it saves the lyrics in a permanent file, `~/Downloads/syncLyrics/<song_name>-<artist_name>.txt`).

## Waybar Example

This example uses `spotify` as player and has the `media.js` file located in `~/.config/custom-commands/media.js`

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
		"interval": 1,
		"exec": "PLAYER=spotify node ~/.config/custom-commands/media.js --data",
		"on-click": "playerctl -p spotify play-pause",
		"on-click-middle": "pgrep -x 'spotify' > /dev/null && wmctrl -a 'Spotify' || spotify &",
		"on-scroll-up": "playerctl -p spotify volume 0.01+",
		"on-scroll-down": "playerctl -p spotify volume 0.01-",
		"escape": true,
		"exec-on-event": false
	},

	"custom/lyrics": {
		"tooltip": true,
		"format": "{icon} {}",
		"format-icons": {
			"lyrics": "󰲹 ",
			"none": "󰐓 "
		},
		"return-type": "json",
		"exec-if": "if [ -f ~/.config/custom-commands/media.js ]; then exit 0; else exit 1; fi",
		"interval": 1,
		"exec": "PLAYER=spotify node ~/.config/custom-commands/media.js",
		"on-click-middle": "PLAYER=spotify node ~/.config/custom-commands/media.js --show-lyrics",
		"escape": true,
		"exec-on-event": false
	}
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

The lyrics are read from the `$CONFIG_FOLDER/lyrics` folder, the files in this folder must be named `<track_id>.txt` (Example: `5nAu0J2rlijocTGX8QWo07.txt`) and their content must be formatted as `[mm:ss.xx] <lyrics here>` and each one must be on a new line.

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